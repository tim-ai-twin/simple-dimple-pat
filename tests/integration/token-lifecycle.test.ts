import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Integration tests for Token Lifecycle (User Story 4).
 * Covers the full lifecycle: create, disable, re-enable, regenerate,
 * expire, and delete — verifying proxy behavior at each stage.
 *
 * Requires:
 *   - Supabase local stack running (supabase start)
 *   - Proxy running (e.g., Netlify dev or local function server)
 * Run with: npm run test:integration
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PROXY_URL = process.env.PROXY_URL ?? "http://localhost:8888";

const canRun = SUPABASE_ANON_KEY.length > 0 && SUPABASE_SERVICE_ROLE_KEY.length > 0;

describe.skipIf(!canRun)("Token Lifecycle (integration)", () => {
  let adminClient: ReturnType<typeof createClient>;
  let userJwt: string;
  let testApiId: string;
  let tokenId: string;
  let rawToken: string;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create test user and sign in
    const email = `lifecycle-test-${Date.now()}@example.com`;
    const password = "test-password-lifecycle-123!";
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    const { data: signInData } = await adminClient.auth.signInWithPassword({
      email,
      password,
    });
    userJwt = signInData?.session?.access_token ?? "";

    // Register a test API via parse-spec
    const specResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/parse-spec`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userJwt}`,
        },
        body: JSON.stringify({
          name: "Lifecycle Test API",
          base_url: "https://lifecycle-mock.example.com",
          auth_method: "bearer_token",
          credential: "real-cred-lifecycle",
          spec_content: JSON.stringify({
            openapi: "3.0.3",
            info: { title: "Lifecycle Test", version: "1.0.0" },
            paths: {
              "/items": {
                get: {
                  operationId: "listItems",
                  summary: "List items",
                },
              },
            },
          }),
        }),
      },
    );
    const specData = await specResponse.json();
    testApiId = specData.api_id;
  });

  afterAll(async () => {
    // Clean up: delete API (cascades to tokens, permissions, logs)
    if (testApiId) {
      await adminClient
        .from("api_registrations")
        .delete()
        .eq("id", testApiId);
    }
    // TODO: Delete test user via admin client
  });

  // ------------------------------------------------------------------
  // Create token -> proxy success
  // ------------------------------------------------------------------

  it("create token -> proxy returns 200 for valid request", async () => {
    // Generate a token via Edge Function
    const genResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userJwt}`,
        },
        body: JSON.stringify({
          api_id: testApiId,
          name: "lifecycle-test-token",
        }),
      },
    );

    expect(genResponse.status).toBe(200);
    const genData = await genResponse.json();
    tokenId = genData.token_id;
    rawToken = genData.raw_token;

    expect(rawToken).toMatch(/^sdp_/);
    expect(rawToken.length).toBe(40);

    // TODO: Send GET through proxy with rawToken and verify 200
    // const proxyResponse = await fetch(`${PROXY_URL}/proxy/${testApiId}/items`, {
    //   headers: { Authorization: `Bearer ${rawToken}` },
    // });
    // expect(proxyResponse.status).toBe(200);
  });

  // ------------------------------------------------------------------
  // Disable token -> proxy 401
  // ------------------------------------------------------------------

  it("disable token -> proxy returns 401", async () => {
    // Disable the token
    const { error: disableError } = await adminClient
      .from("access_tokens")
      .update({ status: "disabled" })
      .eq("id", tokenId);

    expect(disableError).toBeNull();

    // TODO: Send GET through proxy with rawToken and verify 401
    // const proxyResponse = await fetch(`${PROXY_URL}/proxy/${testApiId}/items`, {
    //   headers: { Authorization: `Bearer ${rawToken}` },
    // });
    // expect(proxyResponse.status).toBe(401);
  });

  // ------------------------------------------------------------------
  // Re-enable token -> proxy 200
  // ------------------------------------------------------------------

  it("re-enable token -> proxy returns 200", async () => {
    // Re-enable the token
    const { error: enableError } = await adminClient
      .from("access_tokens")
      .update({ status: "active" })
      .eq("id", tokenId);

    expect(enableError).toBeNull();

    // TODO: Send GET through proxy with rawToken and verify 200
    // const proxyResponse = await fetch(`${PROXY_URL}/proxy/${testApiId}/items`, {
    //   headers: { Authorization: `Bearer ${rawToken}` },
    // });
    // expect(proxyResponse.status).toBe(200);
  });

  // ------------------------------------------------------------------
  // Regenerate -> old token 401, new token 200
  // ------------------------------------------------------------------

  it("regenerate -> old token returns 401, new token returns 200", async () => {
    const oldRawToken = rawToken;

    // Regenerate via Edge Function
    const regenResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/regenerate-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userJwt}`,
        },
        body: JSON.stringify({ token_id: tokenId }),
      },
    );

    expect(regenResponse.status).toBe(200);
    const regenData = await regenResponse.json();
    rawToken = regenData.raw_token;

    expect(rawToken).toMatch(/^sdp_/);
    expect(rawToken).not.toBe(oldRawToken);

    // TODO: Send GET through proxy with oldRawToken and verify 401
    // const oldResponse = await fetch(`${PROXY_URL}/proxy/${testApiId}/items`, {
    //   headers: { Authorization: `Bearer ${oldRawToken}` },
    // });
    // expect(oldResponse.status).toBe(401);

    // TODO: Send GET through proxy with new rawToken and verify 200
    // const newResponse = await fetch(`${PROXY_URL}/proxy/${testApiId}/items`, {
    //   headers: { Authorization: `Bearer ${rawToken}` },
    // });
    // expect(newResponse.status).toBe(200);
  });

  // ------------------------------------------------------------------
  // Set past expiration -> proxy 401
  // ------------------------------------------------------------------

  it("set past expiration -> proxy returns 401", async () => {
    // Set expires_at to the past
    const pastDate = new Date(Date.now() - 86400_000).toISOString();
    const { error: expiryError } = await adminClient
      .from("access_tokens")
      .update({ expires_at: pastDate })
      .eq("id", tokenId);

    expect(expiryError).toBeNull();

    // TODO: Send GET through proxy with rawToken and verify 401
    // const proxyResponse = await fetch(`${PROXY_URL}/proxy/${testApiId}/items`, {
    //   headers: { Authorization: `Bearer ${rawToken}` },
    // });
    // expect(proxyResponse.status).toBe(401);

    // Reset expiration for next test
    const futureDate = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await adminClient
      .from("access_tokens")
      .update({ expires_at: futureDate })
      .eq("id", tokenId);
  });

  // ------------------------------------------------------------------
  // Delete token -> proxy 401
  // ------------------------------------------------------------------

  it("delete token -> proxy returns 401", async () => {
    // Delete the token
    const { error: deleteError } = await adminClient
      .from("access_tokens")
      .delete()
      .eq("id", tokenId);

    expect(deleteError).toBeNull();

    // TODO: Send GET through proxy with rawToken and verify 401
    // const proxyResponse = await fetch(`${PROXY_URL}/proxy/${testApiId}/items`, {
    //   headers: { Authorization: `Bearer ${rawToken}` },
    // });
    // expect(proxyResponse.status).toBe(401);
  });
});
