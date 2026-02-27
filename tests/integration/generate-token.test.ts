import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const canRun = SUPABASE_ANON_KEY.length > 0;

describe.skipIf(!canRun)("generate-token Edge Function (integration)", () => {
  let adminClient: ReturnType<typeof createClient>;
  let userToken: string;
  let testApiId: string;
  let testEndpointIds: string[];

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create test user
    const email = "token-test@example.com";
    const password = "test-password-123!";
    await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    const { data: signInData } = await adminClient.auth.signInWithPassword({ email, password });
    userToken = signInData?.session?.access_token ?? "";

    // Create test API + endpoints via parse-spec
    const specResponse = await fetch(`${SUPABASE_URL}/functions/v1/parse-spec`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        name: "Token Test API",
        base_url: "https://test.example.com",
        auth_method: "bearer_token",
        credential: "test-cred",
        spec_content: JSON.stringify({
          openapi: "3.0.3",
          info: { title: "Test", version: "1.0.0" },
          paths: {
            "/items": { get: { operationId: "listItems", summary: "List items" }, post: { operationId: "createItem", summary: "Create item" } },
            "/items/{id}": { get: { operationId: "getItem", parameters: [{ name: "id", in: "path", schema: { type: "string" }, required: true }] } }
          }
        })
      })
    });
    const specData = await specResponse.json();
    testApiId = specData.api_id;

    // Get endpoint IDs
    const { data: endpoints } = await adminClient.from("parsed_endpoints").select("id").eq("api_id", testApiId);
    testEndpointIds = (endpoints ?? []).map(e => e.id);
  });

  it("should create a token and return raw_token (show-once)", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        api_id: testApiId,
        name: "test-agent",
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.raw_token).toBeDefined();
    expect(data.raw_token).toMatch(/^sdp_/);
    expect(data.raw_token.length).toBe(40);
    expect(data.token_id).toBeDefined();
    expect(data.token_prefix).toBeDefined();
    expect(data.name).toBe("test-agent");
  });

  it("should store hash in DB, not raw token", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        api_id: testApiId,
        name: "hash-check-agent",
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
    });

    const data = await response.json();
    const { data: token } = await adminClient.from("access_tokens").select("*").eq("id", data.token_id).single();

    expect(token).toBeDefined();
    expect(token!.token_hash).toBeDefined();
    expect(token!.token_hash).not.toContain("sdp_");
    expect(token!.token_hash.length).toBe(64); // SHA-256 hex
  });

  it("should create endpoint permissions (all allowed by default)", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        api_id: testApiId,
        name: "perm-test-agent",
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
    });

    const data = await response.json();
    const { data: permissions } = await adminClient
      .from("token_endpoint_permissions")
      .select("*")
      .eq("token_id", data.token_id);

    expect(permissions).toBeDefined();
    expect(permissions!.length).toBe(testEndpointIds.length);
    expect(permissions!.every(p => p.is_allowed === true)).toBe(true);
  });

  it("should store parameter constraints when provided", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        api_id: testApiId,
        name: "constraint-agent",
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        parameter_constraints: [
          { endpoint_id: testEndpointIds[0], param_name: "org", allowed_patterns: ["my-org-*"] }
        ]
      })
    });

    const data = await response.json();
    const { data: permissions } = await adminClient
      .from("token_endpoint_permissions")
      .select("*, parameter_constraints(*)")
      .eq("token_id", data.token_id);

    const permWithConstraints = permissions?.find(p =>
      p.parameter_constraints && p.parameter_constraints.length > 0
    );
    expect(permWithConstraints).toBeDefined();
    expect(permWithConstraints!.parameter_constraints[0].param_name).toBe("org");
    expect(permWithConstraints!.parameter_constraints[0].allowed_patterns).toEqual(["my-org-*"]);
  });

  it("should reject request without auth", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_id: testApiId, name: "test" })
    });
    expect(response.status).toBe(401);
  });
});
