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
  
  // START DATE: Febbraio 2026
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 1, 1)); 
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const { theme, toggleTheme } = useTheme();

  // Range: +/- 12 mesi dalla data target
  const monthsList = useMemo(() => {
    const center = new Date(2026, 1, 1);
    const start = subMonths(center, 12);
    const end = addMonths(center, 12);
    return eachMonthOfInterval({ start, end });
  }, []);

  // Scroll to current month on mount (Logic Perfected)
  useEffect(() => {
    // Timeout breve per garantire che il rendering sia completato
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const index = monthsList.findIndex(m => isSameMonth(m, currentDate));
        if (index !== -1) {
          const containerWidth = scrollRef.current.clientWidth;
          const itemWidth = containerWidth / 3; // 33vw approx
          
          // Calcolo preciso per centrare l'elemento
          const scrollPos = (index * itemWidth) - (containerWidth / 2) + (itemWidth / 2);
          
          scrollRef.current.scrollTo({ left: scrollPos, behavior: 'instant' });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []); // Run once on mount

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

  const handleWheelScroll = () => {
    if (!scrollRef.current) return;
    
    const container = scrollRef.current;
    const center = container.scrollLeft + (container.clientWidth / 2);
    const itemWidth = container.clientWidth / 3;
    const index = Math.floor(center / itemWidth);
    
    if (index >= 0 && index < monthsList.length) {
      const newMonth = monthsList[index];
      if (!isSameMonth(newMonth, currentDate)) {
        setCurrentDate(newMonth);
      }
    }
  };

  const topSpacerHeight = showSearchBar ? 'h-[24rem]' : 'h-[20rem]';

  return (
    <div className="h-screen flex flex-col wallet-bg overflow-hidden relative font-sans">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* HEADER BACKGROUND & FADE */}
      <div className="fixed top-0 left-0 right-0 h-[26rem] z-10 pointer-events-none header-fade opacity-100" />

      {/* BURGER MENU */}
      <div className="fixed top-0 right-0 z-50 p-6 pt-safe-top">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-background/40 backdrop-blur-md hover:bg-background/60 transition-all active:scale-95 border border-foreground/5 shadow-sm"
        >
          <Menu className="w-5 h-5 text-foreground/80" strokeWidth={2} />
        </button>
      </div>

      {/* MAXI HEADER */}
      <header className="fixed top-0 left-0 right-0 z-40 flex flex-col items-center pt-safe-top pointer-events-none">
        
        {/* 1. YEAR */}
        <div className="mb-4 opacity-50 animate-fade-in pointer-events-none">
          <span className="text-xs font-semibold tracking-[0.4em] uppercase text-foreground">
            {format(currentDate, "yyyy")}
          </span>
        </div>

        {/* 2. THE WHEEL INTERFACE */}
        <div className="relative w-full h-24 flex items-center justify-center pointer-events-auto">
          
          {/* THE RADIO WHEEL GRAPHIC (Background Element) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-20 z-0 pointer-events-none opacity-90">
             {/* 3D Cylinder Effect */}
             <div 
               className="w-full h-full rounded-full"
               style={{
                 background: `
                   linear-gradient(to right, transparent 0%, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.05) 80%, transparent 100%),
                   repeating-linear-gradient(90deg, transparent 0px, transparent 18px, rgba(150,150,150,0.15) 19px, rgba(150,150,150,0.15) 20px)
                 `,
                 boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)',
                 maskImage: 'linear-gradient(to right, transparent, black 30%, black 70%, transparent)'
               }}
             />
             {/* Top/Bottom Highlight Lines for edge definition */}
             <div className="absolute top-0 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
             <div className="absolute bottom-0 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
          </div>

          {/* Side Gradients for fading text */}
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-background via-background/80 to-transparent z-20 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-background via-background/80 to-transparent z-20 pointer-events-none" />

          {/* Scroll Container */}
          <div 
            ref={scrollRef}
            onScroll={handleWheelScroll}
            onTouchStart={() => setIsUserScrolling(true)}
            onTouchEnd={() => setTimeout(() => setIsUserScrolling(false), 500)}
            className="w-full h-full overflow-x-auto scrollbar-hide flex items-center snap-x snap-mandatory cursor-grab active:cursor-grabbing relative z-30"
          >
            {/* Start Spacer */}
            <div className="shrink-0 w-[33vw]" />
            
            {monthsList.map((date, i) => {
              const isCurrent = isSameMonth(date, currentDate);
              return (
                <div 
                  key={i} 
                  className="flex-shrink-0 w-[33vw] h-full flex items-center justify-center snap-center"
                >
                  <button 
                    onClick={() => {
                        if (scrollRef.current) {
                            const itemWidth = scrollRef.current.clientWidth / 3;
                            const scrollPos = (i * itemWidth) - (scrollRef.current.clientWidth / 2) + (itemWidth / 2);
                            scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
                        }
                    }}
                    className={cn(
                      "transition-all duration-500 ease-out transform select-none",
                      isCurrent 
                        ? "text-3xl font-bold text-foreground scale-110 tracking-tight" 
                        : "text-lg font-medium text-muted-foreground/30 scale-90 blur-[1px]"
                    )}
                    style={{
                      textShadow: isCurrent ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {format(date, "MMMM", { locale: it })}
                  </button>
                </div>
              );
            })}
            
            {/* End Spacer */}
            <div className="shrink-0 w-[33vw]" />
          </div>
          
          {/* Center Indicator (Subtle notch) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1.5 bg-primary rounded-full z-40" />
        </div>
        
        {/* 3. HUGE BALANCE */}
        <div className="relative flex items-baseline text-gradient-bronze-rich drop-shadow-sm scale-110 mt-8 pointer-events-auto">
          <span className="text-2xl font-medium mr-1 opacity-40 text-foreground">€</span>
          <span className="text-6xl font-black tracking-tighter tabular-nums">
            <OdometerValue value={currentMonthTotal} />
          </span>
        </div>
      </header>

      {/* SEARCH BAR (Slide down) */}
      {showSearchBar && (
        <div className="fixed top-[20rem] left-0 right-0 z-30 px-6 flex justify-center animate-slide-down">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca transazione..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {/* LIST CONTAINER */}
      <div className="flex-1 flex flex-col h-full w-full relative z-0">
        {loading && !expenses.length ? (
          <div className="flex-1 flex items-center justify-center pt-32">
            <div className="shimmer w-64 h-32 rounded-3xl opacity-50" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          // CLEAN EMPTY STATE (Minimal)
          <div className="flex-1 flex flex-col items-center justify-center pt-32 animate-fade-in text-center px-10">
            <p className="text-muted-foreground/40 text-sm font-medium tracking-wide">
              Nessuna voce per questo mese
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
      <div className="fixed bottom-0 left-0 right-0 h-32 z-20 pointer-events-none footer-fade opacity-90" />

      {/* CONSOLE DI COMANDO */}
      <nav className="fixed bottom-8 left-0 right-0 z-50 pointer-events-none">
        <div className="flex justify-center pointer-events-auto">
          <div className="relative flex items-center justify-between px-8 py-3 rounded-[2.5rem] glass-stone shadow-xl shadow-black/5 min-w-[300px]">
            
            {/* Search */}
            <button 
              onClick={toggleSearchBar}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${showSearchBar ? 'text-primary bg-primary/10' : 'text-muted-foreground/70 hover:bg-foreground/5'}`}
            >
              <Search className="w-6 h-6" strokeWidth={2} />
            </button>

            {/* GIANT FAB (Elevated) */}
            <div className="relative -top-10 mx-8">
              <button 
                onClick={handleSelectPhoto} 
                className="w-20 h-20 rounded-full fab-glass-bronze shadow-2xl flex items-center justify-center transform transition-transform active:scale-95 border-[4px] border-background"
              >
                <Plus className="w-9 h-9 text-white drop-shadow-md" strokeWidth={2.5} />
              </button>
            </div>

            {/* Theme */}
            <button 
              onClick={toggleTheme}
              className="w-12 h-12 rounded-full flex items-center justify-center text-muted-foreground/70 hover:bg-foreground/5 transition-all active:scale-95"
            >
              {theme === 'dark' ? (
                <Moon className="w-6 h-6" strokeWidth={2} />
              ) : (
                <Sun className="w-6 h-6" strokeWidth={2} />
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
          setCurrentDate(new Date(2026, 1, 1));
          setTimeout(() => {
            if (scrollRef.current) {
               const index = monthsList.findIndex(m => isSameMonth(m, new Date(2026, 1, 1)));
               if(index !== -1) {
                   const itemWidth = scrollRef.current.clientWidth / 3;
                   const pos = (index * itemWidth) - (scrollRef.current.clientWidth / 2) + (itemWidth / 2);
                   scrollRef.current.scrollTo({ left: pos, behavior: 'smooth' });
               }
            }
          }, 100);
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