"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

interface InviteData {
  email: string
  role: string
  orgName: string
  expiresAt: string
  status: string
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setError("Invalid invite link")
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/people/invites/validate?token=${token}`)
        if (!res.ok) {
          const errorData = await res.json()
          setError(errorData.error || "Failed to load invite")
          setLoading(false)
          return
        }

        const data = await res.json()
        setInviteData(data)
        setLoading(false)
      } catch (err) {
        setError("Failed to load invite details")
        setLoading(false)
      }
    }

    loadInvite()
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    try {
      const res = await fetch("/api/people/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to accept invite")
        setAccepting(false)
        return
      }

      if (data.alreadyAccepted) {
        setSuccess(true)
        setTimeout(() => {
          router.push("/dashboard?invite=already-accepted")
        }, 2000)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/dashboard?invite=accepted")
      }, 2000)
    } catch (err) {
      setError("Failed to accept invite")
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading Invite...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Invalid Invite</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mt-4">
              This invite link may have expired or already been used. Please contact your organization manager for a new invite.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/")} variant="outline" data-testid="button-go-home">
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <CardTitle>Invite Accepted!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Redirecting you to the dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md" data-testid="card-invite-details">
        <CardHeader>
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            Accept this invitation to join the organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="text-base" data-testid="text-invite-email">{inviteData?.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Organization</p>
            <p className="text-base" data-testid="text-invite-org">{inviteData?.orgName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Role</p>
            <p className="text-base capitalize" data-testid="text-invite-role">{inviteData?.role}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Expires</p>
            <p className="text-base" data-testid="text-invite-expires">
              {inviteData?.expiresAt ? new Date(inviteData.expiresAt).toLocaleDateString() : "N/A"}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full"
            data-testid="button-accept-invite"
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept Invite"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
