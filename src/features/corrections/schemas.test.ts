import {
  approveSchema,
  correctionFormSchema,
  proposalSchema,
} from "@/features/corrections/schemas";

// The Server Actions re-validate what the forms already parsed, so each schema must
// accept its own output.
describe("correction form schemas", () => {
  const form = {
    attendanceId: "01a18c63-0bc9-7548-a089-70b591453337",
    workDate: "2026-11-02",
    timezone: "Asia/Jakarta",
    checkIn: "",
    checkOut: "17:10",
    reason: "  Forgot to check out after the client call.  ",
  };

  it("accepts its own output", () => {
    const once = correctionFormSchema.parse(form);
    expect(correctionFormSchema.parse(once)).toEqual(once);
    expect(once.reason).toBe("Forgot to check out after the client call.");
  });

  it("refuses a check-out before the check-in", () => {
    expect(proposalSchema.safeParse({ ...form, checkIn: "18:00" }).success).toBe(false);
  });

  it("drops an empty approval note, and accepts its own output", () => {
    const once = approveSchema.parse({ decisionNote: "" });
    expect(once).toEqual({ decisionNote: undefined });
    expect(approveSchema.parse(once)).toEqual(once);
  });
});
