import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const LEVELS = [
  { key: "PROVINCE", label: "Provinsi" },
  { key: "REGENCY", label: "Kabupaten / Kota" },
  { key: "DISTRICT", label: "Kecamatan" },
  { key: "VILLAGE", label: "Kelurahan / Desa" },
  { key: "RW", label: "RW" },
  { key: "RT", label: "RT" },
];

// Cascading region selector. `until` = deepest level to pick (default RT).
export function RegionPicker({ value, onChange, until = "RT" }) {
  const stop = LEVELS.findIndex((l) => l.key === until);
  const levels = LEVELS.slice(0, stop + 1);
  const [options, setOptions] = useState({});
  const [selected, setSelected] = useState(value || {});

  useEffect(() => {
    api.get("/regions", { params: { level: "PROVINCE" } }).then(({ data }) => {
      setOptions((o) => ({ ...o, PROVINCE: data }));
    });
  }, []);

  const loadChildren = async (parentLevel, parentId, childLevel) => {
    const { data } = await api.get("/regions", { params: { level: childLevel, parent_id: parentId } });
    setOptions((o) => ({ ...o, [childLevel]: data }));
  };

  const handleSelect = async (levelKey, id, idx) => {
    const next = { ...selected };
    levels.forEach((l, i) => { if (i >= idx) delete next[l.key]; });
    next[levelKey] = id;
    // clear deeper options
    const cleared = { ...options };
    levels.forEach((l, i) => { if (i > idx) delete cleared[l.key]; });
    setOptions(cleared);
    setSelected(next);
    onChange?.(next);
    const childLevel = levels[idx + 1]?.key;
    if (childLevel) await loadChildren(levelKey, id, childLevel);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {levels.map((lvl, idx) => {
        const disabled = idx > 0 && !selected[levels[idx - 1].key];
        const opts = options[lvl.key] || [];
        return (
          <div key={lvl.key}>
            <Label className="text-xs font-semibold text-slate-500">{lvl.label}</Label>
            <Select value={selected[lvl.key] || ""} disabled={disabled}
              onValueChange={(v) => handleSelect(lvl.key, v, idx)}>
              <SelectTrigger data-testid={`region-select-${lvl.key.toLowerCase()}`} className="mt-1 rounded-xl">
                <SelectValue placeholder={disabled ? "Pilih sebelumnya dulu" : `Pilih ${lvl.label}`} />
              </SelectTrigger>
              <SelectContent>
                {opts.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}{r.level === "RT" && r.status === "UNCLAIMED" ? " (Belum bergabung)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
