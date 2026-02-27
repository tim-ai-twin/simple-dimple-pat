import { useState } from "react";
import type { RequestLog } from "../../../shared/types";

interface ActivityLogProps {
  logs: RequestLog[];
  isLoading: boolean;
}

const METHOD_BADGE_COLORS: Record<string, string> = {
  GET: "bg-success/10 text-success",
  POST: "bg-primary/10 text-primary",
  PUT: "bg-warning/10 text-warning",
  PATCH: "bg-warning/10 text-warning",
  DELETE: "bg-error/10 text-error",
};

function statusCodeColor(code: number | null): string {
  if (code === null) return "bg-text-light/10 text-text-light";
  if (code >= 200 && code < 300) return "bg-success/10 text-success";
  if (code >= 300 && code < 400) return "bg-warning/10 text-warning";
  return "bg-error/10 text-error";
}

/**
 * Returns a relative time string like "2m ago", "3h ago", "1d ago".
 */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityLog({ logs, isLoading }: ActivityLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-text-light">Loading activity...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-text-light">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {logs.map((log) => {
        const isExpanded = expandedId === log.id;
        const tokenName = log.token?.name ?? "Unknown";

        return (
          <div key={log.id}>
            <div
              className={`flex items-center gap-3 rounded-lg border border-border-light bg-white px-4 py-2.5 text-sm ${
                log.blocked ? "cursor-pointer" : ""
              }`}
              onClick={() => {
                if (log.blocked) {
                  setExpandedId(isExpanded ? null : log.id);
                }
              }}
            >
              {/* Relative time */}
              <span className="w-16 shrink-0 text-xs text-text-light">
                {relativeTime(log.created_at)}
              </span>

              {/* Token name */}
              <span className="w-24 shrink-0 truncate text-xs font-medium text-text">
                {tokenName}
              </span>

              {/* Method badge */}
              <span
                className={`inline-block w-16 shrink-0 rounded-pill px-2 py-0.5 text-center text-xs font-bold uppercase ${
                  METHOD_BADGE_COLORS[log.method] ??
                  "bg-text-light/10 text-text-light"
                }`}
              >
                {log.method}
              </span>

              {/* Path */}
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-text">
                {log.path}
              </span>

              {/* Status code badge */}
              {log.status_code !== null && (
                <span
                  className={`inline-block w-12 shrink-0 rounded-pill px-2 py-0.5 text-center text-xs font-bold ${statusCodeColor(
                    log.status_code,
                  )}`}
                >
                  {log.status_code}
                </span>
              )}

              {/* Blocked indicator */}
              <span className="w-5 shrink-0 text-center">
                {log.blocked ? (
                  <span className="text-error" title="Blocked">
                    &#x2717;
                  </span>
                ) : (
                  <span className="text-success" title="Allowed">
                    &#x2713;
                  </span>
                )}
              </span>
            </div>

            {/* Expandable block reason */}
            {log.blocked && isExpanded && log.block_reason && (
              <div className="ml-4 mt-1 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2 text-xs text-warning">
                {log.block_reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
