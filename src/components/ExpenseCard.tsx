import { useMemo, useState, useRef, MouseEvent, TouchEvent } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Expense } from "@/hooks/useExpenses";
import { cn } from "@/lib/utils";
import { Trash2, Pencil } from "lucide-react";
import { useHaptic } from "@/hooks/useHaptic";

interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function ExpenseCard({ expense, onClick, onDelete, onEdit, className }: ExpenseCardProps) {
  const { impact, success } = useHaptic();
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isPressed, setIsPressed] = useState(false);

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
    // Fallback safe if id is somehow missing
    const seedStr = expense.id || "default";
    const seed = seedStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randRot = Math.sin(seed) * 10000;
    const rotVal = (randRot - Math.floor(randRot)) * 6 - 3; 
    const randX = Math.cos(seed) * 10000;
    const xVal = (randX - Math.floor(randX)) * 20 - 10; 
    return { rotation: rotVal, offsetX: xVal };
  }, [expense.id]);

  // SWIPE LOGIC
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD = -100; 
  const MAX_SWIPE = -160;

  // TILT LOGIC
  const handleMove = (clientX: number, clientY: number) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // Prevent division by zero

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calcolo rotazione basata sulla posizione del tocco (Max 8 gradi)
    const rotateX = ((y - centerY) / centerY) * -8; 
    const rotateY = ((x - centerX) / centerX) * 8;

    // Check for NaN just in case
    if (!isNaN(rotateX) && !isNaN(rotateY)) {
        setTilt({ x: rotateX, y: rotateY });
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  const onMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsPressed(false);
  };

  const onMouseDown = () => {
    setIsPressed(true);
    impact(); // Haptic on press
  };

  const onMouseUp = () => {
    setIsPressed(false);
  };

  // TOUCH HANDLERS (Combined Swipe + Tilt)
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    setIsPressed(true);
    impact(); // Haptic on touch
    handleMove(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    // Update Tilt
    handleMove(e.targetTouches[0].clientX, e.targetTouches[0].clientY);

    // Update Swipe
    if (touchStartX.current === null) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartX.current;
    
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, MAX_SWIPE));
    } else if (swipeOffset < 0) {
      setSwipeOffset(Math.min(diff + SWIPE_THRESHOLD, 0));
    }
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    setTilt({ x: 0, y: 0 }); // Reset tilt on release
    
    if (swipeOffset < SWIPE_THRESHOLD / 2) {
      setSwipeOffset(SWIPE_THRESHOLD); 
      impact(); // Feedback when snapped open
    } else {
      setSwipeOffset(0); 
    }
    touchStartX.current = null;
  };

  return (
    <div className="relative w-full max-w-[90%] mx-auto mb-3 min-h-[175px]" style={{ perspective: "1000px" }}>
      
      {/* BACKGROUND ACTIONS */}
      <div className="absolute inset-0 flex justify-end items-center px-4 rounded-[2.5rem] bg-transparent">
        <div className="flex flex-col gap-3 pl-4">
          <button 
            onClick={(e) => { e.stopPropagation(); impact(); onEdit?.(); setSwipeOffset(0); }}
            className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center text-white shadow-lg z-10 active:scale-90 transition-transform"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); success(); onDelete?.(); setSwipeOffset(0); }}
            className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg z-10 active:scale-90 transition-transform"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* FOREGROUND CARD */}
      <div
        ref={cardRef}
        onClick={() => { 
          if(swipeOffset === 0) { 
            impact(); 
            onClick?.(); 
          } else { 
            setSwipeOffset(0); 
          } 
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          transform: `
            rotate(${rotation}deg) 
            translateX(${offsetX + swipeOffset}px) 
            rotateX(${tilt.x}deg) 
            rotateY(${tilt.y}deg)
            scale(${isPressed ? 0.98 : 1})
          `,
          transition: touchStartX.current || isPressed ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        className={cn(
          "chunky-card-3d group relative flex flex-col p-5 w-full h-full", 
          "rounded-[2.5rem] cursor-pointer bg-card z-20",
          // Removed will-change-transform to avoid rendering glitches
          className
        )}
      >
        {/* Shine Effect Overlay driven by Tilt */}
        <div 
          className="absolute inset-0 rounded-[2.5rem] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `linear-gradient(${135 + tilt.y * 5}deg, rgba(255,255,255,0.1) 0%, transparent 60%)`
          }}
        />

        {/* TOP ROW */}
        <div className="flex justify-between items-start w-full mb-1 pointer-events-none">
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

          {/* Merchant Title */}
          <div className="flex-1 pt-2 flex flex-col items-end">
            <h3 className="text-xl font-extrabold text-foreground leading-tight line-clamp-2 text-right">
              {expense.merchant || "Sconosciuto"}
            </h3>
            <div className="inline-flex items-center justify-center px-2.5 py-1 mt-2 rounded-full bg-secondary/30 border border-border/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {expense.category || "Spesa"}
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM RIGHT */}
        <div className="flex-1 flex items-end justify-end mt-4 pointer-events-none">
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