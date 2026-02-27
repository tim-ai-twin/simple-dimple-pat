import { useState } from "react";

interface ParamConstraintsProps {
  constraints: Record<string, string[]>;
  onChange: (paramName: string, patterns: string[]) => void;
  parameters: Array<{
    name: string;
    in: string;
    type: string;
    required: boolean;
  }>;
  readOnly?: boolean;
}

export default function ParamConstraints({
  constraints,
  onChange,
  parameters,
  readOnly = false,
}: ParamConstraintsProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const handleKeyDown = (
    paramName: string,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const value = (inputValues[paramName] ?? "").trim();
    if (!value) return;

    const existing = constraints[paramName] ?? [];
    if (existing.includes(value)) {
      setInputValues((prev) => ({ ...prev, [paramName]: "" }));
      return;
    }

    onChange(paramName, [...existing, value]);
    setInputValues((prev) => ({ ...prev, [paramName]: "" }));
  };

  const handleRemove = (paramName: string, index: number) => {
    const existing = constraints[paramName] ?? [];
    const updated = existing.filter((_, i) => i !== index);
    onChange(paramName, updated);
  };

  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {parameters.map((param) => {
        const patterns = constraints[param.name] ?? [];

        return (
          <div key={param.name}>
            {/* Parameter name label */}
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-text">
                {param.name}
              </span>
              <span className="text-xs text-text-light">
                ({param.in}, {param.type}
                {param.required ? ", required" : ""})
              </span>
            </div>

            {/* Chips and input */}
            <div className="flex flex-wrap items-center gap-1.5">
              {patterns.map((pattern, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 rounded-pill bg-primary/10 px-3 py-1 text-sm text-primary"
                >
                  <span className="font-mono">{pattern}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemove(param.name, index)}
                      className="ml-0.5 text-primary/60 transition-colors hover:text-primary"
                      aria-label={`Remove pattern ${pattern}`}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </span>
              ))}

              {!readOnly && (
                <input
                  type="text"
                  value={inputValues[param.name] ?? ""}
                  onChange={(e) =>
                    setInputValues((prev) => ({
                      ...prev,
                      [param.name]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => handleKeyDown(param.name, e)}
                  placeholder="Add pattern..."
                  className="min-w-[120px] flex-1 rounded-pill border border-border-light bg-white px-3 py-1 text-sm text-text placeholder:text-disabled focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
