import { useMemo, useState, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Expense } from "@/hooks/useExpenses";
import { cn } from "@/lib/utils";
import { Trash2, Pencil } from "lucide-react";

interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function ExpenseCard({ expense, onClick, onDelete, onEdit, className }: ExpenseCardProps) {
  const expenseDate = expense.expense_date ? new Date(expense.expense_date) : null;
  
  // Calendar Widget Data
  const day = expenseDate ? format(expenseDate, "d") : "-";
  const month = expenseDate ? format(expenseDate, "MMM", { locale: it }).replace(".", "") : "";

  // STRICT ITALIAN FORMATTING
  let rawFormatted = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

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

  // Organic Rotation Calculation
  const { rotation, offsetX } = useMemo(() => {
    const seed = expense.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randRot = Math.sin(seed) * 10000;
    const rotVal = (randRot - Math.floor(randRot)) * 6 - 3; // Reduced rotation slightly for swipe stability
    const randX = Math.cos(seed) * 10000;
    const xVal = (randX - Math.floor(randX)) * 20 - 10; // Reduced X offset
    return { rotation: rotVal, offsetX: xVal };
  }, [expense.id]);

  // SWIPE LOGIC
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD = -100; // Amount to swipe to lock open
  const MAX_SWIPE = -160;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartX.current;
    
    // Only allow left swipe
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, MAX_SWIPE));
    } else if (swipeOffset < 0) {
      // Allow closing if already open
      setSwipeOffset(Math.min(diff + SWIPE_THRESHOLD, 0));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset < SWIPE_THRESHOLD / 2) {
      setSwipeOffset(SWIPE_THRESHOLD); // Snap open
    } else {
      setSwipeOffset(0); // Snap close
    }
    touchStartX.current = null;
  };

  const resetSwipe = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSwipeOffset(0);
  };

  return (
    <div className="relative w-full max-w-[90%] mx-auto mb-3 min-h-[175px]">
      
      {/* BACKGROUND ACTIONS (Revealed on Swipe) */}
      <div className="absolute inset-0 flex justify-end items-center px-4 rounded-[2.5rem] bg-transparent">
        <div className="flex gap-3 pl-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(); setSwipeOffset(0); }}
            className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center text-white shadow-lg z-10"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setSwipeOffset(0); }}
            className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg z-10"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* FOREGROUND CARD */}
      <div
        onClick={() => { if(swipeOffset === 0) onClick?.(); else setSwipeOffset(0); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          transform: `rotate(${rotation}deg) translateX(${offsetX + swipeOffset}px)`,
          transition: touchStartX.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        className={cn(
          "chunky-card-3d group relative flex flex-col p-5 w-full h-full", 
          "rounded-[2.5rem] cursor-pointer bg-card z-20",
          className
        )}
      >
        {/* TOP ROW: Title Left, Calendar Right */}
        <div className="flex justify-between items-start w-full mb-1">
          {/* Merchant Title (Left) */}
          <div className="flex-1 pr-4 pt-2">
            <h3 className="text-xl font-extrabold text-foreground leading-tight line-clamp-2 text-left">
              {expense.merchant || "Sconosciuto"}
            </h3>
            {/* Category Pill */}
            <div className="inline-flex items-center justify-center px-2.5 py-1 mt-2 rounded-full bg-secondary/30 border border-border/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {expense.category || "Spesa"}
              </span>
            </div>
          </div>

          {/* Calendar Widget (Moved to TOP RIGHT) */}
          <div className="flex flex-col items-center justify-center w-[60px] h-[60px] rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-white dark:bg-card shrink-0">
              <div className="w-full h-6 bg-red-600 dark:bg-red-900 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white uppercase tracking-wider leading-none mt-0.5">
                      {month}
                  </span>
              </div>
              <div className="w-full flex-1 flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-foreground leading-none -mt-1">
                      {day}
                  </span>
              </div>
          </div>
        </div>

        {/* BOTTOM RIGHT: Solid Flat Price */}
        <div className="flex-1 flex items-end justify-end mt-4">
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
    </div>
  );
}