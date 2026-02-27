import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Context } from "https://edge.netlify.com";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FETCH_TIMEOUT_MS = 30_000;

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNoPqRsTuVwXyZabcdefghijklmnopqrstuvwxyz";

/**
 * Validate that a URL is safe to proxy to (not an internal/private address).
 * Blocks RFC 1918, loopback, link-local, and non-HTTP(S) schemes.
 */
function isUrlSafeForProxy(urlStr: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }

  // Only allow http/https schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Scheme '${parsed.protocol}' not allowed` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  ) {
    return { safe: false, reason: "Loopback addresses not allowed" };
  }

  // Block known metadata endpoints
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return { safe: false, reason: "Cloud metadata endpoints not allowed" };
  }

  // Block private/reserved IP ranges
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 10) return { safe: false, reason: "Private IP range (10.x.x.x) not allowed" };
    if (a === 172 && b >= 16 && b <= 31) return { safe: false, reason: "Private IP range (172.16-31.x.x) not allowed" };
    if (a === 192 && b === 168) return { safe: false, reason: "Private IP range (192.168.x.x) not allowed" };
    if (a === 169 && b === 254) return { safe: false, reason: "Link-local range (169.254.x.x) not allowed" };
    if (a === 127) return { safe: false, reason: "Loopback range (127.x.x.x) not allowed" };
    if (a === 0) return { safe: false, reason: "Reserved range (0.x.x.x) not allowed" };
  }

  return { safe: true };
}

function proxyError(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error, message, ...extra }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "X-SDP-Error": "true",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Match a URL path against an OpenAPI path template.
 * e.g., "/repos/my-org/my-repo" matches "/repos/{owner}/{repo}"
 * Returns extracted parameters or null if no match.
 */
function matchPathTemplate(
  template: string,
  actualPath: string,
): Record<string, string> | null {
  const templateParts = template.split("/");
  const actualParts = actualPath.split("/");

  if (templateParts.length !== actualParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < templateParts.length; i++) {
    const tpl = templateParts[i];
    const act = actualParts[i];

    if (tpl.startsWith("{") && tpl.endsWith("}")) {
      const paramName = tpl.slice(1, -1);
      params[paramName] = act;
    } else if (tpl !== act) {
      return null;
    }
  }

  return params;
}

/**
 * Match a glob pattern against a value.
 * Supports * (any chars) and ? (single char).
 */
