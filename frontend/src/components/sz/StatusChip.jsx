import { cn } from "@/lib/utils";
import { STATUS_TONE, label } from "@/lib/labels";

const TONES = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
};

export function StatusChip({ status, className }) {
  const tone = STATUS_TONE[status] || "slate";
  return (
    <span data-testid={`status-chip-${status}`}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", `bg-current opacity-70`)} />
      {label(status)}
    </span>
  );
}
