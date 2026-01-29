import { useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Expense } from "@/hooks/useExpenses";
import { Utensils, Car, ShoppingBag, Briefcase, Receipt, Coffee, Zap, Home, Plane, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ExpenseCardProps {
  expense: Expense;
  index: number;
  isNew?: boolean;
  onClick?: () => void;
}

// Map categories to Lucide icons
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
  // Simple partial match or default
  const key = Object.keys(categoryIcons).find(k => category.toLowerCase().includes(k.toLowerCase()));
  return key ? categoryIcons[key] : Receipt;
}

// Generate deterministic rotation based on expense ID (-1.5 to +1.5 degrees) - Subtle
function getRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return ((hash % 300) / 100) - 1.5;
}

export function ExpenseCard({ expense, index, isNew, onClick }: ExpenseCardProps) {
  const expenseDate = expense.expense_date ? new Date(expense.expense_date) : null;
  
  // Format Date: "28 GEN"
  const dateFormatted = expenseDate 
    ? format(expenseDate, "d MMM", { locale: it }).toUpperCase().replace(".", "")
    : "—";

  const formattedTotal = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  const rotation = useMemo(() => getRotation(expense.id), [expense.id]);
  const Icon = getCategoryIcon(expense.category);

  return (
    <div
      onClick={onClick}
      className={`expense-card-rotated group ${isNew ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      style={{
        zIndex: 100 - index,
        transform: `rotate(${rotation}deg)`,
        animationDelay: isNew ? '0ms' : `${index * 50}ms`,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Left - Icon Squircle */}
        <div className="flex-shrink-0 w-11 h-11 rounded-[14px] bg-[hsl(var(--accent-light))] flex items-center justify-center text-[hsl(var(--accent))]">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
        
        {/* Center - Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <h3 className="text-[15px] font-bold text-foreground leading-tight truncate">
            {expense.merchant || "Sconosciuto"}
          </h3>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="truncate max-w-[100px]">{expense.category || "Altro"}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
            <span>{dateFormatted}</span>
          </div>
        </div>
        
        {/* Right - Amount */}
        <div className="flex-shrink-0 text-right pl-2">
          <p className="text-[17px] font-bold text-amount tabular-nums tracking-tight">
            €{formattedTotal}
          </p>
        </div>
      </div>
    </div>
  );
}