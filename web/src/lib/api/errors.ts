/** Thrown by both the mock layer and the real HTTP client. `fields` maps input paths to messages. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
    /** Machine code from the real API (e.g. OUT_OF_STOCK); absent for mock errors. */
    public code?: string,
  ) {
    super(message);
  }
}
