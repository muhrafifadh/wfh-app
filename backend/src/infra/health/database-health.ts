/** What the readiness check needs from whichever database this service owns. */
export abstract class DatabaseHealth {
  abstract ping(): Promise<void>;
}
