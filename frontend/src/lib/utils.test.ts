import { cn } from "@/lib/utils";

describe("cn", () => {
  it("lets later Tailwind classes win over conflicting earlier ones", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("drops falsy values", () => {
    expect(cn("block", false, undefined, null, "font-medium")).toBe("block font-medium");
  });
});
