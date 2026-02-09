import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RosterShift, Staff } from "@/types"
import { useDataStore } from "@/lib/store/dataStore"
import { format } from "date-fns"
import { toast } from "sonner"
import { ArrowLeftRight, Users } from "lucide-react"

interface ShiftSwapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: RosterShift | null
}

export function ShiftSwapDialog({ open, onOpenChange, shift }: ShiftSwapDialogProps) {
  const { staff, createSwapRequest } = useDataStore()
  const [targetStaffId, setTargetStaffId] = useState<string>("")
  const [notes, setNotes] = useState("")

  const activeStaff = staff.filter(
    (s) => s.status === "active" && s.id !== shift?.staff_id
  )

  const handleSubmit = () => {
    if (!shift) return

    createSwapRequest(shift.id, targetStaffId || undefined)

    toast.success(
      targetStaffId
        ? "Swap request sent"
        : "Shift posted for swap"
    )

    setTargetStaffId("")
    setNotes("")
    onOpenChange(false)
  }

  if (!shift) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Request Shift Swap
          </DialogTitle>
          <DialogDescription>
            Request to swap this shift with another team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Shift Info */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Current Shift</span>
              <Badge variant="outline">{shift.staff_name}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>{format(new Date(shift.date), "EEEE, MMM d, yyyy")}</p>
              <p>{shift.start_time} - {shift.end_time}</p>
              <p>{shift.total_hours.toFixed(1)} hours</p>
            </div>
          </div>

          {/* Target Staff Selection */}
          <div className="space-y-2">
            <Label>Swap With (optional)</Label>
            <Select value={targetStaffId} onValueChange={setTargetStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select specific person or leave open" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Anyone Available
                  </span>
                </SelectItem>
                {activeStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave as "Anyone Available" to let any team member claim this shift
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Why do you need to swap this shift?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Request Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SwapRequestsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SwapRequestsPanel({ open, onOpenChange }: SwapRequestsPanelProps) {
  const {
    shiftSwapRequests,
    rosterShifts,
    staff,
    approveSwapRequest,
    rejectSwapRequest,
    cancelSwapRequest,
  } = useDataStore()

  const [rejectReason, setRejectReason] = useState("")
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const pendingRequests = shiftSwapRequests.filter((r) => r.status === "pending")
  const recentRequests = shiftSwapRequests
    .filter((r) => r.status !== "pending")
    .slice(0, 5)

  const getShift = (shiftId: string) => rosterShifts.find((s) => s.id === shiftId)

  const handleApprove = (requestId: string) => {
    approveSwapRequest(requestId)
    toast.success("Swap request approved")
  }

  const handleReject = (requestId: string) => {
    if (rejectingId === requestId) {
      rejectSwapRequest(requestId, rejectReason)
      toast.success("Swap request rejected")
      setRejectingId(null)
      setRejectReason("")
    } else {
      setRejectingId(requestId)
    }
  }

  const handleCancel = (requestId: string) => {
    cancelSwapRequest(requestId)
    toast.success("Swap request cancelled")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pending</Badge>
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700">Approved</Badge>
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700">Rejected</Badge>
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Shift Swap Requests
          </DialogTitle>
          <DialogDescription>
            Manage shift swap requests from your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Pending Requests */}
          <div>
            <h3 className="font-medium mb-3">
              Pending Requests ({pendingRequests.length})
            </h3>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests</p>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => {
                  const shift = getShift(request.original_shift_id)
                  return (
                    <div
                      key={request.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{request.original_staff_name}</p>
                          {shift && (
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(shift.date), "EEE, MMM d")} •{" "}
                              {shift.start_time}-{shift.end_time}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      {request.target_staff_name && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Swap with:</span>{" "}
                          {request.target_staff_name}
                        </p>
                      )}

                      {rejectingId === request.id && (
                        <Textarea
                          placeholder="Reason for rejection (optional)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      )}

                      <div className="flex gap-2">
                        {request.target_staff_id && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(request.id)}
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={rejectingId === request.id ? "destructive" : "outline"}
                          onClick={() => handleReject(request.id)}
                        >
                          {rejectingId === request.id ? "Confirm Reject" : "Reject"}
                        </Button>
                        {rejectingId === request.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRejectingId(null)
                              setRejectReason("")
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent History */}
          {recentRequests.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Recent History</h3>
              <div className="space-y-2">
                {recentRequests.map((request) => {
                  const shift = getShift(request.original_shift_id)
                  return (
                    <div
                      key={request.id}
                      className="flex justify-between items-center rounded-lg border p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{request.original_staff_name}</span>
                        {shift && (
                          <span className="text-muted-foreground">
                            {" "}• {format(new Date(shift.date), "MMM d")}
                          </span>
                        )}
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
