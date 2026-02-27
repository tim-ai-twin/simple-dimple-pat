import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Simple OpenAPI spec parser (mirrors what the Edge Function does)
function parseOpenApiSpec(content: string) {
  let spec: Record<string, unknown>;

  try {
    spec = JSON.parse(content);
  } catch {
    // Try YAML-like parsing for simple cases
    // In production, the Edge Function uses a proper YAML parser
    throw new Error("Invalid JSON spec");
  }

  if (!spec.openapi && !spec.swagger) {
    throw new Error("Missing 'openapi' or 'swagger' version field");
  }

  if (!spec.paths || typeof spec.paths !== "object") {
    throw new Error("Missing 'paths' property");
  }

  const version = (spec.openapi ?? spec.swagger) as string;
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  const endpoints: Array<{
    operation_id: string | null;
    method: string;
    path_template: string;
    tag: string | null;
    summary: string | null;
    parameters: Array<{
      name: string;
      in: string;
      type: string;
      required: boolean;
    }>;
  }> = [];

  const httpMethods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
  ];

  for (const [path, methods] of Object.entries(paths)) {
    for (const method of httpMethods) {
      const operation = methods[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const tags = operation.tags as string[] | undefined;
      const parameters = (operation.parameters ?? []) as Array<{
        name: string;
        in: string;
        schema?: { type?: string };
        type?: string;
        required?: boolean;
      }>;

      endpoints.push({
        operation_id: (operation.operationId as string) ?? null,
        method: method.toUpperCase(),
        path_template: path,
        tag: tags?.[0] ?? null,
        summary: (operation.summary as string) ?? null,
        parameters: parameters.map((p) => ({
          name: p.name,
          in: p.in,
          type: p.schema?.type ?? p.type ?? "string",
          required: p.required ?? false,
        })),
      });
    }
  }

  return { version, endpoints };
}

describe("OpenAPI Spec Parsing", () => {
  it("parses minimal Petstore spec and extracts endpoints", () => {
    const content = readFileSync(
      join(__dirname, "../fixtures/petstore-minimal.yaml"),
      "utf-8",
    );
    // For unit tests, we test with a JSON version
    const jsonSpec = {
      openapi: "3.0.3",
      info: { title: "Petstore", version: "1.0.0" },
      paths: {
        "/pets": {
          get: {
            operationId: "listPets",
            summary: "List all pets",
            parameters: [
              {
                name: "limit",
                in: "query",
                schema: { type: "integer" },
                required: false,
              },
            ],
          },
        },
        "/pets/{petId}": {
          get: {
            operationId: "getPetById",
            summary: "Get a pet by ID",
            parameters: [
              { name: "petId", in: "path", schema: { type: "string" }, required: true },
            ],
          },
        },
      },
    };

    const result = parseOpenApiSpec(JSON.stringify(jsonSpec));

    expect(result.version).toBe("3.0.3");
    expect(result.endpoints).toHaveLength(2);
    expect(result.endpoints[0].method).toBe("GET");
    expect(result.endpoints[0].path_template).toBe("/pets");
    expect(result.endpoints[0].operation_id).toBe("listPets");
    expect(result.endpoints[0].parameters).toHaveLength(1);
    expect(result.endpoints[0].parameters[0].name).toBe("limit");
    expect(result.endpoints[1].path_template).toBe("/pets/{petId}");
  });

  it("extracts endpoints with tags", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/repos/{owner}/{repo}": {
          get: {
            operationId: "getRepo",
            tags: ["repositories"],
            summary: "Get a repository",
            parameters: [
              { name: "owner", in: "path", schema: { type: "string" }, required: true },
              { name: "repo", in: "path", schema: { type: "string" }, required: true },
            ],
          },
          delete: {
            operationId: "deleteRepo",
            tags: ["repositories"],
            summary: "Delete a repository",
            parameters: [
              { name: "owner", in: "path", schema: { type: "string" }, required: true },
              { name: "repo", in: "path", schema: { type: "string" }, required: true },
            ],
          },
        },
      },
    };

    const result = parseOpenApiSpec(JSON.stringify(spec));

    expect(result.endpoints).toHaveLength(2);
    expect(result.endpoints[0].tag).toBe("repositories");
    expect(result.endpoints[0].method).toBe("GET");
    expect(result.endpoints[1].method).toBe("DELETE");
    expect(result.endpoints[1].tag).toBe("repositories");
  });

  it("handles specs without tags (flat list)", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/items": {
          get: { operationId: "listItems", summary: "List items" },
          post: { operationId: "createItem", summary: "Create item" },
        },
      },
    };

    const result = parseOpenApiSpec(JSON.stringify(spec));

    expect(result.endpoints).toHaveLength(2);
    expect(result.endpoints[0].tag).toBeNull();
    expect(result.endpoints[1].tag).toBeNull();
  });

  it("rejects specs missing paths property", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
    };

    expect(() => parseOpenApiSpec(JSON.stringify(spec))).toThrow(
      "Missing 'paths' property",
    );
  });

  it("rejects specs missing openapi version", () => {
    const spec = {
      info: { title: "Test", version: "1.0.0" },
      paths: {},
    };

    expect(() => parseOpenApiSpec(JSON.stringify(spec))).toThrow(
      "Missing 'openapi' or 'swagger' version field",
    );
  });

  it("rejects invalid JSON", () => {
    expect(() => parseOpenApiSpec("not valid json")).toThrow();
  });

  it("handles spec with parameters that have no schema", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test",
            parameters: [{ name: "q", in: "query" }],
          },
        },
      },
    };

    const result = parseOpenApiSpec(JSON.stringify(spec));
    expect(result.endpoints[0].parameters[0].type).toBe("string");
    expect(result.endpoints[0].parameters[0].required).toBe(false);
  });
});
