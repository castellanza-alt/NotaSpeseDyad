import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center justify-center w-9 h-9 rounded-full",
        "bg-secondary/80 hover:bg-secondary",
        "transition-all duration-200"
      )}
      aria-label={theme === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro"}
    >
      <Sun className={cn(
        "absolute w-4 h-4 transition-all duration-300",
        theme === "light" 
          ? "opacity-100 rotate-0 scale-100 text-amber-500" 
          : "opacity-0 rotate-90 scale-0"
      )} strokeWidth={1.5} />
      
      <Moon className={cn(
        "absolute w-4 h-4 transition-all duration-300",
        theme === "dark" 
          ? "opacity-100 rotate-0 scale-100 text-primary" 
          : "opacity-0 -rotate-90 scale-0"
      )} strokeWidth={1.5} />
    </button>
  );
}
