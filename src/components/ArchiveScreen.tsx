import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useExpenses, Expense } from "@/hooks/useExpenses";
import { Moon, Menu, Plus, Check, Search, Sun, LayoutDashboard, Settings, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useHaptic } from "@/hooks/use-haptic";
import { SettingsSheet } from "./SettingsSheet";
import { ImageAnalyzer } from "./ImageAnalyzer";
import { OdometerValue } from "./OdometerValue";
import { ExpenseDetail } from "./ExpenseDetail";
import { SearchBar } from "./SearchBar";
import { VirtualizedExpenseList } from "./VirtualizedExpenseList";
import { MonthlyReport } from "./MonthlyReport";
import { format, isSameMonth } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export function ArchiveScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  
  // RESPONSIVE STATE
  const [columns, setColumns] = useState(1);
  const [isDesktop, setIsDesktop] = useState(false);
  
  // START DATE: Current Date or loaded from data
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [availableMonths, setAvailableMonths] = useState<Date[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { theme, toggleTheme } = useTheme();
  const { trigger: haptic } = useHaptic();

  // RULER CONFIGURATION
  const ITEM_WIDTH = 120; // Larghezza fissa di ogni blocco mese in pixel

  // Responsive Handler
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      
      let cols = 1;
      let desktop = false;

      if (width < 768) {
        cols = 1; // Mobile
        desktop = false;
      } else if (width >= 768 && width <= 1024 && !isLandscape) {
        cols = 2; // Tablet Verticale
        desktop = true; // Sidebar mode starts at tablet
      } else {
        cols = 3; // Desktop or Tablet Landscape
        desktop = true;
      }

      setColumns(cols);
      setIsDesktop(desktop);
    };

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch available months from DB
  const fetchAvailableMonths = useCallback(async () => {
    // Removed deleted_at check to avoid errors
    const { data } = await supabase
      .from('expenses')
      .select('expense_date')
      .not('expense_date', 'is', null)
      .order('expense_date', { ascending: false });

    if (data && data.length > 0) {
      const uniqueMonths = new Set<string>();
      data.forEach(e => {
        if (!e.expense_date) return;
        const date = new Date(e.expense_date);
        // Normalize to 1st of month: YYYY-MM-01
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        uniqueMonths.add(key);
      });
      
      const dates = Array.from(uniqueMonths).map(dateStr => new Date(dateStr));
      
      // Sort descending (Recent first)
      dates.sort((a, b) => b.getTime() - a.getTime());
      
      setAvailableMonths(dates);
      
      if (dates.length > 0) {
          // Check if current date is in the list
          const found = dates.find(d => isSameMonth(d, currentDate));
          if (!found) {
              setCurrentDate(dates[0]);
          }
      }
    } else {
      // Fallback if no data
      setAvailableMonths([new Date()]);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  // Scroll to current month on mount or change (Mobile Only)
  const scrollToMonth = (targetDate: Date) => {
    if (scrollRef.current && availableMonths.length > 0) {
      const index = availableMonths.findIndex(m => isSameMonth(m, targetDate));
      if (index !== -1) {
        const containerWidth = scrollRef.current.clientWidth;
        const scrollPos = (index * ITEM_WIDTH) - (containerWidth / 2) + (ITEM_WIDTH / 2);
        scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    if (!isDesktop) {
      const timer = setTimeout(() => {
         scrollToMonth(currentDate);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isDesktop, availableMonths, currentDate]);

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
    fetchAvailableMonths(); // Refresh month list in case a new month was created
    setShowSuccess(true);
    haptic('success');
    setTimeout(() => setShowSuccess(false), 2500);
  }, [refetch, fetchAvailableMonths, haptic]);

  const toggleSearchBar = () => {
    haptic('light');
    setShowSearchBar(prev => !prev);
    if (showSearchBar) setSearchQuery("");
  };

  const handleWheelScroll = () => {
    if (!scrollRef.current || isDesktop) return;
    
    const container = scrollRef.current;
    const center = container.scrollLeft + (container.clientWidth / 2);
    const index = Math.floor(center / ITEM_WIDTH);
    
    if (index >= 0 && index < availableMonths.length) {
      const newMonth = availableMonths[index];
      if (!isSameMonth(newMonth, currentDate)) {
        setCurrentDate(newMonth);
      }
    }
  };

  const handleReportMonthChange = (newDate: Date) => {
    setCurrentDate(newDate);
    if (!isDesktop) scrollToMonth(newDate);
  };

  // Adjusted spacer for the new compact header
  // Header height roughly: pt-safe-top + padding + hero (80px) + gap (20px) + ruler (60px) ~ 200px (12.5rem)
  const topSpacerHeight = showSearchBar ? 'h-[16rem]' : 'h-[13rem]';

  // --- DESKTOP COMPONENTS ---

  const NavigationRail = () => (
    <div className="hidden md:flex flex-col items-center py-8 w-[80px] h-screen fixed left-0 top-0 z-50 border-r border-border/20 bg-background/50 backdrop-blur-xl">
      <div className="h-4" />

      <div className="flex flex-col gap-6 w-full items-center">
        <button 
          onClick={() => { haptic('light'); handleSelectPhoto(); }}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button 
           onClick={toggleSearchBar}
           className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-secondary/50", showSearchBar ? "bg-secondary text-primary" : "text-muted-foreground")}
        >
          <Search className="w-5 h-5" />
        </button>

        <button 
           onClick={toggleTheme}
           className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-secondary/50 text-muted-foreground"
        >
          {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-6 items-center">
        <button 
           onClick={() => setSettingsOpen(true)}
           className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-secondary/50 text-muted-foreground"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const DesktopSidebar = () => (
    <div className="hidden md:flex flex-col w-[25%] h-screen fixed left-[80px] top-0 z-40 p-8 border-r border-border/20 bg-background/30 backdrop-blur-lg">
      <h1 className="text-3xl font-black tracking-tight text-foreground mb-6 drop-shadow-sm">
        Nota Spese
      </h1>

      <div className="mb-8">
        <MonthlyReport 
            expenses={filteredExpenses} 
            currentDate={currentDate} 
            total={currentMonthTotal}
            onMonthChange={handleReportMonthChange}
        >
          <div className="w-full bg-card/60 backdrop-blur-md p-6 rounded-3xl border border-border/30 shadow-sm text-left group hover:bg-card/80 transition-all cursor-pointer">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Saldo Mensile</p>
            <div className="flex items-baseline text-gradient-bronze-rich">
                <span className="text-2xl font-medium mr-1 opacity-60">€</span>
                <span className="text-4xl font-black tracking-tighter tabular-nums">
                  <OdometerValue value={currentMonthTotal} />
                </span>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs font-medium text-primary">
               <LayoutDashboard className="w-4 h-4" />
               Vedi Report Completo
            </div>
          </div>
        </MonthlyReport>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-1 scrollbar-hide">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Periodo</p>
        {availableMonths.map((date, i) => {
          const isCurrent = isSameMonth(date, currentDate);
          return (
            <button
              key={i}
              onClick={() => setCurrentDate(date)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm backdrop-blur-sm",
                isCurrent 
                  ? "bg-primary text-primary-foreground font-bold shadow-md" 
                  : "hover:bg-secondary/40 text-muted-foreground"
              )}
            >
              <span>{format(date, "MMMM yyyy", { locale: it })}</span>
              {isCurrent && <Check className="w-4 h-4" />}
            </button>
          )
        })}
      </div>
    </div>
  );


  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden relative font-sans bg-transparent">
      {/* 
          IMPORTANT: bg-transparent on container. 
          The background image is on the BODY tag (fixed).
      */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* --- MOBILE COMPONENTS --- */}
      
      <div className="md:hidden fixed top-0 left-0 right-0 h-[13rem] z-40 pointer-events-none">
        {/* Adjusted header backdrop to be glassy but not opaque */}
        <div className="absolute inset-0 bg-background/40 backdrop-blur-xl border-b border-white/5 transition-all duration-300" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background/10 to-transparent opacity-50" />
      </div>

      <div className="md:hidden fixed top-0 right-0 z-50 p-6 pt-safe-top">
        <button
          onClick={() => { haptic('light'); setSettingsOpen(true); }}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-background/20 backdrop-blur-md hover:bg-background/40 transition-all active:scale-95 border border-foreground/5 shadow-sm"
        >
          <Menu className="w-5 h-5 text-foreground/80" strokeWidth={2} />
        </button>
      </div>

      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex flex-col items-center pt-safe-top pointer-events-none">
        
        {/* LEVEL 1: HERO AMOUNT & UTILITIES */}
        <div className="relative w-full px-6 pt-4 flex items-center justify-between pointer-events-auto">
          <button
            onClick={() => { haptic('light'); toggleTheme(); }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-background/20 backdrop-blur-md hover:bg-background/40 border border-foreground/5 shadow-sm transition-all active:scale-95 text-muted-foreground"
          >
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <MonthlyReport 
            expenses={filteredExpenses} 
            currentDate={currentDate} 
            total={currentMonthTotal}
            onMonthChange={handleReportMonthChange}
          >
            <div 
              className="flex items-baseline text-gradient-bronze-rich drop-shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => haptic('light')}
            >
              <span className="text-2xl font-medium mr-1 opacity-40 text-foreground">€</span>
              <span className="text-6xl font-bold tracking-tighter tabular-nums text-shadow-sm">
                <OdometerValue value={currentMonthTotal} />
              </span>
            </div>
          </MonthlyReport>

          <button 
            onClick={toggleSearchBar}
            className={`w-10 h-10 rounded-full flex items-center justify-center bg-background/20 backdrop-blur-md border border-foreground/5 shadow-sm transition-all active:scale-95 ${showSearchBar ? 'text-primary bg-primary/20 border-primary/20' : 'text-muted-foreground hover:bg-background/40'}`}
          >
            <Search className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* LEVEL 2: RULER (FILTER) - COMPACTED */}
        <div className="relative w-full h-[3.5rem] mt-4 flex items-end pointer-events-auto select-none">
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background/40 via-background/20 to-transparent z-20 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background/40 via-background/20 to-transparent z-20 pointer-events-none" />
          
          <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-30 flex flex-col items-center">
             <div className="w-[2px] h-6 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
          </div>

          <div 
            ref={scrollRef}
            onScroll={handleWheelScroll}
            className="w-full h-full overflow-x-auto scrollbar-hide flex items-end snap-x snap-mandatory cursor-grab active:cursor-grabbing relative z-10 pb-2"
          >
            <div style={{ width: `calc(50vw - ${ITEM_WIDTH / 2}px)` }} className="shrink-0 h-full" />
            
            {availableMonths.map((date, i) => {
              const isCurrent = isSameMonth(date, currentDate);
              const monthStr = format(date, "MMM", { locale: it }).toUpperCase();
              const yearStr = format(date, "yy");
              
              return (
                <div 
                  key={i} 
                  style={{ width: `${ITEM_WIDTH}px` }}
                  className="shrink-0 h-[3rem] snap-center flex flex-col justify-end group relative"
                >
                  <button 
                    onClick={() => scrollToMonth(date)}
                    className="w-full h-full flex flex-col justify-end items-center"
                  >
                    <div className="absolute bottom-0 text-center w-full">
                      <span className={cn(
                        "font-mono tracking-widest transition-all duration-300 block", 
                        isCurrent ? "text-foreground scale-110" : "text-muted-foreground/50 scale-90"
                      )}>
                        <span className="text-sm font-bold">{monthStr}</span>
                        <span className="text-xs font-normal opacity-70 ml-0.5">-{yearStr}</span>
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
            
            <div style={{ width: `calc(50vw - ${ITEM_WIDTH / 2}px)` }} className="shrink-0 h-full" />
          </div>
        </div>
      </header>
      
      <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <button
          onClick={() => { haptic('light'); handleSelectPhoto(); }}
          className="w-[74px] h-[74px] rounded-full fab-glass-bronze shadow-2xl flex items-center justify-center transform transition-all active:scale-95 hover:scale-105 border-[4px] border-white/20 backdrop-blur-sm"
        >
          <Plus className="w-10 h-10 text-white drop-shadow-sm" strokeWidth={2.5} />
        </button>
      </div>

      {/* --- DESKTOP STRUCTURE --- */}
      <NavigationRail />
      <DesktopSidebar />

      {showSearchBar && (
        <div className={cn(
           "fixed z-[60] flex justify-center animate-slide-down",
           isDesktop ? "top-8 left-[calc(25%_+_80px)] right-0" : "top-[13.5rem] left-0 right-0 px-6"
        )}>
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca transazione..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {/* LIST CONTAINER */}
      <div className={cn(
        "flex-1 flex flex-col h-full relative z-0 transition-all duration-300",
        isDesktop ? "ml-[calc(80px_+_25%)] w-[calc(100%_-_80px_-_25%)]" : "w-full"
      )}>
        {!isDesktop && (
          <div className="absolute top-0 left-0 right-0 h-full pointer-events-none z-10"
             style={{
               maskImage: 'linear-gradient(to bottom, transparent 0px, black 160px, black 100%)',
               WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 160px, black 100%)'
             }} 
          />
        )}
        
        {loading && !expenses.length ? (
          <div className="flex-1 flex items-center justify-center pt-32">
            <div className="shimmer w-64 h-32 rounded-3xl opacity-50 backdrop-blur-sm" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center pt-32 animate-fade-in text-center px-10">
            <div className="bg-background/20 backdrop-blur-md p-6 rounded-3xl border border-white/5">
              <p className="text-muted-foreground text-sm font-medium tracking-wide">
                Nessuna voce per questo mese
              </p>
            </div>
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
            paddingClassName={isDesktop ? "h-24" : topSpacerHeight}
            columns={columns}
          />
        )}
      </div>

      {!isDesktop && (
        <div className="fixed bottom-0 left-0 right-0 h-32 z-20 pointer-events-none footer-fade opacity-90" />
      )}

      <SettingsSheet 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        showTrigger={false} 
        expenses={expenses}
        onDataGenerated={() => {
          refetch();
          fetchAvailableMonths();
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