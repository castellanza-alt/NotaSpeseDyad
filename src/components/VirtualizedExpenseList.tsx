import { useRef, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ExpenseCard } from "./ExpenseCard";
import type { Expense } from "@/hooks/useExpenses";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useHaptic } from "@/hooks/use-haptic";

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
  columns?: number; // New prop for grid control
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
  columns = 1
}: VirtualizedExpenseListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { trigger: haptic } = useHaptic();

  // BASE HEIGHTS
  // Card base height is approx 175px. 
  // With stagger (max 40px) + gap, we need more space per row.
  const CARD_HEIGHT = 175;
  const GAP = 20; 
  const STAGGER_BUFFER = columns > 1 ? 40 : 0; // Space for the offset
  const ITEM_SIZE = CARD_HEIGHT + GAP + STAGGER_BUFFER;

  // Calculate rows based on columns
  const rows = Math.ceil(expenses.length / columns);

  const virtualizer = useVirtualizer({
    count: rows + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 3,
  });

  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = items[items.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= rows - 1 &&
      hasMore &&
      !loadingMore
    ) {
      onLoadMore();
    }
  }, [items, rows, hasMore, loadingMore, onLoadMore]);

  // STAGGER LOGIC
  const getStaggerClass = (colIndex: number) => {
    if (columns === 1) return "";
    if (columns === 2) {
      // Col 1: 0px, Col 2: 40px
      return colIndex === 1 ? "pt-[40px]" : "";
    }
    if (columns >= 3) {
      // Col 1: 0px, Col 2: 40px, Col 3: 20px
      if (colIndex === 1) return "pt-[40px]";
      if (colIndex === 2) return "pt-[20px]";
    }
    return "";
  };

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center pt-20">
        <p className="text-muted-foreground text-sm font-medium">
          Nessuna spesa trovata
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="parallax-wrapper flex-1 w-full scrollbar-hide h-full overflow-y-auto"
      style={{ contain: "strict" }}
    >
      {/* Parallax Background Layer */}
      <div className={cn("parallax-bg", theme === 'dark' ? "mesh-gradient-dark" : "mesh-gradient-light")} />

      {/* Spacer for Header */}
      <div className={cn("w-full shrink-0 transition-all duration-300", paddingClassName)} />

      <div
        className="relative w-full pb-40"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {items.map((virtualRow) => {
          const isLoaderRow = virtualRow.index >= rows;
          
          if (isLoaderRow) {
             return (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 w-full flex justify-center items-center"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground/60 bg-muted/20 px-4 py-2 rounded-full">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-medium tracking-wide uppercase">Caricamento</span>
                    </div>
                  )}
              </div>
             );
          }

          // Calculate which items belong to this row
          const startIndex = virtualRow.index * columns;
          const rowItems = expenses.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full px-4 md:px-8"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex w-full justify-center gap-6 h-full">
                {rowItems.map((expense, colIndex) => (
                  <div 
                    key={expense.id} 
                    className={cn(
                      "flex-1 h-full max-w-[400px] w-full", 
                      getStaggerClass(colIndex) // Apply Stagger
                    )}
                  >
                    <ExpenseCard
                      expense={expense}
                      onClick={() => { haptic('light'); onExpenseClick(expense); }}
                      onDelete={() => { haptic('warning'); onExpenseDelete(expense.id); }}
                      onEdit={() => { haptic('light'); onExpenseEdit(expense); }}
                      className="w-full"
                    />
                  </div>
                ))}
                
                {/* Fill empty columns if last row is incomplete to maintain alignment */}
                {rowItems.length < columns && Array.from({ length: columns - rowItems.length }).map((_, i) => (
                   <div key={`empty-${i}`} className="flex-1 max-w-[400px]" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}