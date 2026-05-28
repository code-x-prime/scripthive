export const CardSkeleton = ({ count = 1 }: { count?: number }) => (
  <div className="animate-pulse space-y-4">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-5 w-3/4 rounded bg-slate-100" />
        <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);
