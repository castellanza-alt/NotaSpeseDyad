import { useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Expense } from "@/hooks/useExpenses";
import { cn } from "@/lib/utils";

interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
  className?: string;
}

export function ExpenseCard({ expense, onClick, className }: ExpenseCardProps) {
  const expenseDate = expense.expense_date ? new Date(expense.expense_date) : null;
  
  // Calendar Widget Data
  const day = expenseDate ? format(expenseDate, "d") : "-";
  const month = expenseDate ? format(expenseDate, "MMM", { locale: it }).replace(".", "") : "";

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
      {/* TOP ROW: Large Calendar Widget (Left) */}
      <div className="flex justify-start items-start w-full mb-2">
        {/* 
           Calendar Widget
           Size: ~72px (Double the previous size)
           Style: Classic Calendar (Red/Bordeaux Header)
        */}
        <div className="flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-white dark:bg-card">
            {/* Header: Month */}
            <div className="w-full h-7 bg-red-600 dark:bg-red-900 flex items-center justify-center">
                <span className="text-[11px] font-black text-white uppercase tracking-wider leading-none mt-0.5">
                    {month}
                </span>
            </div>
            {/* Body: Day */}
            <div className="w-full flex-1 flex items-center justify-center">
                <span className="text-3xl font-extrabold text-foreground leading-none -mt-1">
                    {day}
                </span>
            </div>
        </div>
      </div>

      {/* CENTER: Text Content (Merchant & Category) */}
      <div className="flex-1 flex flex-col items-center justify-center w-full space-y-1 -mt-6">
        <h3 className="text-lg font-extrabold text-foreground leading-snug text-center line-clamp-2 px-2">
          {expense.merchant || "Sconosciuto"}
        </h3>
        
        {/* Category Pill */}
        <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-secondary/30 border border-border/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            {expense.category || "Altri Costi"}
          </span>
        </div>
      </div>

      {/* BOTTOM RIGHT: Solid Flat Price */}
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