/**
 * Demo account seed data definitions.
 *
 * Constants are duplicated from src/lib/demo.ts because Edge Functions
 * run in Deno and cannot import Vite modules.
 */

// ── Demo user constants ──────────────────────────────────────────────
// These are intentionally public — the demo account is shared by design.
export const DEMO_USER_ID = "a4f228ac-f811-494c-a9bc-5c376255d61c"; // placeholder — updated after creation
export const DEMO_USER_EMAIL = "demo@simple-dimple-pat.local";
export const DEMO_USER_PASSWORD = "demo-account-public-password";

// ── Pre-generated demo token ─────────────────────────────────────────
// A fixed sdp_ token so the hash is deterministic across resets.
const DEMO_RAW_TOKEN = "sdp_DemoToken1234567890abcdefA00000";
const DEMO_TOKEN_PREFIX = "sdp_Demo";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSeedTokenData(): Promise<{
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  rawToken: string;
}> {
  return {
    name: "Demo Token",
    tokenHash: await sha256Hex(DEMO_RAW_TOKEN),
    tokenPrefix: DEMO_TOKEN_PREFIX,
    rawToken: DEMO_RAW_TOKEN,
  };
}

// ── Petstore OpenAPI spec (trimmed) ──────────────────────────────────
export const PETSTORE_SPEC_RAW = JSON.stringify({
  openapi: "3.0.3",
  info: {
    title: "Petstore - Swagger",
    version: "1.0.0",
    description: "A sample Petstore API for demonstrating Simple Dimple PAT",
  },
  servers: [{ url: "https://petstore3.swagger.io/api/v3" }],
  paths: {
    "/pet/{petId}": {
      get: {
        tags: ["pet"],
        summary: "Find pet by ID",
        operationId: "getPetById",
        parameters: [
          { name: "petId", in: "path", required: true, schema: { type: "integer" } },
        ],
      },
      delete: {
        tags: ["pet"],
        summary: "Deletes a pet",
        operationId: "deletePet",
        parameters: [
          { name: "petId", in: "path", required: true, schema: { type: "integer" } },
        ],
      },
    },
    "/pet/findByStatus": {
      get: {
        tags: ["pet"],
        summary: "Finds pets by status",
        operationId: "findPetsByStatus",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["available", "pending", "sold"] },
          },
        ],
      },
    },
    "/pet": {
      post: {
        tags: ["pet"],
        summary: "Add a new pet to the store",
        operationId: "addPet",
        parameters: [],
      },
      put: {
        tags: ["pet"],
        summary: "Update an existing pet",
        operationId: "updatePet",
        parameters: [],
      },
    },
    "/store/inventory": {
      get: {
        tags: ["store"],
        summary: "Returns pet inventories by status",
        operationId: "getInventory",
        parameters: [],
      },
    },
    "/store/order": {
      post: {
        tags: ["store"],
        summary: "Place an order for a pet",
        operationId: "placeOrder",
        parameters: [],
      },
    },
    "/user/{username}": {
      get: {
        tags: ["user"],
        summary: "Get user by user name",
        operationId: "getUserByName",
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" } },
        ],
      },
    },
    "/user/login": {
      get: {
        tags: ["user"],
        summary: "Logs user into the system",
        operationId: "loginUser",
        parameters: [
          { name: "username", in: "query", required: false, schema: { type: "string" } },
          { name: "password", in: "query", required: false, schema: { type: "string" } },
        ],
      },
    },
  },
});

// ── Seed endpoint rows ───────────────────────────────────────────────
interface SeedEndpoint {
  api_id: string;
  method: string;
  path_template: string;
  operation_id: string | null;
  summary: string | null;
  tag: string | null;
  parameters: unknown[];
  display_order: number;
}

