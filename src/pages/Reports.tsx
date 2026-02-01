import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, DollarSign, Users, TrendingDown, Package } from "lucide-react"

export default function Reports() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Reports & Insights</h1>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="waste">Waste</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Sales Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Sales analytics and trends will appear here
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Cost Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              COGS and cost analysis will appear here
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labour" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Labour Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Labour cost and productivity metrics will appear here
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Waste Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Waste tracking and analysis will appear here
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Stock levels and turnover analysis will appear here
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
