import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/types";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import { audit } from "@/lib/audit";
import { encryptOperationalValue, operationalBufferToBytea } from "@/lib/operational/crypto";
import type { CreateCreditProposalInput } from "@/lib/schemas";

type SB = SupabaseClient;

function encryptedParams(value: string | null | undefined) {
  if (!value) {
    return { ciphertext: null, iv: null, tag: null };
  }

  const encrypted = encryptOperationalValue(value);

  return {
    ciphertext: operationalBufferToBytea(encrypted.ciphertext),
    iv: operationalBufferToBytea(encrypted.iv),
    tag: operationalBufferToBytea(encrypted.tag),
  };
}

export async function createCreditProposalHandler(
  supabase: SB,
  ctx: HandlerCtx,
  input: CreateCreditProposalInput,
): Promise<Record<string, unknown>> {
  if (ctx.actor.type !== "user") {
    throw new ApiError(
      403,
      "forbidden",
      undefined,
      ctx.requestId,
      "Somente usuários autenticados podem enviar propostas para digitação.",
    );
  }

  const contract = encryptedParams(input.contract_number);
  const registration = encryptedParams(input.registration_number);

  const { data, error } = await supabase.rpc(
    "fn_create_credit_proposal" as never,
    {
      p_org: ctx.organization_id,
      p_contact: input.contact_id,
      p_conversation: input.conversation_id ?? null,
      p_lead: input.lead_id ?? null,
      p_product: input.product,
      p_agreement_name: input.agreement_name ?? null,
      p_current_bank: input.current_bank ?? null,
      p_destination_bank: input.destination_bank ?? null,
      p_contract_ciphertext: contract.ciphertext,
      p_contract_iv: contract.iv,
      p_contract_tag: contract.tag,
      p_registration_ciphertext: registration.ciphertext,
      p_registration_iv: registration.iv,
      p_registration_tag: registration.tag,
      p_outstanding_balance_cents: input.outstanding_balance_cents ?? null,
      p_installment_cents: input.installment_cents ?? null,
      p_expected_release_cents: input.expected_release_cents ?? null,
      p_term_months: input.term_months ?? null,
      p_interest_rate: input.interest_rate ?? null,
      p_notes: input.notes ?? null,
    } as never,
  );

  if (error) {
    if (error.code === "42501") {
      throw new ApiError(403, "forbidden", undefined, ctx.requestId, "Você não tem permissão para enviar esta proposta.");
    }

    if (error.code === "23503" || error.code === "23514" || error.code === "22023") {
      throw new ApiError(422, "validation_failed", undefined, ctx.requestId, "Os dados informados para a proposta são inválidos.");
    }

    console.error("[credit-proposal.create] RPC falhou:", {
      code: error.code,
      requestId: ctx.requestId,
    });

    throw new ApiError(500, "internal_error", undefined, ctx.requestId, "Falha ao enviar a proposta para digitação.");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiError(500, "internal_error", undefined, ctx.requestId, "A proposta foi processada, mas o retorno foi inválido.");
  }

  const proposal = data as Record<string, unknown>;
  const proposalId = typeof proposal.id === "string" ? proposal.id : null;

  if (!proposalId) {
    throw new ApiError(500, "internal_error", undefined, ctx.requestId, "A proposta foi processada sem identificador válido.");
  }

  await audit({
    action: "credit_proposal.created",
    actorUserId: ctx.actor.id,
    organizationId: ctx.organization_id,
    resourceType: "credit_proposal",
    resourceId: proposalId,
    requestId: ctx.requestId,
    metadata: {
      contact_id: input.contact_id,
      conversation_id: input.conversation_id ?? null,
      lead_id: input.lead_id ?? null,
      product: input.product,
      proposal_number: proposal.proposal_number ?? null,
    },
  });

  return proposal;
}
