import { cn } from "@/lib/utils";

// Rakatin brand logo — uses the official logo asset, shown in full without any frame.
export function Logo({ className, iconOnly = false, light = false, classNameImg }) {
  if (iconOnly) {
    return (
      <img src="/rakatin-mark.png" alt="Rakatin"
        className={cn("h-9 w-9 object-contain", classNameImg, className)}
        data-testid="nav-brand-logo" />
    );
  }
  return (
    <img src="/rakatin-logo.png" alt="Rakatin"
      className={cn("h-10 w-auto object-contain", classNameImg, className)}
      data-testid="nav-brand-logo" />
  );
}
