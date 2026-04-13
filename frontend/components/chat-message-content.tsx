"use client"

import { useEffect, useMemo, useState } from "react"

type Segment = {
  kind: "text" | "mermaid"
  value: string
}

let mermaidInitialized = false

function parseSegments(content: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /```mermaid\s*([\s\S]*?)```/gi
  let cursor = 0
  let match: RegExpExecArray | null = null

  while ((match = pattern.exec(content)) !== null) {
    const [fullMatch, diagramCode] = match
    const start = match.index

    if (start > cursor) {
      const text = content.slice(cursor, start).trim()
      if (text) {
        segments.push({ kind: "text", value: text })
      }
    }

    const diagram = (diagramCode || "").trim()
    if (diagram) {
      segments.push({ kind: "mermaid", value: diagram })
    }

    cursor = start + fullMatch.length
  }

  if (cursor < content.length) {
    const tailText = content.slice(cursor).trim()
    if (tailText) {
      segments.push({ kind: "text", value: tailText })
    }
  }

  if (segments.length === 0) {
    return [{ kind: "text", value: content }]
  }

  return segments
}

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("")
  const [hasError, setHasError] = useState(false)

  const renderId = useMemo(
    () => `mermaid-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
    [],
  )

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        const mermaidModule = await import("mermaid")
        const mermaid = mermaidModule.default

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "default",
          })
          mermaidInitialized = true
        }

        const { svg: generatedSvg } = await mermaid.render(renderId, code)

        if (!cancelled) {
          setSvg(generatedSvg)
          setHasError(false)
        }
      } catch {
        if (!cancelled) {
          setSvg("")
          setHasError(true)
        }
      }
    }

    void renderDiagram()

    return () => {
      cancelled = true
    }
  }, [code, renderId])

  if (hasError) {
    return (
      <pre className="mt-2 overflow-x-auto rounded-md bg-black/30 p-3 text-xs text-gray-200 whitespace-pre-wrap">
        {`\`\`\`mermaid\n${code}\n\`\`\``}
      </pre>
    )
  }

  if (!svg) {
    return <p className="text-sm text-gray-300">Rendering diagram...</p>
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-md bg-black/20 p-2">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}

export function ChatMessageContent({ content }: { content: string }) {
  const segments = useMemo(() => parseSegments(content), [content])

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.kind === "mermaid") {
          return <MermaidBlock key={`mermaid-${index}`} code={segment.value} />
        }

        return (
          <p key={`text-${index}`} className="text-sm break-words whitespace-pre-wrap">
            {segment.value}
          </p>
        )
      })}
    </div>
  )
}
