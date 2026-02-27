import { useState, useMemo } from "react";
import { useEndpointsForApi } from "../../hooks/useEndpoints";
import { useCreateToken } from "../../hooks/useTokens";
import EndpointPermissions from "./EndpointPermissions";
import ParamConstraints from "./ParamConstraints";
import TokenShowOnce from "./TokenShowOnce";
import type { ParsedEndpoint } from "../../../shared/types";

interface CreateTokenFormProps {
  apiId: string;
  onDone: () => void;
}

const inputClass =
  "w-full rounded-pill border border-border bg-white px-4 py-2 text-sm text-text placeholder:text-disabled focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const labelClass = "mb-1 block text-sm font-medium text-text";

export default function CreateTokenForm({ apiId, onDone }: CreateTokenFormProps) {
  const { data: endpoints, isLoading: loadingEndpoints } = useEndpointsForApi(apiId);
  const createToken = useCreateToken();

  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  });
  const [error, setError] = useState<string | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);

  // Permissions: endpoint_id → is_allowed (all true by default)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  // Constraints: param key (endpointId:paramName) → patterns
  const [constraints, setConstraints] = useState<Record<string, string[]>>({});

  // Initialize permissions when endpoints load
  const effectivePermissions = useMemo(() => {
    if (!endpoints) return permissions;
    const merged: Record<string, boolean> = {};
    for (const ep of endpoints) {
      merged[ep.id] = permissions[ep.id] ?? true;
    }
    return merged;
  }, [endpoints, permissions]);

  const handlePermissionChange = (endpointId: string, isAllowed: boolean) => {
    setPermissions((prev) => ({ ...prev, [endpointId]: isAllowed }));
  };

  const handleConstraintChange = (paramKey: string, patterns: string[]) => {
    setConstraints((prev) => ({ ...prev, [paramKey]: patterns }));
  };

  // Gather all parameters from checked endpoints for constraints UI
  const checkedEndpointParams = useMemo(() => {
    if (!endpoints) return [];
    return endpoints
      .filter((ep) => effectivePermissions[ep.id] !== false)
      .flatMap((ep) =>
        (ep.parameters ?? []).map((p) => ({
          endpointId: ep.id,
          endpoint: ep,
          param: p,
          key: `${ep.id}:${p.name}`,
        })),
      );
  }, [endpoints, effectivePermissions]);

  const canSubmit = name.trim() && !createToken.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);

    try {
      // Build endpoint permissions array (only overrides where is_allowed != true)
      const endpointPerms = Object.entries(effectivePermissions)
        .filter(([, allowed]) => !allowed)
        .map(([endpointId, isAllowed]) => ({ endpoint_id: endpointId, is_allowed: isAllowed }));

      // Build parameter constraints array
      const paramConstraints: Array<{
        endpoint_id: string;
        param_name: string;
        allowed_patterns: string[];
      }> = [];
      for (const [key, patterns] of Object.entries(constraints)) {
        if (patterns.length === 0) continue;
        const [endpointId, paramName] = key.split(":");
        paramConstraints.push({
          endpoint_id: endpointId,
          param_name: paramName,
          allowed_patterns: patterns,
        });
      }

      const result = await createToken.mutateAsync({
        api_id: apiId,
        name: name.trim(),
        expires_at: new Date(expiresAt).toISOString(),
        endpoint_permissions: endpointPerms.length > 0 ? endpointPerms : undefined,
        parameter_constraints: paramConstraints.length > 0 ? paramConstraints : undefined,
      });

      setRawToken(result.raw_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    }
  };

  // Show-once modal
  if (rawToken) {
    return (
      <TokenShowOnce
        rawToken={rawToken}
        onDismiss={onDone}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      <h2 className="font-heading text-2xl font-bold text-primary">
        Create Access Token
      </h2>

      {/* Token Name */}
      <div>
        <label htmlFor="token-name" className={labelClass}>
          Token Name
        </label>
        <input
          id="token-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., cursor-agent"
          className={inputClass}
          required
        />
      </div>

      {/* Expiration */}
      <div>
        <label htmlFor="token-expiry" className={labelClass}>
          Expires
        </label>
        <input
          id="token-expiry"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Endpoint Permissions */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-text">
          Endpoint Permissions
        </h3>
        {loadingEndpoints ? (
          <p className="text-sm text-text-light">Loading endpoints...</p>
        ) : endpoints && endpoints.length > 0 ? (
          <>
            <EndpointPermissions
              endpoints={endpoints}
              permissions={effectivePermissions}
              onChange={handlePermissionChange}
            />
            {/* Parameter Constraints for checked endpoints */}
            {checkedEndpointParams.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-text">
                  Parameter Constraints
                </h3>
                <div className="space-y-3">
                  {groupParamsByEndpoint(checkedEndpointParams).map(
                    ([ep, params]) => (
                      <div key={ep.id} className="rounded-lg border border-border-light bg-white p-3">
                        <p className="mb-2 text-xs font-medium text-text-light">
                          {ep.method} {ep.path_template}
                        </p>
                        <ParamConstraints
                          parameters={params.map((p) => p.param)}
                          constraints={Object.fromEntries(
                            params.map((p) => [p.param.name, constraints[p.key] ?? []]),
                          )}
                          onChange={(paramName, patterns) => {
                            const key = `${ep.id}:${paramName}`;
                            handleConstraintChange(key, patterns);
                          }}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-text-light">No endpoints found for this API.</p>
        )}
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
          {createToken.isPending ? "Creating..." : "Create Token"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-pill border border-border px-6 py-2.5 text-sm font-medium text-text-light transition-colors hover:border-primary hover:text-primary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function groupParamsByEndpoint(
  items: Array<{
    endpointId: string;
    endpoint: ParsedEndpoint;
    param: { name: string; in: string; type: string; required: boolean };
    key: string;
  }>,
): [ParsedEndpoint, typeof items][] {
  const map = new Map<string, { ep: ParsedEndpoint; params: typeof items }>();
  for (const item of items) {
    const existing = map.get(item.endpointId);
    if (existing) {
      existing.params.push(item);
    } else {
      map.set(item.endpointId, { ep: item.endpoint, params: [item] });
    }
  }
  return Array.from(map.values()).map(({ ep, params }) => [ep, params]);
}
