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

// Controlled Rotation: Range -2.5deg to +2.5deg
// (hash % 501) -> 0 to 500
// / 100 -> 0 to 5
// - 2.5 -> -2.5 to 2.5
function getSubtleRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return ((Math.abs(hash) % 501) / 100) - 2.5;
}

export function ExpenseCard({ expense, index, isNew, onClick }: ExpenseCardProps) {
  const expenseDate = expense.expense_date ? new Date(expense.expense_date) : null;
  
  const dateFormatted = expenseDate 
    ? format(expenseDate, "d MMMM", { locale: it })
    : "Data sconosciuta";

  const formattedTotal = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  const Icon = getCategoryIcon(expense.category);
  const rotation = useMemo(() => getSubtleRotation(expense.id), [expense.id]);

  return (
    <div
      onClick={onClick}
      className={`squircle-card group mx-4 h-[110px] ${isNew ? 'ring-2 ring-primary ring-offset-4 ring-offset-background' : ''}`}
      style={{
        zIndex: 100 - index,
        transform: `rotate(${rotation}deg)`,
        animationDelay: isNew ? '0ms' : `${Math.min(index * 40, 600)}ms`,
      }}
    >
      <div className="flex items-center h-full px-6 gap-5">
        
        {/* Left: Icon in Stone Circle */}
        <div className="flex-shrink-0 w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-sm">
          <Icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
        
        {/* Center: Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <h3 className="text-lg font-bold text-foreground tracking-tight truncate">
            {expense.merchant || "Sconosciuto"}
          </h3>
          <p className="text-sm font-medium text-muted-foreground capitalize truncate">
            {expense.category || "Generale"} • {dateFormatted}
          </p>
        </div>
        
        {/* Right: Amount - Metallic Bronze */}
        <div className="flex-shrink-0 flex flex-col items-end justify-center">
          <span className="text-2xl font-bold text-gradient-bronze tracking-tight drop-shadow-sm">
            <span className="text-lg align-top opacity-60 mr-0.5 text-foreground/50">€</span>
            {formattedTotal}
          </span>
        </div>
      </div>
    </div>
  );
}