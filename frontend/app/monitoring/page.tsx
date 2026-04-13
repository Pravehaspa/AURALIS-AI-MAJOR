"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { AlertTriangle, ArrowLeft, Ban, Loader2, RefreshCw, ShieldAlert, Timer, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type CounterMap = {
  domain_blocked: number
  rate_limited: number
  auth_error: number
  model_error: number
  invalid_request: number
  request_success: number
}

type MonitoringResponse = {
  success: boolean
  data?: {
    source: "redis" | "memory"
    totals: CounterMap
    lastHour: CounterMap
    generatedAt: string
  }
  error?: string
}

const EMPTY_COUNTERS: CounterMap = {
  domain_blocked: 0,
  rate_limited: 0,
  auth_error: 0,
  model_error: 0,
  invalid_request: 0,
  request_success: 0,
}

export default function MonitoringPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<"redis" | "memory">("memory")
  const [generatedAt, setGeneratedAt] = useState<string>("")
  const [totals, setTotals] = useState<CounterMap>(EMPTY_COUNTERS)
  const [lastHour, setLastHour] = useState<CounterMap>(EMPTY_COUNTERS)

  const loadMetrics = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch("/api/monitoring", { cache: "no-store" })
      const payload = (await response.json()) as MonitoringResponse

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "Failed to fetch monitoring metrics")
      }

      setSource(payload.data.source)
      setGeneratedAt(payload.data.generatedAt)
      setTotals(payload.data.totals)
      setLastHour(payload.data.lastHour)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMetrics()
    const interval = setInterval(() => {
      void loadMetrics()
    }, 10000)
    return () => clearInterval(interval)
  }, [loadMetrics])

  const abuseLastHour = useMemo(
    () => lastHour.domain_blocked + lastHour.rate_limited + lastHour.invalid_request,
    [lastHour]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Image src="/auralis-ai-logo.png" alt="Auralis AI" width={32} height={24} className="w-8 h-6 object-contain" />
              <span className="text-xl font-bold text-white">Security Monitoring</span>
            </div>
          </div>
          <Button variant="outline" className="border-white/20 text-gray-300 hover:bg-white/10 bg-transparent" onClick={() => void loadMetrics()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {error ? (
          <Card className="bg-black/40 border-red-500/30">
            <CardContent className="p-6 text-red-300">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-orange-400" />Abuse Last Hour</CardTitle>
              <CardDescription className="text-gray-400">Domain blocks, rate limits, invalid requests</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl text-white font-bold">{abuseLastHour}</CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Ban className="w-4 h-4 text-yellow-400" />Rate Limited</CardTitle>
              <CardDescription className="text-gray-400">Last hour</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl text-white font-bold">{lastHour.rate_limited}</CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" />Invalid Requests</CardTitle>
              <CardDescription className="text-gray-400">Last hour</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl text-white font-bold">{lastHour.invalid_request}</CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" />Successful Requests</CardTitle>
              <CardDescription className="text-gray-400">Last hour</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl text-white font-bold">{lastHour.request_success}</CardContent>
          </Card>
        </div>

        <Card className="bg-black/40 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Timer className="w-4 h-4 text-blue-400" />Totals</CardTitle>
            <CardDescription className="text-gray-300">Data source: {source.toUpperCase()} | Updated: {generatedAt || "-"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-gray-200">
              <div>Domain blocked: <span className="font-semibold">{totals.domain_blocked}</span></div>
              <div>Rate limited: <span className="font-semibold">{totals.rate_limited}</span></div>
              <div>Invalid request: <span className="font-semibold">{totals.invalid_request}</span></div>
              <div>Auth errors: <span className="font-semibold">{totals.auth_error}</span></div>
              <div>Model errors: <span className="font-semibold">{totals.model_error}</span></div>
              <div>Success: <span className="font-semibold">{totals.request_success}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
