import { cn } from "@/lib/utils";

export function StatCard({ icon: Icon, label, value, hint, tone = "sky", testId }) {
  const tones = {
    sky: "from-sky-500 to-blue-600", cyan: "from-cyan-500 to-sky-600",
    teal: "from-teal-500 to-emerald-600", emerald: "from-emerald-500 to-green-600",
    amber: "from-amber-500 to-orange-500", rose: "from-rose-500 to-pink-600",
    violet: "from-violet-500 to-purple-600",
  };
  return (
    <div data-testid={testId}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
