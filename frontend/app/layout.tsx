import type React from "react"
import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AppProvider } from "@/lib/context"
import { cn } from "@/lib/utils"
import { ChatWidget } from "@/components/chat-widget"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

export const metadata: Metadata = {
  title: "Auralis AI - Voice-Native AI Agent Studio",
  description:
    "Create, customize, and deploy intelligent AI agents with advanced voice capabilities. Calm, premium, enterprise-ready.",
  icons: {
    icon: "/favicon.ico",
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, outfit.variable, "font-sans")} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AppProvider>
            {children}
            <ChatWidget />
            <Toaster />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
