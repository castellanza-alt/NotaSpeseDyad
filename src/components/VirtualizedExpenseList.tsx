import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ExpenseCard } from "./ExpenseCard";
import type { Expense } from "@/hooks/useExpenses";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VirtualizedExpenseListProps {
  expenses: Expense[];
  lastAddedId: string | null;
  onExpenseClick: (expense: Expense) => void;
  onExpenseDelete: (id: string) => void;
  onExpenseEdit: (expense: Expense) => void; // New prop
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  paddingClassName?: string;
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
  paddingClassName = "h-48"
}: VirtualizedExpenseListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Height approx 175px + 12px Gap (reduced gap for tighter feel)
  const CARD_HEIGHT = 175;
  const GAP = 12; 
  const ITEM_SIZE = CARD_HEIGHT + GAP;

  const virtualizer = useVirtualizer({
    count: expenses.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 3,
  });

  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = items[items.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= expenses.length - 3 &&
      hasMore &&
      !loadingMore
    ) {
      onLoadMore();
    }
  }, [items, expenses.length, hasMore, loadingMore, onLoadMore]);

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
      ref={parentRef}
      className="flex-1 overflow-auto w-full scrollbar-hide"
      style={{ contain: "strict" }}
    >
      <div className={cn("w-full shrink-0 transition-all duration-300", paddingClassName)} />

      <div
        className="relative w-full pb-40"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {items.map((virtualRow) => {
          const isLoaderRow = virtualRow.index >= expenses.length;
          const expense = expenses[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full flex justify-center px-0 md:px-0 overflow-visible"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center h-full w-full">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground/60 bg-muted/20 px-4 py-2 rounded-full">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-medium tracking-wide uppercase">Sincronizzazione</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex justify-center"> 
                  <ExpenseCard
                    expense={expense}
                    onClick={() => onExpenseClick(expense)}
                    onDelete={() => onExpenseDelete(expense.id)}
                    onEdit={() => onExpenseEdit(expense)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}