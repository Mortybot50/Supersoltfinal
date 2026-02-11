import { create } from 'zustand'
import { InvoiceIntakeJob, InvoiceIntakeReview, SupplierAlias, InvoiceIntakeStatus, GSTMode, MatchType } from '@/types'
import { logPriceChange, runCostCascade, applyCascadeToState } from '@/lib/services/costCascade'
import { getDefaultOrgSettings } from '@/lib/venueSettings'

interface InvoiceIntakeState {
  // Data
  jobs: InvoiceIntakeJob[]
  reviews: InvoiceIntakeReview[]
  aliases: SupplierAlias[]
  
  // UI State
  selectedJob: InvoiceIntakeJob | null
  uploadDrawerOpen: boolean
  reviewModalOpen: boolean
  isProcessing: boolean
  
  // Actions - Upload & Parse
  uploadInvoice: (file: File, venueId: string, supplierId?: string) => Promise<void>
  parseInvoice: (jobId: string) => Promise<void>
  
  // Actions - Mapping
  mapInvoiceLines: (jobId: string) => Promise<void>
  updateLineMapping: (jobId: string, lineIndex: number, mapping: Partial<InvoiceIntakeJob['mapping_json'][0]>) => void
  
  // Actions - Review & Approve
  openReviewModal: (job: InvoiceIntakeJob) => void
  closeReviewModal: () => void
  approveInvoice: (jobId: string, notes?: string) => Promise<void>
  rejectInvoice: (jobId: string, reason: string) => Promise<void>
  saveDraft: (jobId: string) => Promise<void>
  
  // Utilities
  checkDuplicate: (dedupeKey: string) => InvoiceIntakeJob | null
  getJobsByStatus: (status: InvoiceIntakeStatus) => InvoiceIntakeJob[]
}

