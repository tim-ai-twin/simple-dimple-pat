import { useState } from "react";
import { supabase } from "../../lib/supabase";
import SpecUpload from "./SpecUpload";

type AuthMethod = "bearer_token" | "api_key_header" | "api_key_query";

const AUTH_METHOD_OPTIONS: { value: AuthMethod; label: string }[] = [
  { value: "bearer_token", label: "Bearer Token" },
  { value: "api_key_header", label: "API Key (Header)" },
  { value: "api_key_query", label: "API Key (Query Param)" },
];

interface AddApiFormProps {
  onSuccess: (apiId: string) => void;
  onCancel?: () => void;
}

const inputClass =
  "w-full rounded-pill border border-border bg-white px-4 py-2 text-sm text-text placeholder:text-disabled focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const labelClass = "mb-1 block text-sm font-medium text-text";

export default function AddApiForm({ onSuccess, onCancel }: AddApiFormProps) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("bearer_token");
  const [authHeaderName, setAuthHeaderName] = useState("");
  const [authQueryParam, setAuthQueryParam] = useState("");
  const [credential, setCredential] = useState("");
  const [showCredential, setShowCredential] = useState(false);
  const [specContent, setSpecContent] = useState("");
  const [specFilename, setSpecFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    name.trim() &&
    baseUrl.trim() &&
    credential.trim() &&
    specContent &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);

    try {
      const body: Record<string, string> = {
        name: name.trim(),
        base_url: baseUrl.trim(),
        auth_method: authMethod,
        credential: credential.trim(),
        spec_content: specContent,
        spec_filename: specFilename,
      };

      if (authMethod === "api_key_header" && authHeaderName.trim()) {
        body.auth_header_name = authHeaderName.trim();
      }
      if (authMethod === "api_key_query" && authQueryParam.trim()) {
        body.auth_query_param = authQueryParam.trim();
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "parse-spec",
        { body },
      );

      if (fnError) {
        throw new Error(fnError.message || "Failed to save API");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const apiId = data?.api_id ?? data?.id;
      if (!apiId) {
        throw new Error("No API ID returned from server");
      }

      onSuccess(apiId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      <h2 className="font-heading text-2xl font-bold text-primary">
        Add New API
      </h2>

      {/* Name */}
      <div>
        <label htmlFor="api-name" className={labelClass}>
          Name
        </label>
        <input
          id="api-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My API"
          className={inputClass}
          required
        />
      </div>

      {/* Base URL */}
      <div>
        <label htmlFor="api-base-url" className={labelClass}>
          Base URL
        </label>
        <input
          id="api-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
          className={inputClass}
          required
        />
      </div>

      {/* Auth Method */}
      <div>
        <label htmlFor="api-auth-method" className={labelClass}>
          Auth Method
        </label>
        <select
          id="api-auth-method"
          value={authMethod}
          onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
          className={inputClass}
        >
          {AUTH_METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Auth Header Name (conditional) */}
      {authMethod === "api_key_header" && (
        <div>
          <label htmlFor="api-auth-header" className={labelClass}>
            Auth Header Name
          </label>
          <input
            id="api-auth-header"
            type="text"
            value={authHeaderName}
            onChange={(e) => setAuthHeaderName(e.target.value)}
            placeholder="X-API-Key"
            className={inputClass}
          />
        </div>
      )}

      {/* Auth Query Param (conditional) */}
      {authMethod === "api_key_query" && (
        <div>
          <label htmlFor="api-auth-query" className={labelClass}>
            Auth Query Param
          </label>
          <input
            id="api-auth-query"
            type="text"
            value={authQueryParam}
            onChange={(e) => setAuthQueryParam(e.target.value)}
            placeholder="api_key"
            className={inputClass}
          />
        </div>
      )}

      {/* Credential */}
      <div>
        <label htmlFor="api-credential" className={labelClass}>
          Credential
        </label>
        <div className="relative">
          <input
            id="api-credential"
            type={showCredential ? "text" : "password"}
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="Enter token or API key"
            className={`${inputClass} pr-12`}
            required
          />
          <button
            type="button"
            onClick={() => setShowCredential(!showCredential)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-primary"
            aria-label={showCredential ? "Hide credential" : "Show credential"}
          >
            {showCredential ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Spec Upload */}
      <div>
        <label className={labelClass}>OpenAPI Specification</label>
        <SpecUpload
          onSpecLoaded={(content, filename) => {
            setSpecContent(content);
            setSpecFilename(filename);
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-pill border border-error/30 bg-error/5 px-4 py-2 text-sm text-error">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-pill bg-primary px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save API"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill border border-border px-6 py-2.5 text-sm font-medium text-text-light transition-colors hover:border-primary hover:text-primary"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
