import { describe, it, expect } from "vitest";
import { matchGlob } from "../../src/lib/glob";

// --- Inline permission-checking logic (mirrors proxy Edge Function) ---

interface Permission {
  method: string;
  path: string;
  is_allowed: boolean;
}

interface ParamConstraint {
  /** The endpoint key in "METHOD /path" form */
  endpoint: string;
  param_name: string;
  allowed_patterns: string[];
}

interface CheckPermissionInput {
  method: string;
  path: string;
  tokenStatus: "active" | "disabled";
  expiresAt: string; // ISO 8601
  permissions: Permission[];
  paramConstraints?: ParamConstraint[];
  /** Actual parameter values from the incoming request, keyed by param name */
  paramValues?: Record<string, string>;
}

interface CheckPermissionResult {
  allowed: boolean;
  reason?: string;
}

function checkPermission(input: CheckPermissionInput): CheckPermissionResult {
  // 1. Token must be active
  if (input.tokenStatus !== "active") {
    return { allowed: false, reason: "Token is disabled" };
  }

  // 2. Token must not be expired
  const now = new Date();
  const expiresAt = new Date(input.expiresAt);
  if (expiresAt <= now) {
    return { allowed: false, reason: "Token has expired" };
  }

  // 3. Endpoint must be in the permissions list
  const endpointKey = `${input.method.toUpperCase()} ${input.path}`;
  const permission = input.permissions.find(
    (p) => `${p.method.toUpperCase()} ${p.path}` === endpointKey
  );

  if (!permission) {
    return {
      allowed: false,
      reason: `Endpoint not found in permissions: ${endpointKey}`,
    };
  }

  // 4. Permission must be allowed
  if (!permission.is_allowed) {
    return {
      allowed: false,
      reason: `Endpoint is blocked: ${endpointKey}`,
    };
  }

  // 5. Parameter constraints must be satisfied (if any)
  if (input.paramConstraints && input.paramValues) {
    const endpointConstraints = input.paramConstraints.filter(
      (c) => c.endpoint === endpointKey
    );

    for (const constraint of endpointConstraints) {
      const actualValue = input.paramValues[constraint.param_name];
      if (actualValue === undefined) {
        // No value provided for constrained param -- skip (param might be optional)
        continue;
      }

      // Value must match at least one allowed pattern
      const matches = constraint.allowed_patterns.some((pattern) =>
        matchGlob(pattern, actualValue)
      );

      if (!matches) {
        return {
          allowed: false,
          reason: `Parameter "${constraint.param_name}" value "${actualValue}" violates constraint [${constraint.allowed_patterns.join(", ")}]`,
        };
      }
    }
  }

  return { allowed: true };
}

// --- Tests ---

