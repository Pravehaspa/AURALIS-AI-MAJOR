"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Bot, Play, Save, Wand2, Volume2, PenLine, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useApp } from "@/lib/context"
import { useToast } from "@/hooks/use-toast"

const voiceOptions = [
  { id: "en-US-terrell", name: "Terrell", style: "Conversational", accent: "American", gender: "Male" },
  { id: "en-US-natalie", name: "Natalie", style: "Inspirational", accent: "American", gender: "Female" },
  { id: "en-US-ken", name: "Ken", style: "Energetic", accent: "American", gender: "Male" },
  { id: "en-US-julia", name: "Julia", style: "Warm", accent: "American", gender: "Female" },
  { id: "en-US-miles", name: "Miles", style: "Professional", accent: "American", gender: "Male" },
  { id: "en-GB-oliver", name: "Oliver", style: "Sophisticated", accent: "British", gender: "Male" },
  { id: "en-AU-sarah", name: "Sarah", style: "Friendly", accent: "Australian", gender: "Female" },
  { id: "es-MX-valeria", name: "Valeria", style: "Expressive", accent: "Mexican", gender: "Female" },
]

const promptTemplates = [
  {
    name: "Stress Relief Assistant",
    prompt:
      "You are a talkative, empathetic assistant bot. Your main job is to help people reduce stress by chatting with them, giving them calming advice, jokes, or friendly motivation. You talk in a relaxed, human tone, like a good friend who really listens.",
    firstMessage: "Hey there 😊 I'm your little stress-buster buddy! What's on your mind today?",
  },
  {
    name: "Creative Artist",
    prompt:
      "You are an inspiring and knowledgeable artist assistant. You help people with creative projects, art techniques, and provide artistic inspiration. You're passionate about all forms of art and love to encourage creativity.",
    firstMessage:
      "Hello, creative soul! 🎨 I'm here to help spark your artistic journey. What are you working on today?",
  },
  {
    name: "Fitness Coach",
    prompt:
      "You are an energetic and motivational fitness coach. You provide workout advice, nutrition tips, and keep people motivated on their fitness journey. You're encouraging but also realistic about goals.",
    firstMessage: "Hey champion! 💪 Ready to crush your fitness goals today? Let's get moving!",
  },
  {
    name: "Study Buddy",
    prompt:
      "You are a helpful and patient study companion. You help students with learning, provide study tips, explain concepts clearly, and keep them motivated. You make learning fun and engaging.",
    firstMessage: "Hi there, scholar! 📚 Ready to dive into some learning? What subject are we tackling today?",
  },
  {
    name: "Business Mentor",
    prompt:
      "You are a wise and experienced business mentor. You provide strategic advice, help with decision-making, and guide entrepreneurs through challenges. You're professional yet approachable.",
    firstMessage:
      "Hello, entrepreneur! 💼 I'm here to help you navigate your business journey. What challenge can we tackle together?",
  },
]

const personaPresets = [
  {
    id: "calm_senpai",
    label: "Calm Senpai",
    tone: "Warm, calm, and reassuring anime mentor",
    behaviorRules: "Use gentle guidance, short supportive lines, and occasional soft anime expressions.",
  },
  {
    id: "energetic_idol",
    label: "Energetic Idol",
    tone: "Upbeat, playful, and motivating anime idol",
    behaviorRules: "Use energetic positivity, celebratory phrasing, and short punchy responses.",
  },
  {
    id: "tsundere_lite",
    label: "Tsundere Lite",
    tone: "Playful tsundere style, still kind and helpful",
    behaviorRules: "Use light teasing tone but stay respectful and supportive at all times.",
  },
  {
    id: "custom",
    label: "Custom",
    tone: "",
    behaviorRules: "",
  },
] as const

const femaleAvatarPack = {
  idle: "/avatars/anime-female-idle.svg",
  listening: "/avatars/anime-female-listening.svg",
  thinking: "/avatars/anime-female-thinking.svg",
  speaking: "/avatars/anime-female-speaking.svg",
}

const maleAvatarPack = {
  idle: "/avatars/anime-male-idle.svg",
  listening: "/avatars/anime-male-listening.svg",
  thinking: "/avatars/anime-male-thinking.svg",
  speaking: "/avatars/anime-male-speaking.svg",
}

function resolveAvatarPack(voiceId: string, avatarStyle: "auto" | "female_anime" | "male_anime" | "custom") {
  if (avatarStyle === "female_anime") return femaleAvatarPack
  if (avatarStyle === "male_anime") return maleAvatarPack
  if (avatarStyle === "custom") return null

  const selected = voiceOptions.find((v) => v.id === voiceId)
  return selected?.gender === "Female" ? femaleAvatarPack : maleAvatarPack
}

