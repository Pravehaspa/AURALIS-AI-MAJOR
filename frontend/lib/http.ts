export async function readJsonResponse<T>(response: Response, requestName: string): Promise<T> {
  const contentType = response.headers.get("content-type") || ""
  const responseText = await response.text()
  const trimmed = responseText.trim()
  const includePreview = process.env.NODE_ENV !== "production"

  if (!trimmed) {
    throw new Error(`${requestName} returned an empty response`)
  }

  const looksJson = contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")

  if (!looksJson) {
    const preview = trimmed.slice(0, 180).replace(/\s+/g, " ")
    const base = `${requestName} returned non-JSON (${contentType || "missing content-type"})`
    throw new Error(includePreview ? `${base}. Preview: ${preview}` : `${base}. Please retry in a moment.`)
  }

  try {
    return JSON.parse(responseText) as T
  } catch {
    const preview = trimmed.slice(0, 180).replace(/\s+/g, " ")
    const base = `${requestName} returned invalid JSON`
    throw new Error(includePreview ? `${base}. Preview: ${preview}` : `${base}. Please retry in a moment.`)
  }
}