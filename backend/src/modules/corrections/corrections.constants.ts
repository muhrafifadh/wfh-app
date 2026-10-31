export const CORRECTION_STATUSES = ["pending", "approved", "rejected"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

/** Which timestamps a request changes. */
export const CORRECTION_CHANGES = ["check_in", "check_out"] as const;
export type CorrectionChange = (typeof CORRECTION_CHANGES)[number];
