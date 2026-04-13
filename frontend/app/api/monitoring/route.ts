import { NextResponse } from "next/server"
import { getSecurityMetrics } from "@/lib/monitoring"

export async function GET() {
  try {
    const metrics = await getSecurityMetrics()
    return NextResponse.json({ success: true, data: metrics })
  } catch (error) {
    console.error("Error loading monitoring metrics:", error)
    return NextResponse.json({ success: false, error: "Failed to load monitoring metrics" }, { status: 500 })
  }
}
