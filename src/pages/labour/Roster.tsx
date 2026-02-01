import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Plus, Calendar } from "lucide-react"

export default function Roster() {
  const [shifts, setShifts] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ 
    staff: "", 
    date: new Date().toISOString().split('T')[0],
    start: "", 
    end: "" 
  })

  const handleAdd = () => {
    setShifts([...shifts, { id: Date.now(), ...formData }])
    setFormData({ staff: "", date: new Date().toISOString().split('T')[0], start: "", end: "" })
    setOpen(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Roster</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Shift</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Shift</DialogTitle>
              <DialogDescription>
                Add a new shift to the roster
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <Input value={formData.staff} onChange={e => setFormData({...formData, staff: e.target.value})} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
              </div>
              <Button onClick={handleAdd} className="w-full">Add Shift</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Roster
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No shifts scheduled</p>
              <p className="text-sm mt-2">Add shifts to build your weekly roster</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shifts.map(shift => (
                <div key={shift.id} className="p-3 border rounded-lg">
                  <div className="font-medium">{shift.staff}</div>
                  <div className="text-sm text-muted-foreground">
                    {shift.date} • {shift.start} - {shift.end}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
