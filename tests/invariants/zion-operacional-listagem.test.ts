import { beforeAll, describe, expect, it } from "vitest";

import {
  GOV_AGENT_A,
  GOV_AGENT_B,
  GOV_CONTACT_1,
  GOV_MANAGER,
  GOV_ORG,
  GOV_VIEWER,
  lastLine,
  seedGov,
  sql,
} from "./gov-helpers";

const PROPOSAL_A = "c1ed1700-0000-4000-8000-000000000001";
const PROPOSAL_B = "c1ed1700-0000-4000-8000-000000000002";
const OTHER_ORG = "c1ed1700-0000-4000-8000-000000000003";

function listAs(userId: string, orgId = GOV_ORG): string {
  return lastLine(
    sql(`
    set role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${userId}"}', false);
    select coalesce(jsonb_agg(to_jsonb(p) order by p.proposal_number), '[]'::jsonb)
      from public.fn_list_credit_proposals('${orgId}', 50, 0) p;
  `),
  );
}

beforeAll(() => {
  seedGov();
  sql(`
    insert into public.organizations (id, slug, legal_name, display_name)
      values ('${OTHER_ORG}', 'zion-list-other', 'Zion List Other', 'Zion List Other')
      on conflict do nothing;
    insert into public.credit_proposals
      (id, organization_id, contact_id, seller_user_id, product, notes)
      values
      ('${PROPOSAL_A}', '${GOV_ORG}', '${GOV_CONTACT_1}', '${GOV_AGENT_A}', 'Produto A', 'Segredo A'),
      ('${PROPOSAL_B}', '${GOV_ORG}', '${GOV_CONTACT_1}', '${GOV_AGENT_B}', 'Produto B', 'Segredo B')
      on conflict do nothing;
  `);
});

describe("Zion Operacional: listagem segura", () => {
  it("shows each seller only their proposal and never returns notes", () => {
    const rows = JSON.parse(listAs(GOV_AGENT_A)) as Array<Record<string, unknown>>;

    expect(rows.map((row) => row.id)).toEqual([PROPOSAL_A]);
    expect(rows[0]).toHaveProperty("proposal_number");
    expect(rows[0]).not.toHaveProperty("notes");
    expect(rows[0]).not.toHaveProperty("contract_ciphertext");
    expect(rows[0]).not.toHaveProperty("registration_ciphertext");
  });

  it("shows the organization queue to a manager but nothing to a viewer", () => {
    expect((JSON.parse(listAs(GOV_MANAGER)) as unknown[]).length).toBe(2);
    expect(JSON.parse(listAs(GOV_VIEWER))).toEqual([]);
  });

  it("denies cross-organization RPC calls even with an authenticated session", () => {
    expect(() => listAs(GOV_AGENT_A, OTHER_ORG)).toThrow();
  });

  it("rejects explicit NULL pagination before returning data", () => {
    expect(() =>
      sql(`
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${GOV_AGENT_A}"}', false);
      select * from public.fn_list_credit_proposals('${GOV_ORG}', null, 0);
    `),
    ).toThrow();
    expect(() =>
      sql(`
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${GOV_AGENT_A}"}', false);
      select * from public.fn_list_credit_proposals('${GOV_ORG}', 50, null);
    `),
    ).toThrow();
  });

  it("grants only the safe RPC, not direct table SELECT", () => {
    const grants = lastLine(
      sql(`
      select has_function_privilege('authenticated', 'public.fn_list_credit_proposals(uuid,integer,integer)', 'EXECUTE')::text
        || ':' || has_function_privilege('anon', 'public.fn_list_credit_proposals(uuid,integer,integer)', 'EXECUTE')::text
        || ':' || has_table_privilege('authenticated', 'public.credit_proposals', 'SELECT')::text;
    `),
    );
    expect(grants).toBe("true:false:false");
  });
});
