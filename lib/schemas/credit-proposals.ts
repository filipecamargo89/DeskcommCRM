import { z } from "zod";

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

const optionalMoneyCents = z.coerce
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable()
  .optional();

/**
 * POST /api/v1/credit-proposals
 *
 * organization_id, seller_user_id, submitted_by_user_id, status,
 * assigned_operator_user_id e timestamps sao controlados pelo servidor.
 *
 * contract_number e registration_number chegam em texto somente no boundary
 * da API e sao criptografados antes de qualquer persistencia.
 */
export const createCreditProposalSchema = z
  .object({
    contact_id: z.string().uuid(),
    conversation_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),

    product: z.string().trim().min(1).max(120),
    agreement_name: optionalText(160),
    current_bank: optionalText(160),
    destination_bank: optionalText(160),

    contract_number: optionalText(200),
    registration_number: optionalText(200),

    outstanding_balance_cents: optionalMoneyCents,
    installment_cents: optionalMoneyCents,
    expected_release_cents: optionalMoneyCents,

    term_months: z.coerce.number().int().positive().max(1200).nullable().optional(),
    interest_rate: z.coerce.number().nonnegative().max(999.999999).nullable().optional(),

    notes: optionalText(4000),
  })
  .strict();

export type CreateCreditProposalInput = z.infer<typeof createCreditProposalSchema>;

export const creditProposalListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

export type CreditProposalListQuery = z.infer<typeof creditProposalListQuerySchema>;
