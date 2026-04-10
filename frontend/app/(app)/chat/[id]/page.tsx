"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Bot, User, Send, Volume2, VolumeX, Loader2, ChevronLeft, Mic, Sparkles } from "lucide-react"
import { useApp } from "@/lib/context"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  audioUrl?: string
  timestamp: Date
}

interface GeminiMessage {
  role: "system" | "user" | "model"
  parts: string[]
}

export default function ChatPage() {
  const params = useParams()
  const { toast } = useToast()
  const { agents } = useApp()

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const smoothedAmplitudeRef = useRef(0)

  // State
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatHistory, setChatHistory] = useState<GeminiMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [currentAudioUrl, setCurrentAudioUrl] = useState("")
  const [status, setStatus] = useState<'listening' | 'thinking' | 'speaking' | 'idle'>('idle')
  const [mouthFrame, setMouthFrame] = useState<'closed' | 'half' | 'open'>('closed')

  const MIN_TEXTAREA_ROWS = 1
  const MAX_TEXTAREA_ROWS = 6

  const suggestedPrompts = [
    "Help me calm down",
    "Give me a 2-minute reset",
    "I need a quick tip",
  ]

  // Get agent data
  const agentId = params.id as string
  const agent = agents.find(a => a.id === agentId)

  // System prompt and first message
  const personaPrompt = agent?.persona?.enabled
    ? [
      `Anime persona preset: ${agent.persona.stylePreset || "custom"}.`,
      agent.persona.tone ? `Tone: ${agent.persona.tone}` : "",
      agent.persona.behaviorRules ? `Behavior rules: ${agent.persona.behaviorRules}` : "",
      agent.avatar?.description ? `Visual character reference: ${agent.avatar.description}` : "",
      "Stay in character while remaining helpful, accurate, and safe.",
      "Keep expressive style moderate and avoid overusing catchphrases.",
    ].filter(Boolean).join("\n")
    : ""
  const systemPrompt = [agent?.prompt || "You are a talkative, empathetic assistant bot...", personaPrompt]
    .filter(Boolean)
    .join("\n\n")
  const firstMessage = agent?.firstMessage || "Hey there. I'm here for you. How are you feeling?"
  const companionEnabled = Boolean(agent?.avatar?.enabled || agent?.persona?.enabled)
  const lipSyncEnabled = Boolean(agent?.lipSync?.enabled)
  const lipSensitivity = agent?.lipSync?.sensitivity ?? 1
  const lipSmoothing = agent?.lipSync?.smoothing ?? 0.75

  const isFemalePack = agent?.avatar?.profile === "female_anime"
  const isMalePack = agent?.avatar?.profile === "male_anime"
  const defaultIdle = isFemalePack ? "/avatars/anime-female-idle.svg" : isMalePack ? "/avatars/anime-male-idle.svg" : "/avatars/anime-idle.svg"
  const defaultListening = isFemalePack ? "/avatars/anime-female-listening.svg" : isMalePack ? "/avatars/anime-male-listening.svg" : "/avatars/anime-listening.svg"
  const defaultThinking = isFemalePack ? "/avatars/anime-female-thinking.svg" : isMalePack ? "/avatars/anime-male-thinking.svg" : "/avatars/anime-thinking.svg"
  const defaultSpeaking = isFemalePack ? "/avatars/anime-female-speaking.svg" : isMalePack ? "/avatars/anime-male-speaking.svg" : "/avatars/anime-speaking.svg"

  const stateAvatar = status === "speaking"
    ? (agent?.avatar?.imageSpeaking || agent?.avatar?.imageListening || agent?.avatar?.imageIdle || defaultSpeaking)
    : status === "thinking"
      ? (agent?.avatar?.imageThinking || agent?.avatar?.imageIdle || defaultThinking)
      : status === "listening"
        ? (agent?.avatar?.imageListening || agent?.avatar?.imageIdle || defaultListening)
        : (agent?.avatar?.imageIdle || defaultIdle)
  const mouthFrameUrl = mouthFrame === "open"
    ? (agent?.lipSync?.mouthFrames?.open || "/avatars/mouth-open.svg")
    : mouthFrame === "half"
      ? (agent?.lipSync?.mouthFrames?.half || "/avatars/mouth-half.svg")
      : (agent?.lipSync?.mouthFrames?.closed || "/avatars/mouth-closed.svg")

  // Status Management
  useEffect(() => {
    if (isPlaying) {
      setStatus('speaking')
    } else if (isGenerating || isGeneratingAudio) {
      setStatus('thinking')
    } else if (input.length > 0) {
      setStatus('listening')
    } else {
      setStatus('listening') // Default to listening/idle "presence"
    }
  }, [isPlaying, isGenerating, isGeneratingAudio, input])

  // Initialize conversation history
  useEffect(() => {
    if (!agent) return

    const initialHistory: GeminiMessage[] = [
      { role: "system", parts: [systemPrompt] },
      { role: "model", parts: [firstMessage] },
    ]
    setChatHistory(initialHistory)

    // Add first message to display
    const firstDisplayMessage: ChatMessage = {
      id: "first-message",
      text: firstMessage,
      isUser: false,
      timestamp: new Date(),
    }
    setMessages([firstDisplayMessage])
  }, [systemPrompt, firstMessage, agent])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isGenerating])

  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = "auto"
    }
  }, [input])

  useEffect(() => {
    return () => {
      stopLipSyncLoop()
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect()
        analyserRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  // Generate AI response using API route
  async function generateAIResponse(userInput: string) {
    try {
      const updatedHistory = [...chatHistory, { role: "user" as const, parts: [userInput] }]

      // Format the messages for the OpenRouter API
      const formattedMessages = updatedHistory.map(msg => ({
        role: msg.role === "model" ? "assistant" : msg.role,
        content: msg.parts.join(" ")
      }))

      // Optional: Add system prompt if it's not the first message
      if (formattedMessages.length > 0 && formattedMessages[0].role !== 'system') {
        formattedMessages.unshift({ role: 'system', content: systemPrompt })
      }

      const response = await api.generateResponse(userInput, systemPrompt, undefined, formattedMessages)

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to generate response")
      }

      const aiResponse = response.data.text
      const finalHistory = [...updatedHistory, { role: "model" as const, parts: [aiResponse] }]
      setChatHistory(finalHistory)

      return aiResponse
    } catch (error) {
      console.error("Error generating AI response:", error)
      throw error
    }
  }

  // Convert text to speech using API route
  async function convertToSpeech(outputText: string) {
    try {
      console.log("🎤 Converting text to speech:", outputText.substring(0, 50))
      console.log("🎙️ Using voice:", agent?.voiceId || "en-US-terrell")

      const response = await api.convertToSpeech(outputText, agent?.voiceId || "en-US-terrell")

      console.log("📡 TTS Response:", response.success ? "Success" : "Failed")

      if (!response.success || !response.data) {
        console.error("❌ TTS Error:", response.error)
        throw new Error(response.error || "Failed to convert to speech")
      }

      console.log("✅ Audio URL received:", response.data.audioUrl?.substring(0, 50))
      return response.data.audioUrl
    } catch (error) {
      console.error("❌ Error converting to speech:", error)
      throw error
    }
  }

  // Handle send message
  async function handleSendMessage() {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsGenerating(true)

    try {
      const aiResponse = await generateAIResponse(currentInput)

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        isUser: false,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
      setIsGenerating(false)
      setIsGeneratingAudio(true)

      const audioUrl = await convertToSpeech(aiResponse)

      setMessages((prev) => prev.map((msg) => (msg.id === aiMessage.id ? { ...msg, audioUrl } : msg)))
      setCurrentAudioUrl(audioUrl)
      setIsGeneratingAudio(false)

      // Auto-play the response
      setTimeout(() => {
        handlePlayAudio(audioUrl, aiMessage.id)
      }, 500)
    } catch (error) {
      setIsGenerating(false)
      setIsGeneratingAudio(false)
      toast({
        title: "Error",
        description: "Failed to generate response. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle audio playback
  function handlePlayAudio(audioUrl?: string, messageId?: string) {
    if (!audioRef.current) {
      console.error("❌ Audio ref is null")
      return
    }

    const url = audioUrl || currentAudioUrl
    if (!url) {
      console.error("❌ No audio URL provided")
      return
    }

    console.log("🎵 Playing audio for message:", messageId)
    console.log("🔗 Audio URL type:", url.substring(0, 30))

    if (messageId && messageId === playingMessageId && isPlaying) {
      console.log("⏸️ Pausing current audio")
      audioRef.current.pause()
      return
    }

    const audioSrc = url.startsWith("http") || url.startsWith("data:") ? url : `data:audio/mpeg;base64,${url}`

    console.log("✅ Setting audio source...")
    audioRef.current.src = audioSrc
    setCurrentAudioUrl(audioSrc)
    setPlayingMessageId(messageId || null)
    setIsPlaying(true)

    console.log("▶️ Attempting to play...")
    audioRef.current.play().catch((error) => {
      console.error("❌ Error playing audio:", error)
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        code: error.code
      })
      toast({
        title: "Audio Playback Error",
        description: `Failed to play audio: ${error.message}`,
        variant: "destructive",
      })
      setIsPlaying(false)
      setPlayingMessageId(null)
    })
  }

  function stopLipSyncLoop() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    smoothedAmplitudeRef.current = 0
    setMouthFrame("closed")
  }

  function setupLipSync() {
    if (!lipSyncEnabled || !audioRef.current) return

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256
        analyserRef.current.smoothingTimeConstant = Math.min(Math.max(lipSmoothing, 0.1), 0.95)
      }

      if (!sourceNodeRef.current) {
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current)
        sourceNodeRef.current.connect(analyserRef.current)
        analyserRef.current.connect(audioContextRef.current.destination)
      }

      const analyser = analyserRef.current
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        if (!audioRef.current || audioRef.current.paused) {
          stopLipSyncLoop()
          return
        }

        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length
        const normalized = Math.min(1, (avg / 255) * lipSensitivity)
        smoothedAmplitudeRef.current = (smoothedAmplitudeRef.current * lipSmoothing) + (normalized * (1 - lipSmoothing))

        if (smoothedAmplitudeRef.current > 0.38) {
          setMouthFrame("open")
        } else if (smoothedAmplitudeRef.current > 0.2) {
          setMouthFrame("half")
        } else {
          setMouthFrame("closed")
        }

        animationFrameRef.current = requestAnimationFrame(tick)
      }

      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }
      animationFrameRef.current = requestAnimationFrame(tick)
    } catch (error) {
      console.error("Lip sync setup failed:", error)
      stopLipSyncLoop()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_TEXTAREA_ROWS * 24)}px`
  }

  function handleSuggestedPrompt(prompt: string) {
    setInput(prompt)
    inputRef.current?.focus()
  }

  if (!agent) {
    return <div className="min-h-screen bg-auralis-background text-white flex items-center justify-center">Agent not found</div>
  }

  return (
    <div className="min-h-screen bg-auralis-background flex flex-col relative overflow-hidden font-sans selection:bg-auralis-accent/30 selection:text-white">

      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-auralis-surface-2/20 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Header: Agent Presence */}
      <header className="pt-10 pb-6 text-center relative z-10">
        <div className="inline-flex flex-col items-center gap-4">
          <div className="relative group cursor-default">
            <div className={`w-20 h-20 rounded-3xl bg-auralis-surface-1 border border-auralis-border flex items-center justify-center transition-all duration-500 ${status === 'speaking' ? 'ring-4 ring-blue-500/20 scale-105' : ''}`}>
              <Bot className={`w-10 h-10 transition-colors duration-500 ${status === 'speaking' ? 'text-blue-400' :
                status === 'thinking' ? 'text-blue-300' :
                  status === 'listening' ? 'text-slate-200' : 'text-slate-500'
                }`} />
            </div>

            {/* Status Pulse Indicators */}
            {status === 'speaking' && (
              <span className="absolute -inset-1 rounded-3xl border border-blue-500/40 animate-pulse" />
            )}
            {status === 'listening' && (
              <span className="absolute -right-1 -bottom-1 w-4 h-4 bg-blue-500 rounded-full border-4 border-auralis-background" />
            )}
          </div>

          <div>
            <h1 className="text-xl font-bold font-heading text-white tracking-tight">{agent.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <span className={`text-xs font-semibold uppercase tracking-widest transition-colors duration-300 ${status === 'speaking' ? 'text-blue-400' :
                status === 'thinking' ? 'text-indigo-400' :
                  status === 'listening' ? 'text-blue-200/60' : 'text-slate-500'
                }`}>
                {status === 'speaking' ? 'Speaking' :
                  status === 'thinking' ? 'Processing' :
                    status === 'listening' ? 'Listening' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Close/Back Button */}
        <Link href="/dashboard" className="absolute top-10 left-10 p-2.5 rounded-2xl hover:bg-white/5 text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10">
          <ChevronLeft className="w-6 h-6" />
        </Link>
      </header>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col container mx-auto max-w-6xl px-4 min-h-0 relative z-10">
        <div className="flex-1 min-h-0 flex gap-6">
          {companionEnabled && (
            <aside className="hidden lg:flex w-56 shrink-0 items-center justify-center">
              <div className="relative w-44 h-64 rounded-2xl border border-white/10 bg-auralis-surface-1/70 backdrop-blur-md p-3">
                <div className={`absolute inset-2 rounded-xl transition-opacity ${status === "speaking" ? "animate-pulse" : ""}`}>
                  {stateAvatar ? (
                    <Image
                      src={stateAvatar}
                      alt={`${agent.name} companion`}
                      fill
                      className="object-contain"
                      sizes="176px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Bot className="w-16 h-16" />
                    </div>
                  )}
                </div>

                {lipSyncEnabled && mouthFrameUrl && status === "speaking" && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-16 h-8">
                    <Image src={mouthFrameUrl} alt="Mouth frame" fill className="object-contain" sizes="64px" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-slate-300">
                  {status === "speaking" ? "Speaking" : status === "thinking" ? "Thinking" : "Listening"}
                </div>
              </div>
            </aside>
          )}

          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto scrollbar-none py-4 space-y-6"
          >
          {/* Messages */}
          {messages.map((message, index) => {
            const isFirst = index === 0;
            return (
              <div key={message.id} className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`
                            max-w-[85%] rounded-3xl px-6 py-4 text-base leading-relaxed relative transition-all
                            ${message.isUser
                    ? 'bg-auralis-surface-1 text-white/90 rounded-br-none border border-auralis-border shadow-sm'
                    : `bg-auralis-surface-2 text-white border border-blue-500/20 shadow-md rounded-bl-none ${isFirst ? 'p-8 text-lg border-blue-500/30' : ''}`
                  }
                        `}>
                  {/* Subtle Glow for Agent */}
                  {!message.isUser && (
                    <div className="absolute inset-0 bg-blue-500/[0.03] rounded-3xl pointer-events-none" />
                  )}

                  <p className="relative z-10 whitespace-pre-wrap">{message.text}</p>

                  {/* Audio Indicator for Agent */}
                  {message.audioUrl && !message.isUser && (
                    <button
                      onClick={() => handlePlayAudio(message.audioUrl, message.id)}
                      className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400/80 hover:text-blue-400 transition-colors relative z-10"
                    >
                      {playingMessageId === message.id && isPlaying ? (
                        <>
                          <Volume2 className="w-3 h-3 animate-pulse" />
                          Playing
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          Listen Again
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Thinking Animation */}
          {status === 'thinking' && (
            <div className="flex items-start">
              <div className="bg-auralis-surface-2/40 border border-white/5 rounded-2xl rounded-bl-none px-5 py-4 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Suggestions */}
        {messages.length === 1 && !isGenerating && (
          <div className="py-4 flex flex-wrap justify-center gap-2 fade-in duration-500">
            {suggestedPrompts.map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="pb-10 pt-4 bg-transparent relative z-20">
        <div className="container mx-auto max-w-3xl">
          <div className="relative bg-auralis-surface-1/80 backdrop-blur-xl border border-auralis-border rounded-[2.5rem] shadow-2xl flex items-end p-3 transition-all focus-within:border-blue-500/40 focus-within:ring-4 focus-within:ring-blue-500/10">
            {/* Text Input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="You can type or just speak — I'm listening."
              rows={1}
              className="flex-1 bg-transparent border-0 text-white placeholder-slate-500 p-3 min-h-[48px] max-h-[120px] resize-none focus:ring-0 text-base"
            />

            {/* Actions */}
            <div className="flex items-center gap-2 pb-2 pr-2">
              {/* Always visible mic icon as requested */}
              <button
                className="p-3 text-slate-500 hover:text-blue-400 transition-colors rounded-full hover:bg-blue-500/5"
                title="Voice Input (Listening)"
              >
                <div className={`relative ${status === 'listening' ? 'scale-110' : ''}`}>
                  <Mic className={`w-6 h-6 transition-colors ${status === 'listening' ? 'text-blue-400' : ''}`} />
                  {status === 'listening' && (
                    <span className="absolute -inset-1 border border-blue-400/50 rounded-full animate-ping" />
                  )}
                </div>
              </button>

              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isGenerating}
                size="icon"
                className={`w-12 h-12 rounded-full transition-all duration-500 ${input.trim() ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={() => {
          console.log("✅ Audio started playing")
          setIsPlaying(true)
          setupLipSync()
        }}
        onPause={() => {
          console.log("⏸️ Audio paused")
          setIsPlaying(false)
          setPlayingMessageId(null)
          stopLipSyncLoop()
        }}
        onEnded={() => {
          console.log("✅ Audio finished")
          setIsPlaying(false)
          setPlayingMessageId(null)
          stopLipSyncLoop()
        }}
        onError={(e) => {
          console.error("❌ Audio element error:", e)
          const audio = e.currentTarget
          if (audio.error) {
            console.error("Error code:", audio.error.code)
            console.error("Error message:", audio.error.message)
          }
          toast({
            title: "Audio Error",
            description: "Failed to load or play audio file",
            variant: "destructive",
          })
          stopLipSyncLoop()
        }}
        onLoadStart={() => console.log("⏳ Loading audio...")}
        onCanPlay={() => console.log("✅ Audio can play")}
      />
    </div>
  )
}
