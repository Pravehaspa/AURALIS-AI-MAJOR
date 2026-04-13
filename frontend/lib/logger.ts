/**
 * Structured logging and telemetry utilities
 */

import { incrementSecurityCounter } from "@/lib/monitoring"

export enum EventType {
  DOMAIN_BLOCKED = "domain_blocked",
  RATE_LIMITED = "rate_limited",
  AUTH_ERROR = "auth_error",
  MODEL_ERROR = "model_error",
  INVALID_REQUEST = "invalid_request",
  REQUEST_SUCCESS = "request_success",
}

export interface LogEvent {
  timestamp: string
  type: EventType
  sessionId?: string
  userId?: string
  agentId?: string
  category?: string
  model?: string
  message?: string
  details?: Record<string, unknown>
}

/**
 * Log structured events for monitoring and debugging
 */
export function logEvent(event: Omit<LogEvent, "timestamp">): void {
  const fullEvent: LogEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  }

  // Console output in structured JSON format for log aggregation
  console.log(JSON.stringify(fullEvent))

  // Track counters for monitoring dashboards.
  void incrementSecurityCounter(fullEvent.type)

  // In production, send to external logging service (e.g., Sentry, DataDog, CloudWatch)
  if (process.env.NODE_ENV === "production" && process.env.TELEMETRY_ENDPOINT) {
    // Batch and send to telemetry service
    void sendTelemetry(fullEvent)
  }
}

// In-memory buffer for batch telemetry sending
const telemetryBuffer: LogEvent[] = []
let telemetryFlushTimeout: NodeJS.Timeout | null = null

/**
 * Send telemetry in batches to reduce network overhead
 */
async function sendTelemetry(event: LogEvent): Promise<void> {
  telemetryBuffer.push(event)

  // Flush immediately for critical events
  if (event.type === EventType.AUTH_ERROR || event.type === EventType.DOMAIN_BLOCKED) {
    void flushTelemetry()
    return
  }

  // Debounce batch sends every 30 seconds or on buffer size
  if (telemetryBuffer.length >= 50) {
    void flushTelemetry()
  } else if (!telemetryFlushTimeout) {
    telemetryFlushTimeout = setTimeout(() => {
      void flushTelemetry()
    }, 30 * 1000)
  }
}

async function flushTelemetry(): Promise<void> {
  if (telemetryBuffer.length === 0) return

  const buffer = telemetryBuffer.splice(0, telemetryBuffer.length)

  try {
    const response = await fetch(process.env.TELEMETRY_ENDPOINT!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: buffer }),
    })

    if (!response.ok) {
      console.error(`Telemetry send failed: ${response.status}`)
      // Re-add to buffer on failure (with size limit to prevent memory leak)
      if (telemetryBuffer.length < 1000) {
        telemetryBuffer.unshift(...buffer)
      }
    }
  } catch (error) {
    console.error("Telemetry send error:", error)
    // Re-add to buffer on failure
    if (telemetryBuffer.length < 1000) {
      telemetryBuffer.unshift(...buffer)
    }
  } finally {
    if (telemetryFlushTimeout) {
      clearTimeout(telemetryFlushTimeout)
      telemetryFlushTimeout = null
    }
  }
}

/**
 * Generate session ID from request headers
 * Uses combination of IP and user agent for pseudo-anonymity
 */
export function getSessionId(
  forwardedFor?: string,
  userAgent?: string
): string {
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown"
  const ua = userAgent || "unknown"
  return `${ip}:${Buffer.from(ua).toString("base64").slice(0, 16)}`
}
