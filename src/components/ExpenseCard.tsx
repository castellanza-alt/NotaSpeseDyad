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

// MANDATORY BUSINESS LOGIC CATEGORIES
// Mapped to available Lucide icons
const categoryIcons: Record<string, LucideIcon> = {
  "Vitto Oltre Comune": Utensils,
  "Alloggio Oltre Comune": Home,
  "Vitto Estero": Utensils,
  "Alloggio Estero": Home,
  "Vitto Comune": Utensils,
  "Alloggio Comune": Home,
  "Taxi": Car,
  "Spese trasporti": Car,
  "Spese Rappresentanza": Briefcase,
  "Altri Costi": Receipt
};

function getCategoryIcon(category: string | null): LucideIcon {
  if (!category) return Receipt;
  
  // Exact match attempt first
  if (categoryIcons[category]) {
    return categoryIcons[category];
  }

  // Fallback for legacy data or partial matches
  const key = Object.keys(categoryIcons).find(k => category.toLowerCase().includes(k.toLowerCase()));
  return key ? categoryIcons[key] : Receipt;
}

export function ExpenseCard({ expense, onClick, className }: ExpenseCardProps) {
  const expenseDate = expense.expense_date ? new Date(expense.expense_date) : null;
  
  const dateFormatted = expenseDate 
    ? format(expenseDate, "d MMMM yyyy", { locale: it })
    : "Data sconosciuta";

  // STRICT ITALIAN FORMATTING: 1.234,56
  let rawFormatted = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  // Manual override if system formatting fails on thousands
  if ((expense.total || 0) >= 1000 && !rawFormatted.includes(".")) {
      const parts = rawFormatted.split(",");
      parts[0] = parts[0].replace(/\s/g, "."); 
      if (!parts[0].includes(".")) {
         parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      }
      rawFormatted = parts.join(",");
  }
  rawFormatted = rawFormatted.replace(/\s/g, ".");
  
  const [integerPart, decimalPart] = rawFormatted.split(",");

  const Icon = getCategoryIcon(expense.category);
  // Income if negative (refund) or tagged 'Entrate' (though not in strict list, handling gracefully)
  const isIncome = (expense.total || 0) < 0; 

  // MEANDERING LAYOUT & ORGANIC ROTATION (+/- 5deg)
  const { rotation, offsetX } = useMemo(() => {
    const seed = expense.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Rotation: -5 to +5 deg
    const randRot = Math.sin(seed) * 10000;
    const rotVal = (randRot - Math.floor(randRot)) * 10 - 5;
    
    // Horizontal Offset: -25px to +25px (Meandering)
    const randX = Math.cos(seed) * 10000;
    const xVal = (randX - Math.floor(randX)) * 50 - 25;

    return { rotation: rotVal, offsetX: xVal };
  }, [expense.id]);

  return (
    <div
      onClick={onClick}
      style={{ 
        transform: `rotate(${rotation}deg) translateX(${offsetX}px)` 
      }}
      className={cn(
        "chunky-card-3d group relative flex flex-col p-5 w-full max-w-[90%]", 
        "rounded-[2.5rem] cursor-pointer mb-3 mx-auto",
        "min-h-[175px]",
        className
      )}
    >
      {/* TOP LEFT: Solid Anchor for Icon */}
      <div className="self-start mb-2">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-sm ring-1 ring-white/20">
          <Icon className="w-5 h-5" strokeWidth={2.5} />
        </div>
      </div>

      {/* CENTER: Text Content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full space-y-1">
        <h3 className="text-lg font-extrabold text-foreground leading-snug text-center line-clamp-2 px-2">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            {expense.category || "Altri Costi"}
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="text-xs font-medium text-muted-foreground/60">
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* BOTTOM RIGHT: Solid Flat Price (No Metallic) */}
      <div className="self-end mt-2">
        <div className={cn(
          "font-black tracking-tighter flex items-baseline gap-1",
          isIncome ? "text-emerald-500" : "text-price-solid"
        )}>
          <span className="text-4xl">{integerPart}</span>
          <span className="text-xl opacity-60">,{decimalPart}</span>
          <span className="text-lg opacity-60 font-bold ml-0.5">€</span>
        </div>
      </div>
    </div>
  );
}