/**
 * Standardised error envelope for server functions and server routes.
 *
 * Server fns:  `throw appError("CODE", "Message", { hint? })`
 * Server routes: wrap handlers with `withErrorBoundary(...)`; returns JSON
 *   `{ error: { code, message, hint? } }` with an appropriate HTTP status.
 *
 * The client toast (toastError) automatically surfaces `hint` when present.
 */

export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "UPSTREAM";

export interface AppErrorShape {
  code: AppErrorCode;
  message: string;
  hint?: string;
}

const STATUS: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UPSTREAM: 502,
};

export class AppError extends Error {
  code: AppErrorCode;
  hint?: string;
  status: number;
  constructor(code: AppErrorCode, message: string, opts?: { hint?: string }) {
    // Serialise into message so the error survives the TanStack RPC boundary;
    // toAppError() / parseAppError() rehydrate on the client.
    super(JSON.stringify({ code, message, hint: opts?.hint }));
    this.name = "AppError";
    this.code = code;
    this.hint = opts?.hint;
    this.status = STATUS[code];
  }
}

export function appError(
  code: AppErrorCode,
  message: string,
  opts?: { hint?: string },
): AppError {
  return new AppError(code, message, opts);
}

/** Try to parse a server-fn error message back into its envelope. */
export function parseAppError(input: unknown): AppErrorShape | null {
  const msg =
    input instanceof Error ? input.message : typeof input === "string" ? input : null;
  if (!msg) return null;
  try {
    const parsed = JSON.parse(msg);
    if (parsed && typeof parsed === "object" && "code" in parsed && "message" in parsed) {
      return parsed as AppErrorShape;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Normalise anything into an AppErrorShape for display. */
export function toAppError(input: unknown): AppErrorShape {
  const parsed = parseAppError(input);
  if (parsed) return parsed;
  if (input instanceof Error) return { code: "INTERNAL", message: input.message };
  if (typeof input === "string") return { code: "INTERNAL", message: input };
  return { code: "INTERNAL", message: "Something went wrong" };
}

/** Build a JSON Response from an AppError-ish value. */
export function errorResponse(input: unknown, extraHeaders?: HeadersInit): Response {
  const shape = toAppError(input);
  const status =
    input instanceof AppError ? input.status : STATUS[shape.code] ?? 500;
  return new Response(JSON.stringify({ error: shape }), {
    status,
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
  });
}

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Promise<Response>;

/**
 * Wrap a server-route handler so any thrown error becomes a JSON envelope
 * with the correct HTTP status. CORS-aware via `extraHeaders`.
 */
export function withErrorBoundary(handler: Handler, extraHeaders?: HeadersInit): Handler {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (e) {
      // Log full stack for ClickHouse / dev console
      console.error(
        JSON.stringify({
          level: "error",
          route: new URL(ctx.request.url).pathname,
          error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
        }),
      );
      return errorResponse(e, extraHeaders);
    }
  };
}
