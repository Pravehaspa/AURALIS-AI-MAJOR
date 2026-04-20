"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Check, Copy, Mic, Sparkles } from "lucide-react"
import { useApp } from "@/lib/context"
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

export default function ChatPage() {
  const params = useParams()
  const { toast } = useToast()
  const { agents } = useApp()

  const messageAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const currentAudioRef = useRef<{ messageId: string; audio: HTMLAudioElement } | null>(null)
  const recognitionRef = useRef<any>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const speechActionRef = useRef<"none" | "pause" | "stop" | "restart">("none")
  const speechSilenceBufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechSilenceFinalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechSilenceCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechSilenceCycleIdRef = useRef(0)
  const noInputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechInputDetectedRef = useRef(false)
  const isVoiceAutoSendRef = useRef(true)
  const speechFinalBufferRef = useRef("")
  const speechComposedRef = useRef("")
  const interimTranscriptRef = useRef("")
  const queuedMessageRef = useRef<string | null>(null)
  const lastSubmitRef = useRef<{ text: string; at: number } | null>(null)
  const isAutoModeRef = useRef(true)
  const pendingAutoPlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runtimeStateRef = useRef({
    isAutoMode: true,
    isGenerating: false,
    isGeneratingAudio: false,
    anyAudioPlaying: false,
  })

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
  const [isSpeechSupported, setIsSpeechSupported] = useState(true)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [speechStatus, setSpeechStatus] = useState<"idle" | "starting" | "listening" | "processing">("idle")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [silenceFinalizeCountdown, setSilenceFinalizeCountdown] = useState<number | null>(null)
  const [autoSendCountdown, setAutoSendCountdown] = useState<number | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isStreamingResponse, setIsStreamingResponse] = useState(false)

  const agentId = params.id as string
  const agent = agents.find((item) => item.id === agentId)

  const SPEECH_SILENCE_BUFFER_MS = 2000
  const SPEECH_SILENCE_MS = 5000
  const AUTO_SEND_DELAY_MS = 5000
  const NO_INPUT_TIMEOUT_MS = 7000

  const anyAudioPlaying = useMemo(
    () => Object.values(audioState).some((state) => state.isPlaying),
    [audioState],
  )

  const systemPrompt = useMemo(
    () =>
      agent?.prompt ||
      "You are a talkative, empathetic assistant bot. Your main job is to help people reduce stress by chatting with them, giving them calming advice, jokes, or friendly motivation. You talk in a relaxed, human tone, like a good friend who really listens. Keep your responses conversational and not too long (2-3 sentences max).",
    [agent?.prompt],
  )

  const firstMessage = useMemo(
    () =>
      agent?.firstMessage ||
      "Hey there 😊 I'm your little stress-buster buddy! What's on your mind today?",
    [agent?.firstMessage],
  )

  const samplePrompts = useMemo(() => {
    if (agent?.samplePrompts?.length) {
      return agent.samplePrompts.slice(0, 4)
    }

    const byCategory: Record<string, string[]> = {
      Wellness: [
        "I feel stressed. Give me a simple reset routine.",
        "How do I calm down before sleep?",
        "Help me make a no-burnout weekly plan.",
      ],
      Creative: [
        "Give me concept ideas for a startup logo.",
        "How can I improve composition in my poster?",
        "Suggest 3 color palettes for a wellness brand.",
      ],
      Health: [
        "Create a beginner 4-day workout plan.",
        "What should I eat for muscle recovery?",
        "Give me a 20-minute home workout.",
      ],
      Education: [
        "Explain this topic in simple words.",
        "Quiz me with 5 questions.",
        "Make a 7-day revision schedule.",
      ],
    }

    return byCategory[agent?.category || ""] || ["What can you help me with?"]
  }, [agent?.samplePrompts, agent?.category])

  useEffect(() => {
    const historyKey = `chat_history_${agentId}`
    const messagesKey = `chat_messages_${agentId}`
    const initialHistory: HistoryMessage[] = [
      { role: "user", parts: [`System instruction: ${systemPrompt}`] },
      { role: "model", parts: [firstMessage] },
    ]

    try {
      const storedHistory = window.localStorage.getItem(historyKey)
      const storedMessages = window.localStorage.getItem(messagesKey)

      if (storedHistory && storedMessages) {
        const parsedHistory = JSON.parse(storedHistory) as HistoryMessage[]
        const parsedMessages = JSON.parse(storedMessages) as Array<ChatMessage & { timestamp: string }>
        setChatHistory(parsedHistory)
        setMessages(
          parsedMessages.map((item) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          })),
        )
        return
      }
    } catch {
      // Ignore corrupted local state and reset.
    }

    setChatHistory(initialHistory)
    setMessages([
      {
        id: "first-message",
        text: firstMessage,
        isUser: false,
        timestamp: new Date(),
      },
    ])
  }, [systemPrompt, firstMessage, agentId])

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!agentId || messages.length === 0) {
      return
    }

    const historyKey = `chat_history_${agentId}`
    const messagesKey = `chat_messages_${agentId}`

    window.localStorage.setItem(historyKey, JSON.stringify(chatHistory))
    window.localStorage.setItem(messagesKey, JSON.stringify(messages))
  }, [agentId, chatHistory, messages])

  useEffect(() => {
    runtimeStateRef.current = {
      isAutoMode,
      isGenerating,
      isGeneratingAudio,
      anyAudioPlaying,
    }
  }, [isAutoMode, isGenerating, isGeneratingAudio, anyAudioPlaying])

  useEffect(() => {
    isAutoModeRef.current = isAutoMode
    if (!isAutoMode && pendingAutoPlayTimeoutRef.current) {
      clearTimeout(pendingAutoPlayTimeoutRef.current)
      pendingAutoPlayTimeoutRef.current = null
    }
  }, [isAutoMode])

  useEffect(() => {
    isVoiceAutoSendRef.current = isVoiceAutoSend
  }, [isVoiceAutoSend])

  function clearSpeechSilenceTimeout() {
    speechSilenceCycleIdRef.current += 1
    if (speechSilenceBufferTimeoutRef.current) {
      clearTimeout(speechSilenceBufferTimeoutRef.current)
      speechSilenceBufferTimeoutRef.current = null
    }
    if (speechSilenceFinalizeTimeoutRef.current) {
      clearTimeout(speechSilenceFinalizeTimeoutRef.current)
      speechSilenceFinalizeTimeoutRef.current = null
    }
    if (speechSilenceCountdownIntervalRef.current) {
      clearInterval(speechSilenceCountdownIntervalRef.current)
      speechSilenceCountdownIntervalRef.current = null
    }
    setSilenceFinalizeCountdown(null)
  }

  function scheduleSpeechSilenceTimeout() {
    clearSpeechSilenceTimeout()
    const cycleId = speechSilenceCycleIdRef.current
    speechSilenceBufferTimeoutRef.current = setTimeout(() => {
      if (cycleId !== speechSilenceCycleIdRef.current) {
        return
      }
      // Freeze what user already said at pause boundary so resumed speech appends instead of overwriting.
      const bufferedComposed = speechComposedRef.current.trim()
      if (bufferedComposed) {
        speechFinalBufferRef.current = bufferedComposed
        interimTranscriptRef.current = ""
        setInterimTranscript("")
      }
      // Show visible countdown for finalization window (5 seconds).
      setSilenceFinalizeCountdown(5)
      speechSilenceCountdownIntervalRef.current = setInterval(() => {
        setSilenceFinalizeCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (speechSilenceCountdownIntervalRef.current) {
              clearInterval(speechSilenceCountdownIntervalRef.current)
              speechSilenceCountdownIntervalRef.current = null
            }
            return null
          }
          return prev - 1
        })
      }, 1000)
      speechSilenceFinalizeTimeoutRef.current = setTimeout(() => {
        if (cycleId !== speechSilenceCycleIdRef.current) {
          return
        }
        if (speechSilenceCountdownIntervalRef.current) {
          clearInterval(speechSilenceCountdownIntervalRef.current)
          speechSilenceCountdownIntervalRef.current = null
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
      setSpeechError("Microphone permission denied. Please enable microphone access in browser settings.")
      return false
    }
  }

  function finalizeSpeechInput() {
    clearSpeechSilenceTimeout()
    clearNoInputTimeout()
    clearAutoSendTimeout()
    clearAutoSendInterval()
    const finalText = `${speechFinalBufferRef.current} ${interimTranscriptRef.current}`.trim() || input.trim()
    setInterimTranscript("")
    interimTranscriptRef.current = ""
    speechFinalBufferRef.current = ""
    speechComposedRef.current = ""

    if (!finalText) {
      setSpeechStatus("idle")
      return
    }

    setSpeechStatus("processing")

    speechActionRef.current = "stop"
    try {
      recognitionRef.current?.stop()
    } catch {
      // Ignore invalid stop state.
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

  const stopListening = () => {
    speechActionRef.current = "stop"
    setSpeechStatus("idle")
    setIsListeningPaused(false)
    clearSpeechSilenceTimeout()
    clearNoInputTimeout()
    speechInputDetectedRef.current = false
    speechFinalBufferRef.current = ""
    speechComposedRef.current = ""
    interimTranscriptRef.current = ""
    setInterimTranscript("")

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        setIsListening(false)
      }
    }
  }

  const startListening = async (isResumingAfterPause: boolean = false) => {
    if (!recognitionRef.current) {
      return
    }

    const state = runtimeStateRef.current

    if (isListening || state.isGenerating || state.isGeneratingAudio || state.anyAudioPlaying) {
      return
    }

    const hasPermission = await ensureMicrophonePermission()
    if (!hasPermission) {
      return
    }

    try {
      cancelAutoSend()
      speechInputDetectedRef.current = false
      // Only clear buffers if this is a fresh start, not a resume after pause
      // Resume should preserve frozen buffers for append behavior
      if (!isResumingAfterPause) {
      speechFinalBufferRef.current = ""
      speechComposedRef.current = ""
      interimTranscriptRef.current = ""
      setInterimTranscript("")
      }
      setSpeechError(null)
      setSpeechStatus("starting")
      speechActionRef.current = "none"
      recognitionRef.current.start()
      scheduleNoInputTimeout()
    } catch {
      // InvalidStateError can happen if already started.
    }
  }

  const pauseListening = () => {
    if (!isListening) {
      return
    }

    speechActionRef.current = "pause"
    setIsListeningPaused(true)
    setSpeechStatus("idle")
    clearSpeechSilenceTimeout()
    clearNoInputTimeout()
    try {
      recognitionRef.current?.stop()
    } catch {
      setIsListening(false)
    }
  }

  const startOverListening = async () => {
    cancelAutoSend()
    speechInputDetectedRef.current = false
    speechFinalBufferRef.current = ""
    speechComposedRef.current = ""
    interimTranscriptRef.current = ""
    setInterimTranscript("")
    setInput("")
    clearSpeechSilenceTimeout()
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

  const resumeListening = async () => {
    if (!isListeningPaused) {
      return
    }

    setIsListeningPaused(false)
    await startListening(true)
  }

  async function requestAIResponse(nextHistory: HistoryMessage[]) {
    const trimmedHistory = nextHistory.slice(-18)

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmedHistory[trimmedHistory.length - 1]?.parts?.[0] || "",
        agentPrompt: systemPrompt,
        agentCategory: agent?.category || "",
        botId: agentId,
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

  async function streamAssistantMessage(messageId: string, fullText: string) {
    setIsStreamingResponse(true)
    setMessages((prev) => [...prev, { id: messageId, text: "", isUser: false, timestamp: new Date() }])

    const chunkSize = fullText.length > 800 ? 18 : 10
    let cursor = 0

    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        cursor = Math.min(cursor + chunkSize, fullText.length)
        const partial = fullText.slice(0, cursor)
        setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, text: partial } : msg)))

        if (cursor >= fullText.length) {
          clearInterval(timer)
          resolve()
        }
      }, 18)
    })

    setIsStreamingResponse(false)
  }

  async function copyMessage(text: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId((current) => (current === messageId ? null : current)), 1200)
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy response right now.",
        variant: "destructive",
      })
    }
  }

  async function requestSpeech(text: string) {
    const response = await fetch("/api/text-to-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voiceId: agent?.voiceId || "en-US-terrell",
      }),
    })

    const payload = await readJsonResponse<{ audioUrl?: string; error?: string }>(response, "/api/text-to-speech")
    if (!response.ok) {
      throw new Error(payload.error || "Failed to convert text to speech")
    }

    return payload.audioUrl as string
  }

  async function sendMessage(rawText: string) {
    const text = rawText.trim()
    if (!text) {
      return
    }

    // Barge-in: sending a new message must interrupt any currently playing TTS immediately.
    clearPendingAutoPlay()
    stopCurrentAudioPlayback()

    if (isGenerating || isGeneratingAudio) {
      queuedMessageRef.current = text
      return
    }

    if (
      lastSubmitRef.current &&
      lastSubmitRef.current.text === text &&
      Date.now() - lastSubmitRef.current.at < 750
    ) {
      return
    }

    lastSubmitRef.current = { text, at: Date.now() }

    if (isListening) {
      stopListening()
    }

    cancelAutoSend()

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
      const aiText = await requestAIResponse(nextHistory)
      const finalHistory = [...nextHistory, { role: "model" as const, parts: [aiText] }]

      setChatHistory(finalHistory)

      const aiMessageId = `${Date.now()}-ai`
      await streamAssistantMessage(aiMessageId, aiText)
      setIsGenerating(false)
      setIsGeneratingAudio(true)

      const audioUrl = await requestSpeech(aiText)
      setMessages((prev) => prev.map((msg) => (msg.id === aiMessageId ? { ...msg, audioUrl } : msg)))
      setIsGeneratingAudio(false)
      setSpeechStatus("idle")

      if (isAutoModeRef.current) {
        clearPendingAutoPlay()
        pendingAutoPlayTimeoutRef.current = setTimeout(() => {
          pendingAutoPlayTimeoutRef.current = null
          if (!isAutoModeRef.current) {
            return
          }
          void playMessageAudio(aiMessageId)
        }, 250)
      }
    } catch (error) {
      setIsGenerating(false)
      setIsGeneratingAudio(false)

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate response. Please try again.",
        variant: "destructive",
      })
      setSpeechStatus("idle")
    }
  }

  async function playMessageAudio(messageId: string) {
    const audioElement = messageAudioRefs.current[messageId]
    if (!audioElement) {
      return
    }

    if (currentAudioRef.current && currentAudioRef.current.messageId !== messageId) {
      stopCurrentAudioPlayback()
    }

    for (const [otherId, otherAudio] of Object.entries(messageAudioRefs.current)) {
      if (otherId !== messageId && otherAudio && !otherAudio.paused) {
        otherAudio.pause()
      }
    }

    if (isListening) {
      stopListening()
    }

    try {
      await audioElement.play()
    } catch {
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setIsSpeechSupported(false)
      return
    }

    const recognition = new Recognition()
    recognition.lang = "en-US"
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      speechInputDetectedRef.current = false
      setSpeechStatus("listening")
    }

    recognition.onresult = (event: any) => {
      let finalChunk = ""
      let interimChunk = ""

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          finalChunk += event.results[index][0].transcript
        } else {
          interimChunk += event.results[index][0].transcript
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
        scheduleSpeechSilenceTimeout()
      }
    }

    recognition.onerror = (event: any) => {
      setIsListening(false)
      setSpeechStatus("idle")
      clearSpeechSilenceTimeout()
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
      speechActionRef.current = "none"
      clearSpeechSilenceTimeout()
      clearNoInputTimeout()
      clearAutoSendTimeout()
      clearAutoSendInterval()
      speechFinalBufferRef.current = ""
      speechComposedRef.current = ""
      interimTranscriptRef.current = ""
      speechInputDetectedRef.current = false
      setInterimTranscript("")
      setAutoSendCountdown(null)
      setSilenceFinalizeCountdown(null)
      setSpeechStatus("idle")
      recognition.stop()
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

  useEffect(() => {
    if ((anyAudioPlaying || isGenerating || isGeneratingAudio) && isListening) {
      stopListening()
    }
  }, [anyAudioPlaying, isGenerating, isGeneratingAudio, isListening])

  useEffect(() => {
    if (!isGenerating && !isGeneratingAudio && queuedMessageRef.current) {
      const queued = queuedMessageRef.current
      queuedMessageRef.current = null
      void sendMessage(queued)
    }
  }, [isGenerating, isGeneratingAudio])

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Agent not found</h1>
          <Link href="/dashboard" className="text-purple-400 hover:text-purple-300">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/auralis-ai-logo.png"
                alt="Elite AI"
                width={32}
                height={24}
                className="w-8 h-6 object-contain"
              />
              <span className="text-xl font-bold text-white">Auralis AI</span>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                ← Back
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
                <p className="text-gray-300">{agent.description}</p>
              </div>
            </div>
            <div className="text-sm text-gray-400">{agent.category}</div>
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-lg h-[calc(100vh-210px)] min-h-[420px] max-h-[760px] md:h-[600px] flex flex-col">
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.isUser ? "justify-end" : "justify-start"}`}>
                {!message.isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-lg p-3 ${
                    message.isUser
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-white/10 text-gray-100"
                  }`}
                >
                  <ChatMessageContent content={message.text} />
                  {!message.isUser && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => void copyMessage(message.text, message.id)}
                        className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs text-gray-200 hover:bg-white/20 transition-colors"
                      >
                        {copiedMessageId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedMessageId === message.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                  {message.audioUrl && !message.isUser && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            audioState[message.id]?.isPlaying
                              ? pauseMessageAudio(message.id)
                              : playMessageAudio(message.id)
                          }
                          className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                        >
                          {audioState[message.id]?.isPlaying
                            ? "⏸ Pause"
                            : audioState[message.id]?.isPaused
                              ? "▶ Resume"
                              : "🔊 Play"}
                        </button>
                        <button
                          onClick={() => stopMessageAudio(message.id)}
                          disabled={!audioState[message.id]?.isPlaying && !audioState[message.id]?.isPaused}
                          className="text-xs bg-red-500/30 hover:bg-red-500/40 disabled:opacity-50 px-2 py-1 rounded transition-colors"
                        >
                          ⏹ Stop
                        </button>
                      </div>
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
                    👤
                  </div>
                )}
              </div>
            ))}
            {(isGenerating || isGeneratingAudio) && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  🤖
                </div>
                <div className="bg-white/10 text-gray-100 rounded-lg p-3">
                  <p className="text-sm inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    {isGenerating ? "Thinking..." : isStreamingResponse ? "Streaming response..." : "Preparing voice..."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setIsAutoMode((prev) => !prev)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  isAutoMode ? "bg-green-500/30 text-green-100" : "bg-white/10 text-gray-300"
                }`}
              >
                {isAutoMode ? "Auto Mode: ON" : "Auto Mode: OFF"}
              </button>
              <button
                onClick={() => setIsVoiceAutoSend((prev) => !prev)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  isVoiceAutoSend ? "bg-blue-500/30 text-blue-100" : "bg-white/10 text-gray-300"
                }`}
              >
                {isVoiceAutoSend ? "Voice Auto Send: ON" : "Voice Auto Send: OFF"}
              </button>
              <button
                onClick={() => {
                  if (isListening || isListeningPaused) {
                    finalizeSpeechInput()
                  } else {
                    void startListening()
                  }
                }}
                disabled={!isSpeechSupported || isGenerating || isGeneratingAudio || anyAudioPlaying}
                className="px-3 py-1 rounded text-xs bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isListening || isListeningPaused ? "Stop Listening" : "Voice Input"}
              </button>
              {(isListening || isListeningPaused) && (
                <>
                  <button
                    onClick={() => {
                      if (isListening) {
                        pauseListening()
                      } else {
                        void resumeListening()
                      }
                    }}
                    className="px-3 py-1 rounded text-xs bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
                  >
                    {isListening ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => void startOverListening()}
                    className="px-3 py-1 rounded text-xs bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
                  >
                    Start Over
                  </button>
                </>
              )}
              <span className="text-xs text-gray-400 self-center">
                {speechStatus === "starting"
                  ? "Starting mic..."
                  : isListeningPaused
                    ? "Paused"
                  : isListening
                    ? "Listening..."
                    : speechStatus === "processing"
                      ? "Processing speech..."
                      : anyAudioPlaying
                        ? "Speaking..."
                        : "Idle"}
              </span>
            </div>

            {(interimTranscript || speechError) && (
              <div className="mb-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200">
                {interimTranscript && <div>Heard: {interimTranscript}</div>}
                {speechError && <div className="text-red-300">{speechError}</div>}
              </div>
            )}

            {silenceFinalizeCountdown !== null && (
              <div className="mb-2 flex items-center justify-between rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <span>Finalizing in {silenceFinalizeCountdown}s...</span>
                <span className="text-amber-200 font-semibold">{silenceFinalizeCountdown}</span>
              </div>
            )}

            {autoSendCountdown !== null && (
              <div className="mb-2 flex items-center justify-between rounded border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                <span>Sending in {autoSendCountdown}...</span>
                <button
                  onClick={cancelAutoSend}
                  className="rounded bg-white/10 px-2 py-1 text-blue-100 hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-200 transition-all hover:border-blue-300 hover:bg-blue-500/20"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isSpeechSupported ? "Type or use voice..." : "Type your message..."}
                className="flex-1 bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none"
                rows={1}
              />
              <button
                onClick={() => {
                  if (isListening || isListeningPaused) {
                    finalizeSpeechInput()
                  } else {
                    void startListening()
                  }
                }}
                disabled={!isSpeechSupported || isGenerating || isGeneratingAudio || anyAudioPlaying}
                className={`px-3 py-2 rounded-lg border transition-colors ${
                  isListening || isListeningPaused
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                    : "border-white/20 bg-black/20 text-gray-300 hover:bg-white/10"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Toggle microphone"
                title={isListening || isListeningPaused ? "Stop microphone" : "Start microphone"}
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                onClick={() => void sendMessage(input)}
                disabled={isGenerating || isGeneratingAudio || !input.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating || isGeneratingAudio ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
