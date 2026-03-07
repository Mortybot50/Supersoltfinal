"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Loader2, Plus, MapPin } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  timezone: z.string().min(1, "Timezone is required"),
})

type FormValues = z.infer<typeof formSchema>

type Venue = {
  id: string
  name: string
  orgId: string
  timezone: string
  createdAt: string
}

type ActiveVenue = {
  venueId: string | null
  orgId: string | null
}

// Common timezones for Australia
const TIMEZONES = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
]

export default function LocationsPage() {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Get active venue/org
  const { data: activeVenue } = useQuery<ActiveVenue>({
    queryKey: ["/api/session/active-venue"],
  })

  // Fetch venues (API will get orgId from cookie, so no need to wait for activeVenue)
  const { data: venues = [], isLoading } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      timezone: "Australia/Melbourne",
    },
  })

  // Mutation to create venue
  const createVenue = useMutation({
    mutationFn: async (values: FormValues) => {
      // API will get orgId from HTTP-only cookie
      const res = await apiRequest("POST", "/api/venues", values)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] })
      toast({
        title: "Venue created",
        description: "New venue has been added successfully.",
      })
      setDialogOpen(false)
      form.reset()
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create venue",
        variant: "destructive",
      })
    },
  })

  const onSubmit = (values: FormValues) => {
    createVenue.mutate(values)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-locations">Locations</h1>
          <p className="text-muted-foreground mt-2">
            Manage your venue locations and settings
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-venue">
              <Plus className="mr-2 h-4 w-4" />
              Add Venue
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Venue</DialogTitle>
              <DialogDescription>
                Create a new venue location for your organisation
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Sydney CBD, Melbourne Central"
                          {...field}
                          data-testid="input-venue-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-venue-timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Local timezone for this venue
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createVenue.isPending}
                    data-testid="button-create-venue"
                  >
                    {createVenue.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Venue"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {venues.map((venue) => (
          <Card key={venue.id} data-testid={`venue-card-${venue.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>{venue.name}</CardTitle>
                </div>
                {venue.id === activeVenue?.venueId && (
                  <Badge variant="default" data-testid="badge-active-venue">Active</Badge>
                )}
              </div>
              <CardDescription>{venue.timezone}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>Created: {new Date(venue.createdAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {venues.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No venues yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first venue to get started
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Venue
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