describe("checkPermission", () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const pastDate = new Date(Date.now() - 60 * 1000).toISOString();

  const basePermissions: Permission[] = [
    { method: "GET", path: "/items", is_allowed: true },
    { method: "POST", path: "/items", is_allowed: true },
    { method: "GET", path: "/items/{id}", is_allowed: true },
    { method: "DELETE", path: "/items/{id}", is_allowed: false },
  ];

  it("allows request when endpoint is permitted and token is active", () => {
    const result = checkPermission({
      method: "GET",
      path: "/items",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("denies request when endpoint is not in permissions", () => {
    const result = checkPermission({
      method: "PUT",
      path: "/items/{id}",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Endpoint not found in permissions");
    expect(result.reason).toContain("PUT /items/{id}");
  });

  it("denies request when endpoint is_allowed is false", () => {
    const result = checkPermission({
      method: "DELETE",
      path: "/items/{id}",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Endpoint is blocked");
    expect(result.reason).toContain("DELETE /items/{id}");
  });

  it("denies request when token is disabled", () => {
    const result = checkPermission({
      method: "GET",
      path: "/items",
      tokenStatus: "disabled",
      expiresAt: futureDate,
      permissions: basePermissions,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Token is disabled");
  });

  it("denies request when token is expired", () => {
    const result = checkPermission({
      method: "GET",
      path: "/items",
      tokenStatus: "active",
      expiresAt: pastDate,
      permissions: basePermissions,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Token has expired");
  });

  it("allows request with matching parameter constraint (glob)", () => {
    const result = checkPermission({
      method: "GET",
      path: "/items/{id}",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
      paramConstraints: [
        {
          endpoint: "GET /items/{id}",
          param_name: "id",
          allowed_patterns: ["item-*"],
        },
      ],
      paramValues: { id: "item-42" },
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("denies request when parameter violates glob constraint", () => {
    const result = checkPermission({
      method: "GET",
      path: "/items/{id}",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
      paramConstraints: [
        {
          endpoint: "GET /items/{id}",
          param_name: "id",
          allowed_patterns: ["item-*"],
        },
      ],
      paramValues: { id: "secret-99" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Parameter "id"');
    expect(result.reason).toContain("secret-99");
    expect(result.reason).toContain("item-*");
  });

  it("allows request when no parameter constraints exist", () => {
    const result = checkPermission({
      method: "POST",
      path: "/items",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
      paramConstraints: [],
      paramValues: { org: "any-org" },
    });
    expect(result.allowed).toBe(true);
  });

  it("allows request when param constraints exist but param value not supplied", () => {
    const result = checkPermission({
      method: "GET",
      path: "/items/{id}",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
      paramConstraints: [
        {
          endpoint: "GET /items/{id}",
          param_name: "id",
          allowed_patterns: ["item-*"],
        },
      ],
      paramValues: {},
    });
    expect(result.allowed).toBe(true);
  });

  it("allows request when param value matches one of several patterns", () => {
    const result = checkPermission({
      method: "GET",
      path: "/items/{id}",
      tokenStatus: "active",
      expiresAt: futureDate,
      permissions: basePermissions,
      paramConstraints: [
        {
          endpoint: "GET /items/{id}",
          param_name: "id",
          allowed_patterns: ["item-*", "thing-*", "widget-?"],
        },
      ],
      paramValues: { id: "thing-abc" },
    });
    expect(result.allowed).toBe(true);
  });

  describe("provides descriptive block_reason for each denial type", () => {
    it("disabled token reason mentions disabled", () => {
      const result = checkPermission({
        method: "GET",
        path: "/items",
        tokenStatus: "disabled",
        expiresAt: futureDate,
        permissions: basePermissions,
      });
      expect(result.reason).toBe("Token is disabled");
    });

    it("expired token reason mentions expired", () => {
      const result = checkPermission({
        method: "GET",
        path: "/items",
        tokenStatus: "active",
        expiresAt: pastDate,
        permissions: basePermissions,
      });
      expect(result.reason).toBe("Token has expired");
    });

    it("missing endpoint reason includes the endpoint key", () => {
      const result = checkPermission({
        method: "PATCH",
        path: "/users",
        tokenStatus: "active",
        expiresAt: futureDate,
        permissions: basePermissions,
      });
      expect(result.reason).toMatch(/Endpoint not found.*PATCH \/users/);
    });

    it("blocked endpoint reason includes the endpoint key", () => {
      const result = checkPermission({
        method: "DELETE",
        path: "/items/{id}",
        tokenStatus: "active",
        expiresAt: futureDate,
        permissions: basePermissions,
      });
      expect(result.reason).toMatch(/Endpoint is blocked.*DELETE \/items/);
    });

    it("param constraint violation reason includes param name, value, and patterns", () => {
      const result = checkPermission({
        method: "GET",
        path: "/items/{id}",
        tokenStatus: "active",
        expiresAt: futureDate,
        permissions: basePermissions,
        paramConstraints: [
          {
            endpoint: "GET /items/{id}",
            param_name: "id",
            allowed_patterns: ["public-*", "shared-*"],
          },
        ],
        paramValues: { id: "private-123" },
      });
      expect(result.reason).toContain('"id"');
      expect(result.reason).toContain("private-123");
      expect(result.reason).toContain("public-*");
      expect(result.reason).toContain("shared-*");
    });
  });
});
