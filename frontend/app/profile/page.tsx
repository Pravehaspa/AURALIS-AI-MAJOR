"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, LogOut, Shield, User, KeyRound, Lock, Globe } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type ProfileData = {
  id: string
  name: string
  email: string
  image: string | null
  provider: string
  createdAt: string
  updatedAt: string
  hasPassword: boolean
}

function jsonMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback
  }

  const data = payload as { message?: string; details?: unknown }
  if (Array.isArray(data.details) && data.details.length > 0) {
    return data.details.join(" | ")
  }

  return data.message || fallback
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"
}

export default function ProfilePage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [avatar, setAvatar] = useState("")
  const [avatarPreview, setAvatarPreview] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [hasPassword, setHasPassword] = useState(false)

  const providerLabel = useMemo(() => {
    if (profile?.provider === "google") {
      return "Connected with Google"
    }

    return "Email/Password account"
  }, [profile?.provider])

  const isGoogleUser = profile?.provider === "google"

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile")
        const payload = await response.json().catch(() => null)

        if (!mounted) {
          return
        }

        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(jsonMessage(payload, "Unable to load profile"))
        }

        const data = payload.data as ProfileData
        setProfile(data)
        setName(data.name || "")
        setEmail(data.email || "")
        setAvatar(data.image || "")
        setAvatarPreview(data.image || "")
        setHasPassword(Boolean(data.hasPassword))
      } catch (error) {
        toast({
          title: "Profile unavailable",
          description: error instanceof Error ? error.message : "Unable to load your profile right now.",
          variant: "destructive",
        })
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [toast])

  const handleAvatarFile = async (file: File | null) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please choose an image file.",
        variant: "destructive",
      })
      return
    }

    if (file.size > 1_000_000) {
      toast({
        title: "Image too large",
        description: "Please choose an image smaller than 1MB.",
        variant: "destructive",
      })
      return
    }

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/profile/upload", {
        method: "POST",
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !payload?.data?.imageUrl) {
        throw new Error(jsonMessage(payload, "Avatar upload failed"))
      }

      const imageUrl = String(payload.data.imageUrl)
      setAvatar(imageUrl)
      setAvatarPreview(imageUrl)

      toast({
        title: "Image uploaded",
        description:
          payload?.data?.storage === "supabase"
            ? "Your profile image was uploaded to storage. Click Save Changes to persist it."
            : "Image uploaded in fallback mode. Click Save Changes to persist it.",
      })
    } catch (error) {
      toast({
        title: "Avatar upload failed",
        description: error instanceof Error ? error.message : "Please try again with a different image.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const saveProfile = async () => {
    setIsSavingProfile(true)
    try {
      const response = await fetch("/api/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          image: avatar.trim() || null,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(jsonMessage(payload, "Failed to update profile"))
      }

      const updated = payload.data as ProfileData
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated))
      setName(updated.name)
      setEmail(updated.email)
      setAvatar(updated.image || "")
      setAvatarPreview(updated.image || "")
      toast({
        title: "Profile saved",
        description: "Your profile details were updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const changePassword = async () => {
    setIsSavingPassword(true)
    try {
      const response = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(jsonMessage(payload, "Failed to change password"))
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setHasPassword(true)
      toast({
        title: "Password updated",
        description: "Your password was changed successfully.",
      })
    } catch (error) {
      toast({
        title: "Password change failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    window.location.href = "/create"
  }

  const handleLogoutAllDevices = () => {
    toast({
      title: "Coming soon",
      description: "Session revocation for all devices will be added in a future release.",
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-black/40 border-white/10 backdrop-blur-xl max-w-md w-full">
          <CardContent className="p-6 flex items-center gap-3 text-gray-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your profile...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Image src="/auralis-ai-logo.png" alt="Auralis AI" width={32} height={24} className="w-8 h-6 object-contain" />
              <h1 className="text-2xl font-bold text-white">Profile</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleLogout} variant="outline" className="border-white/20 text-gray-200 hover:bg-white/10 bg-transparent">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Basic Information
                </CardTitle>
                <CardDescription className="text-gray-300">Manage your name, avatar, and account details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border border-white/10 ring-4 ring-white/5">
                      <AvatarImage src={avatarPreview || undefined} alt={profile?.name || "Profile avatar"} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white text-xl">
                        {initialsFromName(name || profile?.name || "User")}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <Label htmlFor="avatar-upload" className="text-gray-300">Profile picture</Label>
                      <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <Input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleAvatarFile(event.target.files?.[0] || null)}
                          disabled={isUploadingAvatar}
                          className="bg-black/20 border-white/20 text-white file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
                        />
                        <span className="text-sm text-gray-400">
                          {isUploadingAvatar ? "Uploading image..." : "Upload a JPG, PNG, WEBP, or GIF image up to 1MB."}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="avatar-url" className="text-gray-300">Avatar URL</Label>
                      <Input
                        id="avatar-url"
                        value={avatar}
                        onChange={(event) => {
                          setAvatar(event.target.value)
                          setAvatarPreview(event.target.value)
                        }}
                        placeholder="Paste an image URL or use the upload control above"
                        className="mt-2 bg-black/20 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name" className="text-gray-300">Name</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="bg-black/20 border-white/20 text-white placeholder:text-gray-500"
                      placeholder="Your display name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email" className="text-gray-300">Email</Label>
                    <Input
                      id="profile-email"
                      value={email}
                      readOnly
                      className="bg-black/20 border-white/20 text-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Account created</Label>
                    <Input
                      value={profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : "N/A"}
                      readOnly
                      className="bg-black/20 border-white/20 text-gray-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Account type</Label>
                    <div className="h-10 flex items-center">
                      <Badge className={profile?.provider === "google" ? "bg-blue-100/10 text-blue-300 border-blue-500/30" : "bg-purple-100/10 text-purple-300 border-purple-500/30"}>
                        {providerLabel}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <Button
                    onClick={saveProfile}
                    disabled={isSavingProfile}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
                  >
                    {isSavingProfile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5" />
                  Change Password
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasPassword ? (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                    This account currently has no password set. You can create one now without entering a current password.
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {isGoogleUser ? null : (
                    <div className="space-y-2">
                      <Label htmlFor="current-password" className="text-gray-300">Current password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        className="bg-black/20 border-white/20 text-white placeholder:text-gray-500"
                        placeholder="Enter current password"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-gray-300">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="bg-black/20 border-white/20 text-white placeholder:text-gray-500"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-gray-300">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="bg-black/20 border-white/20 text-white placeholder:text-gray-500"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
                {isGoogleUser ? (
                  <p className="text-xs text-blue-300">
                    Connected with Google. You can set a local password here without entering a current password.
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    onClick={changePassword}
                    disabled={isSavingPassword}
                    variant="outline"
                    className="border-white/20 text-gray-200 hover:bg-white/10 bg-transparent"
                  >
                    {isSavingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                    Change Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Security</CardTitle>
                <CardDescription className="text-gray-300">Account session and security controls.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Shield className="h-4 w-4 text-green-400" />
                  Protected by session authentication
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Globe className="h-4 w-4 text-blue-400" />
                  {profile?.provider === "google" ? "Google account linked" : "Local credentials account"}
                </div>
                <Separator className="bg-white/20" />
                <Button
                  variant="outline"
                  onClick={handleLogoutAllDevices}
                  className="w-full border-white/20 text-gray-200 hover:bg-white/10 bg-transparent"
                >
                  Logout all devices
                </Button>
                <p className="text-xs text-gray-400">Future-ready control for revoking all active sessions.</p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Account Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-300">User ID</span>
                  <span className="text-white break-all text-right">{profile?.id || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-300">Created</span>
                  <span className="text-white text-right">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-300">Updated</span>
                  <span className="text-white text-right">{profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : "N/A"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
