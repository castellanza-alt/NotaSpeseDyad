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
    ? format(expenseDate, "d MMM yyyy", { locale: it })
    : "Data sconosciuta";

  // Strict Italian Formatting: 1.234,56
  const formattedTotal = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  // Split integer and decimal for typographic styling
  const [integerPart, decimalPart] = formattedTotal.split(",");

  const Icon = getCategoryIcon(expense.category);
  
  // Check if it's "Entrate" (Income) for Bronze styling, otherwise Slate Green
  const isIncome = expense.category?.toLowerCase() === "entrate" || (expense.total || 0) < 0; // Fallback logic

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center p-5 bg-card rounded-[2rem] w-full",
        "border border-border/60 shadow-sm transition-all duration-300",
        "active:scale-95 hover:shadow-md",
        className
      )}
    >
      {/* TOP: Icon in Circle */}
      <div className="mb-4">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-sm ring-4 ring-background">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
      </div>

      {/* MIDDLE: Details */}
      <div className="flex-1 w-full text-center space-y-1 mb-6">
        <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            {expense.category || "Generale"}
          </span>
          <span className="text-xs font-medium text-muted-foreground/60">
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* BOTTOM: Hero Price */}
      <div className="mt-auto pt-4 border-t border-border/40 w-full text-center">
        <div className={cn(
          "font-black tracking-tight flex items-baseline justify-center gap-0.5",
          isIncome ? "text-gradient-bronze" : "text-foreground dark:text-white"
        )}>
          <span className="text-sm opacity-60 font-bold self-start mt-1">€</span>
          <span className="text-3xl">{integerPart}</span>
          <span className="text-lg opacity-60">,{decimalPart}</span>
        </div>
      </div>
    </div>
  );
}