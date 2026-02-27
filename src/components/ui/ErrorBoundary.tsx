import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-cream">
          <h1 className="mb-2 font-heading text-2xl font-bold text-error">
            Something went wrong
          </h1>
          <p className="mb-6 max-w-md text-center text-text-light">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-pill bg-primary px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-text-on-primary transition-colors hover:bg-primary-light"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
