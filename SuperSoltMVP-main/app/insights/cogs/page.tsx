import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function COGSPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Cost of Goods Sold (COGS)</h1>
        <p className="text-muted-foreground">Track and analyze your food and beverage costs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Detailed COGS analysis and trending will be available soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature is currently under development and will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
