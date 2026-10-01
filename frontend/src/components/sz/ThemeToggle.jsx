import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("sz_theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("sz_theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <Button variant="ghost" size="icon" data-testid="theme-toggle-button"
      onClick={() => setDark((d) => !d)} className="rounded-full">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
