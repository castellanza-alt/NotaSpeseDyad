import { useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Expense } from "@/hooks/useExpenses";
import { Utensils, Car, ShoppingBag, Briefcase, Receipt, Coffee, Zap, Home, Plane, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
  className?: string;
}

const categoryIcons: Record<string, LucideIcon> = {
  "Ristorazione": Utensils,
  "Cibo": Utensils,
  "Trasporti": Car,
  "Auto": Car,
  "Benzina": Car,
  "Shopping": ShoppingBag,
  "Lavoro": Briefcase,
  "Ufficio": Briefcase,
  "Bar": Coffee,
  "Utenze": Zap,
  "Casa": Home,
  "Viaggi": Plane,
  "Regali": Gift
};

function getCategoryIcon(category: string | null): LucideIcon {
  if (!category) return Receipt;
  const key = Object.keys(categoryIcons).find(k => category.toLowerCase().includes(k.toLowerCase()));
  return key ? categoryIcons[key] : Receipt;
}

export function ExpenseCard({ expense, onClick, className }: ExpenseCardProps) {
  const expenseDate = expense.expense_date ? new Date(expense.expense_date) : null;
  
  const dateFormatted = expenseDate 
    ? format(expenseDate, "d MMM", { locale: it })
    : "Data sconosciuta";

  // STRICT ITALIAN FORMATTING: 1.234,56
  // Force manual replacement if locale fails or just to be 100% sure
  let rawFormatted = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  // Verify dot presence for thousands > 999
  if ((expense.total || 0) >= 1000 && !rawFormatted.includes(".")) {
      // Fallback: replace space or comma used as thousand separator with dot
      // This is a naive fix, strictly relying on toLocaleString is better usually, 
      // but the user demanded dots.
      // Let's trust "it-IT" but ensure we aren't getting space separators.
      rawFormatted = rawFormatted.replace(/\s/g, '.'); 
  }

  // Split integer and decimal for typographic styling
  const [integerPart, decimalPart] = rawFormatted.split(",");

  const Icon = getCategoryIcon(expense.category);
  const isIncome = expense.category?.toLowerCase() === "entrate" || (expense.total || 0) < 0; 

  // Random rotation between -3 and 3 degrees. 
  // We use useMemo with the expense ID to keep it stable across renders.
  const rotation = useMemo(() => {
    // Deterministic pseudo-random based on ID char codes
    const seed = expense.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rand = Math.sin(seed) * 10000;
    const randomValue = rand - Math.floor(rand); // 0 to 1
    // Map 0..1 to -3..3
    return (randomValue * 6) - 3;
  }, [expense.id]);

  return (
    <div
      onClick={onClick}
      style={{ transform: `rotate(${rotation}deg)` }}
      className={cn(
        "chunky-card-3d group relative flex items-center p-5 w-full",
        "rounded-[1.5rem] cursor-pointer mb-2", // Compact roundness
        "min-h-[110px]", // Reduced height for 2.5 rule
        className
      )}
    >
      {/* LEFT: Icon in Circle (Smaller) */}
      <div className="mr-5 shrink-0">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-inner ring-1 ring-white/20">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
      </div>

      {/* CENTER: Details (Name & Category close) */}
      <div className="flex-1 min-w-0 text-left mr-4">
        <h3 className="text-base font-bold text-foreground leading-snug truncate">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 truncate">
            {expense.category || "Generale"}
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="text-xs font-medium text-muted-foreground/60 shrink-0">
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* RIGHT: Hero Price (Proportioned) */}
      <div className="shrink-0 text-right">
        <div className={cn(
          "font-black tracking-tight flex items-baseline justify-end gap-0.5",
          isIncome ? "text-gradient-bronze-rich" : "text-foreground dark:text-white"
        )}>
          {/* Main Number - Large but fit */}
          <span className="text-2xl">{integerPart}</span>
          {/* Decimal - Small */}
          <span className="text-sm opacity-60">,{decimalPart}</span>
          <span className="text-sm opacity-60 font-bold ml-0.5">€</span>
        </div>
      </div>
    </div>
  );
}