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
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  paddingClassName?: string;
}

export function VirtualizedExpenseList({
  expenses,
  lastAddedId,
  onExpenseClick,
  hasMore,
  loadingMore,
  onLoadMore,
  paddingClassName = "h-48"
}: VirtualizedExpenseListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Card height estimation (including gap)
  const CARD_HEIGHT = 100;
  const GAP = 24; // Increased gap for more vertical spacing
  const ITEM_SIZE = CARD_HEIGHT + GAP;

  const virtualizer = useVirtualizer({
    count: expenses.length + (hasMore ? 1 : 0), // +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();

  // Trigger load more when near the bottom
  useEffect(() => {
    const lastItem = items[items.length - 1];
    if (!lastItem) return;

    // If we're viewing the last few items and can load more
    if (
      lastItem.index >= expenses.length - 5 &&
      hasMore &&
      !loadingMore
    ) {
      onLoadMore();
    }
  }, [items, expenses.length, hasMore, loadingMore, onLoadMore]);

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center pt-20">
        <p className="text-muted-foreground text-sm">
          Nessuna spesa trovata
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Tocca + per aggiungere un giustificativo
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto px-4"
      style={{ contain: "strict" }}
    >
      {/* 
        SPACER DIV: 
        Pushes content down initially to clear the header.
        As you scroll down, this spacer moves up (off screen), 
        allowing the expense cards to scroll *behind* the header overlay.
      */}
      <div className={cn("w-full shrink-0 transition-all duration-300", paddingClassName)} />

      <div
        className="relative w-full flex flex-col items-center pb-32"
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
              className="absolute top-0 left-0 w-full flex justify-center"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center h-full">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Caricamento...</span>
                    </div>
                  )}
                </div>
              ) : (
                <ExpenseCard
                  expense={expense}
                  index={virtualRow.index}
                  isNew={expense.id === lastAddedId}
                  onClick={() => onExpenseClick(expense)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}