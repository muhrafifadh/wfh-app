import { render, screen } from "@testing-library/react";

import {
  STATUS_BADGES,
  StatusBadge,
  type StatusBadgeStatus,
} from "@/components/shared/status-badge";

const STATUSES = Object.keys(STATUS_BADGES) as StatusBadgeStatus[];

describe("StatusBadge", () => {
  it.each(STATUSES)("shows %s as a word with a hidden icon", (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(STATUS_BADGES[status].label);
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps Late and Absent off the brand and danger colors", () => {
    for (const status of ["late", "absent"] as const) {
      render(<StatusBadge status={status} />);
      // Unprefixed classes only: [a]:hover: and aria-invalid: never apply to a status span
      const classes = screen.getByText(STATUS_BADGES[status].label).className.split(" ");
      const always = classes.filter((name) => !name.includes(":"));
      expect(always.join(" ")).not.toMatch(/\b(bg|text)-(primary|destructive|brand)/);
    }
  });
});
