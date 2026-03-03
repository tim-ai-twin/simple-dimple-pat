import { useState, useMemo } from "react";
import {
  useTokenDetail,
  useToggleTokenStatus,
  useUpdateExpiration,
  useRegenerateToken,
  useDeleteToken,
} from "../../hooks/useTokens";
import EndpointPermissions from "./EndpointPermissions";
import ParamConstraints from "./ParamConstraints";
import TokenShowOnce from "./TokenShowOnce";
import { useTokenActivityLog } from "../../hooks/useActivityLog";
import ActivityLog from "../activity/ActivityLog";
import ShareLinkButton from "../share/ShareLinkButton";
import type { ParsedEndpoint } from "../../../shared/types";

interface TokenDetailViewProps {
  tokenId: string;
  onDeleted?: () => void;
}

export default function TokenDetailView({
  tokenId,
  onDeleted,
}: TokenDetailViewProps) {
  const { data: token, isLoading, error } = useTokenDetail(tokenId);
  const { data: activityLogs, isLoading: logsLoading } = useTokenActivityLog(tokenId);
  const toggleStatus = useToggleTokenStatus();
  const updateExpiration = useUpdateExpiration();
  const regenerateToken = useRegenerateToken();
  const deleteToken = useDeleteToken();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newRawToken, setNewRawToken] = useState<string | null>(null);
  const [expiryInput, setExpiryInput] = useState("");

  // Build permissions map from token data
  const permissions = useMemo(() => {
    if (!token?.token_endpoint_permissions) return {};
    const map: Record<string, boolean> = {};
    for (const perm of token.token_endpoint_permissions) {
      map[perm.endpoint_id] = perm.is_allowed;
    }
    return map;
  }, [token]);

  // Extract endpoints from permissions
  const endpoints = useMemo(() => {
    if (!token?.token_endpoint_permissions) return [];
    return token.token_endpoint_permissions
      .filter((p) => p.parsed_endpoint)
      .map((p) => p.parsed_endpoint as ParsedEndpoint);
  }, [token]);

  // Build constraints map
  const constraintsByParam = useMemo(() => {
    if (!token?.token_endpoint_permissions) return {};
    const map: Record<string, string[]> = {};
    for (const perm of token.token_endpoint_permissions) {
      if (!perm.parameter_constraints) continue;
      for (const c of perm.parameter_constraints) {
        map[c.param_name] = c.allowed_patterns;
      }
    }
    return map;
  }, [token]);

  const allParams = useMemo(() => {
    return endpoints.flatMap((ep) => ep.parameters ?? []);
  }, [endpoints]);

  const handleToggleStatus = async () => {
    if (!token) return;
    const newStatus = token.status === "active" ? "disabled" : "active";
    await toggleStatus.mutateAsync({ tokenId, status: newStatus });
  };

  const handleExpireNow = async () => {
    await updateExpiration.mutateAsync({
      tokenId,
      expiresAt: new Date().toISOString(),
    });
  };

  const handleUpdateExpiry = async () => {
    if (!expiryInput) return;
    await updateExpiration.mutateAsync({
      tokenId,
      expiresAt: new Date(expiryInput).toISOString(),
    });
    setExpiryInput("");
  };

  const handleRegenerate = async () => {
    const result = await regenerateToken.mutateAsync(tokenId);
    setNewRawToken(result.raw_token);
  };

  const handleDelete = async () => {
    await deleteToken.mutateAsync(tokenId);
    onDeleted?.();
  };

  if (newRawToken) {
    return (
      <TokenShowOnce
        rawToken={newRawToken}
        onDismiss={() => setNewRawToken(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-text-light">Loading token details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-error">Failed to load token: {error.message}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-text-light">Token not found.</p>
      </div>
    );
  }

  const isExpired =
    token.status === "expired" || new Date(token.expires_at) < new Date();
  const statusColor =
    token.status === "active" && !isExpired
      ? "text-success"
      : token.status === "disabled"
        ? "text-error"
        : "text-warning";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Identity */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-primary">
          {token.name}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <code className="rounded-pill border border-border-light bg-white px-3 py-1 text-sm text-text-light">
            {token.token_prefix}...
          </code>
          <span className={`text-sm font-medium ${statusColor}`}>
            {isExpired ? "Expired" : token.status}
          </span>
        </div>
      </div>

      {/* Lifecycle Controls */}
      <div className="space-y-3 rounded-xl border border-border-light bg-white p-4">
        <h3 className="text-sm font-medium text-text">Lifecycle</h3>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active/Disabled Toggle */}
          <button
            onClick={handleToggleStatus}
            disabled={toggleStatus.isPending}
            className="rounded-pill border border-primary px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-text-on-primary disabled:opacity-50"
          >
            {token.status === "active" ? "Disable" : "Enable"}
          </button>

          {/* Regenerate */}
          <button
            onClick={handleRegenerate}
            disabled={regenerateToken.isPending}
            className="rounded-pill border border-primary px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-text-on-primary disabled:opacity-50"
          >
            {regenerateToken.isPending ? "Regenerating..." : "Regenerate"}
          </button>

          {/* Expire Now */}
          {!isExpired && (
            <button
              onClick={handleExpireNow}
              disabled={updateExpiration.isPending}
              className="rounded-pill border border-primary px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-text-on-primary disabled:opacity-50"
            >
              Expire Now
            </button>
          )}
        </div>

        {/* Expiration date */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-light">
            Expires: {new Date(token.expires_at).toLocaleDateString()}
          </span>
          <input
            type="date"
            value={expiryInput}
            onChange={(e) => setExpiryInput(e.target.value)}
            className="rounded-pill border border-border bg-white px-3 py-1 text-sm text-text"
          />
          {expiryInput && (
            <button
              onClick={handleUpdateExpiry}
              className="rounded-pill bg-primary px-3 py-1 text-xs font-medium text-text-on-primary"
            >
              Update
            </button>
          )}
        </div>
      </div>

      {/* Endpoint Permissions (read-only view) */}
      {endpoints.length > 0 && (
        <div>
          <h3 className="mb-2 font-heading text-lg font-bold text-text">
            Endpoint Permissions
          </h3>
          <EndpointPermissions
            endpoints={endpoints}
            permissions={permissions}
            onChange={() => {}}
            readOnly
          />
        </div>
      )}

      {/* Parameter Constraints (read-only view) */}
      {allParams.length > 0 && Object.keys(constraintsByParam).length > 0 && (
        <div>
          <h3 className="mb-2 font-heading text-lg font-bold text-text">
            Parameter Constraints
          </h3>
          <ParamConstraints
            parameters={allParams}
            constraints={constraintsByParam}
            onChange={() => {}}
            readOnly
          />
        </div>
      )}

      {/* Recent Calls */}
      <div>
        <h3 className="mb-2 font-heading text-lg font-bold text-text">
          Recent Calls
        </h3>
        <ActivityLog logs={activityLogs ?? []} isLoading={logsLoading} />
      </div>

      {/* Share Link */}
      <ShareLinkButton
        tokenId={tokenId}
        permissions={
          (token.token_endpoint_permissions ?? [])
            .filter((p) => p.parsed_endpoint)
            .map((p) => ({
              method: p.parsed_endpoint!.method,
              path_template: p.parsed_endpoint!.path_template,
              is_allowed: p.is_allowed,
            }))
        }
        constraints={
          (token.token_endpoint_permissions ?? []).flatMap((p) =>
            (p.parameter_constraints ?? []).map((c) => ({
              method: p.parsed_endpoint?.method ?? "",
              path_template: p.parsed_endpoint?.path_template ?? "",
              param_name: c.param_name,
              allowed_patterns: c.allowed_patterns,
            })),
          )
        }
        specReference={token.api_id}
      />

      {/* Delete */}
      <div className="border-t border-border-light pt-6">
        {showDeleteConfirm ? (
          <div className="rounded-xl border border-error/30 bg-error/5 p-4">
            <p className="mb-3 text-sm text-text">
              Are you sure you want to delete token{" "}
              <strong>{token.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteToken.isPending}
                className="rounded-pill bg-error px-5 py-2 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-error/90 disabled:opacity-50"
              >
                {deleteToken.isPending ? "Deleting..." : "Yes, Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-pill border border-border px-5 py-2 text-sm font-medium text-text-light transition-colors hover:border-primary hover:text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-pill border border-error/50 px-5 py-2 text-sm font-semibold uppercase tracking-wider text-error transition-colors hover:bg-error hover:text-white"
          >
            Delete Token
          </button>
        )}
      </div>
    </div>
  );
}
