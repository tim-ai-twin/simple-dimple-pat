import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import SpecUpload from "./SpecUpload";

interface ReuploadSpecFormProps {
  apiId: string;
  apiName: string;
  onDone: () => void;
}

export default function ReuploadSpecForm({
  apiId,
  apiName,
  onDone,
}: ReuploadSpecFormProps) {
  const queryClient = useQueryClient();
  const [specContent, setSpecContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specContent || submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "parse-spec",
        {
          body: {
            api_id: apiId,
            spec_content: specContent,
          },
        },
      );

      if (fnError) throw new Error(fnError.message || "Failed to re-upload spec");
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["api-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["api-detail", apiId] });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      <h2 className="font-heading text-2xl font-bold text-primary">
        Re-upload Spec
      </h2>
      <p className="text-sm text-text-light">
        Upload a new OpenAPI specification for <strong>{apiName}</strong>. This
        will replace all existing endpoints. Token permissions referencing
        removed endpoints will no longer match.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          New OpenAPI Specification
        </label>
        <SpecUpload
          onSpecLoaded={(content) => setSpecContent(content)}
        />
      </div>

      {error && (
        <div className="rounded-pill border border-error/30 bg-error/5 px-4 py-2 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!specContent || submitting}
          className="rounded-pill bg-primary px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Uploading..." : "Upload Spec"}
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
