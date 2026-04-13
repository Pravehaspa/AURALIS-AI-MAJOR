/**
 * Redis-backed rate limiter with in-memory fallback.
 * Uses Upstash Redis for distributed deployments.
 */

import { getRedisClient } from "@/lib/redis"

interface RateLimitEntry {
  count: number
  resetTime: number
  blockedUntil?: number
}

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10
const INITIAL_BACKOFF = 5 * 1000 // 5 seconds
const MAX_BACKOFF = 5 * 60 * 1000 // 5 minutes
const VIOLATION_TTL_SECONDS = 60 * 60 // 1 hour

// In-memory store - in production, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now && !entry.blockedUntil) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitCheck {
  allowed: boolean
  remaining: number
  resetIn: number // milliseconds
  blockedUntil?: number // unix timestamp
}

/**
 * Check if request is allowed under rate limit
 * Returns exponential backoff blocking if quota exceeded
 */
export async function checkRateLimit(sessionId: string): Promise<RateLimitCheck> {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const countKey = `rl:count:${sessionId}`
    const blockedKey = `rl:blocked:${sessionId}`
    const violationsKey = `rl:violations:${sessionId}`

    const blockedUntil = await redis.get<number>(blockedKey)
    if (blockedUntil && blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: blockedUntil - now,
        blockedUntil,
      }
    }

    const count = await redis.incr(countKey)
    if (count === 1) {
      await redis.expire(countKey, Math.ceil(RATE_LIMIT_WINDOW / 1000))
    }

    if (count > MAX_REQUESTS_PER_WINDOW) {
      const violations = await redis.incr(violationsKey)
      if (violations === 1) {
        await redis.expire(violationsKey, VIOLATION_TTL_SECONDS)
      }

      const backoffDuration = Math.min(INITIAL_BACKOFF * Math.pow(2, violations - 1), MAX_BACKOFF)
      const nextBlockedUntil = now + backoffDuration

      await redis.set(blockedKey, nextBlockedUntil, {
        ex: Math.ceil(backoffDuration / 1000),
      })

      return {
        allowed: false,
        remaining: 0,
        resetIn: backoffDuration,
        blockedUntil: nextBlockedUntil,
      }
    }

    const ttlSeconds = await redis.ttl(countKey)
    return {
      allowed: true,
      remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - count),
      resetIn: ttlSeconds > 0 ? ttlSeconds * 1000 : RATE_LIMIT_WINDOW,
    }
  }

  const now = Date.now()
  const entry = rateLimitStore.get(sessionId) || {
    count: 0,
    resetTime: now + RATE_LIMIT_WINDOW,
  }

  // Check if currently in backoff period
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.blockedUntil - now,
      blockedUntil: entry.blockedUntil,
    }
  }

  // Reset window if expired
  if (entry.resetTime < now) {
    entry.count = 0
    entry.resetTime = now + RATE_LIMIT_WINDOW
    entry.blockedUntil = undefined
  }

  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count)
  const resetIn = Math.max(0, entry.resetTime - now)

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    // Activate exponential backoff
    const failureCount = Math.floor(entry.count / MAX_REQUESTS_PER_WINDOW)
    const backoffDuration = Math.min(
      INITIAL_BACKOFF * Math.pow(2, failureCount - 1),
      MAX_BACKOFF
    )
    entry.blockedUntil = now + backoffDuration

    rateLimitStore.set(sessionId, entry)

    return {
      allowed: false,
      remaining: 0,
      resetIn: backoffDuration,
      blockedUntil: entry.blockedUntil,
    }
  }

  entry.count++
  rateLimitStore.set(sessionId, entry)

  return {
    allowed: true,
    remaining: remaining - 1,
    resetIn,
  }
}

/**
 * Reset rate limit for a session (e.g., after auth failure)
 */
export function resetRateLimit(sessionId: string): void {
  const redis = getRedisClient()
  if (redis) {
    void redis.del(`rl:count:${sessionId}`, `rl:blocked:${sessionId}`, `rl:violations:${sessionId}`)
    return
  }

  rateLimitStore.delete(sessionId)
}

/**
 * Get current rate limit status without incrementing counter
 */
export async function getRateLimitStatus(sessionId: string): Promise<RateLimitCheck> {
  const redis = getRedisClient()
  if (redis) {
    const now = Date.now()
    const countKey = `rl:count:${sessionId}`
    const blockedKey = `rl:blocked:${sessionId}`

    const blockedUntil = await redis.get<number>(blockedKey)
    if (blockedUntil && blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: blockedUntil - now,
        blockedUntil,
      }
    }

    const [countRaw, ttlSeconds] = await Promise.all([redis.get<number>(countKey), redis.ttl(countKey)])
    const count = Number(countRaw || 0)

    return {
      allowed: count < MAX_REQUESTS_PER_WINDOW,
      remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - count),
      resetIn: ttlSeconds > 0 ? ttlSeconds * 1000 : 0,
    }
  }

  const now = Date.now()
  const entry = rateLimitStore.get(sessionId)

  if (!entry) {
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW,
      resetIn: 0,
    }
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.blockedUntil - now,
      blockedUntil: entry.blockedUntil,
    }
  }

  const resetIn = Math.max(0, entry.resetTime - now)
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count)

  return {
    allowed: remaining > 0,
    remaining,
    resetIn,
  }
}

