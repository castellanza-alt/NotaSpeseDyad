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

  // STRICT ITALIAN FORMATTING
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
        "chunky-card-3d group relative flex items-center p-6 w-full h-full",
        "rounded-[2rem] cursor-pointer mb-2", 
        // Flex items center + h-full ensures vertical centering in the taller card
        "justify-between", 
        className
      )}
    >
      {/* LEFT: Icon in Circle */}
      <div className="mr-6 shrink-0 flex flex-col justify-center h-full">
        <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-inner ring-1 ring-white/20 transition-transform group-hover:scale-110">
          <Icon className="w-6 h-6" strokeWidth={2} />
        </div>
      </div>

      {/* CENTER: Details (Vertically Centered with spacing) */}
      <div className="flex-1 min-w-0 text-left mr-4 flex flex-col justify-center h-full py-2">
        <h3 className="text-lg font-bold text-foreground leading-snug truncate mb-2">
          {expense.merchant || "Sconosciuto"}
        </h3>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 truncate">
            {expense.category || "Generale"}
          </span>
          <span className="text-xs font-medium text-muted-foreground/60 shrink-0">
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* RIGHT: Hero Price (Vertically Centered) */}
      <div className="shrink-0 text-right flex flex-col justify-center h-full">
        <div className={cn(
          "font-black tracking-tight flex items-baseline justify-end gap-0.5",
          isIncome ? "text-gradient-bronze-rich" : "text-foreground dark:text-white"
        )}>
          {/* Main Number - Larger */}
          <span className="text-3xl">{integerPart}</span>
          <span className="text-lg opacity-60">,{decimalPart}</span>
          <span className="text-lg opacity-60 font-bold ml-1">€</span>
        </div>
      </div>
    </div>
  );
}