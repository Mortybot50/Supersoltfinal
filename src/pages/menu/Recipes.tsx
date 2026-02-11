import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChefHat, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { PageShell, PageToolbar, PageSidebar } from '@/components/shared'

const CATEGORIES = [
  { value: 'mains', label: 'Mains' },
  { value: 'sides', label: 'Sides' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'prep', label: 'Prep' },
  { value: 'other', label: 'Other' },
]

export default function Recipes() {
  const navigate = useNavigate()
  const { recipes, loadRecipesFromDB } = useDataStore()
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadRecipesFromDB().finally(() => setLoading(false))
  }, [loadRecipesFromDB])
  
  // Filter recipes
  const filteredRecipes = useMemo(() => {
    let filtered = recipes
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((r) => r.name.toLowerCase().includes(query))
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((r) => r.category === categoryFilter)
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter)
    }
    
    return filtered.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [recipes, searchQuery, categoryFilter, statusFilter])
  
  const sidebar = (
    <PageSidebar
      title="Recipes"
      metrics={[
        { label: 'Total Recipes', value: recipes.length },
        { label: 'Published', value: recipes.filter(r => r.status === 'published').length },
        { label: 'Draft', value: recipes.filter(r => r.status === 'draft').length },
      ]}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Recipes"
      filters={
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 w-48"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      primaryAction={{
        label: 'Add Recipe',
        icon: Plus,
        onClick: () => navigate('/menu/recipes/new'),
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-6 space-y-6">
      
      {/* Recipes Table */}
      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading recipes...</p>
        </Card>
      ) : filteredRecipes.length === 0 ? (
        <Card className="p-12 text-center">
          <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {recipes.length === 0 ? 'No recipes yet' : 'No recipes found'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {recipes.length === 0
              ? "Create your first recipe to start tracking food costs."
              : 'Try adjusting your filters'}
          </p>
          {recipes.length === 0 && (
            <Button onClick={() => navigate('/menu/recipes/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Recipe
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Servings</TableHead>
                <TableHead>Cost/Serve</TableHead>
                <TableHead>Suggested Price</TableHead>
                <TableHead>GP %</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecipes.map((recipe) => (
                <TableRow
                  key={recipe.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/menu/recipes/${recipe.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{recipe.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CATEGORIES.find((c) => c.value === recipe.category)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{recipe.serves}</TableCell>
                  <TableCell className="font-semibold">
                    ${(recipe.cost_per_serve / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="font-semibold text-green-600">
                    ${(recipe.suggested_price / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>{recipe.gp_target_percent}%</TableCell>
                  <TableCell>
                    {recipe.status === 'draft' && (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                    {recipe.status === 'published' && (
                      <Badge className="bg-green-600">Published</Badge>
                    )}
                    {recipe.status === 'archived' && (
                      <Badge variant="outline">Archived</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      </div>
    </PageShell>
  )
}
