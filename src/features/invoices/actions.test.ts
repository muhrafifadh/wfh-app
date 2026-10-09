import { createInvoiceAction } from "@/features/invoices/actions";
import { requireUser } from "@/lib/auth/session";

// The session reads cookies and calls the backend: mock it at that boundary.
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));

const valid = {
  customer: "Acme Corp",
  email: "billing@acme.test",
  amount: "250",
  dueDate: "2026-11-01",
  status: "sent",
  notes: "",
  emailCopy: true,
};

describe("createInvoiceAction", () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "u1",
      name: "Ada",
      email: "ada@example.test",
      organizationId: "org1",
      emailVerified: true,
      permissions: [],
    });
  });

  afterEach(() => vi.resetAllMocks());

  it("rejects callers without a session", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(createInvoiceAction(valid)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("returns field errors for invalid input", async () => {
    const result = await createInvoiceAction({ ...valid, amount: "-1", email: "nope" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(["email", "amount"]);
  });

  it("succeeds for valid input", async () => {
    await expect(createInvoiceAction(valid)).resolves.toEqual({
      ok: true,
      data: { customer: "Acme Corp" },
    });
  });
});
