import { restoreNullableScalars } from "@/openapi.js";

describe("restoreNullableScalars", () => {
  it("turns a marked fake array back into a nullable scalar", () => {
    const schema = {
      properties: {
        jobTitle: {
          "x-nestjs_zod-empty-type": true,
          type: "array",
          items: { type: "string", enum: ["a"] },
        },
      },
    };
    expect(restoreNullableScalars(schema).properties.jobTitle).toEqual({
      "x-nestjs_zod-empty-type": true,
      anyOf: [{ type: "string", enum: ["a"] }, { type: "null" }],
    });
  });

  it("leaves real arrays alone", () => {
    const schema = { type: "array", items: { type: "string" } };
    expect(restoreNullableScalars(structuredClone(schema))).toEqual(schema);
  });
});
