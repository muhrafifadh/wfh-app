import { ACCURACY_THRESHOLD_METERS } from "@/modules/attendance-verification/attendance-verification.constants.js";

export type Coordinates = { latitude: number; longitude: number };
export type Area = Coordinates & { radiusMeters: number };
export type LocationReading = Coordinates & { accuracyMeters: number };
export type DistanceBand = "within_1km" | "within_10km" | "over_10km";
export type LocationOutcome =
  | { result: "low_accuracy"; distanceBand: null }
  | { result: "verified" | "outside_approved_area"; distanceBand: DistanceBand };

const EARTH_RADIUS_METERS = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export const distanceBandOf = (meters: number): DistanceBand =>
  meters <= 1000 ? "within_1km" : meters <= 10_000 ? "within_10km" : "over_10km";

/**
 * Decision V11: an inaccurate reading says nothing about where someone is, so it is
 * never treated as being outside. Desktop browsers often locate by network.
 */
export function locationOutcome(reading: LocationReading, area: Area): LocationOutcome {
  if (reading.accuracyMeters > ACCURACY_THRESHOLD_METERS) {
    return { result: "low_accuracy", distanceBand: null };
  }
  const meters = distanceMeters(reading, area);
  return {
    result: meters <= area.radiusMeters ? "verified" : "outside_approved_area",
    distanceBand: distanceBandOf(meters),
  };
}

/** Decisions V4, V10, V11: only being outside the area asks for a person's review. */
export const isFlagged = (result: string): boolean => result === "outside_approved_area";

export const roundCoordinate = (value: number, decimals: number): number =>
  Number(value.toFixed(decimals));
