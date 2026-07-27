/**
 * Error type thrown anywhere in a handler to produce a clean JSON error
 * response. The global onError hook in src/index.ts turns it into
 * `{ error: message }` with the given status code.
 */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (what = "Resource") => new ApiError(404, `${what} not found`);
export const badRequest = (message: string) => new ApiError(400, message);
export const conflict = (message: string) => new ApiError(409, message);
export const unauthorized = (message = "Sign in required") => new ApiError(401, message);
export const forbidden = (message = "You don't have permission to do that") =>
  new ApiError(403, message);
