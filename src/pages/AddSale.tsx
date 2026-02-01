import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseCurrency } from "@/lib/currency"

export default function AddSale() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    customer: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Sale recorded:", {
      ...formData,
      amountCents: parseCurrency(formData.amount)
    })
    alert("Sale recorded successfully!")
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: "",
      customer: "",
    })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Record Daily Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="customer">Customer/Venue</Label>
                <Input
                  id="customer"
                  type="text"
                  value={formData.customer}
                  onChange={(e) => setFormData({...formData, customer: e.target.value})}
                  placeholder="Downtown Cafe"
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">Sales Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Record Sale
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
