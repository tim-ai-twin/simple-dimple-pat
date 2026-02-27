import { supabase } from "../../lib/supabase";

export default function Header() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-light bg-cream px-6">
      <h1 className="font-heading text-xl font-bold text-primary">
        Simple Dimple PAT
      </h1>
      <button
        onClick={handleLogout}
        className="rounded-pill border border-primary px-4 py-1.5 text-sm font-medium uppercase tracking-wider text-primary hover:bg-primary hover:text-text-on-primary transition-colors"
      >
        Logout
      </button>
    </header>
  );
}