export default function CreateAgent() {
  const router = useRouter()
  const { createAgent } = useApp()
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    prompt: "",
    firstMessage: "",
    voiceId: "",
    style: "",
    rate: 0,
    pitch: 0,
    variation: 1,
    personaEnabled: false,
    personaPreset: "custom" as "calm_senpai" | "energetic_idol" | "tsundere_lite" | "custom",
    personaTone: "",
    personaRules: "",
    avatarEnabled: false,
    avatarStyle: "auto" as "auto" | "female_anime" | "male_anime" | "custom",
    avatarDescription: "",
    avatarIdle: "",
    avatarListening: "",
    avatarThinking: "",
    avatarSpeaking: "",
    lipSyncEnabled: false,
    mouthClosed: "",
    mouthHalf: "",
    mouthOpen: "",
    lipSensitivity: 1,
    lipSmoothing: 0.75,
  })

  // -1 = Custom Template; null = nothing selected; 0..N = preset index
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false)

  const handleTemplateSelect = (index: number) => {
    if (selectedTemplate === index) return // already selected, do nothing
    setSelectedTemplate(index)
    if (index === -1) {
      // Custom template: only clear the prompt/firstMessage so the user can write their own.
      // Preserve name & description in case the user already filled them in.
      setFormData((prev) => ({
        ...prev,
        prompt: "",
        firstMessage: "",
      }))
    } else {
      const template = promptTemplates[index]
      setFormData((prev) => ({
        ...prev,
        prompt: template.prompt,
        firstMessage: template.firstMessage,
        name: template.name,
        description: `AI assistant specialized in ${template.name.toLowerCase()}`,
      }))
    }
  }

  const handlePersonaPresetChange = (presetId: "calm_senpai" | "energetic_idol" | "tsundere_lite" | "custom") => {
    const preset = personaPresets.find((p) => p.id === presetId)
    setFormData((prev) => ({
      ...prev,
      personaPreset: presetId,
      personaTone: preset?.tone ?? "",
      personaRules: preset?.behaviorRules ?? "",
    }))
  }

  const applyAvatarPack = (voiceId: string, avatarStyle: "auto" | "female_anime" | "male_anime" | "custom") => {
    const pack = resolveAvatarPack(voiceId, avatarStyle)
    if (!pack) return
    setFormData((prev) => ({
      ...prev,
      avatarIdle: pack.idle,
      avatarListening: pack.listening,
      avatarThinking: pack.thinking,
      avatarSpeaking: pack.speaking,
    }))
  }

  const handleVoicePreview = async () => {
    if (!formData.voiceId || !formData.firstMessage) {
      toast({
        title: "Missing Information",
        description: "Please select a voice and add a first message to preview.",
        variant: "destructive",
      })
      return
    }

    setIsPreviewingVoice(true)
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: formData.firstMessage,
          voiceId: formData.voiceId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate voice preview')
      }

      const data = await response.json()
      if (data.audioUrl) {
        // Create audio element and play
        const audio = new Audio(data.audioUrl)
        audio.play()

        toast({
          title: "Voice Preview",
          description: "Playing voice preview...",
        })
      }
    } catch (error) {
      console.error("Voice preview error:", error)
      toast({
        title: "Voice Preview Error",
        description: "Failed to generate voice preview. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPreviewingVoice(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name || !formData.description || !formData.prompt || !formData.firstMessage || !formData.voiceId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const success = await createAgent({
        name: formData.name,
        description: formData.description,
        category: "Custom",
        voiceId: formData.voiceId,
        isActive: true,
        conversations: 0,
        lastUsed: "Never",
        prompt: formData.prompt,
        firstMessage: formData.firstMessage,
        templateType: selectedTemplate === -1
          ? "custom"
          : selectedTemplate !== null
            ? promptTemplates[selectedTemplate].name
            : undefined,
        persona: {
          enabled: formData.personaEnabled,
          stylePreset: formData.personaPreset,
          tone: formData.personaTone,
          behaviorRules: formData.personaRules,
        },
        avatar: {
          enabled: formData.avatarEnabled,
          profile: formData.avatarStyle,
          description: formData.avatarDescription,
          imageIdle: formData.avatarIdle,
          imageListening: formData.avatarListening,
          imageThinking: formData.avatarThinking,
          imageSpeaking: formData.avatarSpeaking,
        },
        lipSync: {
          enabled: formData.lipSyncEnabled,
          mouthFrames: {
            closed: formData.mouthClosed,
            half: formData.mouthHalf,
            open: formData.mouthOpen,
          },
          sensitivity: formData.lipSensitivity,
          smoothing: formData.lipSmoothing,
        },
      })

      if (success) {
        toast({
          title: "Agent Created",
          description: "Your new agent has been created successfully!",
        })
        router.push("/dashboard")
      } else {
        toast({
          title: "Error",
          description: "Failed to create agent. Please try again.",
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
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-auralis-background">
      {/* Header */}
      <header className="border-b border-auralis-border bg-auralis-surface-1">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" className="text-auralis-text-secondary hover:text-auralis-text-primary hover:bg-auralis-sidebar-hover">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-auralis-accent flex items-center justify-center p-1.5">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold font-heading text-auralis-text-primary">Create New Agent</h1>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleVoicePreview}
                disabled={isPreviewingVoice || !formData.voiceId || !formData.firstMessage}
                variant="outline"
                className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
              >
                {isPreviewingVoice ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-auralis-accent border-t-transparent" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Test Voice
                  </>
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isCreating}
                className="bg-auralis-accent text-auralis-accent-foreground hover:bg-auralis-accent/90 border-0 rounded-full px-6 transition-all"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-auralis-accent-foreground border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Agent
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="auralis-card">
              <CardHeader>
                <CardTitle className="text-auralis-text-primary font-heading flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-auralis-text-secondary">
                    Agent Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Stress-Buster Buddy"
                    className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary placeholder:text-auralis-text-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-auralis-text-secondary">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of what your agent does..."
                    className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary placeholder:text-auralis-text-muted min-h-[80px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Personality & Behavior */}
            <Card className="auralis-card">
              <CardHeader>
                <CardTitle className="text-auralis-text-primary font-heading flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Personality & Behavior
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-auralis-text-secondary">Quick Templates</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {promptTemplates.map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        onClick={() => handleTemplateSelect(index)}
                        className={`text-left h-auto p-3 ${selectedTemplate === index
                          ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                          : "border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover hover:border-blue-500/30"
                          }`}
                      >
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs opacity-70 mt-1">{template.firstMessage.substring(0, 50)}...</div>
                        </div>
                      </Button>
                    ))}
                    {/* Custom Template option */}
                    <Button
                      variant="outline"
                      onClick={() => handleTemplateSelect(-1)}
                       className={`text-left h-auto p-3 ${selectedTemplate === -1
                         ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                         : "border-dashed border-auralis-border text-auralis-text-muted hover:bg-auralis-sidebar-hover hover:border-blue-500/20"
                         }`}
                    >
                      <div className="flex items-center gap-2">
                        <PenLine className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-medium">Custom Template</div>
                          <div className="text-xs opacity-70 mt-1">Start from scratch with your own prompt</div>
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt" className="text-auralis-text-secondary">
                    System Prompt
                  </Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Define your agent's personality, role, and behavior..."
                    className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary placeholder:text-auralis-text-muted min-h-[120px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstMessage" className="text-auralis-text-secondary">
                    First Message
                  </Label>
                  <Textarea
                    id="firstMessage"
                    value={formData.firstMessage}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstMessage: e.target.value }))}
                    placeholder="The greeting message users will see first..."
                    className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary placeholder:text-auralis-text-muted min-h-[80px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Anime Persona & Avatar */}
            <Card className="auralis-card">
              <CardHeader>
                <CardTitle className="text-auralis-text-primary font-heading flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Anime Persona & Avatar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border border-auralis-border p-3">
                  <div>
                    <p className="text-auralis-text-primary font-medium">Enable Persona</p>
                    <p className="text-xs text-auralis-text-muted">Apply anime-style behavior rules to responses</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.personaEnabled}
                    onChange={(e) => setFormData((prev) => ({ ...prev, personaEnabled: e.target.checked }))}
                  />
                </div>

                {formData.personaEnabled && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Persona Preset</Label>
                      <Select
                        value={formData.personaPreset}
                        onValueChange={(value) =>
                          handlePersonaPresetChange(value as "calm_senpai" | "energetic_idol" | "tsundere_lite" | "custom")
                        }
                      >
                        <SelectTrigger className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary">
                          <SelectValue placeholder="Choose persona style..." />
                        </SelectTrigger>
                        <SelectContent className="bg-auralis-surface-1 border-auralis-border">
                          {personaPresets.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id} className="text-auralis-text-primary">
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Persona Tone</Label>
                      <Textarea
                        value={formData.personaTone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, personaTone: e.target.value }))}
                        placeholder="Describe tone and personality..."
                        className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary min-h-[72px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Behavior Rules</Label>
                      <Textarea
                        value={formData.personaRules}
                        onChange={(e) => setFormData((prev) => ({ ...prev, personaRules: e.target.value }))}
                        placeholder="Rules like catchphrases, response style, and limits..."
                        className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary min-h-[72px]"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between rounded-lg border border-auralis-border p-3">
                  <div>
                    <p className="text-auralis-text-primary font-medium">Enable Left Companion Avatar</p>
                    <p className="text-xs text-auralis-text-muted">Show character companion in chat</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.avatarEnabled}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      avatarEnabled: e.target.checked,
                      avatarIdle: prev.avatarIdle || resolveAvatarPack(prev.voiceId, prev.avatarStyle)?.idle || "/avatars/anime-female-idle.svg",
                      avatarListening: prev.avatarListening || resolveAvatarPack(prev.voiceId, prev.avatarStyle)?.listening || "/avatars/anime-female-listening.svg",
                      avatarThinking: prev.avatarThinking || resolveAvatarPack(prev.voiceId, prev.avatarStyle)?.thinking || "/avatars/anime-female-thinking.svg",
                      avatarSpeaking: prev.avatarSpeaking || resolveAvatarPack(prev.voiceId, prev.avatarStyle)?.speaking || "/avatars/anime-female-speaking.svg",
                    }))}
                  />
                </div>

                {formData.avatarEnabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Avatar Style</Label>
                      <Select
                        value={formData.avatarStyle}
                        onValueChange={(value) => {
                          const style = value as "auto" | "female_anime" | "male_anime" | "custom"
                          setFormData((prev) => ({ ...prev, avatarStyle: style }))
                          applyAvatarPack(formData.voiceId, style)
                        }}
                      >
                        <SelectTrigger className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary">
                          <SelectValue placeholder="Choose avatar style..." />
                        </SelectTrigger>
                        <SelectContent className="bg-auralis-surface-1 border-auralis-border">
                          <SelectItem value="auto">Auto from selected voice gender</SelectItem>
                          <SelectItem value="female_anime">Female anime character</SelectItem>
                          <SelectItem value="male_anime">Male anime character</SelectItem>
                          <SelectItem value="custom">Custom avatar URLs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Avatar Personality Description (Custom)</Label>
                      <Textarea
                        value={formData.avatarDescription}
                        onChange={(e) => setFormData((prev) => ({ ...prev, avatarDescription: e.target.value }))}
                        placeholder="Describe the anime character style (e.g., shy schoolgirl under sakura trees, confident swordsman with calm smile)"
                        className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary min-h-[70px]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Avatar Idle URL</Label>
                      <Input
                        value={formData.avatarIdle}
                        onChange={(e) => setFormData((prev) => ({ ...prev, avatarIdle: e.target.value }))}
                        placeholder="/avatars/anime-idle.png"
                        className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Avatar Listening URL</Label>
                      <Input
                        value={formData.avatarListening}
                        onChange={(e) => setFormData((prev) => ({ ...prev, avatarListening: e.target.value }))}
                        placeholder="/avatars/anime-listening.png"
                        className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Avatar Thinking URL</Label>
                      <Input
                        value={formData.avatarThinking}
                        onChange={(e) => setFormData((prev) => ({ ...prev, avatarThinking: e.target.value }))}
                        placeholder="/avatars/anime-thinking.png"
                        className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-auralis-text-secondary">Avatar Speaking URL</Label>
                      <Input
                        value={formData.avatarSpeaking}
                        onChange={(e) => setFormData((prev) => ({ ...prev, avatarSpeaking: e.target.value }))}
                        placeholder="/avatars/anime-speaking.png"
                        className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary"
                      />
                    </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border border-auralis-border p-3">
                  <div>
                    <p className="text-auralis-text-primary font-medium">Enable Lip Sync</p>
                    <p className="text-xs text-auralis-text-muted">Animate mouth frames while TTS is speaking</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.lipSyncEnabled}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      lipSyncEnabled: e.target.checked,
                      mouthClosed: prev.mouthClosed || "/avatars/mouth-closed.svg",
                      mouthHalf: prev.mouthHalf || "/avatars/mouth-half.svg",
                      mouthOpen: prev.mouthOpen || "/avatars/mouth-open.svg",
                    }))}
                  />
                </div>

                {formData.lipSyncEnabled && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-auralis-text-secondary">Mouth Closed URL</Label>
                        <Input
                          value={formData.mouthClosed}
                          onChange={(e) => setFormData((prev) => ({ ...prev, mouthClosed: e.target.value }))}
                          placeholder="/avatars/mouth-closed.png"
                          className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-auralis-text-secondary">Mouth Half URL</Label>
                        <Input
                          value={formData.mouthHalf}
                          onChange={(e) => setFormData((prev) => ({ ...prev, mouthHalf: e.target.value }))}
                          placeholder="/avatars/mouth-half.png"
                          className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-auralis-text-secondary">Mouth Open URL</Label>
                        <Input
                          value={formData.mouthOpen}
                          onChange={(e) => setFormData((prev) => ({ ...prev, mouthOpen: e.target.value }))}
                          placeholder="/avatars/mouth-open.png"
                          className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-auralis-text-secondary">Lip Sensitivity ({formData.lipSensitivity.toFixed(2)})</Label>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.05"
                          value={formData.lipSensitivity}
                          onChange={(e) => setFormData((prev) => ({ ...prev, lipSensitivity: Number.parseFloat(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-auralis-text-secondary">Lip Smoothing ({formData.lipSmoothing.toFixed(2)})</Label>
                        <input
                          type="range"
                          min="0.1"
                          max="0.95"
                          step="0.05"
                          value={formData.lipSmoothing}
                          onChange={(e) => setFormData((prev) => ({ ...prev, lipSmoothing: Number.parseFloat(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Voice Configuration */}
            <Card className="auralis-card">
              <CardHeader>
                <CardTitle className="text-auralis-text-primary font-heading flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Voice Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-auralis-text-secondary">Voice Selection</Label>
                  <Select
                    value={formData.voiceId}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, voiceId: value }))
                      if (formData.avatarEnabled && formData.avatarStyle !== "custom") {
                        applyAvatarPack(value, formData.avatarStyle)
                      }
                    }}
                  >
                    <SelectTrigger className="bg-auralis-surface-2 border-auralis-border text-auralis-text-primary">
                      <SelectValue placeholder="Choose a voice..." />
                    </SelectTrigger>
                    <SelectContent className="bg-auralis-surface-1 border-auralis-border">
                      {voiceOptions.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id} className="text-auralis-text-primary hover:bg-auralis-sidebar-hover">
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <div className="font-medium">{voice.name}</div>
                              <div className="text-xs text-auralis-text-muted">
                                {voice.accent} • {voice.gender}
                              </div>
                            </div>
                            <Badge variant="secondary" className="ml-2 bg-auralis-accent/20 text-auralis-accent">
                              {voice.style}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.voiceId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleVoicePreview}
                      disabled={isPreviewingVoice}
                      className="border-auralis-border text-auralis-text-secondary hover:bg-auralis-sidebar-hover bg-transparent"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {isPreviewingVoice ? "Playing..." : "Preview Voice"}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-auralis-text-secondary">Speed ({formData.rate})</Label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={formData.rate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, rate: Number.parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-auralis-text-secondary">Pitch ({formData.pitch})</Label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={formData.pitch}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pitch: Number.parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-auralis-text-secondary">Variation ({formData.variation})</Label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={formData.variation}
                      onChange={(e) => setFormData((prev) => ({ ...prev, variation: Number.parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <Card className="auralis-card sticky top-6">
              <CardHeader>
                <CardTitle className="text-auralis-text-primary">Live Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-auralis-surface-2 rounded-lg p-4 border border-auralis-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-auralis-accent/20 rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 text-auralis-accent" />
                    </div>
                    <div>
                      <div className="text-auralis-text-primary font-medium">{formData.name || "Your Agent"}</div>
                      <div className="text-xs text-auralis-text-muted">
                        {formData.voiceId
                          ? voiceOptions.find((v) => v.id === formData.voiceId)?.name
                          : "No voice selected"}
                      </div>
                    </div>
                  </div>
                  <div className="bg-auralis-surface-1 rounded-lg p-3 border-l-4 border-auralis-accent">
                    <p className="text-auralis-text-secondary text-sm">
                      {formData.firstMessage || "Your first message will appear here..."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-auralis-text-muted">Configuration Summary:</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-auralis-text-muted">Speed:</span>
                      <span className="text-auralis-text-secondary">{formData.rate > 0 ? `+${formData.rate}` : formData.rate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-auralis-text-muted">Pitch:</span>
                      <span className="text-auralis-text-secondary">
                        {formData.pitch > 0 ? `+${formData.pitch}` : formData.pitch}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-auralis-text-muted">Variation:</span>
                      <span className="text-auralis-text-secondary">{formData.variation}/5</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
