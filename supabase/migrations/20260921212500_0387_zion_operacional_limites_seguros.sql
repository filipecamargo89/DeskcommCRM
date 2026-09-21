-- 0387: limites de seguranca do Zion Operacional.
-- Defesa em profundidade: estes limites valem mesmo fora da API.

alter table public.credit_proposals
  add constraint credit_proposals_product_length_chk
    check (char_length(product) between 1 and 120),
  add constraint credit_proposals_agreement_length_chk
    check (agreement_name is null or char_length(agreement_name) <= 160),
  add constraint credit_proposals_current_bank_length_chk
    check (current_bank is null or char_length(current_bank) <= 160),
  add constraint credit_proposals_destination_bank_length_chk
    check (destination_bank is null or char_length(destination_bank) <= 160),
  add constraint credit_proposals_notes_length_chk
    check (notes is null or char_length(notes) <= 4000),
  add constraint credit_proposals_term_limit_chk
    check (term_months is null or term_months <= 1200),
  add constraint credit_proposals_interest_rate_limit_chk
    check (interest_rate is null or interest_rate <= 1000);
