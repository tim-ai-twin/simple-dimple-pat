import { useCallback, useRef, useState } from "react";

interface SpecUploadProps {
  onSpecLoaded: (content: string, filename: string) => void;
}

interface LoadedFile {
  name: string;
  size: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = ".yaml,.yml,.json";

export default function SpecUpload({ onSpecLoaded }: SpecUploadProps) {
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();

      reader.onload = () => {
        const content = reader.result as string;
        setLoadedFile({ name: file.name, size: file.size });
        onSpecLoaded(content, file.name);
      };

      reader.onerror = () => {
        setError(`Failed to read file: ${file.name}`);
        setLoadedFile(null);
      };

      reader.readAsText(file);
    },
    [onSpecLoaded],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-cream hover:border-primary"
        }`}
      >
        <svg
          className="mb-3 h-8 w-8 text-text-light"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-text-light">
          Drop OpenAPI spec file here or click to browse
        </p>
        <p className="mt-1 text-xs text-disabled">.yaml, .yml, .json</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {loadedFile && (
        <div className="mt-3 flex items-center gap-2 rounded-pill border border-border-light bg-cream px-4 py-2">
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
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-medium text-text">
            {loadedFile.name}
          </span>
          <span className="text-xs text-text-light">
            ({formatFileSize(loadedFile.size)})
          </span>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-pill border border-error/30 bg-error/5 px-4 py-2">
          <svg
            className="h-4 w-4 text-error"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span className="text-sm text-error">{error}</span>
        </div>
      )}
    </div>
  );
}
