import { useState, useMemo } from "react";
import { decodeShareLink } from "../../lib/share-link";
import { supabase } from "../../lib/supabase";
import type { ShareTemplate } from "../../../shared/types";

interface ShareLandingPageProps {
  hash: string;
}

const inputClass =
  "w-full rounded-pill border border-border bg-white px-4 py-2 text-sm text-text placeholder:text-disabled focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const labelClass = "mb-1 block text-sm font-medium text-text";

export default function ShareLandingPage({ hash }: ShareLandingPageProps) {
  const [apiName, setApiName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authMethod, setAuthMethod] = useState<
    "bearer_token" | "api_key_header" | "api_key_query"
  >("bearer_token");
  const [credential, setCredential] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Decode the share link from the URL fragment
  const template = useMemo<ShareTemplate | null>(() => {
    try {
      return decodeShareLink(hash);
    } catch {
      return null;
    }
  }, [hash]);

  if (!template) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold text-error">
            Invalid Share Link
          </h2>
          <p className="mt-2 text-sm text-text-light">
            The share link could not be decoded. Please check the URL and try
            again.
          </p>
        </div>
      </div>
    );
  }

  const canSubmit =
    apiName.trim() &&
    baseUrl.trim() &&
    credential.trim() &&
    tokenName.trim() &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);

    try {
      // Step 1: Register the API via parse-spec Edge Function
      const { data: specData, error: specError } =
        await supabase.functions.invoke("parse-spec", {
          body: {
            name: apiName.trim(),
            base_url: baseUrl.trim(),
            auth_method: authMethod,
            credential: credential.trim(),
            spec_url: template.spec_reference,
          },
        });

      if (specError) {
        throw new Error(specError.message || "Failed to register API");
      }
      if (specData?.error) {
        throw new Error(specData.error);
      }

      const apiId = specData.api_id;

      // Step 2: Get the parsed endpoints to map path_template+method -> endpoint_id
      const { data: endpoints, error: epError } = await supabase
        .from("parsed_endpoints")
        .select("id, method, path_template")
        .eq("api_id", apiId);

      if (epError) {
        throw new Error(
          `Failed to fetch endpoints: ${epError.message}`,
        );
      }

      // Build a lookup map: "METHOD:path_template" -> endpoint_id
      const endpointMap = new Map<string, string>();
      for (const ep of endpoints ?? []) {
        endpointMap.set(`${ep.method}:${ep.path_template}`, ep.id);
      }

      // Map share template permissions to endpoint IDs
      const endpointPermissions = template.endpoint_permissions
        .map((perm) => {
          const epId = endpointMap.get(
            `${perm.method}:${perm.path_template}`,
          );
          if (!epId) return null;
          return { endpoint_id: epId, is_allowed: perm.is_allowed };
        })
        .filter(
          (p): p is { endpoint_id: string; is_allowed: boolean } =>
            p !== null,
        );

      // Map share template constraints to endpoint IDs
      const parameterConstraints = template.parameter_constraints
        .map((c) => {
          const epId = endpointMap.get(
            `${c.method}:${c.path_template}`,
          );
          if (!epId) return null;
          return {
            endpoint_id: epId,
            param_name: c.param_name,
            allowed_patterns: c.allowed_patterns,
          };
        })
        .filter(
          (
            c,
          ): c is {
            endpoint_id: string;
            param_name: string;
            allowed_patterns: string[];
          } => c !== null,
        );

      // Step 3: Create token via generate-token Edge Function
      const { data: tokenData, error: tokenError } =
        await supabase.functions.invoke("generate-token", {
          body: {
            api_id: apiId,
            name: tokenName.trim(),
            endpoint_permissions:
              endpointPermissions.length > 0
                ? endpointPermissions
                : undefined,
            parameter_constraints:
              parameterConstraints.length > 0
                ? parameterConstraints
                : undefined,
          },
        });

      if (tokenError) {
        throw new Error(tokenError.message || "Failed to create token");
      }
      if (tokenData?.error) {
        throw new Error(tokenData.error);
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h2 className="font-heading text-2xl font-bold text-success">
          API and Token Created
        </h2>
        <p className="mt-2 text-sm text-text-light">
          Your API has been registered and a scoped access token has been
          created. Go to the dashboard to view and manage it.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-pill bg-primary px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      <h2 className="font-heading text-2xl font-bold text-primary">
        Set Up Shared API Access
      </h2>
      <p className="text-sm text-text-light">
        This share link pre-fills endpoint permissions and parameter
        constraints. Fill in your API details below to register and create a
        scoped token.
      </p>

      {/* Pre-filled spec reference */}
      <div>
        <label className={labelClass}>Spec Reference</label>
        <p className="break-all rounded-lg border border-border-light bg-white/50 px-4 py-2 font-mono text-xs text-text-light">
          {template.spec_reference}
        </p>
      </div>

      {/* Pre-filled permissions summary */}
      <div>
        <label className={labelClass}>
          Endpoint Permissions ({template.endpoint_permissions.length})
        </label>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border-light bg-white/50 p-3">
          {template.endpoint_permissions.map((perm, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs ${
                perm.is_allowed ? "text-text" : "text-text-light opacity-50"
              }`}
            >
              <span
                className={`inline-block w-14 rounded-pill px-1.5 py-0.5 text-center font-bold uppercase ${
                  perm.method === "GET"
                    ? "bg-success/10 text-success"
                    : perm.method === "POST"
                      ? "bg-primary/10 text-primary"
                      : perm.method === "PUT" || perm.method === "PATCH"
                        ? "bg-warning/10 text-warning"
                        : perm.method === "DELETE"
                          ? "bg-error/10 text-error"
                          : "bg-text-light/10 text-text-light"
                }`}
              >
                {perm.method}
              </span>
              <span className="font-mono">{perm.path_template}</span>
              <span className="ml-auto">
                {perm.is_allowed ? "\u2713" : "\u2717"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-filled constraints summary */}
      {template.parameter_constraints.length > 0 && (
        <div>
          <label className={labelClass}>
            Parameter Constraints ({template.parameter_constraints.length})
          </label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border-light bg-white/50 p-3">
            {template.parameter_constraints.map((c, i) => (
              <div key={i} className="text-xs text-text">
                <span className="font-mono">
                  {c.method} {c.path_template}
                </span>{" "}
                <span className="font-medium">{c.param_name}</span>:{" "}
                <span className="text-text-light">
                  {c.allowed_patterns.join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User-provided fields */}
      <div>
        <label htmlFor="share-api-name" className={labelClass}>
          API Name
        </label>
        <input
          id="share-api-name"
          type="text"
          value={apiName}
          onChange={(e) => setApiName(e.target.value)}
          placeholder="e.g., My GitHub API"
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="share-base-url" className={labelClass}>
          Base URL
        </label>
        <input
          id="share-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="share-auth-method" className={labelClass}>
          Auth Method
        </label>
        <select
          id="share-auth-method"
          value={authMethod}
          onChange={(e) =>
            setAuthMethod(
              e.target.value as
                | "bearer_token"
                | "api_key_header"
                | "api_key_query",
            )
          }
          className={inputClass}
        >
          <option value="bearer_token">Bearer Token</option>
          <option value="api_key_header">API Key (Header)</option>
          <option value="api_key_query">API Key (Query Param)</option>
        </select>
      </div>

      <div>
        <label htmlFor="share-credential" className={labelClass}>
          Credential
        </label>
        <input
          id="share-credential"
          type="password"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder="Your API credential"
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="share-token-name" className={labelClass}>
          Token Name
        </label>
        <input
          id="share-token-name"
          type="text"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          placeholder="e.g., cursor-agent"
          className={inputClass}
          required
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-pill border border-error/30 bg-error/5 px-4 py-2 text-sm text-error">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-pill bg-primary px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create API + Token"}
        </button>
      </div>
    </form>
  );
}
