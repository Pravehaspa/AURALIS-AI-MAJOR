import { getRedisClient } from "@/lib/redis"

const SECURITY_EVENT_TYPES = [
  "domain_blocked",
  "rate_limited",
  "auth_error",
  "model_error",
  "invalid_request",
  "request_success",
] as const

type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number]

type CounterMap = Record<SecurityEventType, number>

const memoryTotals: CounterMap = {
  domain_blocked: 0,
  rate_limited: 0,
  auth_error: 0,
  model_error: 0,
  invalid_request: 0,
  request_success: 0,
}

const memoryLastHour: CounterMap = {
  domain_blocked: 0,
  rate_limited: 0,
  auth_error: 0,
  model_error: 0,
  invalid_request: 0,
  request_success: 0,
}

const hourStartMs = Date.now()

function getCurrentHourBucket(now: Date): string {
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(now.getUTCDate()).padStart(2, "0")
  const hh = String(now.getUTCHours()).padStart(2, "0")
  return `${yyyy}${mm}${dd}${hh}`
}

function isSecurityEventType(value: string): value is SecurityEventType {
  return SECURITY_EVENT_TYPES.includes(value as SecurityEventType)
}

export async function incrementSecurityCounter(eventType: string): Promise<void> {
  if (!isSecurityEventType(eventType)) {
    return
  }

  const redis = getRedisClient()
  const now = new Date()
  const hourBucket = getCurrentHourBucket(now)

  if (redis) {
    const totalsKey = "monitor:totals"
    const hourKey = `monitor:hour:${hourBucket}`

    await Promise.all([
      redis.hincrby(totalsKey, eventType, 1),
      redis.hincrby(hourKey, eventType, 1),
      redis.expire(hourKey, 60 * 60 * 48),
    ])
    return
  }

  memoryTotals[eventType] += 1

  // Reset local hourly counters when hour changes.
  if (Date.now() - hourStartMs > 60 * 60 * 1000) {
    for (const key of SECURITY_EVENT_TYPES) {
      memoryLastHour[key] = 0
    }
  }
  memoryLastHour[eventType] += 1
}

export async function getSecurityMetrics(): Promise<{
  source: "redis" | "memory"
  totals: CounterMap
  lastHour: CounterMap
  generatedAt: string
}> {
  const redis = getRedisClient()
  if (redis) {
    const now = new Date()
    const hourBucket = getCurrentHourBucket(now)
    const totalsKey = "monitor:totals"
    const hourKey = `monitor:hour:${hourBucket}`

    const [totalsRaw, hourRaw] = await Promise.all([redis.hgetall<Record<string, string>>(totalsKey), redis.hgetall<Record<string, string>>(hourKey)])

    const totals: CounterMap = {
      domain_blocked: Number(totalsRaw?.domain_blocked || 0),
      rate_limited: Number(totalsRaw?.rate_limited || 0),
      auth_error: Number(totalsRaw?.auth_error || 0),
      model_error: Number(totalsRaw?.model_error || 0),
      invalid_request: Number(totalsRaw?.invalid_request || 0),
      request_success: Number(totalsRaw?.request_success || 0),
    }

    const lastHour: CounterMap = {
      domain_blocked: Number(hourRaw?.domain_blocked || 0),
      rate_limited: Number(hourRaw?.rate_limited || 0),
      auth_error: Number(hourRaw?.auth_error || 0),
      model_error: Number(hourRaw?.model_error || 0),
      invalid_request: Number(hourRaw?.invalid_request || 0),
      request_success: Number(hourRaw?.request_success || 0),
    }

    return {
      source: "redis",
      totals,
      lastHour,
      generatedAt: new Date().toISOString(),
    }
  }

  return {
    source: "memory",
    totals: { ...memoryTotals },
    lastHour: { ...memoryLastHour },
    generatedAt: new Date().toISOString(),
  }
}
