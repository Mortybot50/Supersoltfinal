import { z } from 'zod'
import { isValidTFN, isValidBSB, isValidAccountNumber } from '@/lib/utils/validation'

// ── TFN Declaration ──────────────────────────────────────────────
export const tfnDeclarationSchema = z.discriminatedUnion('tfn_declaration_status', [
  z.object({
    tfn_declaration_status: z.literal('provided'),
    tfn_number: z.string()
      .transform(v => v.replace(/\s/g, ''))
      .refine(v => /^\d{9}$/.test(v), 'TFN must be exactly 9 digits')
      .refine(v => isValidTFN(v), 'Invalid TFN — check digit validation failed'),
    tfn_claimed_tax_free_threshold: z.boolean(),
    tfn_has_help_debt: z.boolean(),
    tfn_has_ssl_debt: z.boolean(),
    tfn_has_tsl_debt: z.boolean(),
  }),
  z.object({
    tfn_declaration_status: z.literal('not_provided'),
    tfn_claimed_tax_free_threshold: z.boolean().optional(),
    tfn_has_help_debt: z.boolean().optional(),
    tfn_has_ssl_debt: z.boolean().optional(),
    tfn_has_tsl_debt: z.boolean().optional(),
  }),
  z.object({
    tfn_declaration_status: z.literal('exemption'),
    tfn_exemption_reason: z.string().min(1, 'Exemption reason is required'),
    tfn_claimed_tax_free_threshold: z.boolean().optional(),
    tfn_has_help_debt: z.boolean().optional(),
    tfn_has_ssl_debt: z.boolean().optional(),
    tfn_has_tsl_debt: z.boolean().optional(),
  }),
])

export type TFNDeclarationFormData = z.infer<typeof tfnDeclarationSchema>

// ── Bank Details ─────────────────────────────────────────────────
export const bankDetailsSchema = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  bsb: z.string()
    .transform(v => v.replace(/[\s-]/g, ''))
    .refine(v => isValidBSB(v), 'BSB must be exactly 6 digits'),
  account_number: z.string()
    .transform(v => v.replace(/[\s-]/g, ''))
    .refine(v => isValidAccountNumber(v), 'Account number must be 6-10 digits'),
  account_name: z.string().min(1, 'Account name is required'),
})

export type BankDetailsFormData = z.infer<typeof bankDetailsSchema>

// ── Super Choice ─────────────────────────────────────────────────
export const superChoiceSchema = z.discriminatedUnion('super_choice', [
  z.object({
    super_choice: z.literal('employer_default'),
  }),
  z.object({
    super_choice: z.literal('self_managed'),
    super_fund_name: z.string().min(1, 'Fund name is required'),
    super_fund_abn: z.string()
      .regex(/^\d{11}$/, 'ABN must be exactly 11 digits'),
    super_member_number: z.string().min(1, 'Member number is required'),
    super_fund_usi: z.string().optional(),
  }),
  z.object({
    super_choice: z.literal('nominated'),
    super_fund_name: z.string().min(1, 'Fund name is required'),
    super_member_number: z.string().min(1, 'Member number is required'),
    super_fund_usi: z.string().optional(),
  }),
])

export type SuperChoiceFormData = z.infer<typeof superChoiceSchema>
