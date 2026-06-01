import { createStart, createMiddleware } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Defence-in-depth headers. Job descriptions scraped from third-party boards
 * are rendered via DOMPurify-sanitised dangerouslySetInnerHTML on
 * /applications/$id — these headers backstop the sanitiser in case of a
 * future DOMPurify regression or novel mXSS vector.
 *
 * CSP keeps script-src to self + the Lovable preview shim. We intentionally
 * skip `frame-ancestors` so the Lovable preview iframe keeps working.
 */
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  setResponseHeaders(
    new Headers({
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.gpteng.co",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.gpteng.co",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    }),
  );
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
