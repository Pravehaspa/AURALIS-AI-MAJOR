import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { incrementSecurityCounter } from "@/lib/monitoring"

const MAX_BYTES = 1_000_000
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function jsonError(status: number, error: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

function extensionForType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    default:
      return "bin"
  }
}

async function uploadToSupabaseStorage(input: {
  userId: string
  contentType: string
  bytes: Uint8Array
}): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "avatars"

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  const extension = extensionForType(input.contentType)
  const objectPath = `${input.userId}/${Date.now()}.${extension}`
  const uploadUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${objectPath}`

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": input.contentType,
      "x-upsert": "true",
    },
    body: Buffer.from(input.bytes),
  })

  if (!uploadResponse.ok) {
    const details = await uploadResponse.text().catch(() => "")
    throw new Error(`Supabase storage upload failed: ${details || uploadResponse.statusText}`)
  }

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      await incrementSecurityCounter("auth_error")
      return jsonError(401, "Unauthorized", "Please sign in to upload an avatar")
    }

    const rateLimit = await checkRateLimit(`profile:upload:${session.user.id}`)
    if (!rateLimit.allowed) {
      await incrementSecurityCounter("rate_limited")
      return jsonError(429, "Rate Limited", "Too many upload attempts. Please try again later.")
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      await incrementSecurityCounter("invalid_request")
      return jsonError(400, "Invalid Form Data", "Avatar upload must use multipart form data")
    }

    const file = formData.get("file")
    if (!(file instanceof File)) {
      await incrementSecurityCounter("invalid_request")
      return jsonError(400, "File Missing", "Upload a profile image file")
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return jsonError(400, "Invalid File Type", "Please upload JPG, PNG, WEBP, or GIF images only")
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return jsonError(400, "Invalid File Size", "Please upload an image smaller than 1MB")
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    const uploadedUrl = await uploadToSupabaseStorage({
      userId: session.user.id,
      contentType: file.type,
      bytes,
    })

    if (uploadedUrl) {
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: uploadedUrl,
          storage: "supabase",
        },
      })
    }

    // Fallback mode when storage credentials are not configured.
    const base64 = Buffer.from(bytes).toString("base64")
    const dataUrl = `data:${file.type};base64,${base64}`

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: dataUrl,
        storage: "inline",
        warning:
          "Supabase storage credentials are not configured. Image is stored inline in profile until storage is enabled.",
      },
    })
  } catch (error) {
    console.error("Avatar upload failed:", error)
    return jsonError(500, "Upload Failed", "Unable to upload profile image right now")
  }
}
