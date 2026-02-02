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

  // RULER CONFIGURATION
  const ITEM_WIDTH = 120; // Larghezza fissa di ogni blocco mese in pixel

  // Range: +/- 12 mesi dalla data target
  const monthsList = useMemo(() => {
    const center = new Date(2026, 1, 1);
    const start = subMonths(center, 12);
    const end = addMonths(center, 12);
    return eachMonthOfInterval({ start, end });
  }, []);

  // Scroll to current month on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const index = monthsList.findIndex(m => isSameMonth(m, currentDate));
        if (index !== -1) {
          const containerWidth = scrollRef.current.clientWidth;
          // Calcolo per centrare l'elemento: (Index * Width) - (MetaSchermo) + (MetaOggetto)
          const scrollPos = (index * ITEM_WIDTH) - (containerWidth / 2) + (ITEM_WIDTH / 2);
          scrollRef.current.scrollTo({ left: scrollPos, behavior: 'instant' });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []); 

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
    // Troviamo il centro dello schermo
    const center = container.scrollLeft + (container.clientWidth / 2);
    // Indice = Centro / LarghezzaOggetto
    const index = Math.floor(center / ITEM_WIDTH);
    
    if (index >= 0 && index < monthsList.length) {
      const newMonth = monthsList[index];
      if (!isSameMonth(newMonth, currentDate)) {
        setCurrentDate(newMonth);
      }
    }
  };

  // SPACER CALCULATION:
  // Reduced header height to ~16.5rem due to wheel shrinking.
  // Spacer adjustments:
  // - Standard: 16.5rem header + gap -> 17.5rem spacer
  // - With Search: 17.5rem + search bar -> 21.5rem spacer
  const topSpacerHeight = showSearchBar ? 'h-[21.5rem]' : 'h-[17.5rem]';

  return (
    <div className="h-screen flex flex-col wallet-bg overflow-hidden relative font-sans">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* 1. HEADER FROSTED GLASS BACKGROUND */}
      {/* Reduced height to 16.5rem (approx 264px) */}
      <div className="fixed top-0 left-0 right-0 h-[16.5rem] z-40 pointer-events-none">
        {/* Strato sfocatura e colore diluito */}
        <div className="absolute inset-0 bg-background/60 dark:bg-[#121414]/60 backdrop-blur-xl shadow-lg border-b border-white/5 transition-all duration-300" />
        {/* Sfumatura inferiore per ammorbidire il taglio */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/10 to-transparent opacity-50" />
      </div>

      {/* BURGER MENU */}
      <div className="fixed top-0 right-0 z-50 p-6 pt-safe-top">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-background/40 backdrop-blur-md hover:bg-background/60 transition-all active:scale-95 border border-foreground/5 shadow-sm"
        >
          <Menu className="w-5 h-5 text-foreground/80" strokeWidth={2} />
        </button>
      </div>

      {/* MAXI HEADER CONTENT */}
      <header className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pt-safe-top pointer-events-none">
        
        {/* YEAR */}
        <div className="mb-2 opacity-60 animate-fade-in pointer-events-none">
          <span className="text-2xl font-bold tracking-[0.3em] text-foreground font-mono">
            {format(currentDate, "yyyy")}
          </span>
        </div>

        {/* RULER INTERFACE */}
        {/* Height reduced by 25% (h-24 -> h-[4.5rem]) */}
        <div className="relative w-full h-[4.5rem] flex items-end pointer-events-auto select-none">
          
          {/* MASCHERE LATERALI SFUMATE */}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background via-background/90 to-transparent z-20 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background via-background/90 to-transparent z-20 pointer-events-none" />
          
          {/* INDICATORE CENTRALE */}
          {/* Lowered bottom to 5 (20px) to match shorter items */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-5 z-30 flex flex-col items-center">
             <div className="w-[2px] h-10 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
             <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-red-500 mt-1" />
          </div>

          {/* SCROLL CONTAINER */}
          <div 
            ref={scrollRef}
            onScroll={handleWheelScroll}
            onTouchStart={() => setIsUserScrolling(true)}
            onTouchEnd={() => setTimeout(() => setIsUserScrolling(false), 500)}
            className="w-full h-full overflow-x-auto scrollbar-hide flex items-end snap-x snap-mandatory cursor-grab active:cursor-grabbing relative z-10 pb-2"
          >
            <div style={{ width: `calc(50vw - ${ITEM_WIDTH / 2}px)` }} className="shrink-0 h-full" />
            
            {monthsList.map((date, i) => {
              const isCurrent = isSameMonth(date, currentDate);
              return (
                <div 
                  key={i} 
                  style={{ width: `${ITEM_WIDTH}px` }}
                  // Item height reduced (h-20 -> h-[3.75rem] / 60px)
                  className="shrink-0 h-[3.75rem] snap-center flex flex-col justify-end group relative"
                >
                  <button 
                    onClick={() => {
                        if (scrollRef.current) {
                            const scrollPos = (i * ITEM_WIDTH) - (scrollRef.current.clientWidth / 2) + (ITEM_WIDTH / 2);
                            scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
                        }
                    }}
                    className="w-full h-full flex flex-col justify-end"
                  >
                    <div className="w-full h-10 flex items-end justify-between px-1 mb-2">
                      <div className={cn(
                        "w-[2px] rounded-t-sm transition-all duration-300",
                        isCurrent ? "h-10 bg-foreground" : "h-6 bg-foreground/30 group-hover:bg-foreground/50"
                      )} />
                      <div className="w-[1px] h-3 bg-foreground/10" />
                      <div className="w-[1px] h-3 bg-foreground/10" />
                      <div className="w-[1px] h-3 bg-foreground/10" />
                      <div className="w-[1px] h-3 bg-foreground/10" />
                    </div>
                    <div className="absolute bottom-0 left-0 w-full text-left pl-1">
                      <span className={cn(
                        "text-xs font-bold tracking-widest transition-all duration-300 block transform -translate-x-[40%]", 
                        isCurrent ? "text-foreground scale-110" : "text-muted-foreground/50 scale-90"
                      )}>
                        {format(date, "MMM", { locale: it }).toUpperCase()}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
            
            <div style={{ width: `calc(50vw - ${ITEM_WIDTH / 2}px)` }} className="shrink-0 h-full" />
          </div>
        </div>
        
        {/* HUGE BALANCE */}
        {/* Margin top reduced to 15px */}
        <div className="relative flex items-baseline text-gradient-bronze-rich drop-shadow-sm scale-110 mt-[15px] pointer-events-auto">
          <span className="text-2xl font-medium mr-1 opacity-40 text-foreground">€</span>
          <span className="text-6xl font-black tracking-tighter tabular-nums">
            <OdometerValue value={currentMonthTotal} />
          </span>
        </div>
      </header>

      {/* SEARCH BAR */}
      {/* Moved up to 17rem to match new header bottom */}
      {showSearchBar && (
        <div className="fixed top-[17rem] left-0 right-0 z-40 px-6 flex justify-center animate-slide-down">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca transazione..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {/* LIST CONTAINER WITH MASK */}
      <div 
        className="flex-1 flex flex-col h-full w-full relative z-0"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0px, black 160px, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 160px, black 100%)'
        }}
      >
        {loading && !expenses.length ? (
          <div className="flex-1 flex items-center justify-center pt-32">
            <div className="shimmer w-64 h-32 rounded-3xl opacity-50" />
          </div>
        ) : filteredExpenses.length === 0 ? (
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
          <div className="relative flex items-center justify-between px-6 py-2 rounded-[2rem] glass-stone shadow-xl shadow-black/5 min-w-[280px]">
            
            <button 
              onClick={toggleSearchBar}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${showSearchBar ? 'text-primary bg-primary/10' : 'text-muted-foreground/70 hover:bg-foreground/5'}`}
            >
              <Search className="w-5 h-5" strokeWidth={2} />
            </button>

            <div className="relative mx-6">
              <button 
                onClick={handleSelectPhoto} 
                className="w-14 h-14 rounded-full fab-glass-bronze shadow-lg flex items-center justify-center transform transition-transform active:scale-95 border-[3px] border-background"
              >
                <Plus className="w-7 h-7 text-white drop-shadow-sm" strokeWidth={2.5} />
              </button>
            </div>

            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground/70 hover:bg-foreground/5 transition-all active:scale-95"
            >
              {theme === 'dark' ? (
                <Moon className="w-5 h-5" strokeWidth={2} />
              ) : (
                <Sun className="w-5 h-5" strokeWidth={2} />
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
                   const scrollPos = (index * ITEM_WIDTH) - (scrollRef.current.clientWidth / 2) + (ITEM_WIDTH / 2);
                   scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
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