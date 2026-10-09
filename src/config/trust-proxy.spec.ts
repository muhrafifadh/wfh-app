import { parseTrustProxy } from "@/config/trust-proxy.js";

describe("parseTrustProxy", () => {
  it.each([
    ["", false],
    ["false", false],
    ["2", 2],
    ["loopback", ["loopback"]],
    ["loopback, 10.0.0.0/8", ["loopback", "10.0.0.0/8"]],
  ])("parses %j", (raw, expected) => {
    expect(parseTrustProxy(raw)).toEqual(expected);
  });

  it("refuses to trust every hop", () => {
    expect(() => parseTrustProxy("true")).toThrow(/trusts any client/);
  });
});
