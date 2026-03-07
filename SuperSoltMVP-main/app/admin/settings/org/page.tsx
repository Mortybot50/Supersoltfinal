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
  timezone: z.string().min(1),
  targetCogsPct: z.coerce.number().int().min(0).max(100),
  targetLabourPct: z.coerce.number().int().min(0).max(100),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
})

type FormValues = z.infer<typeof formSchema>

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

const WEEK_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

type OrgSettings = {
  orgId: string
  timezone: string
  targetCogsPct: number
  targetLabourPct: number
  weekStartsOn: number
  createdAt: string
  updatedAt: string
}

export default function OrganisationSettingsPage() {
  const { toast } = useToast()

  // Fetch current org settings
  const { data: settings, isLoading } = useQuery<OrgSettings>({
    queryKey: ["/api/settings/org"],
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: settings ? {
      timezone: settings.timezone,
      targetCogsPct: settings.targetCogsPct,
      targetLabourPct: settings.targetLabourPct,
      weekStartsOn: settings.weekStartsOn,
    } : undefined,
  })

  // Mutation to update settings
  const updateSettings = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("PATCH", "/api/settings/org", values)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/org"] })
      track("org_settings_updated", {
        timezone: form.getValues("timezone"),
        targetCogsPct: form.getValues("targetCogsPct"),
        targetLabourPct: form.getValues("targetLabourPct"),
      })
      toast({
        title: "Settings updated",
        description: "Organisation settings have been saved successfully.",
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
        <h1 className="text-3xl font-bold" data-testid="heading-org-settings">Organisation Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure default settings for your entire organisation. These can be overridden per venue.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Set defaults for timezones, targets, and calendar preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Timezone</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-timezone">
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
                      Used for reports and forecasts across all venues
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="targetCogsPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target COGS %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          data-testid="input-target-cogs"
                        />
                      </FormControl>
                      <FormDescription>
                        Target cost of goods sold percentage
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetLabourPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Labour %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          data-testid="input-target-labour"
                        />
                      </FormControl>
                      <FormDescription>
                        Target labour cost percentage
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weekStartsOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Week Starts On</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-week-starts">
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEK_DAYS.map((day) => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      First day of the week for rosters and reports
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
