"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Search,
  Bot,
  Play,
  Settings,
  Trash2,
  Copy,
  MessageCircle,
  TrendingUp,
  Sparkles,
  Loader2,
  AlertCircle,
  Filter,
  RotateCcw,
  Check,
  Wand2,
  Code,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useApp } from "@/lib/context"
import { useToast } from "@/hooks/use-toast"
import { DesktopSidebar, MobileSidebar } from "@/components/app-shell/Sidebar"

export default function Dashboard() {
  const { agents, isLoading, error, deleteAgent, updateAgent, loadAgents } = useApp()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  // Load agents on component mount
  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const categories = ["All", ...Array.from(new Set(agents.map((agent) => agent.category)))]

  const filteredAgents = agents.filter((agent) => {
    const name = agent.name || ""
    const description = agent.description || ""
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || agent.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const stats = {
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.isActive).length,
    totalConversations: agents.reduce((sum, a) => sum + (a.conversations || 0), 0),
    avgResponseTime: "0.8s",
  }

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      return
    }

    setIsDeleting(agentId)
    try {
      const success = await deleteAgent(agentId)
      if (success) {
        toast({
          title: "Agent deleted",
          description: "The agent has been successfully deleted.",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete the agent. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleToggleActive = async (agent: any) => {
    try {
      const success = await updateAgent(agent.id, { isActive: !agent.isActive })
      if (success) {
        toast({
          title: "Agent updated",
          description: `Agent ${agent.isActive ? 'deactivated' : 'activated'} successfully.`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update agent status.",
        variant: "destructive",
      })
    }
  }

  const handleCopyAgentId = (agentId: string) => {
    navigator.clipboard.writeText(agentId)
    toast({
      title: "Copied!",
      description: "Agent ID copied to clipboard.",
    })
  }

  if (error) {
    return (
      <div className="min-h-screen bg-auralis-background flex items-center justify-center">
        <Card className="auralis-card max-w-md border-auralis-error/50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-auralis-error mx-auto mb-4" />
            <h3 className="text-auralis-text-primary text-lg font-semibold mb-2">Error Loading Dashboard</h3>
            <p className="text-auralis-text-secondary mb-4">{error}</p>
            <Button onClick={() => loadAgents()} className="bg-auralis-accent text-auralis-accent-foreground hover:opacity-90">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-auralis-background flex">
      {/* Sidebar Navigation */}
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
                <div className="flex items-center gap-6">
                  <Link href="/" className="text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                    Home
                  </Link>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => loadAgents()}
                  disabled={isLoading}
                  variant="outline"
                  className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                </Button>
                <Link href="/create">
                  <Button className="bg-auralis-accent text-auralis-accent-foreground hover:opacity-90 border-0">
                    <Plus className="w-4 h-4 mr-2" />
                    New Agent
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold font-heading text-auralis-text-primary mb-2">AI Agent Dashboard</h1>
            <p className="text-auralis-text-secondary text-lg opacity-80">Manage and monitor your intelligent AI agents</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="auralis-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm">Total Agents</p>
                    <p className="text-2xl font-bold text-auralis-text-primary">{stats.totalAgents}</p>
                  </div>
                  <Bot className="h-8 w-8 text-auralis-accent" />
                </div>
              </CardContent>
            </Card>

            <Card className="auralis-card shadow-lg shadow-blue-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm font-medium uppercase tracking-wider">Active Agents</p>
                    <p className="text-3xl font-bold text-auralis-text-primary mt-1">{stats.activeAgents}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="auralis-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm">Conversations</p>
                    <p className="text-2xl font-bold text-auralis-text-primary">{stats.totalConversations}</p>
                  </div>
                  <MessageCircle className="h-8 w-8 text-auralis-info" />
                </div>
              </CardContent>
            </Card>

            <Card className="auralis-card shadow-lg shadow-yellow-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-auralis-text-muted text-sm font-medium uppercase tracking-wider">Avg Response</p>
                    <p className="text-3xl font-bold text-auralis-text-primary mt-1">{stats.avgResponseTime}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-auralis-warning" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-auralis-text-muted h-4 w-4" />
              <Input
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-auralis-surface-2 border-auralis-border text-auralis-text-primary placeholder:text-auralis-text-muted"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className={
                    selectedCategory === category
                      ? "bg-auralis-accent text-auralis-accent-foreground border-0"
                      : "border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="auralis-card animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-auralis-surface-2 rounded mb-4" />
                    <div className="h-3 bg-auralis-border rounded mb-2" />
                    <div className="h-3 bg-auralis-border rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <Card
                  key={agent.id}
                  className="auralis-card hover:border-auralis-accent/30 transition-colors duration-200"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-auralis-accent/20 rounded-lg flex items-center justify-center">
                          <Bot className="h-5 w-5 text-auralis-accent" />
                        </div>
                        <div>
                          <CardTitle className="text-auralis-text-primary text-lg">{agent.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              className="text-xs bg-auralis-surface-2 text-auralis-text-secondary border-auralis-border"
                            >
                              {agent.category}
                            </Badge>
                            <Badge
                              className={`text-[10px] uppercase tracking-widest px-2 py-0.5 ${agent.isActive
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : "bg-auralis-surface-2 text-auralis-text-muted border-auralis-border"
                                }`}
                            >
                              {agent.isActive ? "Live" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-auralis-text-muted hover:text-auralis-text-primary hover:bg-auralis-sidebar-hover">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-auralis-text-secondary mb-4 leading-relaxed">{agent.description}</CardDescription>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-auralis-text-muted">Conversations</span>
                        <span className="text-auralis-text-primary font-medium">{agent.conversations}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-auralis-text-muted">Last Used</span>
                        <span className="text-auralis-text-primary font-medium">{agent.lastUsed}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-auralis-text-muted">Voice</span>
                        <span className="text-auralis-text-primary font-medium">{agent.voiceId}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/chat/${agent.id}`} className="flex-1">
                        <Button className="w-full bg-auralis-accent text-auralis-accent-foreground hover:opacity-90 border-0">
                          <Play className="w-4 h-4 mr-2" />
                          Chat
                        </Button>
                      </Link>
                      <Link href={`/embed/${agent.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                          title="Embed Agent"
                        >
                          <Code className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        onClick={() => handleCopyAgentId(agent.id)}
                        variant="outline"
                        size="sm"
                        className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                        title="Copy Agent ID"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleToggleActive(agent)}
                        variant="outline"
                        size="sm"
                        className={`border-auralis-border hover:bg-auralis-sidebar-hover bg-transparent ${agent.isActive ? "text-blue-400" : "text-auralis-text-muted"
                          }`}
                        title={agent.isActive ? "Deactivate Agent" : "Activate Agent"}
                      >
                        <div className={`w-2 h-2 rounded-full ${agent.isActive ? "bg-blue-400 animate-pulse" : "bg-auralis-text-muted"}`} />
                      </Button>
                      <Button
                        onClick={() => handleDeleteAgent(agent.id)}
                        disabled={isDeleting === agent.id}
                        variant="outline"
                        size="sm"
                        className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-error/10 hover:text-auralis-error bg-transparent"
                        title="Delete Agent"
                      >
                        {isDeleting === agent.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredAgents.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Bot className="h-16 w-16 text-auralis-text-muted mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-auralis-text-primary mb-2">No agents found</h3>
              <p className="text-auralis-text-secondary mb-6">Try adjusting your search or create a new agent</p>
              <Link href="/create">
                <Button className="bg-auralis-accent text-auralis-accent-foreground hover:opacity-90 border-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Agent
                </Button>
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
