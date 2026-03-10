"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface Org {
  id: string
  name: string
}

interface Venue {
  id: string
  orgId: string
  name: string
  timezone: string
  createdAt: string
}

export function OrgVenueSwitcher() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true)
  const [isLoadingVenues, setIsLoadingVenues] = useState(false)
  const { toast } = useToast()

  // Load orgs and active org on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoadingOrgs(true)

        // Fetch available orgs
        const orgsResponse = await fetch("/api/me/orgs")
        if (!orgsResponse.ok) {
          throw new Error("Failed to load organizations")
        }
        const orgsData: Org[] = await orgsResponse.json()
        setOrgs(orgsData)

        // Fetch current active org
        const activeOrgResponse = await fetch("/api/session/active-org")
        if (!activeOrgResponse.ok) {
          throw new Error("Failed to load active organization")
        }
        const activeOrgData: { orgId: string | null } =
          await activeOrgResponse.json()

        // Determine which org to select
        const orgToSelect = activeOrgData.orgId || orgsData[0]?.id || null
        
        if (orgToSelect) {
          // If we had to default to first org (no active org cookie), set it
          if (!activeOrgData.orgId && orgsData[0]?.id) {
            await fetch("/api/session/active-org", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orgId: orgToSelect }),
            })
          }
          
          setSelectedOrgId(orgToSelect)
          // Load venues for this org
          await loadVenuesForOrg(orgToSelect)
        }
      } catch (error) {
        console.error("Error loading initial data:", error)
        toast({
          title: "Error",
          description: "Failed to load organizations",
          variant: "destructive",
        })
      } finally {
        setIsLoadingOrgs(false)
      }
    }

    loadInitialData()
  }, [toast])

  // Load active venue from cookie when venues are loaded
  useEffect(() => {
    async function loadActiveVenue() {
      if (venues.length === 0) return

      try {
        // Get active venue from cookie
        const activeVenueResponse = await fetch("/api/session/active-venue")
        if (!activeVenueResponse.ok) {
          throw new Error("Failed to load active venue")
        }
        const activeVenueData: { venueId: string | null } =
          await activeVenueResponse.json()

        // Check if the venue from cookie exists in the current org
        const venueExists = activeVenueData.venueId
          ? venues.find((v) => v.id === activeVenueData.venueId)
          : null

        // If no active venue or it doesn't exist in current org, set first venue
        const venueToSelect = venueExists ? activeVenueData.venueId : venues[0]?.id || null

        if (venueToSelect) {
          // If we had to default to first venue, set it via API
          if (!venueExists && venues[0]?.id) {
            await fetch("/api/session/active-venue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ venueId: venueToSelect }),
            })
          }
          
          setSelectedVenueId(venueToSelect)
          // Mirror in localStorage for UX
          localStorage.setItem("venueId", venueToSelect)
        }
      } catch (error) {
        console.error("Error loading active venue:", error)
        // Fallback to first venue if API fails
        const fallbackVenue = venues[0]?.id || null
        if (fallbackVenue) {
          setSelectedVenueId(fallbackVenue)
          localStorage.setItem("venueId", fallbackVenue)
        }
      }
    }

    loadActiveVenue()
  }, [venues])

  async function loadVenuesForOrg(orgId: string) {
    try {
      setIsLoadingVenues(true)
      const response = await fetch("/api/venues")
      if (!response.ok) {
        throw new Error("Failed to load venues")
      }
      const venuesData: Venue[] = await response.json()
      setVenues(venuesData)
    } catch (error) {
      console.error("Error loading venues:", error)
      toast({
        title: "Error",
        description: "Failed to load venues",
        variant: "destructive",
      })
      setVenues([])
    } finally {
      setIsLoadingVenues(false)
    }
  }

  async function handleOrgChange(orgId: string) {
    try {
      // Set active org via API
      const response = await fetch("/api/session/active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      })

      if (!response.ok) {
        throw new Error("Failed to set active organization")
      }

      setSelectedOrgId(orgId)
      setSelectedVenueId(null)
      setVenues([])

      // Load venues for the new org
      await loadVenuesForOrg(orgId)

      toast({
        title: "Organization changed",
        description: `Switched to ${orgs.find((o) => o.id === orgId)?.name}`,
      })
    } catch (error) {
      console.error("Error changing organization:", error)
      toast({
        title: "Error",
        description: "Failed to change organization",
        variant: "destructive",
      })
    }
  }

  async function handleVenueChange(venueId: string) {
    try {
      // Set active venue via API
      const response = await fetch("/api/session/active-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      })

      if (!response.ok) {
        throw new Error("Failed to set active venue")
      }

      setSelectedVenueId(venueId)
      // Mirror in localStorage for UX
      localStorage.setItem("venueId", venueId)

      toast({
        title: "Venue changed",
        description: `Switched to ${venues.find((v) => v.id === venueId)?.name}`,
      })
    } catch (error) {
      console.error("Error changing venue:", error)
      toast({
        title: "Error",
        description: "Failed to change venue",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid="org-venue-switcher">
      <Select
        value={selectedOrgId || undefined}
        onValueChange={handleOrgChange}
        disabled={isLoadingOrgs}
      >
        <SelectTrigger
          className="w-[180px]"
          data-testid="select-organisation"
        >
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          {orgs.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedVenueId || undefined}
        onValueChange={handleVenueChange}
        disabled={isLoadingVenues || venues.length === 0}
      >
        <SelectTrigger className="w-[180px]" data-testid="select-venue">
          <SelectValue placeholder="Select venue" />
        </SelectTrigger>
        <SelectContent>
          {venues.map((venue) => (
            <SelectItem key={venue.id} value={venue.id}>
              {venue.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
