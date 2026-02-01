import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Trash2,
  Plus,
  X,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDataStore } from '@/lib/store/dataStore'
import { calculateLineCost, getCompatibleUnits, calculatePackToBaseFactor } from '@/lib/utils/unitConversions'
import { COMMON_ALLERGENS, Recipe, RecipeIngredient } from '@/types'
import { toast } from 'sonner'

const CATEGORIES = [
  { value: 'mains', label: 'Mains' },
  { value: 'sides', label: 'Sides' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'prep', label: 'Prep' },
  { value: 'other', label: 'Other' },
]

export default function RecipeEditor() {
  const { recipeId } = useParams()
  const navigate = useNavigate()
  const isNew = recipeId === 'new'
  
  const {
    recipes,
    ingredients: products,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    publishRecipe,
    addRecipeIngredient,
    updateRecipeIngredient,
    deleteRecipeIngredient,
    getRecipeIngredients,
  } = useDataStore()
  
  const existingRecipe = !isNew ? recipes.find((r) => r.id === recipeId) : null
  
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    category: 'mains' as Recipe['category'],
    serves: 1,
    wastage_percent: 0,
    gp_target_percent: 65,
    instructions: '',
    steps: [''] as string[],
    allergens: [] as string[],
  })
  
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  
  // Load existing recipe
  useEffect(() => {
    if (existingRecipe) {
      setRecipeForm({
        name: existingRecipe.name,
        category: existingRecipe.category,
        serves: existingRecipe.serves,
        wastage_percent: existingRecipe.wastage_percent,
        gp_target_percent: existingRecipe.gp_target_percent,
        instructions: existingRecipe.instructions || '',
        steps: existingRecipe.steps.length > 0 ? existingRecipe.steps : [''],
        allergens: existingRecipe.allergens,
      })
      setIngredients(getRecipeIngredients(existingRecipe.id))
    }
  }, [existingRecipe, getRecipeIngredients])
  
  // Calculated values
  const totalCost = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + ing.line_cost, 0)
  }, [ingredients])
  
  const costPerServe = useMemo(() => {
    return recipeForm.serves > 0 ? totalCost / recipeForm.serves : 0
  }, [totalCost, recipeForm.serves])
  
  const suggestedPrice = useMemo(() => {
    const gpMultiplier = 1 - recipeForm.gp_target_percent / 100
    return gpMultiplier > 0 ? costPerServe / gpMultiplier : 0
  }, [costPerServe, recipeForm.gp_target_percent])
  
  // Validation
  const canPublish = useMemo(() => {
    return (
      recipeForm.name.trim() !== '' &&
      recipeForm.serves > 0 &&
      ingredients.length > 0 &&
      ingredients.every((ing) => ing.quantity > 0) &&
      recipeForm.steps.some((s) => s.trim() !== '') &&
      recipeForm.allergens.length > 0
    )
  }, [recipeForm, ingredients])
  
  const handleAddIngredient = () => {
    if (ingredients.length === 0 || ingredients[ingredients.length - 1].product_id) {
      const newIngredient: RecipeIngredient = {
        id: crypto.randomUUID(),
        recipe_id: recipeId || 'temp',
        product_id: '',
        product_name: '',
        quantity: 0,
        unit: 'g',
        cost_per_unit: 0,
        line_cost: 0,
        unit_cost_ex_base: 0,
        product_unit: '',
        product_cost: 0,
      }
      setIngredients([...ingredients, newIngredient])
    }
  }
  
  const handleIngredientChange = (
    index: number,
    field: keyof RecipeIngredient,
    value: any
  ) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], [field]: value }
    
    // If product changed, update related fields
    if (field === 'product_id') {
      const product = products.find((p) => p.id === value)
      if (product) {
        updated[index].product_name = product.name
        updated[index].unit = product.unit as any
        updated[index].product_unit = product.unit
        updated[index].product_cost = product.cost_per_unit
        
        // Get cost per base unit (cents per g/mL/ea)
        const ingredientCostPerBase = product.unit_cost_ex_base || 
          (product.cost_per_unit / calculatePackToBaseFactor(
            product.units_per_pack || 1, 
            product.unit_size || product.pack_size || 1, 
            product.unit
          ))
        
        updated[index].unit_cost_ex_base = ingredientCostPerBase
        
        // Recalculate line cost
        updated[index].line_cost = calculateLineCost(
          updated[index].quantity,
          updated[index].unit,
          ingredientCostPerBase
        )
        
        // Deprecated field - kept for backwards compatibility
        updated[index].cost_per_unit = ingredientCostPerBase
      }
    }
    
    // If quantity or unit changed, recalculate cost
    if (field === 'quantity' || field === 'unit') {
      const product = products.find((p) => p.id === updated[index].product_id)
      if (product) {
        // Use stored base unit cost
        const ingredientCostPerBase = updated[index].unit_cost_ex_base || 
          product.unit_cost_ex_base || 
          (product.cost_per_unit / calculatePackToBaseFactor(
            product.units_per_pack || 1, 
            product.unit_size || product.pack_size || 1, 
            product.unit
          ))
        
        updated[index].line_cost = calculateLineCost(
          updated[index].quantity,
          updated[index].unit,
          ingredientCostPerBase
        )
      }
    }
    
    setIngredients(updated)
  }
  
  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }
  
  const handleAddStep = () => {
    setRecipeForm({ ...recipeForm, steps: [...recipeForm.steps, ''] })
  }
  
  const handleStepChange = (index: number, value: string) => {
    const updated = [...recipeForm.steps]
    updated[index] = value
    setRecipeForm({ ...recipeForm, steps: updated })
  }
  
  const handleRemoveStep = (index: number) => {
    setRecipeForm({
      ...recipeForm,
      steps: recipeForm.steps.filter((_, i) => i !== index),
    })
  }
  
  const toggleAllergen = (allergen: string) => {
    setRecipeForm({
      ...recipeForm,
      allergens: recipeForm.allergens.includes(allergen)
        ? recipeForm.allergens.filter((a) => a !== allergen)
        : [...recipeForm.allergens, allergen],
    })
  }
  
  const handleSave = (status: 'draft' | 'published') => {
    if (!recipeForm.name.trim()) {
      toast.error('Recipe name is required')
      return
    }
    
    if (recipeForm.serves <= 0) {
      toast.error('Servings must be greater than 0')
      return
    }
    
    if (status === 'published' && !canPublish) {
      toast.error('Recipe must have ingredients, steps, and allergens to publish')
      return
    }
    
    const recipeData = {
      name: recipeForm.name,
      category: recipeForm.category,
      serves: recipeForm.serves,
      wastage_percent: recipeForm.wastage_percent,
      gp_target_percent: recipeForm.gp_target_percent,
      instructions: recipeForm.instructions || undefined,
      steps: recipeForm.steps.filter((s) => s.trim() !== ''),
      allergens: recipeForm.allergens,
      status,
      total_cost: Math.round(totalCost),
      cost_per_serve: Math.round(costPerServe),
      suggested_price: Math.round(suggestedPrice),
    }
    
    if (isNew) {
      const newRecipe: Recipe = {
        id: crypto.randomUUID(),
        organization_id: 'ORG-001',
        ...recipeData,
        created_by: 'current-user',
        created_by_name: 'J Smith',
        created_at: new Date(),
        updated_at: new Date(),
        ...(status === 'published' && { published_at: new Date() }),
      }
      
      addRecipe(newRecipe)
      
      // Save ingredients
      ingredients.forEach((ing) => {
        if (ing.product_id) {
          addRecipeIngredient({ ...ing, recipe_id: newRecipe.id })
        }
      })
      
      toast.success(`Recipe ${status === 'published' ? 'published' : 'saved'}`)
      navigate('/menu/recipes')
    } else {
      updateRecipe(recipeId!, recipeData)
      
      // Update ingredients (simple approach: delete all and re-add)
      const existingIngredients = getRecipeIngredients(recipeId!)
      existingIngredients.forEach((ing) => deleteRecipeIngredient(ing.id))
      
      ingredients.forEach((ing) => {
        if (ing.product_id) {
          addRecipeIngredient({ ...ing, recipe_id: recipeId! })
        }
      })
      
      if (status === 'published' && existingRecipe?.status !== 'published') {
        publishRecipe(recipeId!)
      }
      
      toast.success(`Recipe ${status === 'published' ? 'published' : 'saved'}`)
    }
  }
  
  const handleDelete = () => {
    if (confirm(`Delete ${recipeForm.name}? This cannot be undone.`)) {
      deleteRecipe(recipeId!)
      toast.success('Recipe deleted')
      navigate('/menu/recipes')
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/menu/recipes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? 'New Recipe' : recipeForm.name || 'Edit Recipe'}
            </h1>
            {!isNew && existingRecipe && (
              <Badge className="mt-1" variant={existingRecipe.status === 'published' ? 'default' : 'secondary'}>
                {existingRecipe.status}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          {!isNew && (
            <Button variant="ghost" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" onClick={() => handleSave('draft')}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave('published')}
            disabled={!canPublish}
          >
            <Send className="h-4 w-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>
      
      {/* Recipe Details */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="name">Recipe Name *</Label>
            <Input
              id="name"
              value={recipeForm.name}
              onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
              placeholder="e.g., Margherita Pizza"
            />
          </div>
          
          <div>
            <Label htmlFor="category">Category *</Label>
            <Select
              value={recipeForm.category}
              onValueChange={(value: any) => setRecipeForm({ ...recipeForm, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="serves">Servings *</Label>
            <Input
              id="serves"
              type="number"
              min="0.1"
              step="0.1"
              value={recipeForm.serves}
              onChange={(e) =>
                setRecipeForm({ ...recipeForm, serves: parseFloat(e.target.value) || 1 })
              }
            />
          </div>
          
          <div>
            <Label htmlFor="gp_target">GP Target %</Label>
            <Input
              id="gp_target"
              type="number"
              min="0"
              max="100"
              value={recipeForm.gp_target_percent}
              onChange={(e) =>
                setRecipeForm({
                  ...recipeForm,
                  gp_target_percent: parseFloat(e.target.value) || 65,
                })
              }
            />
          </div>
        </div>
      </Card>
      
      {/* Tabs */}
      <Tabs defaultValue="ingredients">
        <TabsList>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="steps">Steps & Instructions</TabsTrigger>
          <TabsTrigger value="allergens">Allergens</TabsTrigger>
        </TabsList>
        
        {/* INGREDIENTS TAB */}
        <TabsContent value="ingredients" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recipe Ingredients</h3>
              <Button onClick={handleAddIngredient} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            </div>
            
            {ingredients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No ingredients yet</p>
                <Button onClick={handleAddIngredient} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Ingredient
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Cost/Unit</TableHead>
                    <TableHead>Line Cost</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ingredient, index) => (
                    <TableRow key={ingredient.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={ingredient.product_id}
                          onValueChange={(value) =>
                            handleIngredientChange(index, 'product_id', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products
                              .filter((p) => p.active)
                              .map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.unit})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={ingredient.quantity || ''}
                          onChange={(e) =>
                            handleIngredientChange(
                              index,
                              'quantity',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={ingredient.unit}
                          onValueChange={(value: any) =>
                            handleIngredientChange(index, 'unit', value)
                          }
                          disabled={!ingredient.product_id}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getCompatibleUnits(ingredient.product_unit || 'g').map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ${((ingredient.unit_cost_ex_base || 0) / 100).toFixed(4)}/{ingredient.product_unit}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${(ingredient.line_cost / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIngredient(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
                      Total Cost:
                    </TableCell>
                    <TableCell className="font-bold text-lg">
                      ${(totalCost / 100).toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
                      Cost per Serve:
                    </TableCell>
                    <TableCell className="font-bold">
                      ${(costPerServe / 100).toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
                      GP Target ({recipeForm.gp_target_percent}%):
                    </TableCell>
                    <TableCell className="font-bold text-green-600 text-lg">
                      ${(suggestedPrice / 100).toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </Card>
        </TabsContent>
        
        {/* STEPS TAB */}
        <TabsContent value="steps" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="instructions">General Instructions (Optional)</Label>
                <Textarea
                  id="instructions"
                  value={recipeForm.instructions}
                  onChange={(e) =>
                    setRecipeForm({ ...recipeForm, instructions: e.target.value })
                  }
                  placeholder="General cooking notes, tips, or overview..."
                  rows={4}
                />
              </div>
              
              <Separator />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Step-by-Step Instructions *</Label>
                  <Button onClick={handleAddStep} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Step
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {recipeForm.steps.map((step, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                      <Textarea
                        value={step}
                        onChange={(e) => handleStepChange(index, e.target.value)}
                        placeholder={`Step ${index + 1}...`}
                        rows={2}
                        className="flex-1"
                      />
                      {recipeForm.steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStep(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        {/* ALLERGENS TAB */}
        <TabsContent value="allergens">
          <Card className="p-6">
            <Label className="mb-4 block">Common Allergens (FSANZ) *</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {COMMON_ALLERGENS.map((allergen) => (
                <div key={allergen} className="flex items-center space-x-2">
                  <Checkbox
                    id={allergen}
                    checked={recipeForm.allergens.includes(allergen)}
                    onCheckedChange={() => toggleAllergen(allergen)}
                  />
                  <Label htmlFor={allergen} className="text-sm cursor-pointer">
                    {allergen}
                  </Label>
                </div>
              ))}
            </div>
            
            {recipeForm.allergens.length === 0 && (
              <p className="text-sm text-red-600 mt-4">
                ⚠️ Select allergens present in this recipe (required to publish)
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recipe Card Preview</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold">{recipeForm.name || 'Recipe Name'}</h2>
              <div className="flex gap-2 mt-2">
                <Badge>{CATEGORIES.find((c) => c.value === recipeForm.category)?.label}</Badge>
                <Badge variant="outline">Serves: {recipeForm.serves}</Badge>
              </div>
            </div>
            
            {/* Allergens */}
            {recipeForm.allergens.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">⚠️ Allergens:</h3>
                <div className="flex flex-wrap gap-2">
                  {recipeForm.allergens.map((allergen) => (
                    <Badge key={allergen} variant="destructive">
                      {allergen}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Ingredients */}
            <div>
              <h3 className="font-semibold mb-2">Ingredients:</h3>
              <ul className="list-disc list-inside space-y-1">
                {ingredients
                  .filter((ing) => ing.product_id)
                  .map((ing) => (
                    <li key={ing.id}>
                      {ing.quantity} {ing.unit} {ing.product_name}
                    </li>
                  ))}
              </ul>
            </div>
            
            {/* Steps */}
            {recipeForm.steps.filter((s) => s.trim()).length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Instructions:</h3>
                <ol className="list-decimal list-inside space-y-2">
                  {recipeForm.steps
                    .filter((s) => s.trim())
                    .map((step, index) => (
                      <li key={index} className="pl-2">
                        {step}
                      </li>
                    ))}
                </ol>
              </div>
            )}
            
            {recipeForm.instructions && (
              <div>
                <h3 className="font-semibold mb-2">Notes:</h3>
                <p className="text-sm text-muted-foreground">{recipeForm.instructions}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
