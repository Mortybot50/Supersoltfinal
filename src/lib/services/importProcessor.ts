import { importMappings, ColumnMapping } from '@/lib/config/importMappings'
import * as ExcelUtils from '@/lib/utils/excelImport'
import { ImportResult, ImportError, ImportWarning } from '@/lib/utils/excelImport'
import { z } from 'zod'

export async function processImport<T>(
  file: File,
  entityType: string,
  validationSchema: z.ZodSchema<T>
): Promise<ImportResult<T>> {
  const errors: ImportError[] = []
  const warnings: ImportWarning[] = []
  const validData: T[] = []
  
  try {
    // Parse file
    const rawData = await ExcelUtils.parseFile(file)
    
    if (rawData.length === 0) {
      throw new Error('File is empty')
    }
    
    // Get column mappings
    const mappings = importMappings[entityType]
    if (!mappings) {
      throw new Error(`No import mapping found for ${entityType}`)
    }
    
    // Process each row
    rawData.forEach((row, index) => {
      const rowNumber = index + 2 // +2 because Excel is 1-indexed and has header
      
      try {
        // Transform row data
        const transformedRow = transformRow(row, mappings)
        
        // Validate row
        const result = validationSchema.safeParse(transformedRow)
        
        if (result.success) {
          validData.push(result.data)
        } else {
          // Add validation errors
          result.error.errors.forEach(err => {
            errors.push({
              row: rowNumber,
              field: err.path.join('.'),
              value: row[err.path[0] as string],
              message: err.message
            })
          })
        }
      } catch (error: any) {
        errors.push({
          row: rowNumber,
          field: 'general',
          value: null,
          message: error.message
        })
      }
    })
    
    return {
      success: errors.length === 0,
      data: validData,
      errors,
      warnings,
      totalRows: rawData.length,
      validRows: validData.length,
      invalidRows: errors.length
    }
    
  } catch (error: any) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, field: 'file', value: null, message: error.message }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0
    }
  }
}

function transformRow(row: any, mappings: ColumnMapping[]): any {
  const transformed: any = {}
  
  mappings.forEach(mapping => {
    const rawValue = row[mapping.header]
    
    if (!rawValue && mapping.required) {
      throw new Error(`${mapping.header} is required`)
    }
    
    if (!rawValue && !mapping.required) {
      return
    }
    
    // Transform based on type
    switch (mapping.type) {
      case 'string':
        transformed[mapping.field] = ExcelUtils.cleanString(rawValue)
        break
      case 'number':
        transformed[mapping.field] = ExcelUtils.cleanNumber(rawValue)
        if (transformed[mapping.field] === null && mapping.required) {
          throw new Error(`${mapping.header} must be a valid number`)
        }
        break
      case 'date':
        transformed[mapping.field] = ExcelUtils.cleanDate(rawValue)
        if (!transformed[mapping.field] && mapping.required) {
          throw new Error(`${mapping.header} must be a valid date`)
        }
        break
      case 'boolean':
        transformed[mapping.field] = ExcelUtils.cleanBoolean(rawValue)
        break
      case 'email':
        transformed[mapping.field] = ExcelUtils.cleanEmail(rawValue)
        if (!transformed[mapping.field] && mapping.required) {
          throw new Error(`${mapping.header} must be a valid email`)
        }
        break
      case 'phone':
        transformed[mapping.field] = ExcelUtils.cleanPhone(rawValue)
        break
      case 'enum':
        const cleanValue = ExcelUtils.cleanString(rawValue).toLowerCase()
        if (mapping.options && !mapping.options.includes(cleanValue)) {
          throw new Error(`${mapping.header} must be one of: ${mapping.options.join(', ')}`)
        }
        transformed[mapping.field] = cleanValue
        break
    }
    
    // Apply custom transform if exists
    if (mapping.transform) {
      transformed[mapping.field] = mapping.transform(transformed[mapping.field])
    }
  })
  
  return transformed
}
