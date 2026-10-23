export default function ModuleLoading() {
  return <div className="space-y-5" role="status" aria-label="Loading clinic records">
    <div className="h-9 w-52 animate-pulse rounded-xl bg-slate-200"/>
    <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100"/>
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 h-10 w-full animate-pulse rounded-lg bg-slate-100"/>
      {[0,1,2,3].map(row=><div key={row} className="mb-3 h-12 animate-pulse rounded-lg bg-slate-50"/>)}
    </div>
  </div>;
}
