import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { isDemoUser } from "../../lib/demo";

export default function Header() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setIsDemo(isDemoUser(session.user.id));
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-light bg-cream px-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-xl font-bold text-primary">
          Simple Dimple PAT
        </h1>
        {isDemo && (
          <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary-dark">
            Demo Mode — shared account
          </span>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="rounded-pill border border-primary px-4 py-1.5 text-sm font-medium uppercase tracking-wider text-primary hover:bg-primary hover:text-text-on-primary transition-colors"
      >
        Logout
      </button>
    </header>
  );
}
