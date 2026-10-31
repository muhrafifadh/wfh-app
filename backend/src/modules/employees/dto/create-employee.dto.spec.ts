import { createEmployeeSchema } from "@/modules/employees/dto/create-employee.dto.js";
import { linkAccountSchema } from "@/modules/employees/dto/link-account.dto.js";

const valid = {
  employeeNumber: "emp-001",
  fullName: "Rina Wijaya",
  divisionId: "01a00000-0000-7000-8000-000000000005",
  employmentStartDate: "2026-01-05",
};

describe("createEmployeeSchema", () => {
  it("uppercases and trims the employee number", () => {
    expect(
      createEmployeeSchema.parse({ ...valid, employeeNumber: " emp-001 " }).employeeNumber,
    ).toBe("EMP-001");
  });

  it.each(["EM", "-EMP", "EMP_001", "EMP 001", "E".repeat(33)])("rejects %j", (employeeNumber) => {
    expect(createEmployeeSchema.safeParse({ ...valid, employeeNumber }).success).toBe(false);
  });

  it("accepts an end date on the start date, not before it", () => {
    expect(
      createEmployeeSchema.safeParse({ ...valid, employmentEndDate: "2026-01-05" }).success,
    ).toBe(true);
    expect(
      createEmployeeSchema.safeParse({ ...valid, employmentEndDate: "2026-01-04" }).success,
    ).toBe(false);
  });

  it("turns a blank job title into null", () => {
    expect(createEmployeeSchema.parse({ ...valid, jobTitle: "  " }).jobTitle).toBeNull();
  });
});

describe("linkAccountSchema", () => {
  const roleId = "01a00000-0000-7000-8000-000000000001";

  it("needs email and role to invite, and a user to link", () => {
    expect(
      linkAccountSchema.safeParse({ mode: "invite", email: "a@example.test", roleId }).success,
    ).toBe(true);
    expect(linkAccountSchema.safeParse({ mode: "invite", email: "a@example.test" }).success).toBe(
      false,
    );
    expect(linkAccountSchema.safeParse({ mode: "link", userId: roleId }).success).toBe(true);
    expect(linkAccountSchema.safeParse({ mode: "link", email: "a@example.test" }).success).toBe(
      false,
    );
  });
});