function matchGlob(pattern: string, value: string): boolean {
  let regex = "^";
  for (const ch of pattern) {
    if (ch === "*") regex += ".*";
    else if (ch === "?") regex += ".";
    else regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  regex += "$";
  return new RegExp(regex).test(value);
}

export default async function handler(req: Request, context: Context) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      },
    });
  }

  const url = new URL(req.url);
  const pathSegments = url.pathname.replace(/^\/proxy\//, "").split("/");

  // Extract api_id (first segment) and upstream_path (rest)
  const apiId = pathSegments[0];
  const upstreamPath = pathSegments.slice(1).join("/");

  if (!apiId) {
    return proxyError(404, "api_not_found", "No API ID provided in URL");
  }

  // Extract Bearer token
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!bearerToken) {
    return proxyError(401, "unauthorized", "Missing or invalid Bearer token");
  }

  // Validate token format (basic check — starts with sdp_)
  if (!bearerToken.startsWith("sdp_")) {
    return proxyError(401, "unauthorized", "Missing or invalid Bearer token");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Compute token hash
  const tokenHash = await hashToken(bearerToken);

  // Look up token + API + permissions in a single query chain
  const { data: tokenData, error: tokenError } = await supabase
    .from("access_tokens")
    .select(
      `
      id, name, status, expires_at, api_id, user_id,
      api_registration:api_registrations!inner(
        id, name, base_url, auth_method, auth_header_name, auth_query_param, credential_vault_id
      ),
      token_endpoint_permissions(
        id, endpoint_id, is_allowed,
        parameter_constraints(param_name, allowed_patterns),
        parsed_endpoint:parsed_endpoints(method, path_template, parameters)
      )
    `,
    )
    .eq("token_hash", tokenHash)
    .single();

  if (tokenError || !tokenData) {
    // Log rejected request
    context.waitUntil(
      logRequest(supabase, {
        token_id: null,
        api_id: apiId,
        user_id: null,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: "Token not recognized",
      }),
    );
    return proxyError(401, "unauthorized", "Token not recognized");
  }

  const token = tokenData as TokenData;

  // Verify token belongs to the requested API
  const api = Array.isArray(token.api_registration)
    ? token.api_registration[0]
    : token.api_registration;

  if (!api || api.id !== apiId) {
    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: "Token does not belong to this API",
      }),
    );
    return proxyError(404, "api_not_found", `No API registered with id ${apiId}`);
  }

  // Check token status
  if (token.status === "disabled") {
    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: "Token is disabled",
      }),
    );
    return proxyError(401, "token_disabled", "Token is disabled", {
      token_name: token.name,
    });
  }

  // Check expiration
  if (new Date(token.expires_at) < new Date()) {
    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: `Token expired on ${token.expires_at}`,
      }),
    );
    return proxyError(401, "token_expired", `Token expired on ${token.expires_at}`, {
      token_name: token.name,
    });
  }

  // Find matching endpoint permission
  const permissions = token.token_endpoint_permissions ?? [];

  let matchedPermission: TokenPermission | null = null;
  let extractedParams: Record<string, string> = {};

  for (const perm of permissions) {
    const ep = perm.parsed_endpoint;
    if (!ep) continue;

    if (ep.method !== req.method) continue;

    const params = matchPathTemplate(ep.path_template, "/" + upstreamPath);
    if (params !== null) {
      matchedPermission = perm;
      extractedParams = params;
      break;
    }
  }

  // Check if endpoint is in the spec at all
  if (!matchedPermission) {
    // Check if any endpoint matches the path (regardless of permission)
    const anyMatch = permissions.some((p) => {
      if (!p.parsed_endpoint) return false;
      if (p.parsed_endpoint.method !== req.method) return false;
      return matchPathTemplate(p.parsed_endpoint.path_template, "/" + upstreamPath) !== null;
    });

    const errorType = anyMatch ? "endpoint_denied" : "endpoint_unknown";
    const message = anyMatch
      ? `Endpoint ${req.method} /${upstreamPath} is not permitted for this token`
      : `Endpoint ${req.method} /${upstreamPath} is not defined in the API spec`;
    const status = anyMatch ? 403 : 404;

    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: message,
      }),
    );
    return proxyError(status, errorType, message, { token_name: token.name });
  }

  // Check if endpoint is allowed
  if (!matchedPermission.is_allowed) {
    const message = `Endpoint ${req.method} /${upstreamPath} is not permitted for this token`;
    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: message,
      }),
    );
    return proxyError(403, "endpoint_denied", message, { token_name: token.name });
  }

  // Check parameter constraints
  const constraints = matchedPermission.parameter_constraints ?? [];
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const allParams = { ...extractedParams, ...queryParams };

  for (const constraint of constraints) {
    const paramValue = allParams[constraint.param_name];
    if (paramValue === undefined) continue;

    const patterns = constraint.allowed_patterns;
    if (!patterns || patterns.length === 0) continue;

    const isAllowed = patterns.some((pattern: string) => matchGlob(pattern, paramValue));
    if (!isAllowed) {
      const message = `Parameter '${constraint.param_name}' value '${paramValue}' does not match allowed patterns`;
      context.waitUntil(
        logRequest(supabase, {
          token_id: token.id,
          api_id: apiId,
          user_id: token.user_id,
          method: req.method,
          path: "/" + upstreamPath,
          status_code: null,
          blocked: true,
          block_reason: message,
        }),
      );
      return proxyError(403, "param_denied", message, {
        token_name: token.name,
        allowed_patterns: patterns,
      });
    }
  }

  // Retrieve credential from Vault
  const { data: credential, error: vaultError } = await supabase.rpc(
    "get_api_credential",
    { p_vault_id: api.credential_vault_id, p_user_id: token.user_id },
  );

  if (vaultError || !credential) {
    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: "Failed to retrieve API credential from Vault",
      }),
    );
    return proxyError(502, "upstream_error", "Failed to retrieve API credential");
  }

  // Validate base_url is not a private/internal address (SSRF protection)
  const urlCheck = isUrlSafeForProxy(api.base_url);
  if (!urlCheck.safe) {
    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: `SSRF blocked: ${urlCheck.reason}`,
      }),
    );
    return proxyError(400, "invalid_base_url", "The API base URL is not allowed");
  }

  // Build upstream URL
  let upstreamUrl = `${api.base_url}/${upstreamPath}`;
  const upstreamSearchParams = new URLSearchParams(url.searchParams);

  // Inject credential based on auth method
  if (api.auth_method === "api_key_query") {
    const paramName = api.auth_query_param ?? "api_key";
    upstreamSearchParams.set(paramName, credential);
  }

  const queryString = upstreamSearchParams.toString();
  if (queryString) {
    upstreamUrl += `?${queryString}`;
  }

  // Build forwarded headers
  const forwardHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "host" || lowerKey === "authorization") continue;
    forwardHeaders.set(key, value);
  }

  // Inject credential into headers
  if (api.auth_method === "bearer_token") {
    forwardHeaders.set("Authorization", `Bearer ${credential}`);
  } else if (api.auth_method === "api_key_header") {
    const headerName = api.auth_header_name ?? "X-API-Key";
    forwardHeaders.set(headerName, credential);
  }

  // Forward request to upstream with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const message =
      (e as Error).name === "AbortError"
        ? "Upstream API did not respond within timeout"
        : `Upstream API error: ${(e as Error).message}`;

    context.waitUntil(
      logRequest(supabase, {
        token_id: token.id,
        api_id: apiId,
        user_id: token.user_id,
        method: req.method,
        path: "/" + upstreamPath,
        status_code: null,
        blocked: true,
        block_reason: message,
      }),
    );
    return proxyError(502, "upstream_error", message);
  }

  clearTimeout(timeoutId);

  // Build response with upstream headers + X-SDP-Token
  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.set("X-SDP-Token", token.name);
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  // Log the successful request asynchronously
  context.waitUntil(
    logRequest(supabase, {
      token_id: token.id,
      api_id: apiId,
      user_id: token.user_id,
      method: req.method,
      path: "/" + upstreamPath,
      status_code: upstreamResponse.status,
      blocked: false,
      block_reason: null,
    }),
  );

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

