"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Bot, Mic, Sparkles, Star, Play, MessageCircle, Volume2, Brain, Shield, Globe } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

const features = [
  {
    icon: <Mic className="h-6 w-6" />,
    title: "Advanced Voice AI",
    description: "Powered by Murf's industry-leading voice synthesis technology for natural conversations",
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: "Smart Conversations",
    description: "Google Gemini integration for intelligent, context-aware responses",
  },
  {
    icon: <Bot className="h-6 w-6" />,
    title: "Custom Agents",
    description: "Create specialized AI agents tailored to your specific needs and use cases",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Auto Mode",
    description: "Seamless voice-to-voice conversations with automatic speech recognition",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Enterprise Ready",
    description: "Secure, scalable, and reliable for business-critical applications",
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: "Multi-Language",
    description: "Support for multiple languages and accents with premium voice quality",
  },
]

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Manager",
    company: "TechCorp",
    content: "Auralis AI transformed our customer service. The voice quality is indistinguishable from human agents.",
    rating: 5,
  },
  {
    name: "Marcus Rodriguez",
    role: "CTO",
    company: "StartupXYZ",
    content: "The auto-mode feature is incredible. Our users love the natural conversation flow.",
    rating: 5,
  },
  {
    name: "Emily Watson",
    role: "UX Designer",
    company: "DesignStudio",
    content: "Finally, an AI platform that actually understands context and responds naturally.",
    rating: 5,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-auralis-background">
      {/* Navigation */}
      <nav className="border-b border-auralis-border bg-auralis-surface-1">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-auralis-accent flex items-center justify-center p-2">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold font-heading text-auralis-text-primary">Auralis AI</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                Features
              </Link>
              <Link href="#testimonials" className="text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                Testimonials
              </Link>
              <Link href="/dashboard" className="text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                Dashboard
              </Link>
            </div>
            <div className="flex gap-3">
              <Link href="/login">
                <Button variant="outline" className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent">
                  Sign In
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button className="bg-auralis-accent text-auralis-accent-foreground hover:bg-auralis-accent/90 border-0 rounded-full px-6">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-bold font-heading text-auralis-text-primary mb-8 leading-tight tracking-tight">
            The Future of
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
              {" "}
              AI Voice
            </span>
          </h1>
          <p className="text-xl text-auralis-text-secondary mb-8 leading-[1.7] max-w-2xl mx-auto readable-wide">
            Create intelligent AI agents with human-like voices. Powered by Murf's advanced voice technology and Google
            Gemini's conversational AI for seamless, natural interactions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="bg-auralis-accent text-auralis-accent-foreground hover:bg-auralis-accent/90 border-0 px-10 py-7 text-lg rounded-full font-medium"
              >
                Start Building
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/chat/1">
              <Button
                size="lg"
                variant="outline"
                className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-surface-2 transition-all px-10 py-7 text-lg rounded-full"
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                Try Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold font-heading text-auralis-text-primary mb-6">Built for Intelligence</h2>
          <p className="text-lg text-auralis-text-secondary max-w-2xl mx-auto leading-relaxed opacity-80">
            Everything you need to create, deploy, and manage intelligent AI agents with premium voice capabilities
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="auralis-card hover:border-auralis-accent/30 transition-colors"
            >
              <CardHeader>
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 mb-6">
                  {feature.icon}
                </div>
                <CardTitle className="text-auralis-text-primary text-xl font-semibold tracking-tight">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-auralis-text-secondary text-base leading-[1.7]">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <div className="auralis-card border border-auralis-border backdrop-blur-xl rounded-lg p-8">
            <div className="text-4xl font-bold text-auralis-text-primary mb-2">99.9%</div>
            <div className="text-auralis-text-secondary text-base">Voice Quality</div>
          </div>
          <div className="auralis-card border border-auralis-border backdrop-blur-xl rounded-lg p-8">
            <div className="text-4xl font-bold text-auralis-text-primary mb-2">50ms</div>
            <div className="text-auralis-text-secondary text-base">Response Time</div>
          </div>
          <div className="auralis-card border border-auralis-border backdrop-blur-xl rounded-lg p-8">
            <div className="text-4xl font-bold text-auralis-text-primary mb-2">24/7</div>
            <div className="text-auralis-text-secondary text-base">Availability</div>
          </div>
          <div className="auralis-card border border-auralis-border backdrop-blur-xl rounded-lg p-8">
            <div className="text-4xl font-bold text-auralis-text-primary mb-2">100+</div>
            <div className="text-auralis-text-secondary text-base">Voice Options</div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-auralis-text-primary mb-4">What Our Users Say</h2>
          <p className="text-lg sm:text-xl text-auralis-text-secondary max-w-2xl mx-auto leading-[1.7]">
            Join thousands of developers and businesses building the future with Auralis AI
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="auralis-card">
              <CardHeader>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-auralis-warning text-auralis-warning" />
                  ))}
                </div>
                <CardDescription className="text-auralis-text-secondary text-base leading-[1.7]">
                  "{testimonial.content}"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-auralis-text-primary font-medium">{testimonial.name}</div>
                <div className="text-auralis-text-muted text-sm">
                  {testimonial.role} at {testimonial.company}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <Card className="auralis-card border-auralis-accent/30">
          <CardContent className="text-center py-16">
            <h2 className="text-4xl font-bold text-auralis-text-primary mb-4">Ready to Get Started?</h2>
            <p className="text-lg sm:text-xl text-auralis-text-secondary mb-8 max-w-2xl mx-auto leading-[1.7]">
              Join the AI revolution and create your first intelligent agent in minutes. Experience the power of Murf's
              voice technology today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="bg-auralis-accent text-auralis-accent-foreground hover:opacity-90 border-0 px-8 py-6 text-lg"
                >
                  <Bot className="mr-2 h-5 w-5" />
                  Create Your Agent
                </Button>
              </Link>
              <Link href="/chat/1">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent px-8 py-6 text-lg"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Try Live Demo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-auralis-border bg-auralis-surface-1">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-auralis-accent flex items-center justify-center p-1.5">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold font-heading text-auralis-text-primary">Auralis AI</span>
              </div>
              <p className="text-auralis-text-secondary text-base leading-[1.7] mb-4 max-w-md">
                The most advanced AI agent platform powered by Murf's voice technology and Google Gemini's intelligence.
              </p>
              <div className="flex items-center gap-2 text-sm text-auralis-text-muted">
                <Volume2 className="h-4 w-4" />
                <span>Powered by Murf AI</span>
              </div>
            </div>
            <div>
              <h3 className="text-auralis-text-primary font-semibold mb-4">Product</h3>
              <div className="space-y-2">
                <Link href="/dashboard" className="block text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                  Dashboard
                </Link>
                <Link href="/create" className="block text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                  Create Agent
                </Link>
                <Link href="/chat/1" className="block text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                  Try Demo
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-auralis-text-primary font-semibold mb-4">Company</h3>
              <div className="space-y-2">
                <Link href="#" className="block text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                  About
                </Link>
                <Link href="#" className="block text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                  Contact
                </Link>
                <Link href="#" className="block text-auralis-text-secondary hover:text-auralis-text-primary transition-colors">
                  Support
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-auralis-border mt-8 pt-8 text-center text-auralis-text-muted text-base">
            <p>&copy; 2025 Auralis AI.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
