import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import DashboardPage from "./pages/DashboardPage";
import SharePage from "./pages/SharePage";
import { DEMO_USER_EMAIL, DEMO_USER_PASSWORD } from "./lib/demo";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <p className="text-text-light">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function LoginPage() {
  const [demoLoading, setDemoLoading] = useState(false);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      await supabase.auth.signInWithPassword({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
      });
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-cream">
      <h1 className="mb-2 font-heading text-4xl font-bold text-primary">
        Simple Dimple PAT
      </h1>
      <p className="mb-8 text-text-light">
        Personal Token Management for AI Agents
      </p>
      <button
        onClick={handleLogin}
        className="rounded-pill bg-primary px-8 py-3 font-semibold uppercase tracking-wider text-text-on-primary hover:bg-primary-light transition-colors"
      >
        Sign in with Google
      </button>
      <button
        onClick={handleDemoLogin}
        disabled={demoLoading}
        className="mt-4 rounded-pill border border-primary px-8 py-3 font-semibold uppercase tracking-wider text-primary hover:bg-primary hover:text-text-on-primary transition-colors disabled:opacity-50"
      >
        {demoLoading ? "Signing in..." : "Demo Account"}
      </button>
    </div>
  );
}

function PrototypeBanner() {
  return (
    <div className="bg-warning/90 px-4 py-2 text-center text-sm font-semibold text-white">
      THIS IS A PROTOTYPE. DO NOT INPUT REAL API KEYS!
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PrototypeBanner />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthGuard>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/share" element={<SharePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthGuard>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
