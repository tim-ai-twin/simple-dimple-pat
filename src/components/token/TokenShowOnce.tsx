import { useState } from "react";

interface TokenShowOnceProps {
  rawToken: string;
  onDismiss: () => void;
}

export default function TokenShowOnce({
  rawToken,
  onDismiss,
}: TokenShowOnceProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/50"
        onClick={onDismiss}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-lg rounded-xl border border-border bg-cream p-6 shadow-lg">
        <h2 className="font-heading text-xl font-bold text-primary">
          Token Created
        </h2>

        <p className="mt-3 text-sm text-text">
          Your new access token is shown below. Copy it now and store it
          somewhere safe.
        </p>

        {/* Token display box */}
        <div className="mt-4 rounded-lg border border-border-light bg-white p-4">
          <code className="block break-all font-mono text-sm text-text">
            {rawToken}
          </code>
        </div>

        {/* Warning */}
        <p className="mt-3 text-sm font-semibold text-error">
          This token will not be shown again. Copy it now.
        </p>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="rounded-pill bg-primary px-5 py-2 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onDismiss}
            className="rounded-pill border border-border px-5 py-2 text-sm font-medium text-text-light transition-colors hover:border-primary hover:text-primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
