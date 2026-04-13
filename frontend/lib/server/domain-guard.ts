export type AgentDomainConfig = {
  name: string
  domain: string
  allowedTopics: string[]
  restrictedTopics?: string[]
}

type DomainProfile = {
  label: string
  hints: string[]
  keywords: string[]
  restrictedTopics: string[]
}

const DOMAIN_PROFILES: DomainProfile[] = [
  {
    label: "stress management and emotional wellness",
    hints: ["wellness", "stress", "mental", "emotion", "calm", "stress-buster"],
    keywords: [
      "stress",
      "anxious",
      "anxiety",
      "panic",
      "overwhelmed",
      "burnout",
      "calm",
      "breath",
      "breathe",
      "relax",
      "sleep",
      "worry",
      "sad",
      "lonely",
      "upset",
      "emotional",
      "mindful",
      "meditation",
      "mental health",
    ],
    restrictedTopics: ["self-harm instructions", "violence instructions", "illegal acts"],
  },
  {
    label: "studying and education",
    hints: ["education", "study", "learning", "student", "school", "academic"],
    keywords: [
      "study",
      "learn",
      "lesson",
      "exam",
      "test",
      "quiz",
      "homework",
      "assignment",
      "subject",
      "chapter",
      "teacher",
      "student",
      "revision",
      "syllabus",
      "class",
      "school",
      "college",
      "university",
      "math",
      "science",
      "history",
      "physics",
      "chemistry",
      "biology",
      "english",
    ],
    restrictedTopics: ["cheating", "exam fraud", "harmful content"],
  },
  {
    label: "creative art and design",
    hints: ["creative", "artist", "art", "design", "drawing", "painting"],
    keywords: [
      "art",
      "artist",
      "creative",
      "design",
      "draw",
      "drawing",
      "paint",
      "painting",
      "color",
      "palette",
      "canvas",
      "sketch",
      "illustration",
      "composition",
      "style",
      "portfolio",
    ],
    restrictedTopics: ["harmful content", "illegal acts"],
  },
  {
    label: "fitness, exercise, and healthy habits",
    hints: ["fitness", "health", "workout", "coach", "training", "nutrition"],
    keywords: [
      "fitness",
      "workout",
      "exercise",
      "train",
      "training",
      "cardio",
      "strength",
      "muscle",
      "diet",
      "nutrition",
      "protein",
      "weight",
      "steps",
      "hydration",
      "sleep",
      "health",
    ],
    restrictedTopics: ["unsafe drug use", "extreme harm", "illegal acts"],
  },
  {
    label: "business strategy and entrepreneurship",
    hints: ["business", "mentor", "entrepreneur", "startup", "strategy", "management"],
    keywords: [
      "business",
      "strategy",
      "startup",
      "entrepreneur",
      "customer",
      "market",
      "pricing",
      "sales",
      "revenue",
      "profit",
      "leadership",
      "operations",
      "finance",
      "branding",
      "growth",
      "pitch",
    ],
    restrictedTopics: ["fraud", "market manipulation", "illegal acts"],
  },
]

const GENERIC_ALLOWED_PHRASES = ["hi", "hello", "hey", "good morning", "good evening"]

const GLOBAL_UNSAFE_KEYWORDS = [
  "how to make a bomb",
  "build a bomb",
  "kill someone",
  "murder",
  "terror attack",
  "suicide plan",
  "self harm instructions",
  "hack bank",
  "steal password",
  "credit card fraud",
]

const MIN_CONFIDENCE = 0.2

const STOP_WORDS = new Set([
  "you",
  "your",
  "yours",
  "are",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "have",
  "from",
  "into",
  "about",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "would",
  "should",
  "could",
  "their",
  "them",
  "they",
  "main",
  "job",
  "assistant",
  "help",
  "helps",
  "helpful",
  "friendly",
  "talkative",
  "respond",
  "responses",
  "keep",
  "chat",
  "chatting",
  "people",
  "person",
  "like",
  "good",
  "tone",
  "make",
  "making",
])

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

function normalizeText(value?: string) {
  return (value || "").toLowerCase().trim()
}

function matchesAnyKeyword(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword))
}

function countKeywordMatches(input: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => (input.includes(keyword) ? count + 1 : count), 0)
}

function extractPromptKeywords(prompt: string, category: string) {
  const combined = `${prompt} ${category}`
  const tokens = combined
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !STOP_WORDS.has(token))

  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([token]) => token)
}

