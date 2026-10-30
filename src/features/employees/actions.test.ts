import {
  createEmployeeAction,
  inviteAccountAction,
  updateEmployeeAction,
} from "@/features/employees/actions";
import { newEmployeeFormSchema } from "@/features/employees/schemas";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import type { Permission } from "@/types/auth";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
  can: (user: { permissions: string[] }, permission: string) =>
    user.permissions.includes(permission),
}));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const EMPLOYEE = "01a11fa3-9fd3-76d3-9390-2bc41e4671d2";
const DIVISION = "01a11fa3-c92d-721c-83e0-70bf24e76653";
const ROLE = "01a11fa4-0a4e-7c1d-9a77-0d5b1d4c2e10";
const USER = "01a11fa4-1b5f-7d2e-8b88-1e6c2e5d3f21";

const form = {
  employeeNumber: "emp-011",
  fullName: "Dewi Lestari",
  workEmail: "dewi@example.test",
  jobTitle: "",
  divisionId: DIVISION,
  managerId: "",
  employmentStartDate: "2026-11-02",
  employmentEndDate: "",
  roleId: ROLE,
};
const employee = {
  id: EMPLOYEE,
  employeeNumber: "EMP-011",
  fullName: "Dewi Lestari",
  workEmail: "dewi@example.test",
  jobTitle: null,
  status: "active" as const,
  employmentStartDate: "2026-11-02",
  employmentEndDate: null,
  division: { id: DIVISION, code: "ENG", name: "Engineering" },
  manager: null,
  account: null,
  createdAt: "2026-10-30T00:00:00.000Z",
  updatedAt: "2026-10-30T00:00:00.000Z",
};

const signedInWith = (permissions: Permission[]) =>
  vi.mocked(requireUser).mockResolvedValue({
    id: "me",
    name: "HR",
    email: "hr@example.test",
    organizationId: "org",
    role: { id: "role", name: "admin_hr" },
    emailVerified: true,
    permissions,
  });
const HR: Permission[] = ["employee:manage", "user:read", "user:manage"];

/** apiFetch answers, by path, in call order. */
function backend(responses: Record<string, unknown[]>) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const key = Object.keys(responses).find((prefix) => path.startsWith(prefix));
    const next = key ? responses[key]?.shift() : undefined;
    if (next instanceof Error) throw next;
    return next;
  });
}
const bodyOf = (path: string) =>
  vi.mocked(apiFetch).mock.calls.find(([p]) => p.startsWith(path))?.[1]?.body;

afterEach(() => vi.resetAllMocks());

describe("newEmployeeFormSchema", () => {
  it("uppercases the number and turns blanks into nulls", () => {
    expect(newEmployeeFormSchema.parse(form)).toMatchObject({
      employeeNumber: "EMP-011",
      jobTitle: null,
      managerId: null,
      employmentEndDate: null,
    });
  });

  it("needs a work email to create an account", () => {
    const result = newEmployeeFormSchema.safeParse({ ...form, workEmail: "" });
    expect(result.success || result.error.issues[0]?.path).toEqual(["workEmail"]);
  });
});

describe("createEmployeeAction", () => {
  it("refuses without employee:manage, before calling the backend", async () => {
    signedInWith(["user:manage"]);
    await expect(createEmployeeAction(form)).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("creates without an account when no role is chosen", async () => {
    signedInWith(HR);
    backend({ "/employees": [employee] });
    await expect(createEmployeeAction({ ...form, roleId: "" })).resolves.toEqual({
      ok: true,
      data: { employee, account: { kind: "none" } },
    });
    expect(bodyOf("/employees")).not.toHaveProperty("roleId");
  });

  it("invites a new account when no user has the email", async () => {
    signedInWith(HR);
    const linked = {
      ...employee,
      account: {
        id: USER,
        email: form.workEmail,
        role: { id: ROLE, name: "employee" },
        status: "invited",
      },
    };
    backend({ "/employees/": [linked], "/employees": [employee], "/users": [{ items: [] }] });
    const result = await createEmployeeAction(form);
    expect(result).toMatchObject({ ok: true, data: { account: { kind: "invited" } } });
    expect(bodyOf(`/employees/${EMPLOYEE}/account`)).toEqual({
      mode: "invite",
      email: form.workEmail,
      roleId: ROLE,
    });
  });

  it("links the existing user with the same email", async () => {
    signedInWith(HR);
    backend({
      "/employees/": [employee],
      "/employees": [employee],
      "/users": [
        {
          items: [
            { id: "other", name: "Dewi K", email: "dewi.k@example.test", status: "active" },
            { id: USER, name: "Dewi", email: "DEWI@example.test", status: "active" },
          ],
        },
      ],
    });
    await expect(createEmployeeAction(form)).resolves.toMatchObject({
      ok: true,
      data: { account: { kind: "linked" } },
    });
    expect(bodyOf(`/employees/${EMPLOYEE}/account`)).toEqual({
      mode: "link",
      userId: USER,
      roleId: ROLE,
    });
  });

  it("keeps the employee when only the account step fails", async () => {
    signedInWith(HR);
    backend({
      "/employees/": [new ApiError(409, "USER_HAS_EMPLOYEE", "raw")],
      "/employees": [employee],
      "/users": [{ items: [{ id: USER, name: "Dewi", email: form.workEmail, status: "active" }] }],
    });
    await expect(createEmployeeAction(form)).resolves.toEqual({
      ok: true,
      data: {
        employee,
        account: { kind: "failed", error: "That account already belongs to another employee." },
      },
    });
  });

  it("puts a taken number on the number field", async () => {
    signedInWith(HR);
    backend({
      "/employees": [
        new ApiError(409, "EMPLOYEE_NUMBER_TAKEN", "raw", {
          fieldErrors: { employeeNumber: ["Already in use"] },
        }),
      ],
    });
    await expect(createEmployeeAction(form)).resolves.toEqual({
      ok: false,
      error: "Another employee already has this number.",
      fieldErrors: { employeeNumber: ["Already in use"] },
    });
  });
});

describe("updateEmployeeAction", () => {
  it("puts a reporting cycle on the manager field", async () => {
    signedInWith(HR);
    backend({
      "/employees/": [
        new ApiError(422, "REPORTING_LINE_CYCLE", "raw", {
          fieldErrors: { managerId: ["Would create a reporting cycle"] },
        }),
      ],
    });
    const { employeeNumber: _number, roleId: _role, ...details } = form;
    await expect(updateEmployeeAction(EMPLOYEE, { ...details, managerId: USER })).resolves.toEqual({
      ok: false,
      error: "That manager reports to this employee, directly or indirectly.",
      fieldErrors: { managerId: ["Would create a reporting cycle"] },
    });
  });
});

describe("inviteAccountAction", () => {
  it("needs user:manage as well as employee:manage", async () => {
    signedInWith(["employee:manage"]);
    await expect(
      inviteAccountAction(EMPLOYEE, { email: form.workEmail, roleId: ROLE }),
    ).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
