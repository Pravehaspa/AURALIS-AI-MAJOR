"use client"

import React, { useState, useEffect, useRef } from "react"
import { Sparkles, X, Mic, Send, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Message {
  text: string
  sender: "user" | "bot"
  timestamp: number
}

const STORAGE_KEY = "auralis_native_chat_v1"

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse chat history")
      }
    } else {
      setMessages([
        {
          text: "Hello! I'm Auralis AI. I can assist you with your voice agents and analytics. How can I help today?",
          sender: "bot",
          timestamp: Date.now(),
        },
      ])
    }
  }, [])

  // Save History
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    }
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return

    const userMsg: Message = {
      text: inputValue.trim(),
      sender: "user",
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputValue("")
    setIsTyping(true)

    // Sync input height
    if (inputRef.current) inputRef.current.style.height = "auto"

    // Mock AI delay
    await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 500))

    const botMsg: Message = {
      text: getMockReply(userMsg.text),
      sender: "bot",
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, botMsg])
    setIsTyping(false)
  }

  const getMockReply = (input: string) => {
    const replies = [
      "I've updated your agent's voice settings to improve clarity in high-noise environments.",
      "Based on recent analytics, your response times have improved by 12%. Would you like a detailed report?",
      "I can certainly help you integrate the new Cobalt theme into your custom web-hooks.",
      "That configuration looks optimal. I'll monitor the performance over the next 24 hours.",
    ]
    return replies[Math.floor(Math.random() * replies.length)]
  }

  const toggleVoice = () => {
    setIsListening(true)
    setTimeout(() => setIsListening(false), 3000)
  }

  const playVoice = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text)
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[99999] font-sans antialiased">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-[#3B82F6] border border-white/10 rounded-xl flex items-center justify-center text-white shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:translate-y-[-4px] hover:shadow-[0_12px_32px_rgba(59,130,246,0.5)] transition-all duration-300"
        >
          <Sparkles className="w-7 h-7" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="flex flex-col w-[400px] h-[600px] bg-[#151B28] border border-[#2D3A4F] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden origin-bottom-right animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Voice Overlay */}
          {isListening && (
            <div className="absolute inset-0 bg-[#0B0F17]/95 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
              <div className="flex items-center gap-1 h-12 mb-5">
                {[0.1, 0.2, 0.3, 0.4, 0.5].map((delay) => (
                  <div
                    key={delay}
                    className="w-1 bg-[#3B82F6] rounded-full animate-wave-motion"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
              <p className="text-white text-sm font-medium">Auralis Listening...</p>
              <Button
                variant="outline"
                className="mt-6 border-[#2D3A4F] text-white hover:bg-white/5"
                onClick={() => setIsListening(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] border-b border-[#2D3A4F]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-[#3B82F6]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-white text-[15px] font-semibold leading-none font-heading">
                  Auralis AI
                </h3>
                <span className="text-[#64748B] text-[11px] mt-1">
                  Voice Intelligence Support
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-[#64748B] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-[#0B0F17] custom-scrollbar"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex flex-col gap-1.5 max-w-[85%]",
                  m.sender === "user" ? "self-end" : "self-start"
                )}
              >
                <div
                  className={cn(
                    "p-3 text-[14.5px] leading-relaxed rounded-xl",
                    m.sender === "user"
                      ? "bg-[#1E293B] border border-[#2D3A4F] text-[#F8FAFC] rounded-br-none"
                      : "bg-transparent border border-[#2D3A4F] text-[#CBD5E1] rounded-bl-none"
                  )}
                >
                  {m.text}
                </div>
                {m.sender === "bot" && (
                  <button
                    onClick={() => playVoice(m.text)}
                    className="flex items-center gap-1.5 text-[11px] text-[#64748B] hover:text-[#3B82F6] transition-colors self-start px-1"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Voice
                  </button>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-1 p-3 self-start">
                <div className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce delay-0" />
                <div className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce delay-150" />
                <div className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce delay-300" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 bg-[#151B28] border-t border-[#2D3A4F]">
            <div className="flex items-end gap-2 p-2 bg-[#0B0F17] border border-[#2D3A4F] rounded-xl focus-within:border-[#3B82F6] transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Ask Auralis AI..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                className="flex-1 bg-transparent border-none outline-none text-[#F8FAFC] text-sm py-1.5 px-1 resize-none max-h-32"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "auto"
                  target.style.height = target.scrollHeight + "px"
                }}
              />
              <div className="flex items-center gap-1 pb-1">
                <button
                  onClick={toggleVoice}
                  className="p-1.5 text-[#64748B] hover:text-[#F8FAFC] hover:bg-white/5 rounded-lg transition-all"
                >
                  <Mic className="w-4.5 h-4.5" />
                </button>
                <button
                  disabled={!inputValue.trim() || isTyping}
                  onClick={handleSend}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    inputValue.trim() && !isTyping
                      ? "text-[#3B82F6]"
                      : "text-[#64748B] opacity-50 cursor-not-allowed"
                  )}
                >
                  <Send className="w-4.5 h-4.5 fill-current" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes wave-motion {
          0%, 100% { height: 12px; }
          50% { height: 48px; }
        }
        .animate-wave-motion {
          animation: wave-motion 1.2s infinite ease-in-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2D3A4F;
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
}
