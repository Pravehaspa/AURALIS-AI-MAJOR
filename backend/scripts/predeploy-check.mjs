#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

function loadLocalEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) {
    return
  }

  const content = fs.readFileSync(envPath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }

    const equalsIndex = line.indexOf("=")
    if (equalsIndex <= 0) {
      continue
    }

    const key = line.slice(0, equalsIndex).trim()
    if (!key || process.env[key]) {
      continue
    }

    let value = line.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadLocalEnvFile()

const required = [
  "GOOGLE_AI_API_KEY",
  "MURF_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
]

const missing = required.filter((key) => !process.env[key] || process.env[key].trim().length === 0)

const invalid = []
if (process.env.DATABASE_URL && /\[your-password\]|\[your_password\]|your_password|real_password|replace-with|<password>/i.test(process.env.DATABASE_URL)) {
  invalid.push("DATABASE_URL")
}

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:")
  for (const key of missing) {
    console.error(`- ${key}`)
  }
  process.exit(1)
}

if (invalid.length > 0) {
  console.error("❌ Invalid environment variable values:")
  for (const key of invalid) {
    console.error(`- ${key} contains a placeholder value`) 
  }
  process.exit(1)
}

console.log("✅ Environment predeploy check passed")
