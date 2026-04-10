"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Plus,
    BarChart3,
    Volume2,
    Code,
    Settings,
    Menu,
    Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { useState } from "react"

const sidebarItems = [
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        label: "Create Agent",
        href: "/create",
        icon: Plus,
    },
    {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
    },
    {
        label: "Voice Library",
        href: "/voice-library",
        icon: Volume2,
    },
    {
        label: "Embed Widget",
        href: "/standalone-chatbot.html",
        icon: Code,
        target: "_blank",
    },
]

interface SidebarProps {
    className?: string
}

export function DesktopSidebar({ className }: SidebarProps) {
    const pathname = usePathname()

    return (
        <aside className={cn("fixed left-0 top-0 h-screen w-64 bg-auralis-surface-1 border-r border-auralis-border z-40 hidden md:flex flex-col", className)}>
            {/* Logo */}
            <div className="p-8 border-b border-auralis-border">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-auralis-accent flex items-center justify-center p-1.5">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold font-heading text-auralis-text-primary">Auralis AI</span>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 space-y-2">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href

                    return (
                        <Link key={item.label} href={item.href} target={item.target}>
                            <div
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer font-medium",
                                    isActive
                                        ? "bg-auralis-accent/10 text-auralis-accent border border-auralis-accent/30"
                                        : "text-auralis-text-secondary hover:bg-auralis-sidebar-hover hover:text-auralis-text-primary"
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </div>
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-auralis-border space-y-2">
                <Link href="/settings">
                    <div
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer font-medium",
                            pathname === "/settings"
                                ? "bg-auralis-accent/10 text-auralis-accent border border-auralis-accent/30"
                                : "text-auralis-text-secondary hover:bg-auralis-sidebar-hover hover:text-auralis-text-primary"
                        )}
                    >
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </div>
                </Link>
            </div>
        </aside>
    )
}

export function MobileSidebar() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-auralis-text-secondary hover:text-auralis-text-primary">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-auralis-surface-1 border-r border-auralis-border">
                <SheetHeader className="sr-only">
                    <SheetTitle>Navigation Menu</SheetTitle>
                </SheetHeader>
                {/* Logo */}
                <div className="p-8 border-b border-auralis-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-auralis-accent flex items-center justify-center p-1.5">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold font-heading text-auralis-text-primary">Auralis AI</span>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-4 space-y-2">
                    {sidebarItems.map((item) => {
                        const isActive = pathname === item.href

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                target={item.target}
                                onClick={() => setOpen(false)}
                            >
                                <div
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer font-medium mb-2",
                                        isActive
                                            ? "bg-auralis-accent/10 text-auralis-accent border border-auralis-accent/30"
                                            : "text-auralis-text-secondary hover:bg-auralis-sidebar-hover hover:text-auralis-text-primary"
                                    )}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-auralis-border">
                    <Link href="/settings" onClick={() => setOpen(false)}>
                        <div
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer font-medium",
                                pathname === "/settings"
                                    ? "bg-auralis-accent/10 text-auralis-accent border border-auralis-accent/30"
                                    : "text-auralis-text-secondary hover:bg-auralis-sidebar-hover hover:text-auralis-text-primary"
                            )}
                        >
                            <Settings className="w-5 h-5" />
                            <span>Settings</span>
                        </div>
                    </Link>
                </div>
            </SheetContent>
        </Sheet>
    )
}