export function getSeedEndpoints(apiId: string): SeedEndpoint[] {
  return [
    {
      api_id: apiId, method: "GET", path_template: "/pet/{petId}",
      operation_id: "getPetById", summary: "Find pet by ID", tag: "pet",
      parameters: [{ name: "petId", in: "path", type: "integer", required: true, enum: null }],
      display_order: 0,
    },
    {
      api_id: apiId, method: "DELETE", path_template: "/pet/{petId}",
      operation_id: "deletePet", summary: "Deletes a pet", tag: "pet",
      parameters: [{ name: "petId", in: "path", type: "integer", required: true, enum: null }],
      display_order: 1,
    },
    {
      api_id: apiId, method: "GET", path_template: "/pet/findByStatus",
      operation_id: "findPetsByStatus", summary: "Finds pets by status", tag: "pet",
      parameters: [{ name: "status", in: "query", type: "string", required: false, enum: ["available", "pending", "sold"] }],
      display_order: 2,
    },
    {
      api_id: apiId, method: "POST", path_template: "/pet",
      operation_id: "addPet", summary: "Add a new pet to the store", tag: "pet",
      parameters: [], display_order: 3,
    },
    {
      api_id: apiId, method: "PUT", path_template: "/pet",
      operation_id: "updatePet", summary: "Update an existing pet", tag: "pet",
      parameters: [], display_order: 4,
    },
    {
      api_id: apiId, method: "GET", path_template: "/store/inventory",
      operation_id: "getInventory", summary: "Returns pet inventories by status", tag: "store",
      parameters: [], display_order: 5,
    },
    {
      api_id: apiId, method: "POST", path_template: "/store/order",
      operation_id: "placeOrder", summary: "Place an order for a pet", tag: "store",
      parameters: [], display_order: 6,
    },
    {
      api_id: apiId, method: "GET", path_template: "/user/{username}",
      operation_id: "getUserByName", summary: "Get user by user name", tag: "user",
      parameters: [{ name: "username", in: "path", type: "string", required: true, enum: null }],
      display_order: 7,
    },
    {
      api_id: apiId, method: "GET", path_template: "/user/login",
      operation_id: "loginUser", summary: "Logs user into the system", tag: "user",
      parameters: [
        { name: "username", in: "query", type: "string", required: false, enum: null },
        { name: "password", in: "query", type: "string", required: false, enum: null },
      ],
      display_order: 8,
    },
  ];
}

// ── Seed token permissions + constraints ─────────────────────────────
interface SeedPermission {
  token_id: string;
  endpoint_id: string;
  is_allowed: boolean;
}

interface SeedConstraint {
  permission_id: string;
  param_name: string;
  allowed_patterns: string[];
}

export function getSeedPermissions(
  tokenId: string,
  endpointMap: { id: string; method: string; path_template: string }[],
): { permissions: SeedPermission[]; constraints: SeedConstraint[] } {
  const permissions: SeedPermission[] = endpointMap.map((ep) => ({
    token_id: tokenId,
    endpoint_id: ep.id,
    is_allowed: true,
  }));

  // The findByStatus permission gets a parameter constraint
  const findByStatusPermission = permissions.find(
    (p) => {
      const ep = endpointMap.find((e) => e.id === p.endpoint_id);
      return ep && ep.method === "GET" && ep.path_template === "/pet/findByStatus";
    },
  );

  const constraints: SeedConstraint[] = [];
  if (findByStatusPermission) {
    constraints.push({
      permission_id: "", // filled after insert
      param_name: "status",
      allowed_patterns: ["available", "pending"],
    });
  }

  return { permissions, constraints, };
}

// ── Seed activity log entries ────────────────────────────────────────
interface SeedLog {
  token_id: string;
  api_id: string;
  user_id: string;
  method: string;
  path: string;
  status_code: number | null;
  blocked: boolean;
  block_reason: string | null;
  created_at: string;
}

export function getSeedLogs(
  apiId: string,
  tokenId: string,
  userId: string,
): SeedLog[] {
  const now = Date.now();
  const hour = 3_600_000;

  return [
    {
      token_id: tokenId, api_id: apiId, user_id: userId,
      method: "GET", path: "/pet/findByStatus?status=available",
      status_code: 200, blocked: false, block_reason: null,
      created_at: new Date(now - 6 * hour).toISOString(),
    },
    {
      token_id: tokenId, api_id: apiId, user_id: userId,
      method: "GET", path: "/pet/123",
      status_code: 200, blocked: false, block_reason: null,
      created_at: new Date(now - 5 * hour).toISOString(),
    },
    {
      token_id: tokenId, api_id: apiId, user_id: userId,
      method: "POST", path: "/pet",
      status_code: 200, blocked: false, block_reason: null,
      created_at: new Date(now - 4 * hour).toISOString(),
    },
    {
      token_id: tokenId, api_id: apiId, user_id: userId,
      method: "GET", path: "/store/inventory",
      status_code: 200, blocked: false, block_reason: null,
      created_at: new Date(now - 3 * hour).toISOString(),
    },
    {
      token_id: tokenId, api_id: apiId, user_id: userId,
      method: "GET", path: "/pet/findByStatus?status=sold",
      status_code: null, blocked: true,
      block_reason: "Parameter 'status' value 'sold' not in allowed patterns",
      created_at: new Date(now - 2 * hour).toISOString(),
    },
    {
      token_id: tokenId, api_id: apiId, user_id: userId,
      method: "DELETE", path: "/user/john",
      status_code: null, blocked: true,
      block_reason: "Endpoint not permitted for this token",
      created_at: new Date(now - 1 * hour).toISOString(),
    },
    {
      token_id: tokenId, api_id: apiId, user_id: userId,
      method: "GET", path: "/user/john",
      status_code: 200, blocked: false, block_reason: null,
      created_at: new Date(now - 0.5 * hour).toISOString(),
    },
  ];
}
