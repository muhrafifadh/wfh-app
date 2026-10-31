import { render } from "@testing-library/react";
import axe from "axe-core";

import { DivisionFormDialog } from "@/features/divisions/components/division-form-dialog";
import { EmployeeAccount } from "@/features/employees/components/employee-account";
import { EditEmployeeForm, NewEmployeeForm } from "@/features/employees/components/employee-form";
import type { Employee } from "@/features/employees/schemas";
import { HolidayFormDialog } from "@/features/holidays/components/holiday-form-dialog";
import { OrganizationSettingsForm } from "@/features/work-settings/components/organization-settings-form";
import { ScheduleForm } from "@/features/work-settings/components/schedule-form";
import type { WorkSettings } from "@/features/work-settings/schemas";

// UX_FLOWS.md §20 — automated checks on the admin forms (labels, names, ARIA). jsdom has
// no layout, so colour contrast is covered by src/app/theme.test.ts instead.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// Server Actions aren't called while rendering; stub the modules so no server code loads
vi.mock("@/features/divisions/actions", () => ({}));
vi.mock("@/features/employees/actions", () => ({}));
vi.mock("@/features/holidays/actions", () => ({}));
vi.mock("@/features/work-settings/actions", () => ({}));

// Radix checkboxes measure themselves; jsdom has no ResizeObserver
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

async function violations(container: Element = document.body) {
  const result = await axe.run(container, {
    runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

const ROLE = { id: "01a11fa4-0a4e-7c1d-9a77-0d5b1d4c2e10", name: "employee" };
const options = {
  divisions: [
    {
      id: "01a11fa3-c92d-721c-83e0-70bf24e76653",
      code: "ENG",
      name: "Engineering",
      status: "active" as const,
    },
  ],
  managers: [
    {
      id: "01a11fa4-1b5f-7d2e-8b88-1e6c2e5d3f21",
      employeeNumber: "EMP-001",
      fullName: "Rina Wijaya",
    },
  ],
};
const employee: Employee = {
  id: "01a11fa3-9fd3-76d3-9390-2bc41e4671d2",
  employeeNumber: "EMP-011",
  fullName: "Dewi Lestari",
  workEmail: "dewi@example.test",
  jobTitle: null,
  status: "active",
  employmentStartDate: "2026-01-05",
  employmentEndDate: null,
  division: { id: options.divisions[0]?.id ?? "", code: "ENG", name: "Engineering" },
  manager: null,
  account: null,
  createdAt: "2026-01-05T00:00:00.000Z",
  updatedAt: "2026-01-05T00:00:00.000Z",
};
const schedule = {
  id: "s1",
  name: "Default schedule",
  scope: "organization" as const,
  timezone: "Asia/Jakarta",
  workingDays: [1, 2, 3, 4, 5],
  startTime: "09:00:00",
  endTime: "17:00:00",
  toleranceMinutes: 15,
  onTimeDeadline: "09:15:00",
  checkInOpensAt: "08:00:00",
  checkInClosesAt: "17:00:00",
  checkOutDeadline: "23:59:59.999",
  effectiveFrom: "2026-01-05",
  effectiveTo: null,
  state: "current" as const,
  createdBy: { id: "u1", name: "Admin" },
  createdAt: "2026-01-05T00:00:00.000Z",
};
const settings: WorkSettings = {
  timezone: "Asia/Jakarta",
  supportContact: "hr@example.test",
  retentionYears: 5,
  workDate: "2026-11-02",
  earliestEffectiveFrom: "2026-11-03",
  currentSchedule: schedule,
};

describe("admin forms have no automatically detectable accessibility problems", () => {
  it("would catch an unlabelled input (the check itself works)", async () => {
    const { container } = render(<input type="text" />);
    expect(await violations(container)).toEqual([expect.stringMatching(/^label:/)]);
  });

  it("add employee", async () => {
    const { container } = render(
      <NewEmployeeForm options={options} roles={[ROLE]} today="2026-11-02" />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("edit employee and account", async () => {
    const { container } = render(
      <>
        <EditEmployeeForm employee={employee} options={options} />
        <EmployeeAccount
          employee={employee}
          roles={[ROLE]}
          users={[]}
          canManageAccounts
          currentUserId="me"
        />
      </>,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("division dialog", async () => {
    render(<DivisionFormDialog open onOpenChange={() => undefined} />);
    expect(await violations()).toEqual([]);
  });

  it("holiday dialog, with the past-date warning", async () => {
    render(
      <HolidayFormDialog
        open
        onOpenChange={() => undefined}
        today="2026-11-02"
        holiday={{ id: "h1", date: "2026-10-20", name: "Check Day" }}
      />,
    );
    expect(await violations()).toEqual([]);
  });

  it("attendance settings", async () => {
    const { container } = render(
      <>
        <OrganizationSettingsForm settings={settings} />
        <ScheduleForm settings={settings} upcoming={null} />
      </>,
    );
    expect(await violations(container)).toEqual([]);
  });
});
