import { useExpenses } from "@/hooks/useExpenses";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Receipt, Utensils, Car, ShoppingBag, Briefcase, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  "Ristorazione": Utensils,
  "Trasporti": Car,
  "Shopping": ShoppingBag,
  "Lavoro": Briefcase,
};

function getCategoryIcon(category: string | null): LucideIcon {
  if (!category) return Receipt;
  return categoryIcons[category] || Receipt;
}

export function RecentExpenses() {
  const { expenses, loading } = useExpenses({ limit: 5 });

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className="flex-shrink-0 w-36 h-24 rounded-2xl shimmer" 
            />
          ))}
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-4 animate-fade-in">
        <p className="text-sm text-muted-foreground">
          Nessuna spesa recente
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Ultime spese
        </p>
        <button className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
          Vedi tutte
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {expenses.map((expense, index) => {
          const IconComponent = getCategoryIcon(expense.category);
          
          return (
            <div 
              key={expense.id} 
              className="flex-shrink-0 bg-card rounded-2xl p-4 
                         min-w-[140px] max-w-[160px]
                         card-shadow
                         transition-all duration-200 hover:scale-[1.02]
                         animate-fade-in"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Category Icon */}
              <div className="icon-pill-muted w-8 h-8 mb-3">
                <IconComponent className="w-4 h-4" strokeWidth={1.5} />
              </div>
              
              {/* Merchant */}
              <p className="text-sm font-medium text-card-foreground truncate">
                {expense.merchant || "Sconosciuto"}
              </p>
              
              {/* Amount */}
              <p className="text-lg font-semibold text-primary mt-1">
                €{expense.total?.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0,00"}
              </p>
              
              {/* Date */}
              <p className="text-xs text-muted-foreground mt-1.5">
                {expense.expense_date 
                  ? format(new Date(expense.expense_date), "d MMM", { locale: it }) 
                  : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}