"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Bot, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate login
    setTimeout(() => {
      setIsLoading(false)
      router.push("/dashboard")
    }, 1500)
  }

  const handleDemoLogin = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      router.push("/dashboard")
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-auralis-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/elite-ai-logo.png" alt="Auralis AI" width={40} height={30} className="w-10 h-7 object-contain" />
            <h1 className="text-3xl font-bold text-white">Auralis AI</h1>
          </div>
          <Badge className="mb-6 bg-auralis-accent/20 text-auralis-accent border-auralis-accent/30">
            🚀 Murf AI Hackathon 2025 Submission
          </Badge>
          <p className="text-auralis-text-secondary">Sign in to your AI agent studio</p>
        </div>

        <Card className="auralis-card shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-auralis-text-primary text-2xl">Welcome Back</CardTitle>
            <CardDescription className="text-auralis-text-secondary">
              Continue building intelligent AI agents with premium voice capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-auralis-text-secondary">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-auralis-text-muted h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="pl-10 bg-auralis-surface-2 border-auralis-border text-auralis-text-primary placeholder:text-auralis-text-muted"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-auralis-text-secondary">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-auralis-text-muted h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    className="pl-10 pr-10 bg-auralis-surface-2 border-auralis-border text-auralis-text-primary placeholder:text-auralis-text-muted"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-auralis-text-muted hover:text-auralis-text-primary hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-auralis-text-secondary">
                  <input type="checkbox" className="rounded border-auralis-border" />
                  <span>Remember me</span>
                </label>
                <Link href="#" className="text-sm text-auralis-accent-secondary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-auralis-accent text-auralis-accent-foreground hover:opacity-90 border-0 py-6"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-auralis-accent-foreground/30 border-t-auralis-accent-foreground rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-auralis-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-auralis-surface-1 px-2 text-auralis-text-muted">Or continue with</span>
              </div>
            </div>

            <Button
              onClick={handleDemoLogin}
              variant="outline"
              disabled={isLoading}
              className="w-full border-white/20 text-auralis-text-secondary hover:bg-white/10 bg-transparent py-6"
            >
              <Bot className="w-4 h-4 mr-2" />
              Try Demo Account
            </Button>

            <div className="text-center">
              <p className="text-auralis-text-muted text-sm">
                Don't have an account?{" "}
                <Link href="#" className="text-auralis-accent-secondary hover:underline font-medium">
                  Sign up for free
                </Link>
              </p>
            </div>

            {/* Features Preview */}
            <div className="mt-8 p-4 bg-auralis-surface-2 rounded-lg border border-auralis-border">
              <h3 className="text-auralis-text-primary font-medium mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-auralis-accent" />
                What's included:
              </h3>
              <ul className="space-y-2 text-sm text-auralis-text-secondary">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-auralis-accent rounded-full" />
                  Premium Murf AI voices
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-auralis-accent rounded-full" />
                  Google Gemini integration
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-auralis-accent rounded-full" />
                  Auto-mode conversations
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-auralis-accent rounded-full" />
                  Custom agent creation
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-xs text-auralis-text-muted">Built with ❤️ for Murf AI Hackathon 2025</div>
      </div>
    </div>
  )
}
