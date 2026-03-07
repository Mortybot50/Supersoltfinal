"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
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
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Loader2, Save } from "lucide-react"
import { track } from "@/lib/analytics"

const formSchema = z.object({
  timezone: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  safetyStockDays: z.coerce.number().int().min(0).max(30).nullable().optional(),
  defaultOrderWindowDays: z.coerce.number().int().min(1).max(14).nullable().optional(),
})

type FormValues = z.infer<typeof formSchema>

// Common timezones for Australia
const TIMEZONES = [
  { value: "", label: "Use organisation default" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide" },
  { value: "Australia/Perth", label: "Australia/Perth" },
  { value: "Australia/Hobart", label: "Australia/Hobart" },
  { value: "Australia/Darwin", label: "Australia/Darwin" },
]

type VenueSettings = {
  venueId: string
  timezone: string | null
  displayName: string | null
  safetyStockDays: number | null
  defaultOrderWindowDays: number | null
}

type ActiveVenue = {
  venueId: string | null
  orgId: string | null
  venueName: string | null
}

export default function VenueSettingsPage() {
  const { toast } = useToast()

  // Fetch current venue
  const { data: activeVenue } = useQuery<ActiveVenue>({
    queryKey: ["/api/session/active-venue"],
  })

  // Fetch current venue settings
  const { data: settings, isLoading } = useQuery<VenueSettings>({
    queryKey: ["/api/settings/venue"],
    enabled: !!activeVenue?.venueId,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: settings ? {
      timezone: settings.timezone || "",
      displayName: settings.displayName || "",
      safetyStockDays: settings.safetyStockDays ?? "",
      defaultOrderWindowDays: settings.defaultOrderWindowDays ?? "",
    } : undefined,
  })

  // Mutation to update settings
  const updateSettings = useMutation({
    mutationFn: async (values: FormValues) => {
      // Convert empty strings to null, but preserve zero values
      const payload = {
        timezone: values.timezone || null,
        displayName: values.displayName || null,
        safetyStockDays: values.safetyStockDays ?? null,
        defaultOrderWindowDays: values.defaultOrderWindowDays ?? null,
      }
      const res = await apiRequest("PATCH", "/api/settings/venue", payload)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/venue"] })
      track("venue_settings_updated", {
        hasTimezoneOverride: !!form.getValues("timezone"),
        hasDisplayName: !!form.getValues("displayName"),
        hasSafetyStockOverride: form.getValues("safetyStockDays") !== "" && form.getValues("safetyStockDays") !== null,
        hasOrderWindowOverride: form.getValues("defaultOrderWindowDays") !== "" && form.getValues("defaultOrderWindowDays") !== null,
      })
      toast({
        title: "Settings updated",
        description: "Venue settings have been saved successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      })
    },
  })

  const onSubmit = (values: FormValues) => {
    updateSettings.mutate(values)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="heading-venue-settings">Venue Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure venue-specific overrides. Leave fields empty to use organisation defaults.
        </p>
        {activeVenue?.venueName && (
          <p className="text-sm text-muted-foreground mt-1">
            Current venue: <span className="font-medium">{activeVenue.venueName}</span>
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Venue Overrides</CardTitle>
          <CardDescription>
            Override organisation defaults for this specific venue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Leave empty to use venue name"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-display-name"
                      />
                    </FormControl>
                    <FormDescription>
                      Custom display name for this venue (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone Override</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "_default_" ? null : value)}
                      value={field.value || "_default_"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-timezone">
                          <SelectValue placeholder="Use organisation default" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_default_">Use organisation default</SelectItem>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Override the organisation timezone for this venue
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="safetyStockDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Safety Stock Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          placeholder="Use default"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-safety-stock"
                        />
                      </FormControl>
                      <FormDescription>
                        Extra buffer days for stock orders
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultOrderWindowDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Window Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="14"
                          placeholder="Use default"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-order-window"
                        />
                      </FormControl>
                      <FormDescription>
                        Default ordering forecast window
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateSettings.isPending}
                  data-testid="button-save-settings"
                >
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
