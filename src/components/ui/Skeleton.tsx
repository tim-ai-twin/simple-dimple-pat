interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-border-light ${className}`}
    />
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-8 w-full" />
          <div className="ml-6 space-y-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-5 w-1/2" />
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
