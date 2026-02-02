import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useExpenses, Expense } from "@/hooks/useExpenses";
import { Moon, Menu, Plus, Check, Search, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { SettingsSheet } from "./SettingsSheet";
import { ImageAnalyzer } from "./ImageAnalyzer";
import { OdometerValue } from "./OdometerValue";
import { ExpenseDetail } from "./ExpenseDetail";
import { SearchBar } from "./SearchBar";
import { VirtualizedExpenseList } from "./VirtualizedExpenseList";
import { format, addMonths, subMonths, isSameMonth, startOfMonth, eachMonthOfInterval } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function ArchiveScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  
  // Month Navigation State
  const [currentDate, setCurrentDate] = useState(new Date());

  const { theme, toggleTheme } = useTheme();
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { expenses, loading, refetch, lastAddedId, hasMore, loadingMore, loadMore, deleteExpense } = useExpenses({
    searchQuery: debouncedSearch
  });

  // Filter expenses based on selected month (client-side for smooth UX)
  const filteredExpenses = useMemo(() => {
    // If searching, show all matches regardless of month
    if (debouncedSearch) return expenses;

    return expenses.filter(expense => {
      if (!expense.expense_date) return false;
      return isSameMonth(new Date(expense.expense_date), currentDate);
    });
  }, [expenses, currentDate, debouncedSearch]);

  const currentMonthTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.total || 0), 0);
  }, [filteredExpenses]);

  const handleSelectPhoto = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedImage(e.target.files[0]);
    e.target.value = "";
  };

  const handleSuccess = useCallback(() => {
    setSelectedImage(null);
    refetch();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  }, [refetch]);

  const toggleSearchBar = () => {
    setShowSearchBar(prev => !prev);
    if (showSearchBar) setSearchQuery("");
  };

  // Generate Month Scroller Items (-2 to +2 months)
  const monthScrollerItems = useMemo(() => {
    const start = subMonths(currentDate, 2);
    const end = addMonths(currentDate, 2);
    return eachMonthOfInterval({ start, end });
  }, [currentDate]);

  // Dynamic spacer calculation
  const topSpacerHeight = showSearchBar ? 'h-[22rem]' : 'h-72'; // Increased for taller header

  return (
    <div className="h-screen flex flex-col wallet-bg overflow-hidden relative">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* HEADER FADE */}
      <div className="fixed top-0 left-0 right-0 h-80 z-20 pointer-events-none header-fade" />

      {/* TOP RIGHT: Burger Menu (Minimal) */}
      <div className="fixed top-0 right-0 z-50 p-6 pt-safe-top">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-background/50 backdrop-blur-md hover:bg-background/80 transition-all active:scale-95"
        >
          <Menu className="w-6 h-6 text-foreground" strokeWidth={2} />
        </button>
      </div>

      {/* MAXI HEADER: Horizontal Scroller & Balance */}
      <header className="fixed top-0 left-0 right-0 z-40 flex flex-col items-center pt-safe-top mt-4 pointer-events-none">
        
        {/* Month Roller */}
        <div className="pointer-events-auto w-full overflow-x-auto scrollbar-hide flex items-center justify-center gap-6 px-10 py-4 mb-2 mask-linear-fade">
          {monthScrollerItems.map((date, i) => {
            const isCurrent = isSameMonth(date, currentDate);
            return (
              <button
                key={i}
                onClick={() => setCurrentDate(date)}
                className={cn(
                  "transition-all duration-300 flex flex-col items-center justify-center shrink-0",
                  isCurrent ? "scale-110 opacity-100" : "scale-90 opacity-40 hover:opacity-70"
                )}
              >
                <span className={cn(
                  "text-sm font-bold uppercase tracking-widest mb-1",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  {format(date, "MMMM", { locale: it })}
                </span>
                <span className={cn(
                  "text-xs font-medium text-muted-foreground",
                  isCurrent && "text-foreground"
                )}>
                  {format(date, "yyyy")}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Huge Balance (No Subtitles if 0) */}
        <div className="relative flex items-baseline text-gradient-bronze-rich drop-shadow-sm scale-125 mt-2 pointer-events-auto">
          <span className="text-xl font-semibold mr-1.5 opacity-60 text-foreground/50">€</span>
          <span className="text-6xl font-black tracking-tighter">
            <OdometerValue value={currentMonthTotal} />
          </span>
        </div>
      </header>

      {/* Search Bar (Slide down) */}
      {showSearchBar && (
        <div className="fixed top-64 left-0 right-0 z-30 px-6 flex justify-center animate-slide-down">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca transazione..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {/* LIST CONTAINER */}
      <div className="flex-1 flex flex-col h-full w-full">
        {loading && !expenses.length ? (
          <div className="flex-1 flex items-center justify-center pt-48">
            <div className="shimmer w-64 h-32 rounded-3xl opacity-50" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          // CLEAN EMPTY STATE
          <div className="flex-1 flex flex-col items-center justify-center pt-20 animate-fade-in text-center px-10">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-foreground/60 text-lg font-medium leading-relaxed">
              Nessuna spesa registrata per questo mese
            </p>
          </div>
        ) : (
          <VirtualizedExpenseList
            expenses={filteredExpenses}
            lastAddedId={lastAddedId}
            onExpenseClick={setSelectedExpense}
            onExpenseDelete={deleteExpense}
            onExpenseEdit={(expense) => setSelectedExpense(expense)}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            paddingClassName={topSpacerHeight}
          />
        )}
      </div>

      {/* FOOTER FADE */}
      <div className="fixed bottom-0 left-0 right-0 h-40 z-20 pointer-events-none footer-fade" />

      {/* CONSOLE DI COMANDO (Floating Bottom Bar) */}
      <nav className="fixed bottom-8 left-0 right-0 z-50 pointer-events-none">
        <div className="flex justify-center pointer-events-auto">
          <div className="relative flex items-center justify-between px-8 py-3 rounded-[2.5rem] glass-stone shadow-2xl border border-white/10 min-w-[300px]">
            
            {/* Left: Search */}
            <button 
              onClick={toggleSearchBar}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${showSearchBar ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-black/5'}`}
            >
              <Search className="w-6 h-6" strokeWidth={2.5} />
            </button>

            {/* Center: GIANT FAB (+25% bigger) */}
            <div className="relative -top-10 mx-6">
              <button 
                onClick={handleSelectPhoto} 
                className="w-24 h-24 rounded-full fab-glass-bronze shadow-2xl flex items-center justify-center transform transition-transform active:scale-95 border-[6px] border-background"
              >
                <Plus className="w-10 h-10 text-white drop-shadow-md" strokeWidth={3} />
              </button>
            </div>

            {/* Right: Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-12 h-12 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 transition-all active:scale-90"
            >
              {theme === 'dark' ? (
                <Moon className="w-6 h-6" strokeWidth={2.5} />
              ) : (
                <Sun className="w-6 h-6" strokeWidth={2.5} />
              )}
            </button>

          </div>
        </div>
      </nav>

      {/* Settings Sheet (Includes Demo Data Generator) */}
      <SettingsSheet 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        showTrigger={false} 
        expenses={expenses}
        onDataGenerated={refetch}
      />

      {showSuccess && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-scale-in">
          <div className="glass-stone flex flex-col items-center gap-3 px-8 py-6 rounded-3xl shadow-2xl border border-success/20">
            <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center shadow-lg shadow-success/30">
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
            </div>
            <span className="text-foreground font-bold text-lg">Salvato!</span>
          </div>
        </div>
      )}

      {selectedExpense && (
        <ExpenseDetail
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onDelete={() => deleteExpense(selectedExpense.id)}
          onUpdate={refetch}
        />
      )}

      {selectedImage && (
        <ImageAnalyzer imageFile={selectedImage} onClose={() => setSelectedImage(null)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}