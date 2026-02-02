import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useExpenses, Expense } from "@/hooks/useExpenses";
import { Moon, Menu, Plus, Check, Search, ChevronLeft, ChevronRight, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { SettingsSheet } from "./SettingsSheet";
import { ImageAnalyzer } from "./ImageAnalyzer";
import { OdometerValue } from "./OdometerValue";
import { ExpenseDetail } from "./ExpenseDetail";
import { SearchBar } from "./SearchBar";
import { VirtualizedExpenseList } from "./VirtualizedExpenseList";
import { format, addMonths, subMonths, isSameMonth } from "date-fns";
import { it } from "date-fns/locale";

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

  // Month Navigation
  const nextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  const prevMonth = () => setCurrentDate(prev => subMonths(prev, 1));

  // Dynamic spacer calculation
  const topSpacerHeight = showSearchBar ? 'h-[18rem]' : 'h-52';

  return (
    <div className="h-screen flex flex-col wallet-bg overflow-hidden relative">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* HEADER FADE */}
      <div className="fixed top-0 left-0 right-0 h-64 z-20 pointer-events-none header-fade" />

      {/* TOP RIGHT: Burger Menu */}
      <div className="fixed top-0 right-0 z-50 p-6 pt-safe-top">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-background/50 backdrop-blur-md shadow-sm border border-black/5 active:scale-95 transition-all"
        >
          <Menu className="w-5 h-5 text-foreground" strokeWidth={2} />
        </button>
      </div>

      {/* CENTER HEADER: Month Carousel & Balance */}
      <header className="fixed top-0 left-0 right-0 z-40 flex flex-col items-center pt-safe-top mt-2 pointer-events-none">
        
        {/* Month Carousel */}
        <div className="pointer-events-auto flex items-center gap-4 mb-2 bg-background/30 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-sm">
          <button onClick={prevMonth} className="p-1 hover:bg-black/5 rounded-full transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <span className="text-xs font-bold uppercase tracking-[2px] text-foreground w-28 text-center select-none">
            {format(currentDate, "MMMM yyyy", { locale: it })}
          </span>

          <button onClick={nextMonth} className="p-1 hover:bg-black/5 rounded-full transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {/* Huge Balance */}
        <div className="relative flex items-baseline text-gradient-bronze-rich drop-shadow-sm scale-110 pointer-events-auto">
          <span className="text-xl font-semibold mr-1.5 opacity-60 text-foreground/50">€</span>
          <span className="text-5xl font-black tracking-tighter">
            <OdometerValue value={currentMonthTotal} />
          </span>
        </div>
      </header>

      {/* Search Bar (Slide down) */}
      {showSearchBar && (
        <div className="fixed top-48 left-0 right-0 z-30 px-6 flex justify-center animate-slide-down">
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
        ) : (
          <VirtualizedExpenseList
            expenses={filteredExpenses}
            lastAddedId={lastAddedId}
            onExpenseClick={setSelectedExpense}
            onExpenseDelete={deleteExpense}
            onExpenseEdit={(expense) => setSelectedExpense(expense)} // Opens detail in view mode (can switch to edit inside)
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            paddingClassName={topSpacerHeight}
          />
        )}
      </div>

      {/* FOOTER FADE */}
      <div className="fixed bottom-0 left-0 right-0 h-48 z-20 pointer-events-none footer-fade" />

      {/* BOTTOM ACTION BAR (Floating) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="flex justify-center pointer-events-auto">
          <div className="flex items-center gap-6 px-6 py-2 rounded-full glass-stone shadow-xl border border-white/10">
            
            {/* Left: Search (Minimal) */}
            <button 
              onClick={toggleSearchBar}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showSearchBar ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-black/5'}`}
            >
              <Search className="w-6 h-6" strokeWidth={2} />
            </button>

            {/* Center: GIANT FAB (+25% bigger) */}
            <button 
              onClick={handleSelectPhoto} 
              className="w-20 h-20 rounded-full fab-glass-bronze -mt-8 shadow-2xl flex items-center justify-center transform transition-transform active:scale-95"
            >
              <Plus className="w-10 h-10 text-white drop-shadow-md" strokeWidth={3} />
            </button>

            {/* Right: Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-12 h-12 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 transition-all"
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

      {/* Settings Sheet (Triggered via Burger Menu) */}
      <SettingsSheet 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        showTrigger={false} 
        expenses={expenses}
      />

      {showSuccess && (
        <div className="fixed top-48 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="glass-stone flex items-center gap-4 px-6 py-4 rounded-full shadow-lg border border-success/20">
            <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
            <span className="text-slate-green font-bold text-sm tracking-wide uppercase">Salvato</span>
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