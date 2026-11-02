import type { Contact } from "@/common/contracts/directory.js";
import type { Permission } from "@/common/types/auth.js";
import {
  correctionDecidedEmail,
  correctionReviewers,
  correctionSubmittedEmail,
  dedupeKeyOf,
  formatWorkDate,
} from "@/modules/notifications/domain/notification-rules.js";

const contact = (id: string, permissions: Permission[] = []): Contact => ({
  id,
  email: `${id}@example.test`,
  name: `Person ${id}`,
  permissions,
});

describe("notification rules (DOMAIN_RULES.md §18)", () => {
  describe("correction reviewers (§18.2)", () => {
    const hr = contact("hr", ["correction:decide_all"]);
    const hr2 = contact("hr2", ["correction:decide_all"]);

    it("notifies only the direct manager when they may decide team corrections", () => {
      const manager = contact("manager", ["correction:decide_team"]);
      expect(correctionReviewers({ requesterId: "emp", manager, deciders: [hr] })).toEqual([
        manager,
      ]);
    });

    it("accepts a manager who may decide any correction", () => {
      const manager = contact("manager", ["correction:decide_all"]);
      expect(correctionReviewers({ requesterId: "emp", manager, deciders: [hr] })).toEqual([
        manager,
      ]);
    });

    it("falls back to every decider when there is no manager", () => {
      expect(
        correctionReviewers({ requesterId: "emp", manager: null, deciders: [hr, hr2] }),
      ).toEqual([hr, hr2]);
    });

    it("falls back when the manager can't decide corrections", () => {
      const manager = contact("manager", ["attendance:read_team"]);
      expect(correctionReviewers({ requesterId: "emp", manager, deciders: [hr] })).toEqual([hr]);
    });

    it("never notifies the requester, whatever their role (Scenario I)", () => {
      expect(
        correctionReviewers({ requesterId: "hr", manager: null, deciders: [hr, hr2] }),
      ).toEqual([hr2]);
      expect(correctionReviewers({ requesterId: "hr", manager: hr, deciders: [hr, hr2] })).toEqual([
        hr2,
      ]);
    });

    it("can end up with nobody (the only decider asked for themselves)", () => {
      expect(correctionReviewers({ requesterId: "hr", manager: null, deciders: [hr] })).toEqual([]);
    });
  });

  it("builds one dedupe key per type, subject and recipient (§18.1)", () => {
    expect(dedupeKeyOf("correction_submitted", "c1", "u1")).toBe("correction_submitted:c1:u1");
  });

  it("formats a work date without shifting it across time zones", () => {
    expect(formatWorkDate("2026-10-30")).toBe("Friday, 30 October 2026");
  });

  describe("emails", () => {
    const link = "http://localhost:3001/corrections/c1";

    it("tells a reviewer who asked, for which day, and where to review it", () => {
      const email = correctionSubmittedEmail({
        recipientName: "Rina",
        employeeName: "Dewi Anggraini",
        workDate: "2026-10-29",
        link,
      });
      expect(email.subject).toBe(
        "Correction request from Dewi Anggraini for Thursday, 29 October 2026",
      );
      expect(email.text).toContain("Hi Rina,");
      expect(email.text).toContain("Dewi Anggraini asked to correct their attendance");
      expect(email.text).toContain(`Review the request: ${link}`);
    });

    it("tells the requester the outcome, the decider and the note", () => {
      const email = correctionDecidedEmail({
        recipientName: "Dewi",
        decision: "rejected",
        deciderName: "Rina Wijaya",
        workDate: "2026-10-29",
        note: "No evidence of work before 10:00.",
        link,
      });
      expect(email.subject).toBe("Your correction for Thursday, 29 October 2026 was rejected");
      expect(email.text).toContain("Rina Wijaya rejected your correction request");
      expect(email.text).toContain("stays as it was");
      expect(email.text).toContain("Note: No evidence of work before 10:00.");
      expect(email.text).toContain(`See the request: ${link}`);
    });

    it("leaves the note out when there is none", () => {
      const email = correctionDecidedEmail({
        recipientName: "Dewi",
        decision: "approved",
        deciderName: "Rina Wijaya",
        workDate: "2026-10-29",
        note: null,
        link,
      });
      expect(email.text).toContain("has been updated");
      expect(email.text).not.toContain("Note:");
    });
  });
});
