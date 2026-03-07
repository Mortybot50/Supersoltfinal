"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Check, ChevronsUpDown, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { apiRequest, queryClient } from "@/lib/queryClient"

type Venue = {
  id: string
  name: string
  orgId: string
}

type ActiveVenue = {
  venueId: string | null
  orgId: string | null
  venueName: string | null
}

export function VenueSwitcher() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Fetch active venue
  const { data: activeVenue } = useQuery<ActiveVenue>({
    queryKey: ["/api/session/active-venue"],
  })

  // Fetch available venues (user must have membership in the org)
  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
    enabled: !!activeVenue?.orgId,
  })

  // Mutation to switch venue
  const switchVenue = useMutation({
    mutationFn: async (venue: Venue) => {
      return apiRequest("POST", "/api/session/active-venue", {
        venueId: venue.id,
        orgId: venue.orgId,
      })
    },
    onSuccess: () => {
      // Invalidate all queries to refresh data for new venue
      queryClient.invalidateQueries()
      // Refresh the page to reload all venue-specific data
      router.refresh()
      setOpen(false)
    },
  })

  const currentVenue = venues.find((v) => v.id === activeVenue?.venueId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select venue"
          className="w-[200px] justify-between"
          data-testid="button-venue-switcher"
        >
          <MapPin className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {currentVenue?.name || "Select venue..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search venues..." />
          <CommandList>
            <CommandEmpty>No venue found.</CommandEmpty>
            <CommandGroup>
              {venues.map((venue) => (
                <CommandItem
                  key={venue.id}
                  value={venue.name}
                  onSelect={() => {
                    if (venue.id !== activeVenue?.venueId) {
                      switchVenue.mutate(venue)
                    }
                  }}
                  data-testid={`venue-option-${venue.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      activeVenue?.venueId === venue.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {venue.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
