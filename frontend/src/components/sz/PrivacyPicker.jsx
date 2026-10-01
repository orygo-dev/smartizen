import { Globe2, Users, Home } from "lucide-react";
import { PRIVACY_OPTIONS } from "@/lib/content";
import { cn } from "@/lib/utils";

const ICONS = { RT: Home, VILLAGE: Globe2, FOLLOWERS: Users };

export function PrivacyPicker({ value, onChange, testPrefix = "privacy" }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-500">Siapa yang bisa melihat?</p>
      <div className="grid grid-cols-3 gap-2">
        {PRIVACY_OPTIONS.map((p) => {
          const Icon = ICONS[p.v];
          return (
            <button key={p.v} type="button" onClick={() => onChange(p.v)} data-testid={`${testPrefix}-${p.v.toLowerCase()}`}
              className={cn("flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors",
                value === p.v ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" : "border-slate-200 text-slate-500 dark:border-slate-700")}>
              <Icon className="h-4 w-4" /> {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
