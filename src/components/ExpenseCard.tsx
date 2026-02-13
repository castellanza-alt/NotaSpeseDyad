import { useMemo, useState, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Expense } from "@/hooks/useExpenses";
import { cn } from "@/lib/utils";
import { Trash2, Pencil, Eye, Check, X } from "lucide-react";

interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function ExpenseCard({ expense, onClick, onDelete, onEdit, className }: ExpenseCardProps) {
  const expenseDate = expense.date ? new Date(expense.date) : null;
  
  // Calendar Widget Data
  const day = expenseDate ? format(expenseDate, "d") : "-";
  const month = expenseDate ? format(expenseDate, "MMM", { locale: it }).replace(".", "") : "";

  // STRICT ITALIAN FORMATTING
  let rawFormatted = expense.amount?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  if ((expense.amount || 0) >= 1000 && !rawFormatted.includes(".")) {
      const parts = rawFormatted.split(",");
      parts[0] = parts[0].replace(/\s/g, "."); 
      if (!parts[0].includes(".")) {
         parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      }
      rawFormatted = parts.join(",");
  }
  rawFormatted = rawFormatted.replace(/\s/g, ".");
  
  const [integerPart, decimalPart] = rawFormatted.split(",");
  const isIncome = (expense.amount || 0) < 0; 

  // Organic Rotation Calculation
  const { rotation, offsetX } = useMemo(() => {
    const seed = expense.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randRot = Math.sin(seed) * 10000;
    const rotVal = (randRot - Math.floor(randRot)) * 6 - 3; 
    const randX = Math.cos(seed) * 10000;
    const xVal = (randX - Math.floor(randX)) * 20 - 10; 
    return { rotation: rotVal, offsetX: xVal };
  }, [expense.id]);

  // SWIPE LOGIC
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null); // Track vertical too
  const isScrolling = useRef<boolean>(false); // Lock status
  
  // DESKTOP CONFIRM LOGIC
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const SWIPE_THRESHOLD = -100; // Amount to swipe to lock open
  const MAX_SWIPE = -160;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    isScrolling.current = false; // Reset scroll lock
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    // If we determined this is a vertical scroll, stop processing swipe
    if (isScrolling.current) return;

    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // AXIS LOCKING LOGIC:
    // If vertical movement is greater than horizontal, assume user is scrolling list.
    // Also ignore tiny horizontal movements (deadzone of 10px) to prevent jitter.
    if (Math.abs(diffY) > Math.abs(diffX)) {
      isScrolling.current = true;
      return;
    }

    // Deadzone check: don't start swiping until we move at least 15px horizontally
    // unless we are already open (swipeOffset < 0)
    if (Math.abs(diffX) < 15 && swipeOffset === 0) return;

    // Only allow left swipe
    if (diffX < 0) {
      setSwipeOffset(Math.max(diffX, MAX_SWIPE));
    } else if (swipeOffset < 0) {
      // Allow closing if already open
      setSwipeOffset(Math.min(diffX + SWIPE_THRESHOLD, 0));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset < SWIPE_THRESHOLD / 2) {
      setSwipeOffset(SWIPE_THRESHOLD); // Snap open
    } else {
      setSwipeOffset(0); // Snap close
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isScrolling.current = false;
  };

  return (
    <div className="relative w-full max-w-[95%] mx-auto mb-3 min-h-[175px]">
      
      {/* BACKGROUND ACTIONS (Revealed on Swipe) - MOBILE */}
      <div 
        className={cn(
          "absolute inset-0 flex justify-end items-center px-4 rounded-[2.5rem] bg-transparent transition-opacity duration-200",
          swipeOffset < -5 ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex flex-col gap-3 pl-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onClick?.(); setSwipeOffset(0); }}
            className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center text-white shadow-lg z-10 hover:scale-110 transition-transform"
          >
            <Eye className="w-5 h-5" />
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(); setSwipeOffset(0); }}
            className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center text-white shadow-lg z-10 hover:scale-110 transition-transform"
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setSwipeOffset(0); }}
            className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg z-10 hover:scale-110 transition-transform"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* FOREGROUND CARD */}
      <div
        onClick={() => { 
          // Clicking the card body ONLY closes the swipe, does NOT open details anymore
          // UNLESS swipe is 0, then we can treat it as a click (handled by parent usually, but we can trigger onClick)
          if (swipeOffset === 0) {
            onClick?.();
          } else {
            setSwipeOffset(0); 
          }
        }}
        onMouseLeave={() => setIsConfirmingDelete(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          transform: `rotate(${rotation}deg) translateX(${offsetX + swipeOffset}px)`,
          transition: touchStartX.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          touchAction: 'pan-y' 
        }}
        className={cn(
          "chunky-card-3d group relative flex flex-col p-5 w-full h-full",
          "rounded-[2.5rem] cursor-pointer z-20",
          className
        )}
      >
        {/* DESKTOP HOVER ACTIONS (Only visible on MD+ screens on hover) */}
        <div className="hidden md:flex absolute -top-2 -right-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm p-1.5 rounded-full border border-red-500/20 pl-3 shadow-xl animate-scale-in">
              <span className="text-[10px] font-bold text-red-500 uppercase mr-1">Sicuro?</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(); setIsConfirmingDelete(false); }}
                className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                title="Conferma"
              >
                <Check className="w-4 h-4" strokeWidth={3} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
                className="w-7 h-7 rounded-full bg-secondary text-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                title="Annulla"
              >
                <X className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>
          ) : (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                className="w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                title="Modifica"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
                className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                title="Elimina"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* TOP ROW: Calendar & Price */}
        <div className="flex justify-between items-start w-full mb-1">
          
          {/* Calendar Widget */}
          <div className="flex flex-col items-center justify-center w-[60px] h-[60px] rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-white dark:bg-card shrink-0 mr-4">
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

          {/* Price (Moved to Top) */}
          <div className="flex-1 flex justify-end pt-1">
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

        {/* BOTTOM SECTION: Merchant & Category (Moved to Bottom) */}
        <div className="flex-1 flex flex-col justify-end mt-4">
            <h3 className="text-xl font-extrabold text-foreground leading-tight line-clamp-2 text-left">
              {expense.merchant || "Sconosciuto"}
            </h3>
            
            <div className="flex mt-2">
              <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-secondary/30 border border-border/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {expense.category || "Spesa"}
                </span>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}