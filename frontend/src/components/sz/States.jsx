import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction, testId, className }) {
  return (
    <div data-testid={testId || "empty-state"}
      className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40", className)}>
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-sky-100 to-teal-100 dark:from-sky-500/10 dark:to-teal-500/10">
        <Icon className="h-7 w-7 text-sky-600 dark:text-sky-400" />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {actionLabel && (
        <Button data-testid="empty-state-action" onClick={onAction} className="mt-5 rounded-full sz-gradient text-white">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function Loading({ rows = 3 }) {
  return (
    <div className="space-y-3" data-testid="loading-state">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div data-testid="error-state" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-500/20 dark:bg-rose-500/10">
      <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{message || "Gagal memuat data."}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-3 rounded-full" data-testid="error-retry-button">
          Coba Lagi
        </Button>
      )}
    </div>
  );
}