function resolveDomainFromConfig(agentConfig?: AgentDomainConfig): DomainProfile | null {
  if (!agentConfig?.domain?.trim()) {
    return null
  }

  const allowed = uniqueStrings((agentConfig.allowedTopics || []).map((item) => normalizeText(item)))
  if (!allowed.length) {
    return null
  }

  const restricted = uniqueStrings((agentConfig.restrictedTopics || []).map((item) => normalizeText(item)))
  const domainTokens = normalizeText(agentConfig.domain)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)

  const enrichedAllowed = uniqueStrings([...allowed, ...domainTokens])

  return {
    label: normalizeText(agentConfig.domain),
    hints: enrichedAllowed,
    keywords: enrichedAllowed,
    restrictedTopics: restricted,
  }
}

function resolveDomain(agentCategory?: string, agentPrompt?: string): DomainProfile | null {
  const category = normalizeText(agentCategory)
  const prompt = normalizeText(agentPrompt)
  const combined = `${category} ${prompt}`.trim()

  if (!combined) {
    return null
  }

  for (const profile of DOMAIN_PROFILES) {
    if (profile.hints.some((item) => combined.includes(item))) {
      return profile
    }
  }

  const fallbackKeywords = uniqueStrings([
    ...extractPromptKeywords(prompt, category),
    ...category.split(/[^a-z0-9]+/).filter((token) => token.length >= 4),
  ])
  if (!fallbackKeywords.length) {
    return null
  }

  const label = category && category !== "custom" ? `${category} guidance` : "this agent's configured domain"
  return {
    label,
    hints: fallbackKeywords,
    keywords: fallbackKeywords,
    restrictedTopics: ["harmful content", "illegal acts"],
  }
}

function getMessageTokenCount(input: string) {
  return input
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2).length
}

function calculateConfidence(input: string, allowedKeywords: string[]) {
  const matchCount = countKeywordMatches(input, allowedKeywords)
  const tokenCount = Math.max(getMessageTokenCount(input), 1)
  const confidence = matchCount / Math.max(1, Math.ceil(tokenCount / 4))
  return Math.min(1, confidence)
}

function isUnsafeMessage(input: string) {
  return matchesAnyKeyword(input, GLOBAL_UNSAFE_KEYWORDS)
}

function isRestrictedMessage(input: string, profile: DomainProfile) {
  return matchesAnyKeyword(input, profile.restrictedTopics)
}

function isInDomainMessage(profile: DomainProfile, message: string) {
  const normalizedMessage = normalizeText(message)
  if (!normalizedMessage) {
    return false
  }

  if (matchesAnyKeyword(normalizedMessage, GENERIC_ALLOWED_PHRASES)) {
    return true
  }

  const allowedKeywords = uniqueStrings([...profile.keywords, ...profile.hints])
  if (!matchesAnyKeyword(normalizedMessage, allowedKeywords)) {
    return false
  }

  return calculateConfidence(normalizedMessage, allowedKeywords) >= MIN_CONFIDENCE
}

function sampleTopics(profile: DomainProfile, max: number = 3) {
  return uniqueStrings([...profile.hints, ...profile.keywords]).slice(0, max)
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function buildDomainRejectionText(profile: DomainProfile) {
  const topics = sampleTopics(profile)
  const topicsText = topics.length ? topics.join(", ") : profile.label

  const options = [
    `I can only help with ${profile.label}. Try asking about ${topicsText}.`,
    `That is outside my scope. I am focused on ${profile.label}. You can ask me about ${topicsText}.`,
    `I cannot answer that directly. I am designed for ${profile.label}. Want to explore ${topicsText} instead?`,
  ]

  return pickRandom(options)
}

export type DomainValidationResult =
  | { enforced: false }
  | { enforced: true; allowed: true; domainLabel: string }
  | { enforced: true; allowed: false; domainLabel: string; rejectionText: string }

export function validateAgentDomain(
  message: string,
  agentCategory?: string,
  agentPrompt?: string,
  agentConfig?: AgentDomainConfig,
): DomainValidationResult {
  const resolvedDomain = resolveDomainFromConfig(agentConfig) || resolveDomain(agentCategory, agentPrompt)

  if (!resolvedDomain) {
    return { enforced: false }
  }

  const normalizedMessage = normalizeText(message)

  if (isUnsafeMessage(normalizedMessage) || isRestrictedMessage(normalizedMessage, resolvedDomain)) {
    return {
      enforced: true,
      allowed: false,
      domainLabel: resolvedDomain.label,
      rejectionText: buildDomainRejectionText(resolvedDomain),
    }
  }

  if (isInDomainMessage(resolvedDomain, message)) {
    return {
      enforced: true,
      allowed: true,
      domainLabel: resolvedDomain.label,
    }
  }

  return {
    enforced: true,
    allowed: false,
    domainLabel: resolvedDomain.label,
    rejectionText: buildDomainRejectionText(resolvedDomain),
  }
}
