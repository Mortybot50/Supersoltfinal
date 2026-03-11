export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_audit: {
        Row: {
          action: string
          actor_member_id: string | null
          after_snapshot: Json | null
          before_snapshot: Json | null
          created_at: string | null
          id: string
          org_id: string
          target: Json | null
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string | null
          id?: string
          org_id: string
          target?: Json | null
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string | null
          id?: string
          org_id?: string
          target?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "access_audit_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_data_audit: {
        Row: {
          action: string
          actor_user_id: string
          after_counts_json: Json | null
          before_counts_json: Json | null
          created_at: string | null
          id: string
          notes: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_counts_json?: Json | null
          before_counts_json?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_counts_json?: Json | null
          before_counts_json?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      admin_data_jobs: {
        Row: {
          created_at: string | null
          details_json: Json | null
          id: string
          job_type: string
          requested_by: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          details_json?: Json | null
          id?: string
          job_type: string
          requested_by: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          details_json?: Json | null
          id?: string
          job_type?: string
          requested_by?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          created_at: string | null
          id: string
          member_id: string | null
          org_id: string
          role_id: string | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          org_id: string
          role_id?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          org_id?: string
          role_id?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      count_schedules: {
        Row: {
          created_at: string
          days_of_week: Json | null
          due_time_local: string | null
          frequency: string
          id: string
          location_ids: Json | null
          org_id: string | null
          schedule_name: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          days_of_week?: Json | null
          due_time_local?: string | null
          frequency: string
          id?: string
          location_ids?: Json | null
          org_id?: string | null
          schedule_name: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          days_of_week?: Json | null
          due_time_local?: string | null
          frequency?: string
          id?: string
          location_ids?: Json | null
          org_id?: string | null
          schedule_name?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "count_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_schedules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      daybook_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          card_total: number | null
          cash_counted: number | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          issues: string | null
          notes: string | null
          org_id: string
          pos_sales: number | null
          status: string
          updated_at: string
          variance: number | null
          venue_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          card_total?: number | null
          cash_counted?: number | null
          created_at?: string
          created_by?: string | null
          entry_date: string
          id?: string
          issues?: string | null
          notes?: string | null
          org_id: string
          pos_sales?: number | null
          status?: string
          updated_at?: string
          variance?: number | null
          venue_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          card_total?: number | null
          cash_counted?: number | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          issues?: string | null
          notes?: string | null
          org_id?: string
          pos_sales?: number | null
          status?: string
          updated_at?: string
          variance?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daybook_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daybook_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daybook_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daybook_entries_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      device_assignments: {
        Row: {
          created_at: string
          device_id: string
          device_type: string
          id: string
          location_id: string | null
          org_id: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          device_type: string
          id?: string
          location_id?: string | null
          org_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          device_type?: string
          id?: string
          location_id?: string | null
          org_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inv_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_price_history: {
        Row: {
          changed_at: string
          id: string
          ingredient_id: string
          new_cost_cents: number
          old_cost_cents: number | null
          source: string
        }
        Insert: {
          changed_at?: string
          id?: string
          ingredient_id: string
          new_cost_cents: number
          old_cost_cents?: number | null
          source?: string
        }
        Update: {
          changed_at?: string
          id?: string
          ingredient_id?: string
          new_cost_cents?: number
          old_cost_cents?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_price_history_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          base_unit: string | null
          category: string
          cost_per_unit: number
          created_at: string
          current_stock: number
          gst_applicable: boolean
          id: string
          last_cost_update: string | null
          name: string
          notes: string | null
          org_id: string | null
          pack_size: number | null
          pack_size_text: string | null
          pack_to_base_factor: number | null
          par_level: number
          product_code: string | null
          reorder_point: number
          supplier_id: string | null
          supplier_name: string | null
          unit: string
          unit_cost_ex_base: number | null
          unit_size: number | null
          units_per_pack: number | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          active?: boolean
          base_unit?: string | null
          category: string
          cost_per_unit: number
          created_at?: string
          current_stock?: number
          gst_applicable?: boolean
          id?: string
          last_cost_update?: string | null
          name: string
          notes?: string | null
          org_id?: string | null
          pack_size?: number | null
          pack_size_text?: string | null
          pack_to_base_factor?: number | null
          par_level?: number
          product_code?: string | null
          reorder_point?: number
          supplier_id?: string | null
          supplier_name?: string | null
          unit: string
          unit_cost_ex_base?: number | null
          unit_size?: number | null
          units_per_pack?: number | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          active?: boolean
          base_unit?: string | null
          category?: string
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          gst_applicable?: boolean
          id?: string
          last_cost_update?: string | null
          name?: string
          notes?: string | null
          org_id?: string | null
          pack_size?: number | null
          pack_size_text?: string | null
          pack_to_base_factor?: number | null
          par_level?: number
          product_code?: string | null
          reorder_point?: number
          supplier_id?: string | null
          supplier_name?: string | null
          unit?: string
          unit_cost_ex_base?: number | null
          unit_size?: number | null
          units_per_pack?: number | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_bins: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          location_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_bins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inv_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_location_assignments: {
        Row: {
          bin_id: string | null
          count_uom: string | null
          created_at: string
          id: string
          ingredient_id: string | null
          location_id: string | null
          max_level: number | null
          min_level: number | null
          org_id: string | null
          par_level: number | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          bin_id?: string | null
          count_uom?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          location_id?: string | null
          max_level?: number | null
          min_level?: number | null
          org_id?: string | null
          par_level?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          bin_id?: string | null
          count_uom?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          location_id?: string | null
          max_level?: number | null
          min_level?: number | null
          org_id?: string | null
          par_level?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_location_assignments_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "inv_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_location_assignments_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_location_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inv_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_location_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_location_assignments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_locations: {
        Row: {
          capacity_hint: string | null
          code: string | null
          counting_method: string | null
          created_at: string
          default_uom: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string | null
          temperature_target_c: number | null
          type: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          capacity_hint?: string | null
          code?: string | null
          counting_method?: string | null
          created_at?: string
          default_uom?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id?: string | null
          temperature_target_c?: number | null
          type: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          capacity_hint?: string | null
          code?: string | null
          counting_method?: string | null
          created_at?: string
          default_uom?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string | null
          temperature_target_c?: number | null
          type?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_locations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invite_token: string
          invited_by_member_id: string | null
          org_id: string
          role_id: string | null
          status: Database["public"]["Enums"]["invite_status"] | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_token: string
          invited_by_member_id?: string | null
          org_id: string
          role_id?: string | null
          status?: Database["public"]["Enums"]["invite_status"] | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_token?: string
          invited_by_member_id?: string | null
          org_id?: string
          role_id?: string | null
          status?: Database["public"]["Enums"]["invite_status"] | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_member_id_fkey"
            columns: ["invited_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          confidence_score: number | null
          confirmed_quantity: number | null
          confirmed_unit_price: number | null
          created_at: string
          extracted_discount: number | null
          extracted_line_total: number | null
          extracted_quantity: number | null
          extracted_tax: number | null
          extracted_unit: string | null
          extracted_unit_price: number | null
          id: string
          ingredient_id: string | null
          invoice_id: string
          match_status: string
          raw_description: string
          variance_notes: string | null
        }
        Insert: {
          confidence_score?: number | null
          confirmed_quantity?: number | null
          confirmed_unit_price?: number | null
          created_at?: string
          extracted_discount?: number | null
          extracted_line_total?: number | null
          extracted_quantity?: number | null
          extracted_tax?: number | null
          extracted_unit?: string | null
          extracted_unit_price?: number | null
          id?: string
          ingredient_id?: string | null
          invoice_id: string
          match_status?: string
          raw_description: string
          variance_notes?: string | null
        }
        Update: {
          confidence_score?: number | null
          confirmed_quantity?: number | null
          confirmed_unit_price?: number | null
          created_at?: string
          extracted_discount?: number | null
          extracted_line_total?: number | null
          extracted_quantity?: number | null
          extracted_tax?: number | null
          extracted_unit?: string | null
          extracted_unit_price?: number | null
          id?: string
          ingredient_id?: string | null
          invoice_id?: string
          match_status?: string
          raw_description?: string
          variance_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          document_type: string
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          matched_po_id: string | null
          notes: string | null
          org_id: string
          original_file_url: string | null
          original_filename: string | null
          processing_metadata: Json | null
          sender_email: string | null
          source: string
          status: string
          subtotal: number | null
          supplier_id: string | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          document_type?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          matched_po_id?: string | null
          notes?: string | null
          org_id: string
          original_file_url?: string | null
          original_filename?: string | null
          processing_metadata?: Json | null
          sender_email?: string | null
          source?: string
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          document_type?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          matched_po_id?: string | null
          notes?: string | null
          org_id?: string
          original_file_url?: string | null
          original_filename?: string | null
          processing_metadata?: Json | null
          sender_email?: string | null
          source?: string
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_matched_po_id_fkey"
            columns: ["matched_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_budgets: {
        Row: {
          actual_amount: number | null
          budgeted_amount: number
          created_at: string
          created_by: string | null
          critical_threshold_percent: number | null
          id: string
          notes: string | null
          org_id: string
          period_end: string
          period_start: string
          period_type: string
          revenue_target: number | null
          updated_at: string
          venue_id: string
          warning_threshold_percent: number | null
        }
        Insert: {
          actual_amount?: number | null
          budgeted_amount?: number
          created_at?: string
          created_by?: string | null
          critical_threshold_percent?: number | null
          id?: string
          notes?: string | null
          org_id: string
          period_end: string
          period_start: string
          period_type?: string
          revenue_target?: number | null
          updated_at?: string
          venue_id: string
          warning_threshold_percent?: number | null
        }
        Update: {
          actual_amount?: number | null
          budgeted_amount?: number
          created_at?: string
          created_by?: string | null
          critical_threshold_percent?: number | null
          id?: string
          notes?: string | null
          org_id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          revenue_target?: number | null
          updated_at?: string
          venue_id?: string
          warning_threshold_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "labor_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_budgets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_budgets_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          org_id: string
          primary_email: string
          status: Database["public"]["Enums"]["member_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          org_id: string
          primary_email: string
          status?: Database["public"]["Enums"]["member_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          org_id?: string
          primary_email?: string
          status?: Database["public"]["Enums"]["member_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          active: boolean
          category: string
          cost_price: number
          created_at: string
          description: string | null
          id: string
          launch_date: string | null
          margin_percent: number
          menu_group: string
          name: string
          org_id: string | null
          selling_price: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          active?: boolean
          category: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          launch_date?: string | null
          margin_percent?: number
          menu_group: string
          name: string
          org_id?: string | null
          selling_price: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          active?: boolean
          category?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          launch_date?: string | null
          margin_percent?: number
          menu_group?: string
          name?: string
          org_id?: string | null
          selling_price?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string
          created_at: string
          customer_name: string | null
          discount_amount: number
          gross_amount: number
          id: string
          is_refund: boolean
          is_void: boolean
          net_amount: number
          notes: string | null
          order_datetime: string
          order_number: string
          org_id: string | null
          payment_method: string | null
          refund_reason: string | null
          service_charge: number
          staff_member: string | null
          tax_amount: number
          tip_amount: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number
          gross_amount: number
          id?: string
          is_refund?: boolean
          is_void?: boolean
          net_amount: number
          notes?: string | null
          order_datetime: string
          order_number: string
          org_id?: string | null
          payment_method?: string | null
          refund_reason?: string | null
          service_charge?: number
          staff_member?: string | null
          tax_amount: number
          tip_amount?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number
          gross_amount?: number
          id?: string
          is_refund?: boolean
          is_void?: boolean
          net_amount?: number
          notes?: string | null
          order_datetime?: string
          order_number?: string
          org_id?: string | null
          payment_method?: string | null
          refund_reason?: string | null
          service_charge?: number
          staff_member?: string | null
          tax_amount?: number
          tip_amount?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          org_id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pins: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_rotated_at: string | null
          member_id: string | null
          org_id: string
          pin_hash: string
          pin_last4: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_rotated_at?: string | null
          member_id?: string | null
          org_id: string
          pin_hash: string
          pin_last4?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_rotated_at?: string | null
          member_id?: string | null
          org_id?: string
          pin_hash?: string
          pin_last4?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pins_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_connections: {
        Row: {
          access_token: string | null
          connected_by: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_status: string | null
          merchant_id: string | null
          merchant_name: string | null
          org_id: string
          provider: string
          refresh_token: string | null
          sync_frequency: string | null
          sync_from_date: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          org_id: string
          provider?: string
          refresh_token?: string | null
          sync_frequency?: string | null
          sync_from_date?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          org_id?: string
          provider?: string
          refresh_token?: string | null
          sync_frequency?: string | null
          sync_from_date?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_location_mappings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          pos_connection_id: string
          pos_location_id: string
          pos_location_name: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          pos_connection_id: string
          pos_location_id: string
          pos_location_name?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          pos_connection_id?: string
          pos_location_id?: string
          pos_location_name?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_location_mappings_pos_connection_id_fkey"
            columns: ["pos_connection_id"]
            isOneToOne: false
            referencedRelation: "pos_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_location_mappings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          ingredient_name: string
          line_total: number
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number | null
          unit: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name: string
          line_total: number
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number | null
          unit: string
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string
          line_total?: number
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number | null
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          delivered_at: string | null
          expected_delivery_date: string
          id: string
          notes: string | null
          order_date: string
          org_id: string | null
          po_number: string
          received_by_name: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          subtotal: number | null
          supplier_id: string | null
          supplier_name: string
          tax_amount: number | null
          total_amount: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          delivered_at?: string | null
          expected_delivery_date: string
          id?: string
          notes?: string | null
          order_date?: string
          org_id?: string | null
          po_number: string
          received_by_name?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          supplier_name: string
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          delivered_at?: string | null
          expected_delivery_date?: string
          id?: string
          notes?: string | null
          order_date?: string
          org_id?: string | null
          po_number?: string
          received_by_name?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          required_for_roles: string[]
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          required_for_roles?: string[]
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          required_for_roles?: string[]
          updated_at?: string
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          ingredient_id: string
          is_sub_recipe: boolean | null
          notes: string | null
          quantity: number
          recipe_id: string
          sort_order: number | null
          sub_recipe_id: string | null
          unit: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          ingredient_id: string
          is_sub_recipe?: boolean | null
          notes?: string | null
          quantity: number
          recipe_id: string
          sort_order?: number | null
          sub_recipe_id?: string | null
          unit: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          ingredient_id?: string
          is_sub_recipe?: boolean | null
          notes?: string | null
          quantity?: number
          recipe_id?: string
          sort_order?: number | null
          sub_recipe_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_sub_recipe_id_fkey"
            columns: ["sub_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          allergens: string[] | null
          batch_yield: number
          category: string
          code: string | null
          cook_time_mins: number | null
          cost_per_batch: number | null
          cost_per_serve: number | null
          created_at: string
          created_by: string | null
          description: string | null
          gp_target_percent: number | null
          id: string
          image_url: string | null
          method: string | null
          name: string
          org_id: string
          prep_time_mins: number | null
          serve_size: number | null
          serve_unit: string | null
          status: string
          suggested_price: number | null
          updated_at: string
          version: number | null
          waste_percent: number | null
        }
        Insert: {
          allergens?: string[] | null
          batch_yield?: number
          category?: string
          code?: string | null
          cook_time_mins?: number | null
          cost_per_batch?: number | null
          cost_per_serve?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gp_target_percent?: number | null
          id?: string
          image_url?: string | null
          method?: string | null
          name: string
          org_id: string
          prep_time_mins?: number | null
          serve_size?: number | null
          serve_unit?: string | null
          status?: string
          suggested_price?: number | null
          updated_at?: string
          version?: number | null
          waste_percent?: number | null
        }
        Update: {
          allergens?: string[] | null
          batch_yield?: number
          category?: string
          code?: string | null
          cook_time_mins?: number | null
          cost_per_batch?: number | null
          cost_per_serve?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gp_target_percent?: number | null
          id?: string
          image_url?: string | null
          method?: string | null
          name?: string
          org_id?: string
          prep_time_mins?: number | null
          serve_size?: number | null
          serve_unit?: string | null
          status?: string
          suggested_price?: number | null
          updated_at?: string
          version?: number | null
          waste_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_line_items: {
        Row: {
          actual_unit_price: number | null
          expected_quantity: number | null
          expected_unit_price: number | null
          id: string
          ingredient_id: string | null
          invoice_line_item_id: string | null
          notes: string | null
          po_line_item_id: string | null
          price_variance: number | null
          quantity_variance: number | null
          received_quantity: number | null
          reconciliation_id: string
          status: string
        }
        Insert: {
          actual_unit_price?: number | null
          expected_quantity?: number | null
          expected_unit_price?: number | null
          id?: string
          ingredient_id?: string | null
          invoice_line_item_id?: string | null
          notes?: string | null
          po_line_item_id?: string | null
          price_variance?: number | null
          quantity_variance?: number | null
          received_quantity?: number | null
          reconciliation_id: string
          status?: string
        }
        Update: {
          actual_unit_price?: number | null
          expected_quantity?: number | null
          expected_unit_price?: number | null
          id?: string
          ingredient_id?: string | null
          invoice_line_item_id?: string | null
          notes?: string | null
          po_line_item_id?: string | null
          price_variance?: number | null
          quantity_variance?: number | null
          received_quantity?: number | null
          reconciliation_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_line_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_line_items_invoice_line_item_id_fkey"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_line_items_po_line_item_id_fkey"
            columns: ["po_line_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_line_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_logs: {
        Row: {
          id: string
          invoice_id: string
          notes: string | null
          purchase_order_id: string | null
          reconciled_at: string
          reconciled_by: string | null
          status: string
          total_expected_value: number | null
          total_received_value: number | null
          total_variance: number | null
          venue_id: string
        }
        Insert: {
          id?: string
          invoice_id: string
          notes?: string | null
          purchase_order_id?: string | null
          reconciled_at?: string
          reconciled_by?: string | null
          status?: string
          total_expected_value?: number | null
          total_received_value?: number | null
          total_variance?: number | null
          venue_id: string
        }
        Update: {
          id?: string
          invoice_id?: string
          notes?: string | null
          purchase_order_id?: string | null
          reconciled_at?: string
          reconciled_by?: string | null
          status?: string
          total_expected_value?: number | null
          total_received_value?: number | null
          total_variance?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_logs_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_logs_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_logs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          approval_limits: Json | null
          can_edit: boolean | null
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          key: string
          org_id: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          approval_limits?: Json | null
          can_edit?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key: string
          org_id: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          approval_limits?: Json | null
          can_edit?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          org_id?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_definitions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_patterns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          shifts: Json
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          shifts?: Json
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          shifts?: Json
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_patterns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_patterns_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_shifts: {
        Row: {
          base_cost: number | null
          break_duration_mins: number | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          end_time: string
          estimated_cost: number | null
          hourly_rate: number | null
          id: string
          is_open_shift: boolean | null
          notes: string | null
          org_id: string
          penalty_cost: number | null
          penalty_rate: number | null
          penalty_type: string | null
          position: string | null
          published_at: string | null
          shift_date: string
          staff_id: string
          start_time: string
          status: string
          template_id: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          base_cost?: number | null
          break_duration_mins?: number | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          estimated_cost?: number | null
          hourly_rate?: number | null
          id?: string
          is_open_shift?: boolean | null
          notes?: string | null
          org_id: string
          penalty_cost?: number | null
          penalty_rate?: number | null
          penalty_type?: string | null
          position?: string | null
          published_at?: string | null
          shift_date: string
          staff_id: string
          start_time: string
          status?: string
          template_id?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          base_cost?: number | null
          break_duration_mins?: number | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          estimated_cost?: number | null
          hourly_rate?: number | null
          id?: string
          is_open_shift?: boolean | null
          notes?: string | null
          org_id?: string
          penalty_cost?: number | null
          penalty_rate?: number | null
          penalty_type?: string | null
          position?: string | null
          published_at?: string | null
          shift_date?: string
          staff_id?: string
          start_time?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_shifts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_shifts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          org_id: string
          original_shift_id: string
          original_staff_id: string
          rejection_reason: string | null
          requested_at: string
          responded_at: string | null
          responded_by: string | null
          status: string
          target_staff_id: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          original_shift_id: string
          original_staff_id: string
          rejection_reason?: string | null
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          target_staff_id?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          original_shift_id?: string
          original_staff_id?: string
          rejection_reason?: string | null
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          target_staff_id?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_original_shift_id_fkey"
            columns: ["original_shift_id"]
            isOneToOne: false
            referencedRelation: "roster_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_original_staff_id_fkey"
            columns: ["original_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_staff_id_fkey"
            columns: ["target_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          break_minutes: number | null
          created_at: string
          created_by: string | null
          days_of_week: number[] | null
          description: string | null
          end_time: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          org_id: string
          position: string
          start_time: string
          template_shifts: Json
          updated_at: string
          usage_count: number | null
          venue_id: string
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[] | null
          description?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          org_id: string
          position?: string
          start_time: string
          template_shifts?: Json
          updated_at?: string
          usage_count?: number | null
          venue_id: string
        }
        Update: {
          break_minutes?: number | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[] | null
          description?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          org_id?: string
          position?: string
          start_time?: string
          template_shifts?: Json
          updated_at?: string
          usage_count?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_templates_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          award_classification: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_bsb: string | null
          base_hourly_rate: number | null
          contract_signed: boolean | null
          contract_signed_at: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employment_type: string
          end_date: string | null
          fwis_acknowledged: boolean | null
          fwis_acknowledged_at: string | null
          gender: string | null
          id: string
          id_verified: boolean | null
          onboarding_status: string
          org_member_id: string
          pin_code: string | null
          policies_acknowledged: boolean | null
          policies_acknowledged_at: string | null
          position: string | null
          postcode: string | null
          start_date: string | null
          state: string | null
          suburb: string | null
          super_fund_abn: string | null
          super_fund_name: string | null
          super_member_number: string | null
          tfn_declaration_date: string | null
          tfn_provided: boolean | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          award_classification?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          base_hourly_rate?: number | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employment_type?: string
          end_date?: string | null
          fwis_acknowledged?: boolean | null
          fwis_acknowledged_at?: string | null
          gender?: string | null
          id?: string
          id_verified?: boolean | null
          onboarding_status?: string
          org_member_id: string
          pin_code?: string | null
          policies_acknowledged?: boolean | null
          policies_acknowledged_at?: string | null
          position?: string | null
          postcode?: string | null
          start_date?: string | null
          state?: string | null
          suburb?: string | null
          super_fund_abn?: string | null
          super_fund_name?: string | null
          super_member_number?: string | null
          tfn_declaration_date?: string | null
          tfn_provided?: boolean | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          award_classification?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          base_hourly_rate?: number | null
          contract_signed?: boolean | null
          contract_signed_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employment_type?: string
          end_date?: string | null
          fwis_acknowledged?: boolean | null
          fwis_acknowledged_at?: string | null
          gender?: string | null
          id?: string
          id_verified?: boolean | null
          onboarding_status?: string
          org_member_id?: string
          pin_code?: string | null
          policies_acknowledged?: boolean | null
          policies_acknowledged_at?: string | null
          position?: string | null
          postcode?: string | null
          start_date?: string | null
          state?: string | null
          suburb?: string | null
          super_fund_abn?: string | null
          super_fund_name?: string | null
          super_member_number?: string | null
          tfn_declaration_date?: string | null
          tfn_provided?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_org_member_id_fkey"
            columns: ["org_member_id"]
            isOneToOne: false
            referencedRelation: "org_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_availability: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          is_available: boolean | null
          staff_id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          staff_id: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          staff_id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accessed_at: string | null
          completed_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
          sent_at: string
          sent_to_email: string
          staff_id: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          accessed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: string
          sent_at?: string
          sent_to_email: string
          staff_id?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          accessed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
          sent_at?: string
          sent_to_email?: string
          staff_id?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_qualifications: {
        Row: {
          certificate_number: string | null
          created_at: string
          evidence_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          org_id: string
          qualification_type_id: string
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          evidence_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          org_id: string
          qualification_type_id: string
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          evidence_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          org_id?: string
          qualification_type_id?: string
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_qualifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_qualifications_qualification_type_id_fkey"
            columns: ["qualification_type_id"]
            isOneToOne: false
            referencedRelation: "qualification_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_qualifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          actual_quantity: number
          created_at: string
          expected_quantity: number
          id: string
          ingredient_id: string
          ingredient_name: string
          stock_count_id: string
          variance: number
          variance_value: number
        }
        Insert: {
          actual_quantity: number
          created_at?: string
          expected_quantity: number
          id?: string
          ingredient_id: string
          ingredient_name: string
          stock_count_id: string
          variance: number
          variance_value: number
        }
        Update: {
          actual_quantity?: number
          created_at?: string
          expected_quantity?: number
          id?: string
          ingredient_id?: string
          ingredient_name?: string
          stock_count_id?: string
          variance?: number
          variance_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          count_date: string
          count_number: string
          counted_by_name: string | null
          counted_by_user_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string | null
          status: string
          total_variance_value: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          count_date?: string
          count_number: string
          counted_by_name?: string | null
          counted_by_user_id: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          status?: string
          total_variance_value?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          count_date?: string
          count_number?: string
          counted_by_name?: string | null
          counted_by_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          status?: string
          total_variance_value?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          abn: string | null
          account_number: string | null
          active: boolean
          address: string | null
          category: string
          certificate_expiry: string | null
          certificate_number: string | null
          contact_person: string | null
          created_at: string
          cutoff_time: string
          delivery_days: number[]
          delivery_lead_days: number
          delivery_schedule: Json | null
          email: string | null
          haccp_certified: boolean | null
          id: string
          invoice_email_domains: string[] | null
          is_gst_registered: boolean | null
          minimum_order: number | null
          name: string
          notes: string | null
          order_method: string | null
          organization_id: string
          payment_terms: string | null
          phone: string | null
          postcode: string | null
          preferred_order_channel: string | null
          schedule_overrides: Json | null
          state: string | null
          suburb: string | null
          updated_at: string
        }
        Insert: {
          abn?: string | null
          account_number?: string | null
          active?: boolean
          address?: string | null
          category?: string
          certificate_expiry?: string | null
          certificate_number?: string | null
          contact_person?: string | null
          created_at?: string
          cutoff_time?: string
          delivery_days?: number[]
          delivery_lead_days?: number
          delivery_schedule?: Json | null
          email?: string | null
          haccp_certified?: boolean | null
          id?: string
          invoice_email_domains?: string[] | null
          is_gst_registered?: boolean | null
          minimum_order?: number | null
          name: string
          notes?: string | null
          order_method?: string | null
          organization_id: string
          payment_terms?: string | null
          phone?: string | null
          postcode?: string | null
          preferred_order_channel?: string | null
          schedule_overrides?: Json | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string | null
          account_number?: string | null
          active?: boolean
          address?: string | null
          category?: string
          certificate_expiry?: string | null
          certificate_number?: string | null
          contact_person?: string | null
          created_at?: string
          cutoff_time?: string
          delivery_days?: number[]
          delivery_lead_days?: number
          delivery_schedule?: Json | null
          email?: string | null
          haccp_certified?: boolean | null
          id?: string
          invoice_email_domains?: string[] | null
          is_gst_registered?: boolean | null
          minimum_order?: number | null
          name?: string
          notes?: string | null
          order_method?: string | null
          organization_id?: string
          payment_terms?: string | null
          phone?: string | null
          postcode?: string | null
          preferred_order_channel?: string | null
          schedule_overrides?: Json | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_end: string | null
          break_start: string | null
          clock_in: string
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_in_method: string | null
          clock_out: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          created_at: string
          edit_reason: string | null
          edited: boolean | null
          hourly_rate: number | null
          id: string
          notes: string | null
          org_id: string
          overtime_hours: number | null
          penalty_rate: number | null
          rejection_reason: string | null
          roster_shift_id: string | null
          staff_id: string
          status: string
          total_break_mins: number | null
          total_hours: number | null
          total_pay: number | null
          updated_at: string
          venue_id: string
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_end?: string | null
          break_start?: string | null
          clock_in: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_method?: string | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string
          edit_reason?: string | null
          edited?: boolean | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          org_id: string
          overtime_hours?: number | null
          penalty_rate?: number | null
          rejection_reason?: string | null
          roster_shift_id?: string | null
          staff_id: string
          status?: string
          total_break_mins?: number | null
          total_hours?: number | null
          total_pay?: number | null
          updated_at?: string
          venue_id: string
          work_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_end?: string | null
          break_start?: string | null
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_method?: string | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string
          edit_reason?: string | null
          edited?: boolean | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          org_id?: string
          overtime_hours?: number | null
          penalty_rate?: number | null
          rejection_reason?: string | null
          roster_shift_id?: string | null
          staff_id?: string
          status?: string
          total_break_mins?: number | null
          total_hours?: number | null
          total_pay?: number | null
          updated_at?: string
          venue_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_roster_shift_id_fkey"
            columns: ["roster_shift_id"]
            isOneToOne: false
            referencedRelation: "roster_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_access: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          org_member_id: string
          venue_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          org_member_id: string
          venue_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          org_member_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_access_org_member_id_fkey"
            columns: ["org_member_id"]
            isOneToOne: false
            referencedRelation: "org_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_access_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_settings: {
        Row: {
          award_region: string | null
          below_gp_threshold_alert_percent: number | null
          created_at: string
          custom_closed_dates: Json | null
          default_gp_target_percent: number | null
          delivery_windows: Json | null
          gst_rate_percent: number | null
          id: string
          inherit: Json | null
          last_published_snapshot: Json | null
          menu_sections: Json | null
          order_cutoffs: Json | null
          org_id: string | null
          payroll_cycle: string | null
          po_amount_over_requires_owner: number | null
          pos_provider: string | null
          price_change_max_percent_no_approval: number | null
          price_display_mode: string | null
          price_endings: string | null
          primary_suppliers: Json | null
          printer_map: Json | null
          roster_budget_percent: number | null
          rounding_mode: string | null
          state: string | null
          tax_code_default: string | null
          timezone: string | null
          updated_at: string
          use_au_public_holidays: boolean | null
          venue_id: string
          week_starts_on: string | null
        }
        Insert: {
          award_region?: string | null
          below_gp_threshold_alert_percent?: number | null
          created_at?: string
          custom_closed_dates?: Json | null
          default_gp_target_percent?: number | null
          delivery_windows?: Json | null
          gst_rate_percent?: number | null
          id?: string
          inherit?: Json | null
          last_published_snapshot?: Json | null
          menu_sections?: Json | null
          order_cutoffs?: Json | null
          org_id?: string | null
          payroll_cycle?: string | null
          po_amount_over_requires_owner?: number | null
          pos_provider?: string | null
          price_change_max_percent_no_approval?: number | null
          price_display_mode?: string | null
          price_endings?: string | null
          primary_suppliers?: Json | null
          printer_map?: Json | null
          roster_budget_percent?: number | null
          rounding_mode?: string | null
          state?: string | null
          tax_code_default?: string | null
          timezone?: string | null
          updated_at?: string
          use_au_public_holidays?: boolean | null
          venue_id: string
          week_starts_on?: string | null
        }
        Update: {
          award_region?: string | null
          below_gp_threshold_alert_percent?: number | null
          created_at?: string
          custom_closed_dates?: Json | null
          default_gp_target_percent?: number | null
          delivery_windows?: Json | null
          gst_rate_percent?: number | null
          id?: string
          inherit?: Json | null
          last_published_snapshot?: Json | null
          menu_sections?: Json | null
          order_cutoffs?: Json | null
          org_id?: string | null
          payroll_cycle?: string | null
          po_amount_over_requires_owner?: number | null
          pos_provider?: string | null
          price_change_max_percent_no_approval?: number | null
          price_display_mode?: string | null
          price_endings?: string | null
          primary_suppliers?: Json | null
          printer_map?: Json | null
          roster_budget_percent?: number | null
          rounding_mode?: string | null
          state?: string | null
          tax_code_default?: string | null
          timezone?: string | null
          updated_at?: string
          use_au_public_holidays?: boolean | null
          venue_id?: string
          week_starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_settings_venue_id_fkey2"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_settings_audit: {
        Row: {
          action: string
          actor_user_id: string
          after_snapshot: Json | null
          before_snapshot: Json | null
          created_at: string
          diff_summary: string | null
          id: string
          org_id: string | null
          venue_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          diff_summary?: string | null
          id?: string
          org_id?: string | null
          venue_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          diff_summary?: string | null
          id?: string
          org_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_settings_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_settings_audit_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_id: string
          template_data: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_id: string
          template_data?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string
          template_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "venue_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          timezone: string | null
          trading_hours: Json | null
          updated_at: string | null
          venue_type: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          timezone?: string | null
          trading_hours?: Json | null
          updated_at?: string | null
          venue_type?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          timezone?: string | null
          trading_hours?: Json | null
          updated_at?: string | null
          venue_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_logs: {
        Row: {
          cost_at_time: number | null
          created_at: string
          daypart: string | null
          id: string
          ingredient_id: string
          ingredient_name: string
          notes: string | null
          org_id: string | null
          photo_url: string | null
          quantity: number
          reason: string
          reason_code: string | null
          recorded_by_name: string | null
          recorded_by_user_id: string
          unit: string
          value: number
          venue_id: string
          waste_date: string
          waste_time: string
        }
        Insert: {
          cost_at_time?: number | null
          created_at?: string
          daypart?: string | null
          id?: string
          ingredient_id: string
          ingredient_name: string
          notes?: string | null
          org_id?: string | null
          photo_url?: string | null
          quantity: number
          reason: string
          reason_code?: string | null
          recorded_by_name?: string | null
          recorded_by_user_id: string
          unit: string
          value: number
          venue_id: string
          waste_date?: string
          waste_time: string
        }
        Update: {
          cost_at_time?: number | null
          created_at?: string
          daypart?: string | null
          id?: string
          ingredient_id?: string
          ingredient_name?: string
          notes?: string | null
          org_id?: string | null
          photo_url?: string | null
          quantity?: number
          reason?: string
          reason_code?: string | null
          recorded_by_name?: string | null
          recorded_by_user_id?: string
          unit?: string
          value?: number
          venue_id?: string
          waste_date?: string
          waste_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_logs_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_logs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_ids: { Args: never; Returns: string[] }
      get_user_venue_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { check_org_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      invite_status: "pending" | "accepted" | "expired" | "revoked"
      member_status: "active" | "invited" | "suspended" | "deactivated"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      invite_status: ["pending", "accepted", "expired", "revoked"],
      member_status: ["active", "invited", "suspended", "deactivated"],
    },
  },
} as const
