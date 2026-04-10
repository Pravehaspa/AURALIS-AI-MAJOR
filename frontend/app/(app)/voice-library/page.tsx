"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Volume2,
    Play,
    Pause,
    User,
    Mic,
    Search,
    Filter,
    ArrowRight,
    Loader2,
    Check,
    Download
} from "lucide-react"
import Link from "next/link"
import { DesktopSidebar, MobileSidebar } from "@/components/app-shell/Sidebar"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api"

// Voice Data with sample phrases
const availableVoices = [
    {
        id: "en-US-terrell",
        name: "Terrell",
        gender: "Male",
        accent: "American",
        style: "Deep & Calming",
        description: "A deep, resonant male voice perfect for relaxation and storytelling.",
        category: "Wellness",
        sampleText: "Hello! I'm Terrell. I'm here to help you feel calm and relaxed. My voice is designed to create a peaceful atmosphere for our conversation.",
    },
    {
        id: "en-US-natalie",
        name: "Natalie",
        gender: "Female",
        accent: "American",
        style: "Energetic & Bright",
        description: "A lively and enthusiastic female voice, great for motivation and creative inspiration.",
        category: "Creative",
        sampleText: "Hi there! I'm Natalie, and I'm so excited to work with you! Let's bring your creative ideas to life with energy and passion!",
    },
    {
        id: "en-US-ken",
        name: "Ken",
        gender: "Male",
        accent: "American",
        style: "Assertive & Strong",
        description: "A strong, confident male voice suitable for coaching and leadership advice.",
        category: "Health",
        sampleText: "Hey! I'm Ken. Ready to crush your goals? I'm here to motivate you and help you become the best version of yourself!",
    },
    {
        id: "en-US-julia",
        name: "Julia",
        gender: "Female",
        accent: "American",
        style: "Clear & Professional",
        description: "A crisp, articulate female voice ideal for educational content and professional assistance.",
        category: "Education",
        sampleText: "Good day. I'm Julia. I specialize in clear, articulate communication to help you learn and understand complex topics with ease.",
    },
    {
        id: "en-US-miles",
        name: "Miles",
        gender: "Male",
        accent: "American",
        style: "Professional & Polished",
        description: "A sophisticated male voice, perfect for business and formal interactions.",
        category: "Business",
        sampleText: "Hello, I'm Miles. I bring professionalism and clarity to every conversation, making me ideal for business communications.",
    },
    {
        id: "en-GB-oliver",
        name: "Oliver",
        gender: "Male",
        accent: "British",
        style: "Sophisticated & Refined",
        description: "An elegant British male voice with refined articulation.",
        category: "Business",
        sampleText: "Good afternoon, I'm Oliver. With my British sophistication, I'm here to assist you with elegance and precision.",
    },
]

