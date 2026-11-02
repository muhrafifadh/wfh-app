import {
  distanceBandOf,
  distanceMeters,
  isFlagged,
  locationOutcome,
  roundCoordinate,
} from "@/modules/attendance-verification/domain/verification-rules.js";

const area = { latitude: -6.2, longitude: 106.8, radiusMeters: 1000 };

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
    expect(locationOutcome({ ...area, accuracyMeters: 20 }, area, [])).toEqual({
      result: "verified",
      distanceBand: "within_1km",
    });
  });

  it("is outside just past the edge and verified just inside it", () => {
    // About 0.009 degrees of latitude per 1000 m
    const inside = { latitude: -6.2 + 0.0089, longitude: 106.8, accuracyMeters: 20 };
    const outside = { latitude: -6.2 + 0.0091, longitude: 106.8, accuracyMeters: 20 };
    expect(locationOutcome(inside, area, []).result).toBe("verified");
    expect(locationOutcome(outside, area, []).result).toBe("outside_approved_area");
  });

  it("treats accuracy at the threshold as usable, and past it as low accuracy", () => {
    expect(locationOutcome({ ...area, accuracyMeters: 500 }, area, []).result).toBe("verified");
    expect(locationOutcome({ ...area, accuracyMeters: 501 }, area, [])).toEqual({
      result: "low_accuracy",
      distanceBand: null,
    });
  });

  it("never calls an inaccurate reading outside, however far it looks", () => {
    const far = { latitude: 10, longitude: 10, accuracyMeters: 5000 };
    expect(locationOutcome(far, area, []).result).toBe("low_accuracy");
  });

  describe("with offices (decision V13)", () => {
    // About 5.5 km north of the home area
    const office = { latitude: -6.15, longitude: 106.8, radiusMeters: 200 };
    const reading = (latitude: number) => ({ latitude, longitude: 106.8, accuracyMeters: 20 });

    it("says at office inside one, with or without a home area", () => {
      const expected = { result: "at_office", distanceBand: "within_1km" };
      expect(locationOutcome(reading(-6.15), area, [office])).toEqual(expected);
      expect(locationOutcome(reading(-6.15), null, [office])).toEqual(expected);
    });

    it("checks every office", () => {
      const other = { latitude: 0, longitude: 0, radiusMeters: 200 };
      expect(locationOutcome(reading(-6.15), null, [other, office]).result).toBe("at_office");
    });

    it("gives the nearer centre when inside both", () => {
      // An office 500 m from the centre of a 1 km home area
      const nearby = { latitude: -6.1955, longitude: 106.8, radiusMeters: 200 };
      expect(locationOutcome(reading(-6.1955), area, [nearby]).result).toBe("at_office");
      const wide = { ...nearby, radiusMeters: 1000 };
      expect(locationOutcome(reading(-6.2), area, [wide]).result).toBe("verified");
    });

    it("prefers home on a tie", () => {
      expect(locationOutcome(reading(-6.2), area, [area]).result).toBe("verified");
    });

    it("flags a reading outside both, measuring to the nearest", () => {
      // About 1 km from the office, 4.5 km from the edge of the home area
      expect(locationOutcome(reading(-6.141), area, [office])).toEqual({
        result: "outside_approved_area",
        distanceBand: "within_10km",
      });
      // About 330 m from the office, past its 200 m radius
      expect(locationOutcome(reading(-6.147), area, [office])).toEqual({
        result: "outside_approved_area",
        distanceBand: "within_1km",
      });
    });

    it("doesn't flag someone with no home area who isn't at an office", () => {
      expect(locationOutcome(reading(-6.1), null, [office])).toEqual({
        result: "no_approved_area",
        distanceBand: null,
      });
    });

    it("never places an inaccurate reading at an office", () => {
      const fuzzy = { ...reading(-6.15), accuracyMeters: 501 };
      expect(locationOutcome(fuzzy, area, [office]).result).toBe("low_accuracy");
    });
  });

  it("has nothing to compare with when there's no home area or office", () => {
    expect(locationOutcome({ ...area, accuracyMeters: 20 }, null, [])).toEqual({
      result: "no_approved_area",
      distanceBand: null,
    });
    expect(locationOutcome({ ...area, accuracyMeters: 5000 }, null, []).result).toBe(
      "no_approved_area",
    );
  });
});

describe("isFlagged", () => {
  it("flags only being outside the approved area", () => {
    expect(isFlagged("outside_approved_area")).toBe(true);
    for (const result of [
      "verified",
      "at_office",
      "low_accuracy",
      "not_shared",
      "no_approved_area",
      "captured",
    ]) {
      expect(isFlagged(result)).toBe(false);
    }
  });
});

describe("roundCoordinate", () => {
  it("keeps the given decimals", () => {
    expect(roundCoordinate(-6.123456, 3)).toBe(-6.123);
    expect(roundCoordinate(106.8999, 3)).toBe(106.9);
  });
});
