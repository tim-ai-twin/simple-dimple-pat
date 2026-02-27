import type { ParsedEndpoint } from "../../../shared/types";

interface EndpointPermissionsProps {
  endpoints: ParsedEndpoint[];
  permissions: Record<string, boolean>;
  onChange: (endpointId: string, isAllowed: boolean) => void;
  readOnly?: boolean;
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

export default function EndpointPermissions({
  endpoints,
  permissions,
  onChange,
  readOnly = false,
}: EndpointPermissionsProps) {
  const grouped = groupEndpointsByTag(endpoints);

  const handleBulkToggle = (tagEndpoints: ParsedEndpoint[]) => {
    const allAllowed = tagEndpoints.every((ep) => permissions[ep.id]);
    for (const ep of tagEndpoints) {
      onChange(ep.id, !allAllowed);
    }
  };

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([tag, eps]) => {
        const allAllowed = eps.every((ep) => permissions[ep.id]);

        return (
          <div key={tag}>
            {/* Tag header with bulk toggle */}
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-light">
                {tag}
              </h4>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleBulkToggle(eps)}
                  className="text-xs font-medium text-primary transition-colors hover:text-primary-light"
                >
                  {allAllowed ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            {/* Endpoint rows */}
            <div className="space-y-1">
              {eps.map((ep) => {
                const isAllowed = !!permissions[ep.id];

                return (
                  <label
                    key={ep.id}
                    className={`flex items-center gap-3 rounded-lg border border-border-light bg-white px-4 py-2.5 transition-opacity ${
                      isAllowed ? "" : "opacity-50"
                    } ${readOnly ? "" : "cursor-pointer hover:border-primary/30"}`}
                  >
                    <input
                      type="checkbox"
                      checked={isAllowed}
                      onChange={(e) => onChange(ep.id, e.target.checked)}
                      disabled={readOnly}
                      className="h-4 w-4 rounded border-border text-primary accent-primary"
                    />
                    <span
                      className={`inline-block w-16 rounded-pill px-2 py-0.5 text-center text-xs font-bold uppercase ${
                        METHOD_COLORS[ep.method] ??
                        "bg-text-light/10 text-text-light"
                      }`}
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
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
