/** A non-2xx response from the backend, carrying its standard error body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get fieldErrors(): Record<string, string[] | undefined> | undefined {
    const value = this.details?.fieldErrors;
    return value && typeof value === "object"
      ? (value as Record<string, string[] | undefined>)
      : undefined;
  }
}
