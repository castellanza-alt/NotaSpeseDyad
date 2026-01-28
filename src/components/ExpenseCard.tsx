import { useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Expense } from "@/hooks/useExpenses";

interface ExpenseCardProps {
  expense: Expense;
  index: number;
  isNew?: boolean;
  onClick?: () => void;
}

// Generate deterministic rotation based on expense ID (-2 to +2 degrees)
function getRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  // Map to range -2 to +2 degrees
  return ((hash % 500) / 100) - 2;
}

// Get Italian day of week abbreviation
function getDayOfWeek(date: Date): string {
  return format(date, "EEEE", { locale: it }).toUpperCase();
}

export function ExpenseCard({ expense, index, isNew, onClick }: ExpenseCardProps) {
  const expenseDate = expense.expense_date ? new Date(expense.expense_date) : null;
  
  const dayOfWeek = expenseDate ? getDayOfWeek(expenseDate) : "—";
  const dayNumber = expenseDate ? format(expenseDate, "d") : "—";
  const month = expenseDate ? format(expenseDate, "MMM", { locale: it }).toUpperCase() : "—";

  const formattedTotal = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  const rotation = useMemo(() => getRotation(expense.id), [expense.id]);

  return (
    <div
      onClick={onClick}
      className={`expense-card-rotated ${isNew ? 'expense-card-new' : ''}`}
      style={{
        zIndex: 100 - index,
        transform: `rotate(${rotation}deg)`,
        animationDelay: isNew ? '0ms' : `${index * 50}ms`,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Left - Date Block */}
        <div className="flex flex-col items-center min-w-[70px] border-r border-border/50 pr-4">
          <span className="text-[10px] font-semibold tracking-wide text-expense-weekday leading-none">
            {dayOfWeek}
          </span>
          <span className="text-3xl font-bold text-foreground leading-tight mt-0.5">
            {dayNumber}
          </span>
          <span className="text-xs font-medium text-muted-foreground uppercase leading-none">
            {month}
          </span>
        </div>
        
        {/* Center - Merchant & Category */}
        <div className="flex-1 min-w-0 py-1">
          <h3 className="text-lg font-bold text-foreground leading-tight truncate">
            {expense.merchant || "Sconosciuto"}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {expense.category || "Altro"}
          </p>
        </div>
        
        {/* Right - Amount */}
        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-bold text-expense-amount whitespace-nowrap">
            €{formattedTotal}
          </p>
        </div>
      </div>
    </div>
  );
}
