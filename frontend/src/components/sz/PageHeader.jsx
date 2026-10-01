import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action, testId }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4" data-testid={testId}>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, action, children, className }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
