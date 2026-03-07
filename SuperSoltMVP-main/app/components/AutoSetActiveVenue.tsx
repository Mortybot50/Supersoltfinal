"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

/**
 * AutoSetActiveVenue
 * 
 * Automatically sets activeOrgId and activeVenueId cookies after sign-in
 * if they don't already exist. This ensures roster and other venue-scoped
 * pages work immediately after authentication.
 */
export function AutoSetActiveVenue() {
  const { data: session, status } = useSession()
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    async function setDefaultActiveVenue() {
      if (status !== "authenticated" || !session?.user || hasChecked) {
        return
      }

      setHasChecked(true)

      try {
        // Check if active venue is already set
        const checkResponse = await fetch("/api/session/active-venue")
        const checkData = await checkResponse.json()

        if (checkData.venueId && checkData.orgId) {
          // Already set, nothing to do
          return
        }

        // Fetch user's venues to get orgId and venues in one call
        const venuesResponse = await fetch("/api/venues")
        if (!venuesResponse.ok) {
          console.error("Failed to fetch venues:", venuesResponse.status)
          return
        }

        const venues = await venuesResponse.json()

        if (venues.length === 0) {
          console.warn("User has no venues")
          return
        }

        // Use first venue as default
        const defaultVenue = venues[0]
        const orgId = defaultVenue.orgId

        if (!orgId) {
          console.error("Venue has no orgId")
          return
        }

        // Set active venue
        const setResponse = await fetch("/api/session/active-venue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId: defaultVenue.id,
            orgId,
          }),
        })

        if (!setResponse.ok) {
          const errorText = await setResponse.text()
          console.error("Failed to set active venue:", setResponse.status, errorText)
          return
        }

        console.log("Auto-set active venue:", defaultVenue.name, "for org:", orgId)
      } catch (error) {
        console.error("Error auto-setting active venue:", error)
      }
    }

    setDefaultActiveVenue()
  }, [session, status, hasChecked])

  return null
}
