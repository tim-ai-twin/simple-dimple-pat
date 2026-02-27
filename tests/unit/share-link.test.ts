import { describe, it, expect } from "vitest";
import { encodeShareLink, decodeShareLink } from "../../src/lib/share-link";

describe("Share Link encoding/decoding", () => {
  const samplePermissions = [
    { method: "GET", path_template: "/items", is_allowed: true },
    { method: "POST", path_template: "/items", is_allowed: false },
    { method: "GET", path_template: "/items/{id}", is_allowed: true },
  ];

  const sampleConstraints = [
    {
      method: "GET",
      path_template: "/items/{id}",
      param_name: "id",
      allowed_patterns: ["item-*"],
    },
  ];

  const sampleSpec = "https://example.com/openapi.yaml";

  it("should encode and decode roundtrip correctly", () => {
    const encoded = encodeShareLink(
      samplePermissions,
      sampleConstraints,
      sampleSpec,
    );
    const decoded = decodeShareLink(encoded);

    expect(decoded.spec_reference).toBe(sampleSpec);
    expect(decoded.endpoint_permissions).toEqual(samplePermissions);
    expect(decoded.parameter_constraints).toEqual(sampleConstraints);
  });

  it("should not contain credential data in encoded string", () => {
    const encoded = encodeShareLink(
      samplePermissions,
      sampleConstraints,
      sampleSpec,
    );

    // Decode the base64 to inspect raw JSON — it should not contain
    // any credential-like fields
    const base64Standard = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = atob(base64Standard);

    expect(json).not.toContain("credential");
    expect(json).not.toContain("api_key");
    expect(json).not.toContain("password");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("token_hash");
    expect(json).not.toContain("bearer");
  });

  it("should produce URL-safe characters only", () => {
    const encoded = encodeShareLink(
      samplePermissions,
      sampleConstraints,
      sampleSpec,
    );

    // URL-safe base64 uses only: A-Z, a-z, 0-9, -, _
    // No +, /, or = characters
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("should handle large permission sets", () => {
    // Generate a large set of permissions (100 endpoints)
    const largePermissions = Array.from({ length: 100 }, (_, i) => ({
      method: ["GET", "POST", "PUT", "DELETE"][i % 4],
      path_template: `/resource-${i}/{id}`,
      is_allowed: i % 3 !== 0,
    }));

    const largeConstraints = Array.from({ length: 50 }, (_, i) => ({
      method: "GET",
      path_template: `/resource-${i}/{id}`,
      param_name: "id",
      allowed_patterns: [`prefix-${i}-*`, `other-${i}-*`],
    }));

    const encoded = encodeShareLink(
      largePermissions,
      largeConstraints,
      "https://example.com/large-spec.yaml",
    );

    // Should still be URL-safe
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);

    // Roundtrip should preserve all data
    const decoded = decodeShareLink(encoded);
    expect(decoded.endpoint_permissions.length).toBe(100);
    expect(decoded.parameter_constraints.length).toBe(50);
    expect(decoded.endpoint_permissions[0]).toEqual(largePermissions[0]);
    expect(decoded.parameter_constraints[49]).toEqual(largeConstraints[49]);
  });

  it("should handle empty permissions and constraints", () => {
    const encoded = encodeShareLink([], [], "https://example.com/spec.yaml");
    const decoded = decodeShareLink(encoded);

    expect(decoded.endpoint_permissions).toEqual([]);
    expect(decoded.parameter_constraints).toEqual([]);
    expect(decoded.spec_reference).toBe("https://example.com/spec.yaml");
  });

  it("should throw on invalid encoded data", () => {
    expect(() => decodeShareLink("not-valid-base64!!!")).toThrow();
  });

  it("should throw on valid base64 but missing required fields", () => {
    const badPayload = btoa(JSON.stringify({ foo: "bar" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(() => decodeShareLink(badPayload)).toThrow(
      "Invalid share link payload",
    );
  });
});
