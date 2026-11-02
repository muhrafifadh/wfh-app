import { PrismaPg } from "@prisma/adapter-pg";

import { pgAdapter } from "@/infra/pg-adapter.js";

vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn<() => void>() }));

const URL_BASE = "postgresql://u:p@localhost:5432/app";

afterEach(() => vi.clearAllMocks());

describe("pgAdapter", () => {
  it.each([URL_BASE, `${URL_BASE}?schema=public`])("leaves %s on the default schema", (url) => {
    pgAdapter(url);
    expect(PrismaPg).toHaveBeenCalledWith({ connectionString: url });
  });

  it("uses another schema for both Prisma's queries and raw SQL", () => {
    const url = `${URL_BASE}?schema=employee`;
    pgAdapter(url);
    expect(PrismaPg).toHaveBeenCalledWith(
      { connectionString: url, options: "-c search_path=employee" },
      { schema: "employee" },
    );
  });
});
