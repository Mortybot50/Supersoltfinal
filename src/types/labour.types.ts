// ============================================
// LABOUR DATA ENTITIES
// ============================================

export interface LabourPeriod {
  period_start: Date
  period_end: Date
  venue_id: string
  
  // Hours
  total_rostered_hours: number
  total_actual_hours: number
  total_ordinary_hours: number
  total_overtime_hours: number
  total_penalty_rate_hours: number
  
  // Costs (all in cents)
  total_labour_cost: number
  ordinary_cost: number
  overtime_cost: number
  penalty_rate_cost: number
  superannuation_cost: number
  
  // Sales (for percentage calculation)
  total_sales: number
  
  // Calculated metrics
  labour_cost_percent: number
  target_labour_percent: number
  variance_hours: number
  variance_cost: number
  variance_percent: number
  
  // Efficiency
  sales_per_labour_hour: number
  avg_hourly_rate: number
  staff_count: number
}

export interface StaffLabourMetrics {
  staff_id: string
  staff_name: string
  role: string
  
  // Hours
  rostered_hours: number
  actual_hours: number
  ordinary_hours: number
  overtime_hours: number
  penalty_hours: number
  unpaid_break_hours: number
  
  // Costs (cents)
  base_rate: number
  total_cost: number
  ordinary_cost: number
  overtime_cost: number
  penalty_cost: number
  
  // Efficiency
  sales_during_shifts: number
  sales_per_hour: number
  
  // Compliance
  shift_count: number
  avg_shift_length: number
  longest_shift: number
  compliance_issues: string[]
}

export interface RoleLabourBreakdown {
  role: string
  staff_count: number
  total_hours: number
  total_cost: number
  share_of_total_cost: number
  avg_hourly_rate: number
  overtime_hours: number
  overtime_percent: number
}

export interface DaypartLabour {
  day_of_week: string
  daypart: 'breakfast' | 'lunch' | 'dinner' | 'late'
  start_hour: number
  end_hour: number
  avg_staff_count: number
  total_hours: number
  total_cost: number
  avg_sales: number
  labour_percent: number
  efficiency_score: number
}

export interface OvertimeAnalysis {
  total_overtime_hours: number
  total_overtime_cost: number
  overtime_as_percent_of_total: number
  staff_with_overtime: Array<{
    staff_id: string
    staff_name: string
    overtime_hours: number
    overtime_cost: number
    weeks_with_overtime: number
    reason: string
  }>
  trend: 'increasing' | 'stable' | 'decreasing'
}

export interface RosterCompliance {
  total_shifts: number
  published_shifts: number
  unpublished_shifts: number
  shifts_with_issues: number
  
  issues: Array<{
    issue_type: 'excessive_hours' | 'insufficient_break' | 'split_shift' | 'consecutive_days' | 'underage_hours' | 'other'
    severity: 'high' | 'medium' | 'low'
    staff_id: string
    staff_name: string
    shift_date: Date
    description: string
    fair_work_reference: string
    suggested_action: string
  }>
}

export interface LabourForecast {
  date: Date
  forecasted_sales: number
  recommended_hours: number
  recommended_cost: number
  recommended_labour_percent: number
  recommended_staff_count: number
  confidence: number
}

export interface LabourEfficiency {
  // Productivity
  sales_per_labour_hour: number
  sales_per_labour_dollar: number
  transactions_per_labour_hour: number
  items_per_labour_hour: number
  
  // Utilization
  staff_utilization_percent: number
  idle_time_hours: number
  peak_coverage_ratio: number
  
  // Benchmarks
  industry_benchmark_sales_per_lh: number
  variance_vs_benchmark: number
  performance_grade: 'A' | 'B' | 'C' | 'D' | 'F'
}
