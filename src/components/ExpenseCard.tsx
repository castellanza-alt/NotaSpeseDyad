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

  let rawFormatted = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  if ((expense.total || 0) >= 1000 && !rawFormatted.includes(".")) {
      rawFormatted = rawFormatted.replace(/\s/g, '.'); 
  }

  const [integerPart, decimalPart] = rawFormatted.split(",");
  const Icon = getCategoryIcon(expense.category);
  const isIncome = expense.category?.toLowerCase() === "entrate" || (expense.total || 0) < 0; 

  // Random transformations based on ID
  const { rotation, offsetX } = useMemo(() => {
    const seed = expense.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rand = Math.sin(seed) * 10000;
    const randomValue = rand - Math.floor(rand);
    
    return {
      rotation: (randomValue * 6) - 3, // -3 to +3 degrees
      offsetX: (randomValue * 40) - 20 // -20px to +20px drift
    };
  }, [expense.id]);

  return (
    <div
      onClick={onClick}
      style={{ 
        transform: `rotate(${rotation}deg) translateX(${offsetX}px)`,
        width: '90%' // Reduced width to allow drift
      }}
      className={cn(
        "organic-card group relative flex flex-col p-6 mx-auto",
        "rounded-[1.75rem] cursor-pointer mb-2",
        "min-h-[160px]", // Stable height
        className
      )}
    >
      {/* TOP: Header Row */}
      <div className="flex items-start justify-between w-full mb-4">
        {/* Top-Left Icon */}
        <div className="w-10 h-10 rounded-full bg-[#E8E4D5] dark:bg-muted flex items-center justify-center text-olive dark:text-foreground shadow-sm">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
        
        {/* Date on Top Right (Optional balance) */}
        <span className="text-xs font-medium text-muted-foreground mt-1">
          {dateFormatted}
        </span>
      </div>

      {/* MIDDLE: Merchant Name */}
      <div className="flex-1 w-full mb-4">
        <h3 className="text-lg font-bold text-coffee dark:text-foreground leading-tight line-clamp-2">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 block">
          {expense.category || "Generale"}
        </span>
      </div>

      {/* BOTTOM: Hero Price (Right Aligned) */}
      <div className="mt-auto w-full text-right">
        <div className={cn(
          "font-black tracking-tight flex items-baseline justify-end gap-0.5",
          isIncome ? "text-olive" : "text-coffee dark:text-foreground"
        )}>
          {/* Main Number */}
          <span className="text-4xl">{integerPart}</span>
          {/* Decimal */}
          <span className="text-xl opacity-60">,{decimalPart}</span>
          <span className="text-xl opacity-60 font-bold ml-1">€</span>
        </div>
      </div>
    </div>
  );
}