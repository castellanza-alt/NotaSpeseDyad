import { useRef } from "react";
import { ExpenseCard } from "./ExpenseCard";
import type { Expense } from "@/hooks/useExpenses";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VirtualizedExpenseListProps {
  expenses: Expense[];
  lastAddedId: string | null;
  onExpenseClick: (expense: Expense) => void;
  onExpenseDelete: (id: string) => void;
  onExpenseEdit: (expense: Expense) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  paddingClassName?: string;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualizedExpenseList({
  expenses,
  lastAddedId,
  onExpenseClick,
  onExpenseDelete,
  onExpenseEdit,
  hasMore,
  loadingMore,
  onLoadMore,
  paddingClassName = "h-48",
  onScroll
}: VirtualizedExpenseListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // Pass scroll position for Parallax
    onScroll?.(scrollTop);

    // Infinite Scroll Logic (Simple)
    if (scrollHeight - scrollTop - clientHeight < 300 && hasMore && !loadingMore) {
      onLoadMore();
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center pt-20">
        <p className="text-muted-foreground text-sm font-medium">
          Nessuna spesa nel portafoglio
        </p>
        <p className="text-muted-foreground/50 text-xs mt-2">
          Usa il tasto + per iniziare
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto w-full scrollbar-hide overflow-x-hidden"
      onScroll={handleScroll}
      style={{ WebkitOverflowScrolling: "touch" }} // Smooth scrolling on iOS
    >
      {/* Spacer to push content below header */}
      <div className={cn("w-full shrink-0", paddingClassName)} />

      <div className="relative w-full pb-40 px-0 space-y-3">
        {expenses.map((expense) => (
          <div key={expense.id} className="flex justify-center w-full">
            <ExpenseCard
              expense={expense}
              onClick={() => onExpenseClick(expense)}
              onDelete={() => onExpenseDelete(expense.id)}
              onEdit={() => onExpenseEdit(expense)}
            />
          </div>
        ))}

        {loadingMore && (
          <div className="flex items-center justify-center py-4 w-full">
            <div className="flex items-center gap-2 text-muted-foreground/60 bg-muted/20 px-4 py-2 rounded-full">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium tracking-wide uppercase">Sincronizzazione</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}