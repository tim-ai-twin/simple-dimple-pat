interface SidebarProps {
  onSelect?: (type: string, id: string) => void;
  onAddApi?: () => void;
  selectedId?: string | null;
}

export default function Sidebar({ onAddApi }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border-light bg-cream">
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-sm text-text-light">No APIs registered yet.</p>
      </div>
      <div className="border-t border-border-light p-4">
        <button
          onClick={onAddApi}
          className="w-full rounded-pill border border-primary py-2 text-sm font-semibold uppercase tracking-wider text-primary hover:bg-primary hover:text-text-on-primary transition-colors"
        >
          + Add API
        </button>
      </div>
    </aside>
  );
}
