import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { listCreditProposalsHandler } from "./_handler";
import { GET } from "./route";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./_handler", () => ({
  createCreditProposalHandler: vi.fn(),
  listCreditProposalsHandler: vi.fn(),
}));

const sessionClient = { session: true } as never;
const orgId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";

function request(query = "") {
  return new NextRequest(`http://localhost/api/v1/credit-proposals${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: userId, idioma: "pt-BR" } as never,
    org: { orgId, role: "viewer" } as never,
  });
  vi.mocked(createClient).mockResolvedValue(sessionClient);
  vi.mocked(listCreditProposalsHandler).mockResolvedValue([{ id: "proposal-1" }]);
});

describe("GET /api/v1/credit-proposals", () => {
  it("uses the CRM session and active organization with pagination defaults", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "proposal-1" }] });
    expect(requireRole).toHaveBeenCalledWith(
      "viewer",
      expect.objectContaining({
        resource: "credit_proposals",
      }),
    );
    expect(listCreditProposalsHandler).toHaveBeenCalledWith(
      sessionClient,
      expect.objectContaining({
        organization_id: orgId,
        actor: { type: "user", id: userId },
      }),
      { limit: 50, offset: 0 },
    );
  });

  it("passes validated pagination without trusting a query organization", async () => {
    const response = await GET(request("?limit=25&offset=10"));

    expect(response.status).toBe(200);
    expect(vi.mocked(listCreditProposalsHandler).mock.calls[0]?.[2]).toEqual({
      limit: 25,
      offset: 10,
    });
  });

  it.each([
    "?limit=0",
    "?limit=101",
    "?limit=1.5",
    "?offset=-1",
    "?offset=2147483648",
    "?organization_id=33333333-3333-4333-8333-333333333333",
  ])("rejects invalid query %s before database access", async (query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(422);
    expect(createClient).not.toHaveBeenCalled();
    expect(listCreditProposalsHandler).not.toHaveBeenCalled();
  });

  it("passes through session authorization failures", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: fail("unauthenticated", "Auth required.", 401),
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });
});
