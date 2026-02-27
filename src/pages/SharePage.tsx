import { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import ShareLandingPage from "../components/share/ShareLandingPage";
import Header from "../components/layout/Header";

/**
 * Route component mounted at /share.
 * Reads the URL fragment (hash), enforces authentication,
 * and renders the ShareLandingPage with the decoded template.
 */
export default function SharePage() {
  const location = useLocation();
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

  // Extract hash from the URL (strip leading #)
  const hash = location.hash.startsWith("#")
    ? location.hash.slice(1)
    : location.hash;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <p className="text-text-light">Loading...</p>
      </div>
    );
  }

  // Auth guard: must be logged in to use a share link
  if (!session) {
    // Store the current URL so we can redirect back after login
    const returnUrl = `/share${location.hash}`;
    return <Navigate to={`/?returnTo=${encodeURIComponent(returnUrl)}`} replace />;
  }

  if (!hash) {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold text-error">
              Missing Share Data
            </h2>
            <p className="mt-2 text-sm text-text-light">
              No share link data found in the URL. Please use a valid share
              link.
            </p>
            <a
              href="/"
              className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-light"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto bg-cream p-8">
        <ShareLandingPage hash={hash} />
      </div>
    </div>
  );
}
