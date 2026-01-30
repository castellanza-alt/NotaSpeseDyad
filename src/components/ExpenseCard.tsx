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
    ? format(expenseDate, "d MMMM yyyy", { locale: it })
    : "Data sconosciuta";

  // STRICT ITALIAN FORMATTING: 1.234,56
  // We force manual verification for dot separator
  let rawFormatted = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  // Verify dot presence for thousands > 999
  if ((expense.total || 0) >= 1000 && !rawFormatted.includes(".")) {
      // Manual formatting if system fails
      const parts = rawFormatted.split(",");
      parts[0] = parts[0].replace(/\s/g, "."); // replace spaces
      // If no spaces were there but it needs dots (e.g. 1000,00 -> 1.000,00)
      if (!parts[0].includes(".")) {
         parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      }
      rawFormatted = parts.join(",");
  }
  
  // Double check spaces
  rawFormatted = rawFormatted.replace(/\s/g, ".");

  // Split integer and decimal for typographic styling
  const [integerPart, decimalPart] = rawFormatted.split(",");

  const Icon = getCategoryIcon(expense.category);
  const isIncome = expense.category?.toLowerCase() === "entrate" || (expense.total || 0) < 0; 

  // Random rotation between -3 and 3 degrees
  const rotation = useMemo(() => {
    const seed = expense.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rand = Math.sin(seed) * 10000;
    const randomValue = rand - Math.floor(rand);
    return (randomValue * 6) - 3;
  }, [expense.id]);

  return (
    <div
      onClick={onClick}
      style={{ transform: `rotate(${rotation}deg)` }}
      className={cn(
        "chunky-card-3d group relative flex flex-col p-5 w-full",
        "rounded-[2.5rem] cursor-pointer mb-2",
        "min-h-[175px]", // 175% height approx
        className
      )}
    >
      {/* TOP LEFT: Icon */}
      <div className="self-start mb-2">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-sm ring-1 ring-white/10">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
      </div>

      {/* CENTER: Text Content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full space-y-1">
        <h3 className="text-lg font-extrabold text-foreground leading-snug text-center line-clamp-2 px-2">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            {expense.category || "Generale"}
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="text-xs font-medium text-muted-foreground/60">
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* BOTTOM RIGHT: Hero Price */}
      <div className="self-end mt-2">
        <div className={cn(
          "font-black tracking-tighter flex items-baseline gap-1",
          isIncome ? "text-gradient-bronze-rich" : "text-foreground dark:text-white"
        )}>
          {/* Main Number - Huge */}
          <span className="text-4xl">{integerPart}</span>
          {/* Decimal - Smaller */}
          <span className="text-xl opacity-60">,{decimalPart}</span>
          <span className="text-lg opacity-60 font-bold ml-0.5">€</span>
        </div>
      </div>
    </div>
  );
}