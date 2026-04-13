"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Send,
  Bot,
  User,
  Loader2,
  Mic,
  Square,
  Play,
  Pause,
  Square as Stop,
} from "lucide-react"
import { useApp } from "@/lib/context"
import { useToast } from "@/hooks/use-toast"
import { readJsonResponse } from "@/lib/http"
import { ensureAgentConfig } from "@/lib/agent-domain"
import { ChatMessageContent } from "@/components/chat-message-content"

interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  audioUrl?: string
  timestamp: Date
}

type HistoryMessage = {
  role: "user" | "model"
  parts: string[]
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function ChatWidgetPage() {
  const { agents } = useApp()
  const { toast } = useToast()
  const [isClient, setIsClient] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatHistory, setChatHistory] = useState<HistoryMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [audioState, setAudioState] = useState<Record<string, { isPlaying: boolean; isPaused: boolean }>>({})
  const [isAutoMode, setIsAutoMode] = useState(true)
  const [isVoiceAutoSend, setIsVoiceAutoSend] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [isListeningPaused, setIsListeningPaused] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [speechStatus, setSpeechStatus] = useState<"idle" | "starting" | "listening" | "processing">("idle")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [isSpeechSupported, setIsSpeechSupported] = useState(true)
  const [silenceFinalizeCountdown, setSilenceFinalizeCountdown] = useState<number | null>(null)
  const [autoSendCountdown, setAutoSendCountdown] = useState<number | null>(null)

  // Refs
  const messageAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const currentAudioRef = useRef<{ messageId: string; audio: HTMLAudioElement } | null>(null)
  const recognitionRef = useRef<any>(null)
  const speechActionRef = useRef<"none" | "pause" | "stop" | "restart">("none")
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const silenceBufferTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const silenceFinalizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const silenceCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const silenceCycleIdRef = useRef(0)
  const noInputTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoSendIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const speechInputDetectedRef = useRef(false)
  const isVoiceAutoSendRef = useRef(true)
  const speechFinalBufferRef = useRef("")
  const speechComposedRef = useRef("")
  const interimTranscriptRef = useRef("")
  const micStreamRef = useRef<MediaStream | null>(null)
  const queuedMessageRef = useRef<string | null>(null)
  const lastSubmitRef = useRef<{ text: string; at: number } | null>(null)
  const isAutoModeRef = useRef(true)
  const pendingAutoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get agent from URL params
  const agentId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : ''
  const agent = agents.find(a => a.id === agentId)

  const SPEECH_SILENCE_BUFFER_MS = 2000
  const SPEECH_SILENCE_MS = 5000
  const AUTO_SEND_DELAY_MS = 5000
  const NO_INPUT_TIMEOUT_MS = 7000

  const anyAudioPlaying = useMemo(
    () => Object.values(audioState).some((state) => state.isPlaying),
    [audioState],
  )

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    isVoiceAutoSendRef.current = isVoiceAutoSend
  }, [isVoiceAutoSend])

  useEffect(() => {
    isAutoModeRef.current = isAutoMode
    if (!isAutoMode && pendingAutoPlayTimeoutRef.current) {
      clearTimeout(pendingAutoPlayTimeoutRef.current)
      pendingAutoPlayTimeoutRef.current = null
    }
  }, [isAutoMode])

  // Initialize conversation
  useEffect(() => {
    if (!agent) return

    const initialHistory: HistoryMessage[] = [
      { role: "user", parts: [`System instruction: ${agent.prompt}`] },
      { role: "model", parts: [agent.firstMessage] },
    ]

    setChatHistory(initialHistory)

    const firstMessage: ChatMessage = {
      id: "first-message",
      text: agent.firstMessage,
      isUser: false,
      timestamp: new Date(),
    }
    setMessages([firstMessage])
  }, [agent])

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  function clearSpeechTimeout() {
    silenceCycleIdRef.current += 1
    if (silenceBufferTimeoutRef.current) {
      clearTimeout(silenceBufferTimeoutRef.current)
      silenceBufferTimeoutRef.current = null
    }
    if (silenceFinalizeTimeoutRef.current) {
      clearTimeout(silenceFinalizeTimeoutRef.current)
      silenceFinalizeTimeoutRef.current = null
    }
    if (silenceCountdownIntervalRef.current) {
      clearInterval(silenceCountdownIntervalRef.current)
      silenceCountdownIntervalRef.current = null
    }
    setSilenceFinalizeCountdown(null)
  }

  function scheduleSpeechTimeout() {
    clearSpeechTimeout()
    const cycleId = silenceCycleIdRef.current
    silenceBufferTimeoutRef.current = setTimeout(() => {
      if (cycleId !== silenceCycleIdRef.current) {
        return
      }
      // Preserve current composed text across pauses so resumed speech appends naturally.
      const bufferedComposed = speechComposedRef.current.trim()
      if (bufferedComposed) {
        speechFinalBufferRef.current = bufferedComposed
        interimTranscriptRef.current = ""
        setInterimTranscript("")
      }
      // Show visible countdown for finalization window (5 seconds).
      setSilenceFinalizeCountdown(5)
      silenceCountdownIntervalRef.current = setInterval(() => {
        setSilenceFinalizeCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (silenceCountdownIntervalRef.current) {
              clearInterval(silenceCountdownIntervalRef.current)
              silenceCountdownIntervalRef.current = null
            }
            return null
          }
          return prev - 1
        })
      }, 1000)
      silenceFinalizeTimeoutRef.current = setTimeout(() => {
        if (cycleId !== silenceCycleIdRef.current) {
          return
        }
        if (silenceCountdownIntervalRef.current) {
          clearInterval(silenceCountdownIntervalRef.current)
          silenceCountdownIntervalRef.current = null
        }
        setSilenceFinalizeCountdown(null)
        finalizeSpeechInput()
      }, SPEECH_SILENCE_MS)
    }, SPEECH_SILENCE_BUFFER_MS)
  }

  function clearNoInputTimeout() {
    if (noInputTimeoutRef.current) {
      clearTimeout(noInputTimeoutRef.current)
      noInputTimeoutRef.current = null
    }
  }

  function clearAutoSendTimeout() {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current)
      autoSendTimeoutRef.current = null
    }
  }

  function clearAutoSendInterval() {
    if (autoSendIntervalRef.current) {
      clearInterval(autoSendIntervalRef.current)
      autoSendIntervalRef.current = null
    }
  }

  function cancelAutoSend() {
    clearAutoSendTimeout()
    clearAutoSendInterval()
    setAutoSendCountdown(null)
    setSpeechStatus("idle")
  }

  function clearPendingAutoPlay() {
    if (pendingAutoPlayTimeoutRef.current) {
      clearTimeout(pendingAutoPlayTimeoutRef.current)
      pendingAutoPlayTimeoutRef.current = null
    }
  }

  function scheduleNoInputTimeout() {
    clearNoInputTimeout()
    noInputTimeoutRef.current = setTimeout(() => {
      if (!speechInputDetectedRef.current) {
        stopListening()
      }
    }, NO_INPUT_TIMEOUT_MS)
  }

  async function ensureMicrophonePermission() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return true
    }

    if (micStreamRef.current) {
      return true
    }

    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      return true
    } catch {
      setSpeechError("Microphone permission denied. Please enable microphone access.")
      return false
    }
  }

  function finalizeSpeechInput() {
    clearSpeechTimeout()
    clearNoInputTimeout()
    clearAutoSendTimeout()
    clearAutoSendInterval()
    const finalText = `${speechFinalBufferRef.current} ${interimTranscriptRef.current}`.trim() || input.trim()
    speechFinalBufferRef.current = ""
    speechComposedRef.current = ""
    setInterimTranscript("")
    interimTranscriptRef.current = ""
    setSpeechStatus("processing")

    speechActionRef.current = "stop"
    try {
      recognitionRef.current?.stop()
    } catch {
      // Ignore stop race.
    }

    if (!finalText) {
      setSpeechStatus("idle")
      return
    }

    setInput(finalText)

    // Strict rule: after the silence cycle completes, do not start any additional timers.
    if (isVoiceAutoSendRef.current) {
      setAutoSendCountdown(null)
      void sendMessage(finalText)
      return
    }

    setAutoSendCountdown(null)
    setSpeechStatus("idle")
  }

  const startListening = async (isResumingAfterPause: boolean = false) => {
    if (!recognitionRef.current) {
      return
    }

    if (isGenerating || isGeneratingAudio || anyAudioPlaying || isListening) {
      return
    }

    const hasPermission = await ensureMicrophonePermission()
    if (!hasPermission) {
      return
    }

    setSpeechError(null)
    cancelAutoSend()
    speechInputDetectedRef.current = false
    if (!isResumingAfterPause) {
      speechFinalBufferRef.current = ""
      speechComposedRef.current = ""
      interimTranscriptRef.current = ""
      setInterimTranscript("")
    }
    setSpeechStatus("starting")
    speechActionRef.current = "none"
    try {
      recognitionRef.current.start()
      scheduleNoInputTimeout()
    } catch {
      setSpeechStatus("idle")
    }
  }

  const stopListening = () => {
    speechActionRef.current = "stop"
    clearSpeechTimeout()
    clearNoInputTimeout()
    speechInputDetectedRef.current = false
    speechFinalBufferRef.current = ""
    speechComposedRef.current = ""
    interimTranscriptRef.current = ""
    setInterimTranscript("")
    setSpeechStatus("idle")
    setIsListeningPaused(false)
    try {
      recognitionRef.current?.stop()
    } catch {
      setIsListening(false)
    }
  }

  const pauseListening = () => {
    if (!isListening) {
      return
    }

    speechActionRef.current = "pause"
    setIsListeningPaused(true)
    setSpeechStatus("idle")
    clearSpeechTimeout()
    clearNoInputTimeout()
    try {
      recognitionRef.current?.stop()
    } catch {
      setIsListening(false)
    }
  }

  const resumeListening = async () => {
    if (!isListeningPaused) {
      return
    }

    setIsListeningPaused(false)
    await startListening(true)
  }

  const startOverListening = async () => {
    cancelAutoSend()
    speechInputDetectedRef.current = false
    speechFinalBufferRef.current = ""
    speechComposedRef.current = ""
    interimTranscriptRef.current = ""
    setInterimTranscript("")
    setInput("")
    clearSpeechTimeout()
    clearNoInputTimeout()
    clearAutoSendTimeout()

    if (isListening) {
      speechActionRef.current = "restart"
      try {
        recognitionRef.current?.stop()
      } catch {
        // Ignore stop race.
      }
      return
    }

    setIsListeningPaused(false)
    await startListening(false)
  }

  const toggleListening = () => {
    if (isListening || isListeningPaused) {
      finalizeSpeechInput()
      return
    }
    void startListening()
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSpeechSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      setIsListeningPaused(false)
      speechInputDetectedRef.current = false
      setSpeechStatus("listening")
    }

    recognition.onresult = (event: any) => {
      let finalChunk = ""
      let interimChunk = ""

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalChunk += chunk
        } else {
          interimChunk += chunk
        }
      }

      if (finalChunk.trim()) {
        speechFinalBufferRef.current = `${speechFinalBufferRef.current} ${finalChunk}`.trim()
      }

      const hasNewSpeech = Boolean(finalChunk.trim() || interimChunk.trim())

      if (hasNewSpeech) {
        speechInputDetectedRef.current = true
        clearNoInputTimeout()
      }

      const interimTrimmed = interimChunk.trim()
      setInterimTranscript(interimTrimmed)
      interimTranscriptRef.current = interimTrimmed
      const composed = `${speechFinalBufferRef.current} ${interimChunk}`.trim()
      if (composed) {
        speechComposedRef.current = composed
        setInput(composed)
      }

      if (hasNewSpeech && composed.trim()) {
        scheduleSpeechTimeout()
      }
    }

    recognition.onerror = (event: any) => {
      setIsListening(false)
      setSpeechStatus("idle")
      clearSpeechTimeout()
      clearNoInputTimeout()
      speechInputDetectedRef.current = false
      if (event?.error && event.error !== "no-speech" && event.error !== "aborted") {
        setSpeechError(`Speech recognition error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      setIsListening(false)

      if (speechActionRef.current === "pause") {
        speechActionRef.current = "none"
        setSpeechStatus("idle")
        return
      }

      if (speechActionRef.current === "restart") {
        speechActionRef.current = "none"
        setIsListeningPaused(false)
        void startListening()
        return
      }

      speechActionRef.current = "none"
      setIsListeningPaused(false)
      speechInputDetectedRef.current = false
      setSpeechStatus("idle")
    }

    recognitionRef.current = recognition

    return () => {
      clearPendingAutoPlay()
      stopCurrentAudioPlayback()
      clearSpeechTimeout()
      clearNoInputTimeout()
      clearAutoSendTimeout()
      clearAutoSendInterval()
      speechActionRef.current = "none"
      speechFinalBufferRef.current = ""
      speechComposedRef.current = ""
      interimTranscriptRef.current = ""
      speechInputDetectedRef.current = false
      setInterimTranscript("")
      setAutoSendCountdown(null)
      try {
        recognition.stop()
      } catch {
        // Ignore stop race.
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
        micStreamRef.current = null
      }
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isVoiceAutoSend) {
      cancelAutoSend()
    }
  }, [isVoiceAutoSend])

  useEffect(() => {
    const stored = window.localStorage.getItem("voice_auto_send_enabled")
    if (stored === "0" || stored === "1") {
      setIsVoiceAutoSend(stored === "1")
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem("voice_auto_send_enabled", isVoiceAutoSend ? "1" : "0")
  }, [isVoiceAutoSend])

  async function requestAIResponse(nextHistory: HistoryMessage[]) {
    const trimmedHistory = nextHistory.slice(-18)
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmedHistory[trimmedHistory.length - 1]?.parts?.[0] || "",
        agentPrompt: agent?.prompt || "You are a helpful AI assistant.",
        agentCategory: agent?.category || "",
        agentConfig: agent ? ensureAgentConfig(agent) : undefined,
        history: trimmedHistory,
      }),
    })

    const payload = await readJsonResponse<{ text?: string; error?: string }>(response, "/api/chat")
    if (!response.ok) {
      throw new Error(payload.error || "Failed to generate response")
    }

    return payload.text as string
  }

  // Convert text to speech
  async function convertToSpeech(outputText: string) {
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: outputText,
          voiceId: agent?.voiceId || "en-US-terrell",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to convert text to speech")
      }

      const data = await readJsonResponse<{ audioUrl?: string; error?: string }>(response, "/api/text-to-speech")
      return data.audioUrl
    } catch (error) {
      console.error("Error converting to speech:", error)
      throw error
    }
  }

  // Handle send message
  async function sendMessage(rawText: string) {
    const text = rawText.trim()
    if (!text) return

    // Barge-in: immediately interrupt any active TTS when a new message is sent.
    clearPendingAutoPlay()
    stopCurrentAudioPlayback()

    if (isListening) {
      stopListening()
    }

    cancelAutoSend()

    if (isGenerating || isGeneratingAudio) {
      queuedMessageRef.current = text
      return
    }

    if (lastSubmitRef.current && lastSubmitRef.current.text === text && Date.now() - lastSubmitRef.current.at < 750) {
      return
    }
    lastSubmitRef.current = { text, at: Date.now() }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsGenerating(true)

    try {
      const nextHistory = [...chatHistory, { role: "user" as const, parts: [text] }]
      const aiResponse = await requestAIResponse(nextHistory)
      const finalHistory = [...nextHistory, { role: "model" as const, parts: [aiResponse] }]
      setChatHistory(finalHistory)

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
      setIsGeneratingAudio(false)
      setSpeechStatus("idle")

      if (isAutoModeRef.current) {
        clearPendingAutoPlay()
        pendingAutoPlayTimeoutRef.current = setTimeout(() => {
          pendingAutoPlayTimeoutRef.current = null
          if (!isAutoModeRef.current) {
            return
          }
          void playMessageAudio(aiMessage.id)
        }, 500)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
      setIsGenerating(false)
      setIsGeneratingAudio(false)
      setSpeechStatus("idle")
    }
  }

  async function handleSendMessage() {
    await sendMessage(input)
  }

  async function playMessageAudio(messageId: string) {
    const audioElement = messageAudioRefs.current[messageId]
    if (!audioElement) return

    if (currentAudioRef.current && currentAudioRef.current.messageId !== messageId) {
      stopCurrentAudioPlayback()
    }

    for (const [otherId, otherAudio] of Object.entries(messageAudioRefs.current)) {
      if (otherId !== messageId && otherAudio && !otherAudio.paused) {
        otherAudio.pause()
      }
    }

    if (isListening) {
      recognitionRef.current?.stop()
    }

    try {
      await audioElement.play()
    } catch (error) {
      console.error("Error playing audio:", error)
      setAudioState((prev) => ({
        ...prev,
        [messageId]: { isPlaying: false, isPaused: false },
      }))
    }
  }

  function pauseMessageAudio(messageId: string) {
    const audioElement = messageAudioRefs.current[messageId]
    if (!audioElement) return
    audioElement.pause()
    if (currentAudioRef.current?.messageId === messageId) {
      currentAudioRef.current = null
    }
  }

  function stopMessageAudio(messageId: string) {
    const audioElement = messageAudioRefs.current[messageId]
    if (!audioElement) return

    audioElement.pause()
    audioElement.currentTime = 0

    setAudioState((prev) => ({
      ...prev,
      [messageId]: { isPlaying: false, isPaused: false },
    }))

    if (currentAudioRef.current?.messageId === messageId) {
      currentAudioRef.current = null
    }
  }

  function stopCurrentAudioPlayback() {
    const currentAudio = currentAudioRef.current
    if (!currentAudio) {
      return
    }

    currentAudio.audio.pause()
    currentAudio.audio.currentTime = 0
    setAudioState((prev) => ({
      ...prev,
      [currentAudio.messageId]: { isPlaying: false, isPaused: false },
    }))
    currentAudioRef.current = null
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  useEffect(() => {
    if (!isGenerating && !isGeneratingAudio && queuedMessageRef.current) {
      const queued = queuedMessageRef.current
      queuedMessageRef.current = null
      void sendMessage(queued)
    }
  }, [isGenerating, isGeneratingAudio])

  if (!isClient) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white">Loading chat...</h1>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-black/40 border-red-500/20 backdrop-blur-xl max-w-md">
          <CardContent className="p-6 text-center">
            <Bot className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-white text-lg font-semibold mb-2">Agent Not Found</h3>
            <p className="text-gray-300">The requested agent could not be found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Header */}
      <CardHeader className="border-b border-white/10 flex-shrink-0 bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">{agent.name}</CardTitle>
              <p className="text-gray-400 text-sm">{agent.description}</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
            {agent.category}
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAutoMode((prev) => !prev)}
            className={`border-white/20 bg-transparent ${
              isAutoMode ? "text-green-300 hover:bg-green-500/20" : "text-gray-300 hover:bg-white/10"
            }`}
          >
            {isAutoMode ? "Auto Mode: ON" : "Auto Mode: OFF"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsVoiceAutoSend((prev) => !prev)}
            className={`border-white/20 bg-transparent ${
              isVoiceAutoSend ? "text-blue-300 hover:bg-blue-500/20" : "text-gray-300 hover:bg-white/10"
            }`}
          >
            {isVoiceAutoSend ? "Voice Auto Send: ON" : "Voice Auto Send: OFF"}
          </Button>
        </div>
      </CardHeader>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.isUser ? "justify-end" : "justify-start"
            }`}
          >
            {!message.isUser && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.isUser
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "bg-white/10 text-gray-100"
              }`}
            >
              <ChatMessageContent content={message.text} />
              {message.audioUrl && !message.isUser && (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    onClick={() =>
                      audioState[message.id]?.isPlaying
                        ? pauseMessageAudio(message.id)
                        : playMessageAudio(message.id)
                    }
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-gray-300 hover:bg-white/10 bg-transparent"
                  >
                    {audioState[message.id]?.isPlaying ? (
                      <>
                        <Pause className="w-3 h-3 mr-1" />
                        Pause
                      </>
                    ) : audioState[message.id]?.isPaused ? (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Play
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => stopMessageAudio(message.id)}
                    size="sm"
                    variant="outline"
                    disabled={!audioState[message.id]?.isPlaying && !audioState[message.id]?.isPaused}
                    className="border-red-400/30 text-red-300 hover:bg-red-500/20 bg-transparent disabled:opacity-50"
                  >
                    <Stop className="w-3 h-3 mr-1" />
                    Stop
                  </Button>
                  <audio
                    ref={(element) => {
                      messageAudioRefs.current[message.id] = element
                    }}
                    src={message.audioUrl}
                    onPlay={() => {
                      currentAudioRef.current = {
                        messageId: message.id,
                        audio: messageAudioRefs.current[message.id] as HTMLAudioElement,
                      }
                      setAudioState((prev) => ({
                        ...prev,
                        [message.id]: { isPlaying: true, isPaused: false },
                      }))
                    }}
                    onPause={(event) => {
                      const pausedAtMiddle =
                        event.currentTarget.currentTime > 0 &&
                        event.currentTarget.currentTime < event.currentTarget.duration
                      setAudioState((prev) => ({
                        ...prev,
                        [message.id]: { isPlaying: false, isPaused: pausedAtMiddle },
                      }))
                      if (currentAudioRef.current?.messageId === message.id) {
                        currentAudioRef.current = null
                      }
                    }}
                    onEnded={() => {
                      setAudioState((prev) => ({
                        ...prev,
                        [message.id]: { isPlaying: false, isPaused: false },
                      }))
                      if (currentAudioRef.current?.messageId === message.id) {
                        currentAudioRef.current = null
                      }
                    }}
                    className="hidden"
                  />
                </div>
              )}
            </div>
            {message.isUser && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {isGenerating && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white/10 text-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4 flex-shrink-0 bg-black/20">
        {/* Voice input indicator */}
        {(isListening || interimTranscript) && (
          <div className="mb-3 p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-purple-300 text-sm">
              <Mic className="w-4 h-4 animate-pulse" />
              <span>
                {speechStatus === "starting"
                  ? "Starting mic..."
                  : isListeningPaused
                    ? "Paused"
                  : speechStatus === "processing"
                    ? "Processing speech..."
                    : "Listening..."}
              </span>
              {interimTranscript && (
                <span className="text-white">"{interimTranscript}"</span>
              )}
            </div>
          </div>
        )}
        {speechError && (
          <div className="mb-3 p-2 rounded border border-red-400/30 bg-red-500/10 text-red-200 text-xs">
            {speechError}
          </div>
        )}
        {silenceFinalizeCountdown !== null && (
          <div className="mb-3 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-between">
            <span className="text-amber-300 text-sm font-medium">Finalizing in {silenceFinalizeCountdown}s...</span>
            <span className="text-amber-200 text-lg font-bold">{silenceFinalizeCountdown}</span>
          </div>
        )}

        {autoSendCountdown !== null && (
          <div className="mb-3 flex items-center justify-between rounded border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
            <span>Sending in {autoSendCountdown}...</span>
            <Button
              onClick={cancelAutoSend}
              size="sm"
              variant="outline"
              className="border-white/20 text-blue-100 hover:bg-white/10 bg-transparent h-7 px-2"
            >
              Cancel
            </Button>
          </div>
        )}
        
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message or use voice input..."
            className="flex-1 bg-white/5 border-white/20 text-white placeholder-gray-400 resize-none min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={toggleListening}
            disabled={!isSpeechSupported || isGenerating || isGeneratingAudio || anyAudioPlaying}
            variant="outline"
            aria-label={isListening || isListeningPaused ? "Stop Listening" : "Voice Input"}
            className={`border-white/20 text-gray-300 hover:bg-white/10 bg-transparent flex-shrink-0 ${
              isListening || isListeningPaused ? 'bg-red-500/20 border-red-500/30 text-red-300' : ''
            }`}
          >
            {isListening || isListeningPaused ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
          {(isListening || isListeningPaused) && (
            <>
              <Button
                onClick={() => {
                  if (isListening) {
                    pauseListening()
                  } else {
                    void resumeListening()
                  }
                }}
                variant="outline"
                className="border-white/20 text-gray-300 hover:bg-white/10 bg-transparent flex-shrink-0"
              >
                {isListening ? "Pause" : "Resume"}
              </Button>
              <Button
                onClick={() => void startOverListening()}
                variant="outline"
                className="border-white/20 text-gray-300 hover:bg-white/10 bg-transparent flex-shrink-0"
              >
                Start Over
              </Button>
            </>
          )}
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isGenerating || isGeneratingAudio}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
} 