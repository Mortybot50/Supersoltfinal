import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download } from "lucide-react"
import { useState } from "react"

export default function Payroll() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [system, setSystem] = useState("")

  const handleExport = () => {
    alert("Payroll export functionality coming soon")
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Payroll Export</h1>

      <Card>
        <CardHeader>
          <CardTitle>Export Payroll Data</CardTitle>
          <CardDescription>
            Export timesheet data for your payroll system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Payroll System</Label>
            <Select value={system} onValueChange={setSystem}>
              <SelectTrigger>
                <SelectValue placeholder="Select system..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xero">Xero</SelectItem>
                <SelectItem value="keypay">KeyPay</SelectItem>
                <SelectItem value="myob">MYOB</SelectItem>
                <SelectItem value="csv">Generic CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
