import { useEffect, useMemo } from "react";
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
  
  // Split expenses into two columns for masonry effect
  const { leftCol, rightCol } = useMemo(() => {
    const left: Expense[] = [];
    const right: Expense[] = [];
    
    expenses.forEach((exp, i) => {
      if (i % 2 === 0) left.push(exp);
      else right.push(exp);
    });
    
    return { leftCol: left, rightCol: right };
  }, [expenses]);

  // Infinite scroll trigger
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 200) {
        if (hasMore && !loadingMore) {
          onLoadMore();
        }
      }
    };

    // Attach to the parent container found via ID or context in a real app, 
    // but here we attach to the window or a specific ref if passed. 
    // Since we are inside the scrollable div in ArchiveScreen, we can just rely on the parent logic
    // OR use an IntersectionObserver at the bottom.
    
    // Using a simpler IntersectionObserver approach for the loader is safer in React
  }, [hasMore, loadingMore, onLoadMore]);

  // Intersection Observer for infinite scroll
  const loaderRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  };

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-32 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/20" />
        </div>
        <p className="text-foreground font-semibold text-lg">
          Nessuna spesa
        </p>
        <p className="text-muted-foreground text-sm mt-1 max-w-[200px]">
          Il tuo portafoglio è vuoto. Usa il tasto + per aggiungere una nota.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto w-full px-4 scrollbar-hide">
      {/* Spacer for fixed header */}
      <div className={cn("w-full shrink-0", paddingClassName)} />

      {/* Masonry Grid */}
      <div className="flex gap-3 pb-32">
        
        {/* Left Column */}
        <div className="flex-1 flex flex-col gap-3">
          {leftCol.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onClick={() => onExpenseClick(expense)}
            />
          ))}
        </div>

        {/* Right Column - Staggered (Offset top) */}
        <div className="flex-1 flex flex-col gap-3 pt-12">
          {rightCol.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onClick={() => onExpenseClick(expense)}
            />
          ))}
        </div>
      </div>

      {/* Loader Trigger */}
      <div ref={loaderRef} className="w-full py-6 flex justify-center">
        {loadingMore && (
          <div className="flex items-center gap-2 px-4 py-2 bg-card/50 rounded-full backdrop-blur-sm border border-border/50 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caricamento</span>
          </div>
        )}
      </div>
    </div>
  );
}