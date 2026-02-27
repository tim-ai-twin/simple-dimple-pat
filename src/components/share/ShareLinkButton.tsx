import { useState, useMemo } from "react";
import { encodeShareLink } from "../../lib/share-link";
import type { ShareTemplate } from "../../../shared/types";

interface ShareLinkButtonProps {
  tokenId: string;
  permissions: ShareTemplate["endpoint_permissions"];
  constraints: ShareTemplate["parameter_constraints"];
  specReference: string;
}

export default function ShareLinkButton({
  permissions,
  constraints,
  specReference,
}: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const encoded = encodeShareLink(permissions, constraints, specReference);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/share#${encoded}`;
  }, [permissions, constraints, specReference]);

  // Shortened preview: show first ~60 chars with ellipsis
  const urlPreview = useMemo(() => {
    if (shareUrl.length <= 60) return shareUrl;
    return shareUrl.slice(0, 57) + "...";
  }, [shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-pill border border-primary px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-text-on-primary"
      >
        {copied ? "Copied!" : "Copy Share Link"}
      </button>

      <div className="rounded-lg border border-border-light bg-white px-3 py-2">
        <p className="break-all font-mono text-xs text-text-light">
          {urlPreview}
        </p>
      </div>
    </div>
  );
}
