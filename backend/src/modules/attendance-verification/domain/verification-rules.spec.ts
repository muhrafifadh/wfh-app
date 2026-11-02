import {
  distanceBandOf,
  distanceMeters,
  isFlagged,
  locationOutcome,
  locationSubmission,
  roundCoordinate,
} from "@/modules/attendance-verification/domain/verification-rules.js";

const area = { latitude: -6.2, longitude: 106.8, radiusMeters: 1000 };
const checkInAt = new Date("2026-11-02T02:00:00.000Z");
const after = (minutes: number) => new Date(checkInAt.getTime() + minutes * 60_000);

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(area, area)).toBe(0);
  });

  it("measures one degree of latitude as about 111 km", () => {
    const meters = distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(meters).toBeGreaterThan(111_000);
    expect(meters).toBeLessThan(111_400);
  });
});

describe("distanceBandOf", () => {
  it.each([
    [0, "within_1km"],
    [1000, "within_1km"],
    [1001, "within_10km"],
    [10_000, "within_10km"],
    [10_001, "over_10km"],
  ])("puts %i m in %s", (meters, band) => {
    expect(distanceBandOf(meters)).toBe(band);
  });
});

describe("locationOutcome", () => {
  it("verifies a reading inside the area", () => {
    expect(locationOutcome({ ...area, accuracyMeters: 20 }, area)).toEqual({
      result: "verified",
      distanceBand: "within_1km",
    });
  });

  it("is outside just past the edge and verified just inside it", () => {
    // About 0.009 degrees of latitude per 1000 m
    const inside = { latitude: -6.2 + 0.0089, longitude: 106.8, accuracyMeters: 20 };
    const outside = { latitude: -6.2 + 0.0091, longitude: 106.8, accuracyMeters: 20 };
    expect(locationOutcome(inside, area).result).toBe("verified");
    expect(locationOutcome(outside, area).result).toBe("outside_approved_area");
  });

  it("treats accuracy at the threshold as usable, and past it as low accuracy", () => {
    expect(locationOutcome({ ...area, accuracyMeters: 500 }, area).result).toBe("verified");
    expect(locationOutcome({ ...area, accuracyMeters: 501 }, area)).toEqual({
      result: "low_accuracy",
      distanceBand: null,
    });
  });

  it("never calls an inaccurate reading outside, however far it looks", () => {
    const far = { latitude: 10, longitude: 10, accuracyMeters: 5000 };
    expect(locationOutcome(far, area).result).toBe("low_accuracy");
  });
});

describe("isFlagged", () => {
  it("flags only being outside the approved area", () => {
    expect(isFlagged("outside_approved_area")).toBe(true);
    for (const result of [
      "verified",
      "low_accuracy",
      "not_shared",
      "no_approved_area",
      "captured",
    ]) {
      expect(isFlagged(result)).toBe(false);
    }
  });
});

describe("locationSubmission", () => {
  it("allows the first reading within the capture window only", () => {
    expect(locationSubmission("not_shared", checkInAt, after(5))).toBe("allowed");
    expect(locationSubmission("not_shared", checkInAt, after(6))).toBe("window_closed");
  });

  it("allows a retry after low accuracy later that day", () => {
    expect(locationSubmission("low_accuracy", checkInAt, after(240))).toBe("allowed");
  });

  it("refuses a retry after any other result", () => {
    expect(locationSubmission("verified", checkInAt, after(1))).toBe("already_recorded");
    expect(locationSubmission("outside_approved_area", checkInAt, after(1))).toBe(
      "already_recorded",
    );
  });
});

describe("roundCoordinate", () => {
  it("keeps the given decimals", () => {
    expect(roundCoordinate(-6.123456, 3)).toBe(-6.123);
    expect(roundCoordinate(106.8999, 3)).toBe(106.9);
  });
});
