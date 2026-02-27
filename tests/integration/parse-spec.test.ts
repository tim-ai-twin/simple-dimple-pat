import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Integration tests for the parse-spec Edge Function.
 *
 * These tests require a running Supabase local instance (`supabase start`)
 * and functions served (`supabase functions serve`).
 *
 * Run with: npm run test:integration
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const TEST_SPEC_JSON = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Integration Test API", version: "1.0.0" },
  paths: {
    "/items": {
      get: {
        operationId: "listItems",
        summary: "List all items",
        tags: ["items"],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer" },
            required: false,
          },
        ],
      },
      post: {
        operationId: "createItem",
        summary: "Create an item",
        tags: ["items"],
      },
    },
    "/items/{itemId}": {
      get: {
        operationId: "getItem",
        summary: "Get item by ID",
        tags: ["items"],
        parameters: [
          {
            name: "itemId",
            in: "path",
            schema: { type: "string" },
            required: true,
          },
        ],
      },
    },
  },
});

// Skip if no Supabase keys configured (CI without local Supabase)
const canRun = SUPABASE_ANON_KEY.length > 0;

describe.skipIf(!canRun)("parse-spec Edge Function (integration)", () => {
  let adminClient: ReturnType<typeof createClient>;
  let userToken: string;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create a test user or sign in with an existing one
    const email = "integration-test@example.com";
    const password = "test-password-123!";

    // Try sign up first, fall back to sign in
    const { data: signUpData } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpData?.user) {
      const { data: signInData } = await adminClient.auth.signInWithPassword({
        email,
        password,
      });
      userToken = signInData?.session?.access_token ?? "";
    } else {
      const { data: signInData } = await adminClient.auth.signInWithPassword({
        email,
        password,
      });
      userToken = signInData?.session?.access_token ?? "";
    }
  });

  it("should parse a valid spec and create api_registration + parsed_endpoints", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/parse-spec`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name: "Integration Test API",
          base_url: "https://test.example.com",
          auth_method: "bearer_token",
          credential: "test-credential-value",
          spec_content: TEST_SPEC_JSON,
        }),
      },
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.api_id).toBeDefined();
    expect(data.endpoint_count).toBe(3);
    expect(data.spec_version).toBe("3.0.3");
    expect(data.tags).toEqual(["items"]);

    // Verify api_registration row was created
    const { data: api, error: apiError } = await adminClient
      .from("api_registrations")
      .select("*")
      .eq("id", data.api_id)
      .single();

    expect(apiError).toBeNull();
    expect(api).toBeDefined();
    expect(api!.name).toBe("Integration Test API");
    expect(api!.base_url).toBe("https://test.example.com");
    expect(api!.spec_version).toBe("3.0.3");
    expect(api!.credential_vault_id).toBeDefined();

    // Verify parsed_endpoints rows were created
    const { data: endpoints, error: epError } = await adminClient
      .from("parsed_endpoints")
      .select("*")
      .eq("api_id", data.api_id)
      .order("display_order");

    expect(epError).toBeNull();
    expect(endpoints).toHaveLength(3);
    expect(endpoints![0].method).toBe("GET");
    expect(endpoints![0].path_template).toBe("/items");
    expect(endpoints![0].operation_id).toBe("listItems");
    expect(endpoints![1].method).toBe("POST");
    expect(endpoints![2].path_template).toBe("/items/{itemId}");

    // Cleanup
    await adminClient
      .from("api_registrations")
      .delete()
      .eq("id", data.api_id);
  });

  it("should reject request without auth token", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/parse-spec`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          base_url: "https://example.com",
          auth_method: "bearer_token",
          credential: "test",
          spec_content: TEST_SPEC_JSON,
        }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("should reject invalid spec content", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/parse-spec`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name: "Bad Spec",
          base_url: "https://example.com",
          auth_method: "bearer_token",
          credential: "test",
          spec_content: "not valid at all {{{",
        }),
      },
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("invalid_spec");
  });

  it("should reject spec missing paths property", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/parse-spec`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name: "No Paths",
          base_url: "https://example.com",
          auth_method: "bearer_token",
          credential: "test",
          spec_content: JSON.stringify({
            openapi: "3.0.0",
            info: { title: "test", version: "1.0.0" },
          }),
        }),
      },
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("invalid_spec");
    expect(data.message).toContain("paths");
  });
});