export const useInvoiceIntakeStore = create<InvoiceIntakeState>((set, get) => ({
  // Initial State
  jobs: [],
  reviews: [],
  aliases: [],
  selectedJob: null,
  uploadDrawerOpen: false,
  reviewModalOpen: false,
  isProcessing: false,
  
  // ============================================
  // UPLOAD & PARSE
  // ============================================
  
  uploadInvoice: async (file: File, venueId: string, supplierId?: string) => {
    set({ isProcessing: true })
    
    try {
      // Simulate file upload to storage
      const fileUrl = URL.createObjectURL(file)
      
      // Create new job
      const newJob: InvoiceIntakeJob = {
        id: `intake-${Date.now()}`,
        org_id: 'DEMO-ORG',
        venue_id: venueId,
        created_by_user_id: 'current-user',
        source: 'UPLOAD',
        status: 'queued',
        file_url: fileUrl,
        original_filename: file.name,
        supplier_confidence: 0,
        totals_confidence: 0,
        header_json: {
          invoice_number: '',
          invoice_date: new Date().toISOString(),
          supplier_name: '',
          gst_mode: 'INC',
          subtotal: 0,
          gst: 0,
          total: 0
        },
        lines_json: [],
        mapping_json: [],
        dedupe_key: '',
        created_at: new Date(),
        updated_at: new Date()
      }
      
      set((state) => ({
        jobs: [newJob, ...state.jobs]
      }))
      
      // Start parsing (async)
      await get().parseInvoice(newJob.id)
      
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    } finally {
      set({ isProcessing: false, uploadDrawerOpen: false })
    }
  },
  
  parseInvoice: async (jobId: string) => {
    set({ isProcessing: true })
    
    try {
      // Update status
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId ? { ...job, status: 'parsing' as InvoiceIntakeStatus } : job
        )
      }))
      
      // Simulate OCR/AI parsing (2 second delay)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      
      // MOCK OCR RESULTS (in production, call actual OCR service)
      const mockParsedData = {
        header_json: {
          invoice_number: `INV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          invoice_date: new Date().toISOString(),
          supplier_name: 'Fresh Produce Co',
          abn: '12345678901',
          supplier_code: 'FPC',
          po_number: `PO-${Math.floor(Math.random() * 10000)}`,
          gst_mode: 'INC' as GSTMode,
          subtotal: 450.00,
          gst: 45.00,
          total: 495.00
        },
        lines_json: [
          {
            line_index: 0,
            raw_desc: 'Tomatoes - Roma 10kg',
            brand: 'Premium',
            pack_size_text: '10kg',
            qty: 2,
            unit_price: 35.00,
            ext_price: 70.00,
            confidence: 0.95
          },
          {
            line_index: 1,
            raw_desc: 'Lettuce - Iceberg each',
            pack_size_text: 'each',
            qty: 12,
            unit_price: 2.50,
            ext_price: 30.00,
            confidence: 0.88
          },
          {
            line_index: 2,
            raw_desc: 'Onions - Brown 5kg',
            pack_size_text: '5kg',
            qty: 3,
            unit_price: 12.00,
            ext_price: 36.00,
            confidence: 0.92
          }
        ],
        supplier_confidence: 0.96,
        totals_confidence: 0.98
      }
      
      // Compute dedupe key
      const dedupeKey = `${mockParsedData.header_json.abn}_${mockParsedData.header_json.invoice_number}_${mockParsedData.header_json.invoice_date.split('T')[0]}`
      
      // Check for duplicate
      const duplicate = get().checkDuplicate(dedupeKey)
      if (duplicate && duplicate.status === 'approved') {
        // Mark as failed with duplicate error
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: 'failed' as InvoiceIntakeStatus,
                  ...mockParsedData,
                  dedupe_key: dedupeKey,
                  updated_at: new Date()
                }
              : job
          )
        }))
        
        alert(`Duplicate invoice detected! This invoice has already been processed.\n\nExisting Job ID: ${duplicate.id}`)
        return
      }
      
      // Update job with parsed data
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId
            ? {
                ...job,
                ...mockParsedData,
                dedupe_key: dedupeKey,
                status: 'parsing' as InvoiceIntakeStatus,
                updated_at: new Date()
              }
            : job
        )
      }))
      
      // Start line mapping
      await get().mapInvoiceLines(jobId)
      
    } catch (error) {
      console.error('Parsing failed:', error)
      
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId ? { ...job, status: 'failed' as InvoiceIntakeStatus } : job
        )
      }))
      
      throw error
    } finally {
      set({ isProcessing: false })
    }
  },
  
  // ============================================
  // LINE MAPPING
  // ============================================
  
  mapInvoiceLines: async (jobId: string) => {
    const job = get().jobs.find((j) => j.id === jobId)
    if (!job) return
    
    try {
      // Simulate mapping delay
      await new Promise((resolve) => setTimeout(resolve, 1000))
      
      // Map lines to ingredients
      const mappings = job.lines_json.map((line, index) => {
        let matchType: MatchType = 'new_item'
        let ingredientId: string | undefined
        let packToUnitFactor = 1
        let unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs' | 'ea' = 'ea'
        
        // Parse pack size
        if (line.pack_size_text) {
          const packText = line.pack_size_text.toLowerCase()
          if (packText.includes('kg')) {
            const qty = parseFloat(packText)
            packToUnitFactor = qty * 1000  // convert to grams
            unit = 'g'
          } else if (packText.includes('g')) {
            packToUnitFactor = parseFloat(packText)
            unit = 'g'
          } else if (packText.includes('l')) {
            const qty = parseFloat(packText)
            packToUnitFactor = qty * 1000  // convert to ml
            unit = 'ml'
          } else if (packText.includes('ml')) {
            packToUnitFactor = parseFloat(packText)
            unit = 'ml'
          } else if (packText.includes('each') || packText.includes('ea')) {
            packToUnitFactor = 1
            unit = 'ea'
          }
        }
        
        // For demo: randomly assign match types
        if (index === 0) {
          matchType = 'exact'
          ingredientId = 'DEMO-ING-001'
        } else if (index === 1) {
          matchType = 'fuzzy'
          ingredientId = 'DEMO-ING-002'
        } else {
          matchType = 'new_item'
        }
        
        // Compute unit cost in cents per base unit
        const unitCostCents = Math.round((line.unit_price / packToUnitFactor) * 100)
        
        return {
          line_index: index,
          match_type: matchType,
          ingredient_id: ingredientId,
          pack_to_unit_factor: packToUnitFactor,
          unit: unit,
          unit_cost_computed: unitCostCents
        }
      })
      
      // Update job with mappings
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId
            ? {
                ...job,
                mapping_json: mappings,
                status: 'needs_review' as InvoiceIntakeStatus,
                updated_at: new Date()
              }
            : job
        )
      }))
      
    } catch (error) {
      console.error('Mapping failed:', error)
      throw error
    }
  },
  
  updateLineMapping: (jobId: string, lineIndex: number, mapping: Partial<InvoiceIntakeJob['mapping_json'][0]>) => {
    set((state) => ({
      jobs: state.jobs.map((job) => {
        if (job.id !== jobId) return job
        
        const updatedMappings = job.mapping_json.map((m) =>
          m.line_index === lineIndex ? { ...m, ...mapping } : m
        )
        
        return {
          ...job,
          mapping_json: updatedMappings,
          updated_at: new Date()
        }
      })
    }))
  },
  
  // ============================================
  // REVIEW & APPROVAL
  // ============================================
  
  openReviewModal: (job: InvoiceIntakeJob) => {
    set({ selectedJob: job, reviewModalOpen: true })
  },
  
  closeReviewModal: () => {
    set({ selectedJob: null, reviewModalOpen: false })
  },
  
  approveInvoice: async (jobId: string, notes?: string) => {
    set({ isProcessing: true })
    
    try {
      const job = get().jobs.find((j) => j.id === jobId)
      if (!job) throw new Error('Job not found')
      
      // Validate: all lines must be mapped
      const unmappedLines = job.mapping_json.filter(
        (m) => m.match_type !== 'new_item' && !m.ingredient_id
      )
      
      if (unmappedLines.length > 0) {
        alert('Cannot approve: Some lines are unmapped.')
        set({ isProcessing: false })
        return
      }
      
      // Validate totals (2% tolerance)
      const lineTotal = job.lines_json.reduce((sum, line) => sum + line.ext_price, 0)
      const headerSubtotal = job.header_json.subtotal
      const variance = Math.abs(lineTotal - headerSubtotal)
      const variancePercent = (variance / headerSubtotal) * 100
      
      if (variancePercent > 2) {
        alert(`Cannot approve: Totals mismatch by ${variancePercent.toFixed(1)}%`)
        set({ isProcessing: false })
        return
      }
      
      // Update ingredient costs from mapped invoice lines
      const { useDataStore } = await import('@/lib/store/dataStore')
      const store = useDataStore.getState()
      const gpThreshold = getDefaultOrgSettings().below_gp_threshold_alert_percent ?? 60

      let currentIngredients = [...store.ingredients]
      let currentRecipes = [...store.recipes]
      let currentRecipeIngredients = [...store.recipeIngredients]
      let currentMenuItems = [...store.menuItems]
      let costUpdates = 0

      for (let i = 0; i < job.mapping_json.length; i++) {
        const mapping = job.mapping_json[i]
        if (!mapping.ingredient_id || mapping.match_type === 'new_item') continue

        const line = job.lines_json[i]
        if (!line) continue

        const ingredient = currentIngredients.find((ing) => ing.id === mapping.ingredient_id)
        if (!ingredient) continue

        const newCostCents = mapping.unit_cost_computed
        if (newCostCents === ingredient.cost_per_unit) continue

        // Log price change
        await logPriceChange(ingredient.id, ingredient.cost_per_unit, newCostCents, 'invoice')

        // Update ingredient in Supabase
        await store.updateIngredient(ingredient.id, {
          cost_per_unit: newCostCents,
          last_cost_update: new Date(),
        })

        // Run cascade
        const unitCostExBase = mapping.unit_cost_computed // already in base-unit cents
        const cascade = runCostCascade(ingredient.id, newCostCents, unitCostExBase, currentIngredients, currentRecipes, currentRecipeIngredients, currentMenuItems, gpThreshold)
        if (cascade.affectedRecipes.length > 0) {
          const applied = applyCascadeToState(cascade, currentIngredients, currentRecipes, currentRecipeIngredients, currentMenuItems, newCostCents, unitCostExBase)
          currentIngredients = applied.ingredients
          currentRecipes = applied.recipes
          currentRecipeIngredients = applied.recipeIngredients
          currentMenuItems = applied.menuItems
        } else {
          // Still update the ingredient cost in local state
          currentIngredients = currentIngredients.map((ing) =>
            ing.id === ingredient.id ? { ...ing, cost_per_unit: newCostCents, last_cost_update: new Date() } : ing
          )
        }
        costUpdates++
      }

      // Apply all cascaded state
      if (costUpdates > 0) {
        store.setIngredients(currentIngredients)
        store.setRecipes(currentRecipes)
        store.setRecipeIngredients(currentRecipeIngredients)
        store.setMenuItems(currentMenuItems)
      }

      // Update job status
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, status: 'approved' as InvoiceIntakeStatus, updated_at: new Date() }
            : j
        )
      }))

      // Create review record
      const review: InvoiceIntakeReview = {
        id: `review-${Date.now()}`,
        intake_id: jobId,
        reviewer_user_id: 'current-user',
        status: 'approved',
        notes: notes,
        created_at: new Date()
      }

      set((state) => ({
        reviews: [review, ...state.reviews]
      }))

      alert(`Invoice approved! ${job.lines_json.length} items processed.${costUpdates > 0 ? ` ${costUpdates} ingredient cost(s) updated.` : ''}`)
      get().closeReviewModal()
      
    } catch (error) {
      console.error('Approval failed:', error)
      throw error
    } finally {
      set({ isProcessing: false })
    }
  },
  
  rejectInvoice: async (jobId: string, reason: string) => {
    set({ isProcessing: true })
    
    try {
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, status: 'rejected' as InvoiceIntakeStatus, updated_at: new Date() }
            : j
        )
      }))
      
      const review: InvoiceIntakeReview = {
        id: `review-${Date.now()}`,
        intake_id: jobId,
        reviewer_user_id: 'current-user',
        status: 'rejected',
        notes: reason,
        created_at: new Date()
      }
      
      set((state) => ({
        reviews: [review, ...state.reviews]
      }))
      
      alert('Invoice rejected.')
      get().closeReviewModal()
      
    } catch (error) {
      console.error('Rejection failed:', error)
      throw error
    } finally {
      set({ isProcessing: false })
    }
  },
  
  saveDraft: async (jobId: string) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId ? { ...j, updated_at: new Date() } : j
      )
    }))
    
    alert('Draft saved.')
  },
  
  // ============================================
  // UTILITIES
  // ============================================
  
  checkDuplicate: (dedupeKey: string) => {
    const jobs = get().jobs
    return jobs.find((j) => j.dedupe_key === dedupeKey) || null
  },
  
  getJobsByStatus: (status: InvoiceIntakeStatus) => {
    return get().jobs.filter((j) => j.status === status)
  }
}))
