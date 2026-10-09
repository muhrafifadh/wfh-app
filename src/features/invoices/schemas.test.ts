import { createInvoiceSchema, type CreateInvoiceFormValues } from "@/features/invoices/schemas";

const valid: CreateInvoiceFormValues = {
  customer: " Acme Corp ",
  email: " Billing@Acme.TEST ",
  amount: "1234.5",
  dueDate: "2026-11-01",
  status: "draft",
  notes: "",
  emailCopy: false,
};

const errorsFor = (values: Partial<CreateInvoiceFormValues>) => {
  const result = createInvoiceSchema.safeParse({ ...valid, ...values });
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("createInvoiceSchema", () => {
  it("trims text, lowercases the email and converts the amount to cents", () => {
    const result = createInvoiceSchema.parse(valid);
    expect(result).toMatchObject({
      customer: "Acme Corp",
      email: "billing@acme.test",
      amount: 123_450,
    });
  });

  it.each(["", "   ", "abc", "0", "-5", "1000000.01"])("rejects the amount %j", (amount) => {
    expect(errorsFor({ amount })).toEqual(["amount"]);
  });

  it("accepts the largest allowed amount", () => {
    expect(errorsFor({ amount: "1000000" })).toEqual([]);
  });

  it("requires a customer, a valid email and a due date", () => {
    expect(errorsFor({ customer: "  ", email: "not-an-email", dueDate: "" })).toEqual([
      "customer",
      "email",
      "dueDate",
    ]);
  });

  it("limits notes to 500 characters", () => {
    expect(errorsFor({ notes: "a".repeat(500) })).toEqual([]);
    expect(errorsFor({ notes: "a".repeat(501) })).toEqual(["notes"]);
  });
});
