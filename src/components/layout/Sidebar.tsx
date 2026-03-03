import { useState, useEffect } from "react";
import { useApiList } from "../../hooks/useApis";
import { useTokensForApi } from "../../hooks/useTokens";
import { useResetDemo } from "../../hooks/useDemo";
import { SidebarSkeleton } from "../ui/Skeleton";
import { supabase } from "../../lib/supabase";
import { isDemoUser } from "../../lib/demo";
import type { ApiRegistration, AccessToken } from "../../../shared/types";

interface SidebarProps {
  onSelect?: (type: string, id: string) => void;
  onAddApi?: () => void;
  selectedId?: string | null;
}

function getEndpointCount(api: ApiRegistration): number {
  if (Array.isArray(api.parsed_endpoints)) return api.parsed_endpoints.length;
  if (
    api.parsed_endpoints &&
    typeof api.parsed_endpoints === "object" &&
    "count" in (api.parsed_endpoints as unknown as Record<string, unknown>)
  ) {
    return (api.parsed_endpoints as unknown as { count: number }).count;
  }
  return 0;
}

function getTokenStatusColor(token: AccessToken): string {
  if (token.status === "disabled") return "bg-error";
  if (token.status === "expired") return "bg-error";

  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  if (expiresAt < now) return "bg-error";

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (expiresAt.getTime() - now.getTime() < sevenDays) return "bg-warning";

  return "bg-success";
}

function ApiTokenChildren({
  apiId,
  onSelect,
  selectedId,
}: {
  apiId: string;
  onSelect?: (type: string, id: string) => void;
  selectedId?: string | null;
}) {
  const { data: tokens, isLoading } = useTokensForApi(apiId);

  if (isLoading) {
    return (
      <div className="ml-6 py-1">
        <p className="px-2 py-0.5 text-xs text-text-light">Loading...</p>
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="ml-6 py-0.5">
        <p className="px-2 py-1 text-xs text-text-light">No tokens yet</p>
      </div>
    );
  }

  return (
    <div className="ml-6 space-y-0.5 py-0.5">
      {tokens.map((token) => {
        const isSelected = selectedId === token.id;
        const statusColor = getTokenStatusColor(token);

        return (
          <button
            key={token.id}
            onClick={() => onSelect?.("token", token.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors ${
              isSelected
                ? "bg-primary/10 font-medium text-primary"
                : "text-text-light hover:bg-primary/5 hover:text-text"
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
            <span className="truncate">{token.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Sidebar({ onSelect, onAddApi, selectedId }: SidebarProps) {
  const { data: apis, isLoading } = useApiList();
  const [expandedApis, setExpandedApis] = useState<Set<string>>(new Set());
  const [isDemo, setIsDemo] = useState(false);
  const resetDemo = useResetDemo();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setIsDemo(isDemoUser(session.user.id));
    });
  }, []);

  const toggleExpand = (apiId: string) => {
    setExpandedApis((prev) => {
      const next = new Set(prev);
      if (next.has(apiId)) next.delete(apiId);
      else next.add(apiId);
      return next;
    });
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border-light bg-cream">
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading && <SidebarSkeleton />}

        {!isLoading && (!apis || apis.length === 0) && (
          <p className="px-1 py-2 text-sm text-text-light">
            No APIs registered yet.
          </p>
        )}

        {apis && apis.length > 0 && (
          <nav className="space-y-0.5" aria-label="API list">
            {apis.map((api) => {
              const isSelected = selectedId === api.id;
              const isExpanded = expandedApis.has(api.id);
              const endpointCount = getEndpointCount(api);

              return (
                <div key={api.id}>
                  {/* API row */}
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleExpand(api.id)}
                      className="flex h-7 w-6 shrink-0 items-center justify-center text-text-light hover:text-primary"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <svg
                        className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => onSelect?.("api", api.id)}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-text hover:bg-primary/5"
                      }`}
                    >
                      <span className="truncate">{api.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-text-light">
                        {endpointCount}
                      </span>
                    </button>
                  </div>

                  {/* Token children */}
                  {isExpanded && (
                    <ApiTokenChildren
                      apiId={api.id}
                      onSelect={onSelect}
                      selectedId={selectedId}
                    />
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </div>

      <div className="border-t border-border-light p-4 space-y-2">
        <button
          onClick={onAddApi}
          className="w-full rounded-pill border border-primary py-2 text-sm font-semibold uppercase tracking-wider text-primary hover:bg-primary hover:text-text-on-primary transition-colors"
        >
          + Add API
        </button>
        {isDemo && (
          <button
            onClick={() => {
              if (window.confirm("Reset demo to original state? All current demo data will be replaced.")) {
                resetDemo.mutate();
              }
            }}
            disabled={resetDemo.isPending}
            className="w-full rounded-pill border border-primary py-2 text-sm font-semibold uppercase tracking-wider text-primary hover:bg-primary hover:text-text-on-primary transition-colors disabled:opacity-50"
          >
            {resetDemo.isPending ? "Resetting..." : "Reset Demo"}
          </button>
        )}
      </div>
    </aside>
  );
}
