import type { Agent } from "@/lib/types"

export type AgentConfigPayload = {
  name: string
  domain: string
  allowedTopics: string[]
  restrictedTopics: string[]
}

type DomainPreset = {
  domain: string
  allowedTopics: string[]
  restrictedTopics: string[]
}

const DOMAIN_PRESETS: Record<string, DomainPreset> = {
  wellness: {
    domain: "stress management and emotional wellness",
    allowedTopics: [
      "stress",
      "anxiety",
      "panic",
      "overwhelmed",
      "burnout",
      "calm",
      "breathing",
      "relaxation",
      "mindfulness",
      "sleep hygiene",
      "emotional support",
    ],
    restrictedTopics: ["self-harm instructions", "violence instructions", "illegal acts"],
  },
  education: {
    domain: "studying and education",
    allowedTopics: [
      "study planning",
      "homework",
      "exam prep",
      "subject learning",
      "math",
      "science",
      "history",
      "reading",
      "writing",
      "revision",
    ],
    restrictedTopics: ["cheating", "exam fraud", "harmful content"],
  },
  creative: {
    domain: "creative art and design",
    allowedTopics: [
      "drawing",
      "painting",
      "illustration",
      "composition",
      "color theory",
      "creative workflow",
      "design critique",
      "portfolio",
    ],
    restrictedTopics: ["harmful content", "illegal acts"],
  },
  health: {
    domain: "fitness, exercise, and healthy habits",
    allowedTopics: [
      "workout planning",
      "exercise form",
      "fitness goals",
      "nutrition basics",
      "hydration",
      "sleep recovery",
      "habit tracking",
    ],
    restrictedTopics: ["unsafe drug use", "extreme harm", "illegal acts"],
  },
  business: {
    domain: "business strategy and entrepreneurship",
    allowedTopics: [
      "business strategy",
      "go-to-market",
      "customer research",
      "pricing",
      "sales",
      "operations",
      "startup planning",
      "leadership",
    ],
    restrictedTopics: ["fraud", "market manipulation", "illegal acts"],
  },
}

function normalizeText(value?: string) {
  return (value || "").trim()
}

function keywordize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

function deriveDomainFromPrompt(agent: Pick<Agent, "name" | "category" | "prompt">) {
  const category = agent.category.toLowerCase()
  const prompt = agent.prompt.toLowerCase()
  const name = agent.name.toLowerCase()
  const combined = `${category} ${name} ${prompt}`

  for (const [key, preset] of Object.entries(DOMAIN_PRESETS)) {
    if (combined.includes(key) || preset.allowedTopics.some((topic) => combined.includes(topic.toLowerCase()))) {
      return preset
    }
  }

  const dynamicTokens = unique(keywordize(combined)).slice(0, 18)
  const dynamicDomain = normalizeText(agent.category) && agent.category.toLowerCase() !== "custom"
    ? `${agent.category.toLowerCase()} guidance`
    : "this agent's configured domain"

  return {
    domain: dynamicDomain,
    allowedTopics: dynamicTokens,
    restrictedTopics: ["harmful content", "illegal acts"],
  }
}

export function ensureAgentConfig(agent: Agent): AgentConfigPayload {
  const inferred = deriveDomainFromPrompt(agent)
  return {
    name: normalizeText(agent.name) || "Agent",
    domain: normalizeText(agent.domain) || inferred.domain,
    allowedTopics: unique(agent.allowedTopics?.length ? agent.allowedTopics : inferred.allowedTopics),
    restrictedTopics: unique(agent.restrictedTopics?.length ? agent.restrictedTopics : inferred.restrictedTopics),
  }
}

export function normalizeAgent(agent: Agent): Agent {
  const config = ensureAgentConfig(agent)
  return {
    ...agent,
    domain: config.domain,
    allowedTopics: config.allowedTopics,
    restrictedTopics: config.restrictedTopics,
  }
}
