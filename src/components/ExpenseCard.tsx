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
  // Force manual replacement if locale fails or just to be 100% sure
  let rawFormatted = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  // Verify dot presence for thousands > 999
  if ((expense.total || 0) >= 1000 && !rawFormatted.includes(".")) {
      rawFormatted = rawFormatted.replace(/\s/g, '.'); 
  }

  // Split integer and decimal for typographic styling
  const [integerPart, decimalPart] = rawFormatted.split(",");

  const Icon = getCategoryIcon(expense.category);
  const isIncome = expense.category?.toLowerCase() === "entrate" || (expense.total || 0) < 0; 

  // Random rotation between -3 and 3 degrees.
  const rotation = useMemo(() => {
    const seed = expense.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rand = Math.sin(seed) * 10000;
    const randomValue = rand - Math.floor(rand); // 0 to 1
    return (randomValue * 6) - 3;
  }, [expense.id]);

  return (
    <div
      onClick={onClick}
      style={{ transform: `rotate(${rotation}deg)` }}
      className={cn(
        "chunky-card-3d group relative flex flex-col justify-between w-full h-full",
        "rounded-[2.5rem] cursor-pointer", // Extra roundness
        "p-6", // 24px padding
        className
      )}
    >
      {/* TOP: Icon (Left Aligned) */}
      <div className="w-full flex justify-start">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-inner ring-1 ring-white/20 transition-transform group-hover:scale-110">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
      </div>

      {/* CENTER: Details (Centered Block) */}
      <div className="flex-1 flex flex-col justify-center items-center text-center py-2 space-y-1">
        <h3 className="text-xl font-extrabold text-foreground leading-tight line-clamp-2 px-2">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5">
            {expense.category || "Generale"}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* BOTTOM: Hero Price (Right Aligned or Bottom Aligned) */}
      <div className="w-full flex justify-end items-end pt-4 border-t border-dashed border-border/40">
        <div className={cn(
          "font-black tracking-tighter flex items-baseline gap-1",
          isIncome ? "text-gradient-bronze-rich" : "text-foreground dark:text-white"
        )}>
          {/* Main Number - Huge */}
          <span className="text-4xl">{integerPart}</span>
          {/* Decimal - Smaller */}
          <span className="text-xl opacity-60">,{decimalPart}</span>
          <span className="text-xl opacity-60 font-bold">€</span>
        </div>
      </div>
    </div>
  );
}