// --- Logging ---

interface LogEntry {
  token_id: string | null;
  api_id: string | null;
  user_id: string | null;
  method: string;
  path: string;
  status_code: number | null;
  blocked: boolean;
  block_reason: string | null;
}

async function logRequest(
  supabase: ReturnType<typeof createClient>,
  entry: LogEntry,
): Promise<void> {
  try {
    await supabase.from("request_logs").insert(entry);
  } catch {
    // Non-critical — don't fail the request if logging fails
  }
}

// --- TypeScript types for query results ---

interface TokenData {
  id: string;
  name: string;
  status: string;
  expires_at: string;
  api_id: string;
  user_id: string;
  api_registration:
    | ApiData
    | ApiData[];
  token_endpoint_permissions: TokenPermission[];
}

interface ApiData {
  id: string;
  name: string;
  base_url: string;
  auth_method: string;
  auth_header_name: string | null;
  auth_query_param: string | null;
  credential_vault_id: string;
}

interface TokenPermission {
  id: string;
  endpoint_id: string;
  is_allowed: boolean;
  parameter_constraints: Array<{
    param_name: string;
    allowed_patterns: string[];
  }>;
  parsed_endpoint: {
    method: string;
    path_template: string;
    parameters: unknown[];
  } | null;
}

export const config = { path: "/proxy/*" };
