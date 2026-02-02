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
import { format, addMonths, subMonths, isSameMonth, eachMonthOfInterval } from "date-fns";
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
  
  // --- WHEEL STATE ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const { theme, toggleTheme } = useTheme();

  // Generate range of months (+/- 24 months)
  const monthsList = useMemo(() => {
    const today = new Date();
    const start = subMonths(today, 24);
    const end = addMonths(today, 24);
    return eachMonthOfInterval({ start, end });
  }, []);

  // Sync Search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { expenses, loading, refetch, lastAddedId, hasMore, loadingMore, loadMore, deleteExpense } = useExpenses({
    searchQuery: debouncedSearch
  });

  const filteredExpenses = useMemo(() => {
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

  // --- WHEEL LOGIC ---
  const ITEM_WIDTH = 64; // Width of one tick area (w-16 = 64px)

  const handleWheelScroll = () => {
    if (!scrollRef.current) return;
    
    // Calculate center index
    const container = scrollRef.current;
    const index = Math.round(container.scrollLeft / ITEM_WIDTH);
    
    if (index >= 0 && index < monthsList.length) {
      const newMonth = monthsList[index];
      if (!isSameMonth(newMonth, currentDate)) {
        setCurrentDate(newMonth);
      }
    }
  };

  // Initial Center & Programmatic Updates
  useEffect(() => {
    if (scrollRef.current && !isUserScrolling) {
      const index = monthsList.findIndex(m => isSameMonth(m, currentDate));
      if (index !== -1) {
        const targetScroll = index * ITEM_WIDTH;
        // Check distance to avoid fighting native snap during small adjustments
        if (Math.abs(scrollRef.current.scrollLeft - targetScroll) > 5) {
           scrollRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
      }
    }
  }, [currentDate, isUserScrolling, monthsList]);

  // Adjust spacer based on SearchBar visibility
  const topSpacerHeight = showSearchBar ? 'h-[24rem]' : 'h-[20rem]';

  return (
    <div className="h-screen flex flex-col wallet-bg overflow-hidden relative">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* HEADER FADE */}
      <div className="fixed top-0 left-0 right-0 h-96 z-20 pointer-events-none header-fade" />

      {/* TOP RIGHT: Burger Menu */}
      <div className="fixed top-0 right-0 z-50 p-6 pt-safe-top">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-background/50 backdrop-blur-md hover:bg-background/80 transition-all active:scale-95 shadow-sm border border-white/5"
        >
          <Menu className="w-6 h-6 text-foreground" strokeWidth={2} />
        </button>
      </div>

      {/* MAXI HEADER: WHEEL & BALANCE */}
      <header className="fixed top-0 left-0 right-0 z-40 flex flex-col items-center pt-safe-top mt-2 pointer-events-none">
        
        {/* 1. CURRENT MONTH NAME (Fixed Above Wheel) */}
        <div className="flex flex-col items-center mb-6 animate-fade-in pointer-events-none z-30">
          <h2 className="text-sm font-bold tracking-[0.2em] text-muted-foreground uppercase">
            {format(currentDate, "yyyy")}
          </h2>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            {format(currentDate, "MMMM", { locale: it })}
          </h1>
        </div>

        {/* 2. HORIZONTAL GRAPHICAL WHEEL (The Ruler) */}
        <div className="relative w-full h-16 pointer-events-auto">
          {/* Center Indicator (Needle) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[3px] bg-primary z-20 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.1)]" />
          
          {/* Side Gradients */}
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          {/* Scroll Container */}
          <div 
            ref={scrollRef}
            onScroll={handleWheelScroll}
            onTouchStart={() => setIsUserScrolling(true)}
            onTouchEnd={() => setTimeout(() => setIsUserScrolling(false), 500)} // Delay to allow snap to finish
            className="w-full h-full overflow-x-auto scrollbar-hide flex items-center px-[calc(50%-32px)] snap-x snap-mandatory cursor-grab active:cursor-grabbing"
          >
            {monthsList.map((date, i) => {
              const isCurrent = isSameMonth(date, currentDate);
              // We emphasize start of year or quarter
              const isStartOfYear = date.getMonth() === 0;
              const isQuarter = date.getMonth() % 3 === 0;

              return (
                <div 
                  key={i} 
                  className="flex-shrink-0 w-16 h-full flex flex-col items-center justify-center snap-center group relative"
                >
                  {/* The Tick */}
                  <div 
                    className={cn(
                      "rounded-full transition-all duration-300",
                      isCurrent 
                        ? "w-[3px] h-10 bg-transparent" // Invisible center (placeholder for alignment with needle)
                        : cn(
                            "bg-muted-foreground/30 group-hover:bg-muted-foreground/50",
                            isStartOfYear ? "h-10 w-[2px] bg-foreground/40" : 
                            isQuarter ? "h-7 w-[1.5px]" : "h-4 w-[1px]"
                          )
                    )} 
                  />
                  
                  {/* Optional: Tiny dot for start of year */}
                  {isStartOfYear && !isCurrent && (
                     <div className="absolute bottom-2 w-1 h-1 rounded-full bg-foreground/30" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* 3. HUGE BALANCE */}
        <div className="relative flex items-baseline text-gradient-bronze-rich drop-shadow-sm scale-125 mt-8 pointer-events-auto transition-all duration-300">
          <span className="text-xl font-semibold mr-1.5 opacity-60 text-foreground/50">€</span>
          <span className="text-6xl font-black tracking-tighter">
            <OdometerValue value={currentMonthTotal} />
          </span>
        </div>
      </header>

      {/* SEARCH BAR (Slide down) */}
      {showSearchBar && (
        <div className="fixed top-80 left-0 right-0 z-30 px-6 flex justify-center animate-slide-down">
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
          <div className="flex-1 flex flex-col items-center justify-center pt-32 animate-fade-in text-center px-10">
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

      {/* CONSOLE DI COMANDO */}
      <nav className="fixed bottom-8 left-0 right-0 z-50 pointer-events-none">
        <div className="flex justify-center pointer-events-auto">
          <div className="relative flex items-center justify-between px-8 py-3 rounded-[2.5rem] glass-stone shadow-2xl border border-white/10 min-w-[300px]">
            
            {/* Search */}
            <button 
              onClick={toggleSearchBar}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${showSearchBar ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-black/5'}`}
            >
              <Search className="w-6 h-6" strokeWidth={2.5} />
            </button>

            {/* GIANT FAB */}
            <div className="relative -top-10 mx-6">
              <button 
                onClick={handleSelectPhoto} 
                className="w-24 h-24 rounded-full fab-glass-bronze shadow-2xl flex items-center justify-center transform transition-transform active:scale-95 border-[6px] border-background"
              >
                <Plus className="w-10 h-10 text-white drop-shadow-md" strokeWidth={3} />
              </button>
            </div>

            {/* Theme */}
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

      <SettingsSheet 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        showTrigger={false} 
        expenses={expenses}
        onDataGenerated={() => {
          refetch();
        }}
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