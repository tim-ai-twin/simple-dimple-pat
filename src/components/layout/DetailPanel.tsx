interface DetailPanelProps {
  children?: React.ReactNode;
}

export default function DetailPanel({ children }: DetailPanelProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-cream p-6">
      {children ?? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold text-primary mb-2">
              Welcome to Simple Dimple PAT
            </h2>
            <p className="text-text-light">
              Add an API to get started managing tokens for your AI agents.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
