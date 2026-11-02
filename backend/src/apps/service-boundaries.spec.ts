import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SIDES = {
  employee: ["audit", "auth", "divisions", "employees", "service-link", "uploads", "users"],
  attendance: [
    "attendance",
    "attendance-verification",
    "corrections",
    "directory",
    "holidays",
    "notifications",
    "reports",
    "work-settings",
  ],
} as const;

const OTHER_DB = { employee: "attendance-db", attendance: "employee-db" } as const;

const sourcesOf = (module: string): string[] =>
  readdirSync(join("src/modules", module), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .map((file) => join("src/modules", module, file));

const modulesImportedBy = (source: string): string[] =>
  [...source.matchAll(/from "@\/modules\/([a-z-]+)\//g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );

describe("service boundaries", () => {
  it("lists every module on exactly one side", () => {
    expect([...SIDES.employee, ...SIDES.attendance].sort()).toEqual(
      readdirSync("src/modules").sort(),
    );
  });

  describe.each(["employee", "attendance"] as const)("the %s side", (side) => {
    const other = side === "employee" ? SIDES.attendance : SIDES.employee;

    it.each([...SIDES[side]])("%s imports no module of the other service", (module) => {
      const crossings = sourcesOf(module).flatMap((file) =>
        modulesImportedBy(readFileSync(file, "utf8"))
          .filter((imported) => (other as readonly string[]).includes(imported))
          .map((imported) => `${file} → ${imported}`),
      );
      expect(crossings).toEqual([]);
    });

    it.each([...SIDES[side]])("%s touches only its own service's database", (module) => {
      const crossings = sourcesOf(module).filter((file) => {
        const source = readFileSync(file, "utf8");
        return (
          source.includes(`@/infra/${OTHER_DB[side]}/`) ||
          source.includes(`@/generated/${OTHER_DB[side]}/`)
        );
      });
      expect(crossings).toEqual([]);
    });
  });
});
