import type { Contact } from "@/common/contracts/directory.js";

/** DOMAIN_RULES.md §18 — pure rules, so they can be unit-tested without a database. */

export const NOTIFICATION_TYPES = [
  "correction_submitted",
  "correction_approved",
  "correction_rejected",
  "reminder_check_in",
  "reminder_check_out",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type CorrectionNotificationType = Extract<NotificationType, `correction_${string}`>;

/** "{type}:{subjectId}:{recipientId}" (§18.1): one notification per recipient and subject. */
export const dedupeKeyOf = (
  type: CorrectionNotificationType,
  subjectId: string,
  recipientId: string,
) => `${type}:${subjectId}:${recipientId}`;

/**
 * Who hears about a new correction (§18.2): the direct manager if they may decide it,
 * otherwise everyone who may decide any correction. Never the requester (Scenario I).
 */
export function correctionReviewers(input: {
  requesterId: string;
  manager: Contact | null;
  deciders: Contact[];
}): Contact[] {
  const { requesterId, manager } = input;
  const managerMayDecide =
    manager !== null &&
    manager.id !== requesterId &&
    (manager.permissions.includes("correction:decide_team") ||
      manager.permissions.includes("correction:decide_all"));
  if (managerMayDecide) return [manager];
  return input.deciders.filter((contact) => contact.id !== requesterId);
}

const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "2026-10-30" → "Friday, 30 October 2026" (a work date has no time zone). */
export const formatWorkDate = (isoDate: string) =>
  longDate.format(new Date(`${isoDate}T00:00:00Z`));

/** "2026-10-30" → "Fri 30 Oct", for the one-line in-app title. */
export const formatShortWorkDate = (isoDate: string) =>
  shortDate.format(new Date(`${isoDate}T00:00:00Z`)).replace(",", "");

/** The email, and the one line the in-app list shows (§18.6). */
export type EmailContent = { subject: string; text: string; title: string };

/** §18.2 — to a reviewer: who asked, for which day, and where to review it. */
export function correctionSubmittedEmail(input: {
  recipientName: string;
  employeeName: string;
  workDate: string;
  link: string;
}): EmailContent {
  const day = formatWorkDate(input.workDate);
  return {
    title: `${input.employeeName} asked to correct ${formatShortWorkDate(input.workDate)}`,
    subject: `Correction request from ${input.employeeName} for ${day}`,
    text: [
      `Hi ${input.recipientName},`,
      "",
      `${input.employeeName} asked to correct their attendance for ${day}.`,
      `Review the request: ${input.link}`,
      "",
      `You're receiving this because you review ${input.employeeName}'s attendance corrections.`,
    ].join("\n"),
  };
}

/** §18.3 — to the requester: the decision, who made it, and the note if any. */
export function correctionDecidedEmail(input: {
  recipientName: string;
  decision: "approved" | "rejected";
  deciderName: string;
  workDate: string;
  note: string | null;
  link: string;
}): EmailContent {
  const day = formatWorkDate(input.workDate);
  const result =
    input.decision === "approved"
      ? "Your attendance for that day has been updated."
      : "Your attendance for that day stays as it was.";
  return {
    title: `Your correction for ${formatShortWorkDate(input.workDate)} was ${input.decision}`,
    subject: `Your correction for ${day} was ${input.decision}`,
    text: [
      `Hi ${input.recipientName},`,
      "",
      `${input.deciderName} ${input.decision} your correction request for ${day}. ${result}`,
      ...(input.note ? [`Note: ${input.note}`] : []),
      `See the request: ${input.link}`,
    ].join("\n"),
  };
}
