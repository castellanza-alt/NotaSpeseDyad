import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useExpenses, Expense } from "@/hooks/useExpenses";
import { Moon, Menu, Plus, Check, Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { SettingsSheet } from "./SettingsSheet";
import { ImageAnalyzer } from "./ImageAnalyzer";
import { OdometerValue } from "./OdometerValue";
import { ExpenseDetail } from "./ExpenseDetail";
import { SearchBar } from "./SearchBar";
import { VirtualizedExpenseList } from "./VirtualizedExpenseList";
import { format } from "date-fns";
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
  
  const { theme, toggleTheme } = useTheme();
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { expenses, loading, refetch, lastAddedId, hasMore, loadingMore, loadMore, deleteExpense } = useExpenses({
    searchQuery: debouncedSearch
  });

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return expenses
      .filter(expense => {
        if (!expense.expense_date) return false;
        const d = new Date(expense.expense_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, e) => sum + (e.total || 0), 0);
  }, [expenses]);

  const currentMonthName = useMemo(() => {
    return format(new Date(), "MMMM", { locale: it }).toUpperCase();
  }, []);

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

  const topSpacerHeight = showSearchBar ? 'h-[17rem]' : 'h-48';

  return (
    <div className="h-screen flex flex-col wallet-bg overflow-hidden relative">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* 
        HEADER FADE OVERLAY
      */}
      <div className="fixed top-0 left-0 right-0 h-48 z-20 pointer-events-none header-fade" />

      {/* Header (Liquid Glass) */}
      <header className="fixed top-0 left-0 right-0 z-40 flex justify-center pt-safe-top mt-4 pointer-events-none">
        <div className="flex flex-col items-center justify-center min-w-[280px] pointer-events-auto">
          {/* Dynamic Title */}
          <p className="text-olive text-[10px] font-bold uppercase tracking-[2px] mb-2">
            SPESE DI {currentMonthName}
          </p>
          
          {/* Huge Balance - Coffee Brown */}
          <div className="flex items-baseline text-coffee dark:text-foreground drop-shadow-sm scale-110">
            <span className="text-xl font-semibold mr-1.5 opacity-60">€</span>
            <span className="text-5xl font-black tracking-tighter">
              <OdometerValue value={currentMonthTotal} />
            </span>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      {showSearchBar && (
        <div className="fixed top-44 left-0 right-0 z-30 px-6 flex justify-center animate-slide-down">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca transazione..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {/* List Container - Single Column */}
      <div className="flex-1 flex flex-col h-full w-full">
        {loading && !expenses.length ? (
          <div className="flex-1 flex items-center justify-center pt-48">
            <div className="shimmer w-64 h-32 rounded-3xl opacity-50" />
          </div>
        ) : (
          <VirtualizedExpenseList
            expenses={expenses}
            lastAddedId={lastAddedId}
            onExpenseClick={setSelectedExpense}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            paddingClassName={topSpacerHeight}
          />
        )}
      </div>

      {/* 
        FOOTER FADE OVERLAY
      */}
      <div className="fixed bottom-0 left-0 right-0 h-48 z-20 pointer-events-none footer-fade" />

      {/* Bottom Dock (Frosted Stone) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="relative px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-0 flex justify-center pointer-events-auto">
          <div className="dock-pill dock-pill-row glass-stone items-center justify-between px-6 py-3 min-w-[300px] gap-6 backdrop-blur-[40px] shadow-lg">
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="dock-button group">
                <Moon className="w-5 h-5 group-hover:fill-current transition-all" />
              </button>
              <button onClick={toggleSearchBar} className="dock-button group">
                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
              <button onClick={() => setSettingsOpen(true)} className="dock-button group">
                <Menu className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              </button>
            </div>
            {/* FAB Button with Olive Accent */}
            <button onClick={handleSelectPhoto} className="fab-button bg-[#7A8068] text-[#FFFCF2] shadow-xl hover:scale-105 transition-transform flex items-center justify-center w-14 h-14 rounded-full">
              <Plus className="w-8 h-8" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </nav>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} showTrigger={false} />

      {showSuccess && (
        <div className="fixed top-44 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
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