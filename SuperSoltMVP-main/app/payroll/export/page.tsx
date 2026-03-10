"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Download, AlertCircle } from "lucide-react"
import { format, startOfWeek } from "date-fns"

export default function PayrollExportPage() {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date()
    const monday = startOfWeek(now, { weekStartsOn: 1 })
    return monday
  })
  const [system, setSystem] = useState<"xero" | "keypay" | "myob">("xero")

  const weekStart = format(currentWeek, "yyyy-MM-dd")

  const handleDownload = () => {
    const url = `/api/payroll/export.csv?weekStart=${weekStart}&system=${system}`
    window.open(url, "_blank")
  }

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value)
    setCurrentWeek(date)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payroll Export</h1>
        <p className="text-muted-foreground mt-2">
          Download approved timesheets as CSV for payroll processing
        </p>
      </div>

      <Card data-testid="card-payroll-export">
        <CardHeader>
          <CardTitle>Export Settings</CardTitle>
          <CardDescription>
            Select the week and payroll system to generate a CSV export
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="week-start" data-testid="label-week-start">
                Week Start Date
              </Label>
              <Input
                id="week-start"
                type="date"
                value={weekStart}
                onChange={handleWeekChange}
                data-testid="input-week-start"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system" data-testid="label-system">
                Payroll System
              </Label>
              <Select
                value={system}
                onValueChange={(value) => setSystem(value as "xero" | "keypay" | "myob")}
              >
                <SelectTrigger id="system" data-testid="select-system">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xero">Xero</SelectItem>
                  <SelectItem value="keypay">KeyPay</SelectItem>
                  <SelectItem value="myob">MYOB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Export Information</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Only APPROVED timesheets are included in the export</li>
                <li>Hours are calculated as: (Clock Out - Clock In - Break) / 3600</li>
                <li>Missing employee or pay item mappings will result in empty fields</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleDownload}
              size="lg"
              data-testid="button-download-csv"
            >
              <Download className="mr-2 h-5 w-5" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV Format</CardTitle>
          <CardDescription>
            The exported CSV will contain the following columns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto">
            <div className="text-muted-foreground">
              EmployeeId, EmployeeName, Date, StartTimeUTC, EndTimeUTC, BreakMinutes, HoursDecimal, PayItemCode, VenueName
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>EmployeeId:</strong> External reference from payroll system integration
            </p>
            <p>
              <strong>HoursDecimal:</strong> Total hours worked (rounded to 2 decimal places)
            </p>
            <p>
              <strong>PayItemCode:</strong> Mapped pay item code based on role title
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
