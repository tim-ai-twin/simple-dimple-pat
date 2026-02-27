import { useState } from "react";
import { useApiDetail, useDeleteApi } from "../../hooks/useApis";
import type { ParsedEndpoint } from "../../../shared/types";

interface ApiDetailViewProps {
  apiId: string;
  onReupload?: () => void;
  onDeleted?: () => void;
  onCreateToken?: () => void;
}

function groupEndpointsByTag(
  endpoints: ParsedEndpoint[],
): Map<string, ParsedEndpoint[]> {
  const groups = new Map<string, ParsedEndpoint[]>();
  const sorted = [...endpoints].sort(
    (a, b) => a.display_order - b.display_order,
  );

  for (const ep of sorted) {
    const tag = ep.tag ?? "Untagged";
    const group = groups.get(tag);
    if (group) {
      group.push(ep);
    } else {
      groups.set(tag, [ep]);
    }
  }

  return groups;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-success/10 text-success",
  POST: "bg-primary/10 text-primary",
  PUT: "bg-warning/10 text-warning",
  PATCH: "bg-warning/10 text-warning",
  DELETE: "bg-error/10 text-error",
  HEAD: "bg-text-light/10 text-text-light",
  OPTIONS: "bg-text-light/10 text-text-light",
};

export default function ApiDetailView({
  apiId,
  onReupload,
  onDeleted,
  onCreateToken,
}: ApiDetailViewProps) {
  const { data: api, isLoading, error } = useApiDetail(apiId);
  const deleteApi = useDeleteApi();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    if (!api) return;
    try {
      await navigator.clipboard.writeText(api.base_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const handleDelete = async () => {
    try {
      await deleteApi.mutateAsync(apiId);
      onDeleted?.();
    } catch {
      /* error is available via deleteApi.error */
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-text-light">Loading API details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-error">
          Failed to load API: {error.message}
        </p>
      </div>
    );
  }

  if (!api) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-text-light">API not found.</p>
      </div>
    );
  }

  const endpoints = api.parsed_endpoints ?? [];
  const endpointCount = endpoints.length;
  const tokenCount =
    api.access_tokens && api.access_tokens.length > 0
      ? api.access_tokens[0].count
      : 0;
  const grouped = groupEndpointsByTag(endpoints);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-primary">
            {api.name}
          </h2>

          {/* Base URL with copy */}
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-pill border border-border-light bg-white px-3 py-1 text-sm text-text-light">
              {api.base_url}
            </code>
            <button
              onClick={handleCopyUrl}
              className="rounded-pill border border-border-light p-1.5 text-text-light transition-colors hover:border-primary hover:text-primary"
              aria-label="Copy base URL"
            >
              {copied ? (
                <svg
                  className="h-4 w-4 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Spec version badge */}
        {api.spec_version && (
          <span className="rounded-pill border border-border-light bg-white px-3 py-1 text-xs font-medium text-text-light">
            {api.spec_version}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">
            {endpointCount}
          </span>
          <span className="text-sm text-text-light">
            {endpointCount === 1 ? "endpoint" : "endpoints"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{tokenCount}</span>
          <span className="text-sm text-text-light">
            {tokenCount === 1 ? "active token" : "active tokens"}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {onCreateToken && (
          <button
            onClick={onCreateToken}
            className="rounded-pill bg-primary px-5 py-2 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light"
          >
            Create Token
          </button>
        )}
        {onReupload && (
          <button
            onClick={onReupload}
            className="rounded-pill border border-primary px-5 py-2 text-sm font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-text-on-primary"
          >
            Re-upload Spec
          </button>
        )}
      </div>

      {/* Endpoints list grouped by tag */}
      {endpointCount > 0 && (
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-bold text-text">
            Endpoints
          </h3>

          {Array.from(grouped.entries()).map(([tag, eps]) => (
            <div key={tag}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-light">
                {tag}
              </h4>
              <div className="space-y-1">
                {eps.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center gap-3 rounded-lg border border-border-light bg-white px-4 py-2.5"
                  >
                    <span
                      className={`inline-block w-16 rounded-pill px-2 py-0.5 text-center text-xs font-bold uppercase ${METHOD_COLORS[ep.method] ?? "bg-text-light/10 text-text-light"}`}
                    >
                      {ep.method}
                    </span>
                    <span className="font-mono text-sm text-text">
                      {ep.path_template}
                    </span>
                    {ep.summary && (
                      <span className="ml-auto truncate text-xs text-text-light">
                        {ep.summary}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete section */}
      <div className="border-t border-border-light pt-6">
        {showDeleteConfirm ? (
          <div className="rounded-xl border border-error/30 bg-error/5 p-4">
            <p className="mb-3 text-sm text-text">
              Are you sure you want to delete{" "}
              <strong>{api.name}</strong>? This will also remove all
              associated endpoints and tokens. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteApi.isPending}
                className="rounded-pill bg-error px-5 py-2 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-error/90 disabled:opacity-50"
              >
                {deleteApi.isPending ? "Deleting..." : "Yes, Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-pill border border-border px-5 py-2 text-sm font-medium text-text-light transition-colors hover:border-primary hover:text-primary"
              >
                Cancel
              </button>
            </div>
            {deleteApi.error && (
              <p className="mt-2 text-sm text-error">
                {deleteApi.error.message}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-pill border border-error/50 px-5 py-2 text-sm font-semibold uppercase tracking-wider text-error transition-colors hover:bg-error hover:text-white"
          >
            Delete API
          </button>
        )}
      </div>
    </div>
  );
}
