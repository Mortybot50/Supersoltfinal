"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react"
import { format, addDays, startOfWeek } from "date-fns"

interface Staff {
  id: string
  name: string
  email: string
  roleTitle: string
}

interface Timesheet {
  id: string
  orgId: string
  venueId: string
  staffId: string
  shiftId: string | null
  clockInTs: string
  clockOutTs: string | null
  breakMinutes: number
  source: string
  status: string
  managerNote: string | null
  createdAt: string
}

interface TimesheetWithStaff {
  timesheet: Timesheet
  staff: Staff | null
}

export default function TimesheetsPage() {
  const { toast } = useToast()
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date()
    const monday = startOfWeek(now, { weekStartsOn: 1 })
    return monday
  })
  const [venueId, setVenueId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedVenueId = localStorage.getItem("venueId")
      if (storedVenueId) {
        setVenueId(storedVenueId)
      }
    }
  }, [])

  const weekStart = format(currentWeek, "yyyy-MM-dd")

  const { data, isLoading } = useQuery<TimesheetWithStaff[]>({
    queryKey: ["/api/labour/timesheets", weekStart],
    queryFn: async () => {
      const response = await fetch(
        `/api/labour/timesheets?weekStart=${weekStart}`
      )
      if (!response.ok) {
        throw new Error("Failed to fetch timesheets")
      }
      return response.json()
    },
    enabled: !!venueId, // Keep venueId from localStorage for UX (to know when to enable query)
  })

  const approveMutation = useMutation({
    mutationFn: async ({
      timesheetId,
      approved,
    }: {
      timesheetId: string
      approved: boolean
    }) => {
      const response = await fetch("/api/labour/timesheets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timesheetId, approved }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update timesheet")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/labour/timesheets"],
      })
      toast({
        title: "Success",
        description: "Timesheet updated successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handlePreviousWeek = () => {
    setCurrentWeek((prev) => addDays(prev, -7))
  }

  const handleNextWeek = () => {
    setCurrentWeek((prev) => addDays(prev, 7))
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-"
    return format(new Date(dateString), "HH:mm")
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return format(new Date(dateString), "MMM d, HH:mm")
  }

  const calculateHours = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-"
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const diffMs = end.getTime() - start.getTime()
    const hours = diffMs / (1000 * 60 * 60)
    return hours.toFixed(2)
  }

  if (!venueId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4" data-testid="text-page-title">
          Timesheets
        </h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              No venue selected. Please select a venue from the top bar.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          Timesheets
        </h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Week Selector</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousWeek}
                data-testid="button-previous-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {format(currentWeek, "MMM d")} -{" "}
                {format(addDays(currentWeek, 6), "MMM d, yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextWeek}
                data-testid="button-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">Loading timesheets...</p>
            </div>
          ) : !data || data.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">No timesheets found for this week</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Break (min)</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(({ timesheet, staff }) => (
                  <TableRow key={timesheet.id} data-testid={`row-timesheet-${timesheet.id}`}>
                    <TableCell data-testid={`text-staff-${timesheet.id}`}>
                      {staff?.name || "Unknown"}
                    </TableCell>
                    <TableCell data-testid={`text-clock-in-${timesheet.id}`}>
                      {formatDate(timesheet.clockInTs)}
                    </TableCell>
                    <TableCell data-testid={`text-clock-out-${timesheet.id}`}>
                      {formatDate(timesheet.clockOutTs)}
                    </TableCell>
                    <TableCell data-testid={`text-hours-${timesheet.id}`}>
                      {calculateHours(timesheet.clockInTs, timesheet.clockOutTs)}
                    </TableCell>
                    <TableCell data-testid={`text-break-${timesheet.id}`}>
                      {timesheet.breakMinutes}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{timesheet.source}</Badge>
                    </TableCell>
                    <TableCell data-testid={`text-status-${timesheet.id}`}>
                      <Badge
                        variant={
                          timesheet.status === "approved"
                            ? "default"
                            : timesheet.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {timesheet.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {timesheet.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              approveMutation.mutate({
                                timesheetId: timesheet.id,
                                approved: true,
                              })
                            }
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-${timesheet.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              approveMutation.mutate({
                                timesheetId: timesheet.id,
                                approved: false,
                              })
                            }
                            disabled={approveMutation.isPending}
                            data-testid={`button-reject-${timesheet.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
