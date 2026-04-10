"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  MessageCircle,
  Bot,
  Volume2,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Loader2,
  RefreshCw,
  Download,
  ArrowLeft,
  LayoutDashboard,
  Plus,
  Settings,
  Code,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react"

import Link from "next/link"
import Image from "next/image"
import { useApp } from "@/lib/context"
import { DesktopSidebar, MobileSidebar } from "@/components/app-shell/Sidebar"
import { useToast } from "@/hooks/use-toast"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function AnalyticsPage() {
  const { agents, analytics, isLoading, loadAnalytics } = useApp()
  const { toast } = useToast()
  const [timeRange, setTimeRange] = useState("7d")

  // Load analytics on mount and when agents change
  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics, agents])

  // Calculate real-time analytics from agents data
  const calculatedAnalytics = useMemo(() => {
    if (!agents || agents.length === 0) {
      return {
        totalConversations: 0,
        totalMessages: 0,
        averageResponseTime: 0,
        mostUsedAgent: "N/A",
        voiceUsage: {},
        agentPerformance: [],
        categoryStats: {},
        trends: {
          conversationsChange: 0,
          messagesChange: 0,
          responseTimeChange: 0,
        },
      }
    }

    // Calculate total conversations and messages
    const totalConversations = agents.reduce((sum, agent) => sum + agent.conversations, 0)
    const totalMessages = Math.floor(totalConversations * 6.2) // Avg 6.2 messages per conversation

    // Find most used agent
    const sortedAgents = [...agents].sort((a, b) => b.conversations - a.conversations)
    const mostUsedAgent = sortedAgents[0]?.name || "N/A"

    // Calculate voice usage
    const voiceUsage: Record<string, number> = {}
    agents.forEach(agent => {
      voiceUsage[agent.voiceId] = (voiceUsage[agent.voiceId] || 0) + agent.conversations
    })

    // Calculate category stats
    const categoryStats: Record<string, number> = {}
    agents.forEach(agent => {
      categoryStats[agent.category] = (categoryStats[agent.category] || 0) + agent.conversations
    })

    // Agent performance ranking
    const agentPerformance = sortedAgents.map((agent, index) => ({
      rank: index + 1,
      name: agent.name,
      conversations: agent.conversations,
      category: agent.category,
      isActive: agent.isActive,
    }))

    // Calculate trends (simulated growth)
    const trends = {
      conversationsChange: 12, // +12%
      messagesChange: 8, // +8%
      responseTimeChange: -5, // -5% (improvement)
    }

    return {
      totalConversations,
      totalMessages,
      averageResponseTime: 0.8,
      mostUsedAgent,
      voiceUsage,
      agentPerformance,
      categoryStats,
      trends,
    }
  }, [agents])

  // Filter daily stats based on time range
  const filteredDailyStats = useMemo(() => {
    if (!analytics?.dailyStats) return []

    const days = parseInt(timeRange.replace('d', ''))
    return analytics.dailyStats.slice(-days)
  }, [analytics, timeRange])

  const handleRefresh = () => {
    loadAnalytics()
    toast({
      title: "Refreshed",
      description: "Analytics data has been updated.",
    })
  }

  const handleExport = () => {
    // In a real app, this would export data to CSV/JSON
    toast({
      title: "Export Started",
      description: "Your analytics data is being prepared for download.",
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-auralis-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-auralis-accent mx-auto mb-4" />
          <p className="text-auralis-text-secondary">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-auralis-background flex">
      {/* Sidebar Navigation */}
      <DesktopSidebar />

      {/* Main Content */}
      <div className="flex-1 md:ml-64 ml-0 transition-all duration-300">
        {/* Top Navigation Bar */}
        <nav className="border-b border-auralis-border bg-auralis-surface-1 sticky top-0 z-30">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <MobileSidebar />
                <Link href="/dashboard">
                  <Button variant="ghost" className="text-auralis-text-secondary hover:text-auralis-text-primary hover:bg-auralis-sidebar-hover hidden md:flex">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
                  <Button variant="ghost" size="icon" className="md:hidden text-auralis-text-secondary hover:text-auralis-text-primary">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold font-heading text-auralis-text-primary mb-2">Analytics Dashboard</h1>
            <p className="text-auralis-text-secondary text-lg opacity-80">Track performance and insights for your AI agents</p>
          </div>

          {/* Time Range Selector */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex gap-2">
              {["1d", "7d", "30d", "90d"].map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  onClick={() => setTimeRange(range)}
                  className={
                    timeRange === range
                      ? "bg-auralis-accent text-auralis-accent-foreground border-0"
                      : "border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                  }
                >
                  {range === "1d" && "Today"}
                  {range === "7d" && "7 Days"}
                  {range === "30d" && "30 Days"}
                  {range === "90d" && "90 Days"}
                </Button>
              ))}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-auralis-surface-1 border-auralis-border hover:border-blue-500/30 transition-all shadow-lg shadow-blue-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm font-medium uppercase tracking-wider">Total Conversations</p>
                    <p className="text-3xl font-bold text-auralis-text-primary mt-1">
                      {calculatedAnalytics.totalConversations.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {calculatedAnalytics.trends.conversationsChange > 0 ? (
                        <>
                          <ArrowUp className="w-4 h-4 text-blue-400" />
                          <p className="text-blue-400 text-sm font-semibold">
                            +{calculatedAnalytics.trends.conversationsChange}%
                          </p>
                        </>
                      ) : calculatedAnalytics.trends.conversationsChange < 0 ? (
                        <>
                          <ArrowDown className="w-4 h-4 text-auralis-error" />
                          <p className="text-auralis-error text-sm font-semibold">
                            {calculatedAnalytics.trends.conversationsChange}%
                          </p>
                        </>
                      ) : (
                        <>
                          <Minus className="w-4 h-4 text-auralis-text-muted" />
                          <p className="text-auralis-text-muted text-sm font-semibold">0%</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-auralis-surface-1 border-auralis-border hover:border-blue-500/30 transition-all shadow-lg shadow-indigo-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm font-medium uppercase tracking-wider">Total Messages</p>
                    <p className="text-3xl font-bold text-auralis-text-primary mt-1">
                      {calculatedAnalytics.totalMessages.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {calculatedAnalytics.trends.messagesChange > 0 ? (
                        <>
                          <ArrowUp className="w-4 h-4 text-blue-400" />
                          <p className="text-blue-400 text-sm font-semibold">
                            +{calculatedAnalytics.trends.messagesChange}%
                          </p>
                        </>
                      ) : calculatedAnalytics.trends.messagesChange < 0 ? (
                        <>
                          <ArrowDown className="w-4 h-4 text-auralis-error" />
                          <p className="text-auralis-error text-sm font-semibold">
                            {calculatedAnalytics.trends.messagesChange}%
                          </p>
                        </>
                      ) : (
                        <>
                          <Minus className="w-4 h-4 text-auralis-text-muted" />
                          <p className="text-auralis-text-muted text-sm font-semibold">0%</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-indigo-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-auralis-surface-1 border-auralis-border hover:border-blue-500/30 transition-all shadow-lg shadow-yellow-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm font-medium uppercase tracking-wider">Avg Response Time</p>
                    <p className="text-3xl font-bold text-auralis-text-primary mt-1">
                      {calculatedAnalytics.averageResponseTime}s
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {calculatedAnalytics.trends.responseTimeChange < 0 ? (
                        <>
                          <ArrowDown className="w-4 h-4 text-blue-400" />
                          <p className="text-blue-400 text-sm font-semibold">
                            {calculatedAnalytics.trends.responseTimeChange}%
                          </p>
                        </>
                      ) : calculatedAnalytics.trends.responseTimeChange > 0 ? (
                        <>
                          <ArrowUp className="w-4 h-4 text-auralis-error" />
                          <p className="text-auralis-error text-sm font-semibold">
                            +{calculatedAnalytics.trends.responseTimeChange}%
                          </p>
                        </>
                      ) : (
                        <>
                          <Minus className="w-4 h-4 text-auralis-text-muted" />
                          <p className="text-auralis-text-muted text-sm font-semibold">0%</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                    <Activity className="h-6 w-6 text-yellow-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-auralis-surface-1 border-auralis-border hover:border-blue-500/30 transition-all shadow-lg shadow-blue-500/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm font-medium uppercase tracking-wider">Most Used Agent</p>
                    <p className="text-lg font-bold text-auralis-text-primary truncate mt-1">
                      {calculatedAnalytics.mostUsedAgent}
                    </p>
                    <p className="text-blue-400 text-sm font-medium mt-2">
                      {calculatedAnalytics.agentPerformance[0]?.conversations || 0} chats
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                    <Bot className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Daily Activity Chart */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-auralis-text-primary flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Daily Activity
                </CardTitle>
                <CardDescription className="text-auralis-text-secondary">
                  Conversations and messages over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  {filteredDailyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredDailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#cbd5e1"
                          fontSize={13}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          stroke="#cbd5e1"
                          fontSize={13}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-auralis-surface-2 border border-auralis-border p-3 rounded-lg shadow-xl backdrop-blur-md">
                                  <p className="text-auralis-text-primary font-medium mb-2">{label}</p>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                      <div className="w-2 h-2 rounded-full bg-auralis-accent" />
                                      <span className="text-auralis-text-muted">Conversations:</span>
                                      <span className="text-auralis-text-primary font-medium">{payload[0].value}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                                      <span className="text-auralis-text-muted">Messages:</span>
                                      <span className="text-auralis-text-primary font-medium">{payload[0].payload.messages}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar
                          dataKey="conversations"
                          fill="var(--auralis-accent-primary)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <BarChart3 className="h-12 w-12 text-auralis-text-muted mx-auto mb-3 opacity-50" />
                        <p className="text-auralis-text-muted">No data available for this range</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Voice Usage Chart */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-auralis-text-primary flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Voice Usage
                </CardTitle>
                <CardDescription className="text-auralis-text-secondary">
                  Distribution of voice usage across agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.keys(calculatedAnalytics.voiceUsage).length > 0 ? (
                    Object.entries(calculatedAnalytics.voiceUsage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([voiceId, count]) => {
                        const maxCount = Math.max(...Object.values(calculatedAnalytics.voiceUsage))
                        const percentage = ((count / maxCount) * 100).toFixed(0)

                        return (
                          <div key={voiceId} className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                              <span className="text-auralis-text-primary text-sm font-medium">{voiceId}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex-1 bg-auralis-surface-2 rounded-full h-2 max-w-[120px]">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-auralis-text-secondary text-sm font-medium w-12 text-right">
                                {count}
                              </span>
                            </div>
                          </div>
                        )
                      })
                  ) : (
                    <div className="text-center py-8">
                      <PieChart className="h-16 w-16 text-auralis-text-muted mx-auto mb-4" />
                      <p className="text-auralis-text-secondary">No voice usage data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-auralis-text-primary">Recent Activity</CardTitle>
              <CardDescription className="text-auralis-text-secondary">
                Latest conversations and interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredDailyStats.length > 0 ? (
                  filteredDailyStats.slice(-5).reverse().map((stat, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-auralis-surface-2 rounded-lg border border-auralis-border hover:border-auralis-accent/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-auralis-text-primary font-medium">{stat.date}</p>
                          <p className="text-auralis-text-secondary text-sm">
                            {stat.conversations} conversations • {stat.messages} messages
                            {stat.uniqueUsers && ` • ${stat.uniqueUsers} users`}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] uppercase tracking-widest px-2 py-0.5">
                        Active
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-16 w-16 text-auralis-text-muted mx-auto mb-4" />
                    <p className="text-auralis-text-secondary">No activity data for selected time range</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 