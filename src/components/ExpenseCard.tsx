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
  // Use "de-DE" as a base if "it-IT" fails to produce dots in some browsers, but "it-IT" usually works.
  // We force manual verify:
  const rawFormatted = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  // Split integer and decimal for typographic styling
  // e.g. "1.234,56" -> ["1.234", "56"]
  const [integerPart, decimalPart] = rawFormatted.split(",");

  const Icon = getCategoryIcon(expense.category);
  
  // Income vs Expense styling
  const isIncome = expense.category?.toLowerCase() === "entrate" || (expense.total || 0) < 0; 

  return (
    <div
      onClick={onClick}
      className={cn(
        "chunky-card-3d group relative flex flex-col items-center p-8 w-full h-full",
        "rounded-[2.5rem] cursor-pointer", // Extra roundness
        className
      )}
    >
      {/* TOP: Icon in Circle */}
      <div className="mb-6">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-inner ring-1 ring-white/20">
          <Icon className="w-7 h-7" strokeWidth={2} />
        </div>
      </div>

      {/* MIDDLE: Details */}
      <div className="flex-1 w-full text-center space-y-2 mb-8">
        <h3 className="text-xl font-extrabold text-foreground leading-tight line-clamp-2 px-4">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            {expense.category || "Generale"}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* BOTTOM: Hero Price (Huge & Rich) */}
      <div className="mt-auto pt-6 border-t border-dashed border-border/60 w-full text-center">
        <div className={cn(
          "font-black tracking-tighter flex items-baseline justify-center gap-1",
          isIncome ? "text-gradient-bronze-rich" : "text-foreground dark:text-white"
        )}>
          <span className="text-lg opacity-50 font-bold self-start mt-2">€</span>
          {/* Main Number - Huge */}
          <span className="text-5xl">{integerPart}</span>
          {/* Decimal - Smaller */}
          <span className="text-2xl opacity-50">,{decimalPart}</span>
        </div>
      </div>
    </div>
  );
}