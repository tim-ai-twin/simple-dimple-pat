import type { ShareTemplate } from "../../shared/types";

/**
 * Encode a share link payload as a URL-safe base64 string suitable for use
 * in a URL fragment (hash). The fragment never leaves the browser, so no
 * credential data is transmitted to any server.
 */
export function encodeShareLink(
  permissions: ShareTemplate["endpoint_permissions"],
  constraints: ShareTemplate["parameter_constraints"],
  specReference: string,
): string {
  const payload: ShareTemplate = {
    spec_reference: specReference,
    endpoint_permissions: permissions,
    parameter_constraints: constraints,
  };

  const json = JSON.stringify(payload);
  const base64 = btoa(json);

  // Convert standard base64 to URL-safe base64:
  //   + -> -
  //   / -> _
  //   = (padding) removed
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a URL-safe base64 string (from a URL fragment) back into the
 * share template with permissions and constraints.
 */
export function decodeShareLink(hash: string): ShareTemplate {
  // Restore standard base64 from URL-safe variant
  let base64 = hash.replace(/-/g, "+").replace(/_/g, "/");

  // Re-add padding if necessary
  const remainder = base64.length % 4;
  if (remainder === 2) {
    base64 += "==";
  } else if (remainder === 3) {
    base64 += "=";
  }

  const json = atob(base64);
  const parsed = JSON.parse(json);

  // Validate structure minimally
  if (
    !parsed.spec_reference ||
    !Array.isArray(parsed.endpoint_permissions) ||
    !Array.isArray(parsed.parameter_constraints)
  ) {
    throw new Error("Invalid share link payload: missing required fields");
  }

  return parsed as ShareTemplate;
}