export default function VoiceLibraryPage() {
    const { toast } = useToast()
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
    const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [audioCache, setAudioCache] = useState<Record<string, string>>({})
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Filter voices
    const filteredVoices = availableVoices.filter(voice => {
        const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            voice.style.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory ? voice.category === selectedCategory : true
        return matchesSearch && matchesCategory
    })

    // Categories for detailed filtering
    const categories = Array.from(new Set(availableVoices.map(v => v.category)))

    // Handle audio playback
    const handlePlaySample = async (voiceId: string) => {
        try {
            // If currently playing this voice, pause it
            if (playingVoiceId === voiceId && audioRef.current) {
                audioRef.current.pause()
                setPlayingVoiceId(null)
                return
            }

            // Stop any currently playing audio
            if (audioRef.current) {
                audioRef.current.pause()
            }

            const voice = availableVoices.find(v => v.id === voiceId)
            if (!voice) return

            // Check if audio is cached
            let audioUrl = audioCache[voiceId]

            if (!audioUrl) {
                // Generate audio
                setLoadingVoiceId(voiceId)
                toast({
                    title: "Generating voice sample",
                    description: `Creating audio for ${voice.name}...`,
                })

                const response = await api.convertToSpeech(voice.sampleText, voiceId)

                if (!response.success || !response.data?.audioUrl) {
                    throw new Error(response.error || "Failed to generate audio")
                }

                audioUrl = response.data.audioUrl
                
                // Cache the audio URL
                setAudioCache(prev => ({ ...prev, [voiceId]: audioUrl }))
                setLoadingVoiceId(null)
            }

            // Create and play audio
            if (!audioRef.current) {
                audioRef.current = new Audio()
                audioRef.current.addEventListener('ended', () => {
                    setPlayingVoiceId(null)
                })
                audioRef.current.addEventListener('pause', () => {
                    setPlayingVoiceId(null)
                })
            }

            audioRef.current.src = audioUrl
            setPlayingVoiceId(voiceId)
            await audioRef.current.play()

            toast({
                title: "Playing sample",
                description: `Listening to ${voice.name}`,
            })

        } catch (error: any) {
            console.error("Error playing voice sample:", error)
            setLoadingVoiceId(null)
            setPlayingVoiceId(null)
            toast({
                title: "Playback Error",
                description: error.message || "Failed to play voice sample",
                variant: "destructive",
            })
        }
    }

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    return (
        <div className="min-h-screen bg-auralis-background flex">
            {/* Sidebar Navigation */}
            <DesktopSidebar />

            {/* Main Content */}
            <div className="flex-1 md:ml-64 ml-0 transition-all duration-300">
                {/* Top Navigation Bar */}
                <nav className="border-b border-auralis-border bg-auralis-surface-1 sticky top-0 z-30">
                    <div className="px-6 py-4">
                        <div className="flex items-center gap-4">
                            <MobileSidebar />
                            <h1 className="text-xl font-bold font-heading text-auralis-text-primary">Voice Library</h1>
                        </div>
                    </div>
                </nav>

                <div className="container mx-auto px-6 py-8">
                    {/* Header & Search */}
                    <div className="mb-8 space-y-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-3xl font-bold font-heading text-auralis-text-primary mb-2">Explore Voices</h2>
                                <p className="text-auralis-text-secondary max-w-2xl opacity-80">
                                    Discover our diverse collection of AI voices. Find the perfect tone, accent, and style for your next agent.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-auralis-text-muted">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="font-medium text-blue-400">{Object.keys(audioCache).length} / {availableVoices.length} Samples Cached</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-auralis-text-muted" />
                                <input
                                    type="text"
                                    placeholder="Search voices..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-auralis-surface-2 border border-auralis-border rounded-lg text-auralis-text-primary placeholder:text-auralis-text-muted focus:outline-none focus:border-auralis-accent transition-colors"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                <Button
                                    variant={selectedCategory === null ? "default" : "outline"}
                                    onClick={() => setSelectedCategory(null)}
                                    className={`rounded-full px-6 transition-all ${selectedCategory === null ? "bg-auralis-accent text-auralis-accent-foreground hover:bg-auralis-accent/90" : "border-auralis-border text-auralis-text-secondary hover:bg-auralis-surface-2"}`}
                                >
                                    All
                                </Button>
                                {categories.map(category => (
                                    <Button
                                        key={category}
                                        variant={selectedCategory === category ? "default" : "outline"}
                                        onClick={() => setSelectedCategory(category)}
                                        className={`rounded-full px-6 transition-all ${selectedCategory === category ? "bg-auralis-accent text-auralis-accent-foreground hover:bg-auralis-accent/90" : "border-auralis-border text-auralis-text-secondary hover:bg-auralis-surface-2"}`}
                                    >
                                        {category}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Voices Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredVoices.map((voice) => (
                            <Card key={voice.id} className="bg-auralis-surface-1 border-auralis-border hover:border-auralis-accent/50 transition-colors group">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="w-12 h-12 rounded-xl bg-auralis-surface-2 flex items-center justify-center text-auralis-accent group-hover:scale-105 transition-transform">
                                            {voice.gender === "Female" ? (
                                                <User className="w-6 h-6" />
                                            ) : (
                                                <User className="w-6 h-6" />
                                            )}
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className={`rounded-full w-10 h-10 ${playingVoiceId === voice.id ? "bg-auralis-accent text-auralis-accent-foreground" : "hover:bg-auralis-surface-2 text-auralis-text-secondary"}`}
                                            onClick={() => handlePlaySample(voice.id)}
                                            disabled={loadingVoiceId === voice.id}
                                        >
                                            {loadingVoiceId === voice.id ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : playingVoiceId === voice.id ? (
                                                <Pause className="w-5 h-5" />
                                            ) : (
                                                <Play className="w-5 h-5 ml-1" />
                                            )}
                                        </Button>
                                    </div>
                                    <CardTitle className="text-auralis-text-primary text-xl font-heading flex items-center gap-2">
                                        {voice.name}
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-auralis-surface-2 border-auralis-border text-auralis-text-muted">
                                            {voice.gender}
                                        </Badge>
                                        {audioCache[voice.id] && (
                                            <span className="w-2 h-2 rounded-full bg-blue-500" title="Sample cached"></span>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="text-auralis-text-muted">
                                        {voice.accent} • {voice.style}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-auralis-text-secondary mb-6 line-clamp-2 min-h-[40px]">
                                        {voice.description}
                                    </p>

                                    <Link href={`/create?voice=${voice.id}`}>
                                        <Button className="w-full border border-auralis-accent/20 bg-auralis-accent/5 text-auralis-accent hover:bg-auralis-accent hover:text-auralis-accent-foreground transition-all">
                                            Use Voice
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {filteredVoices.length === 0 && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-auralis-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mic className="w-8 h-8 text-auralis-text-muted" />
                            </div>
                            <h3 className="text-lg font-medium text-auralis-text-primary mb-2">No voices found</h3>
                            <p className="text-auralis-text-muted">
                                Try adjusting your search or filters to find what you're looking for.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
