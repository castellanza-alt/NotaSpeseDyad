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

  return (
    <div className="h-screen flex flex-col archive-gradient overflow-hidden relative">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* 
        PREMIUM HEADER GRADIENT OVERLAY 
        Sits behind the pill but on top of the list.
        Uses z-20 to be above list (z-0) but below search (z-30) and pill (z-40).
        h-40 (160px) ensures the fade starts ~20px below the pill bottom.
      */}
      <div className="fixed top-0 left-0 right-0 h-40 z-20 pointer-events-none header-gradient-overlay" />

      {/* Pill Superiore (Fluttuante) */}
      <header className="fixed top-0 left-0 right-0 z-40 flex justify-center pt-safe-top mt-3 pointer-events-none">
        <div className="dock-pill flex flex-col items-center justify-center px-4 py-3 max-w-sm w-full shadow-xl pointer-events-auto">
          <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Mese Corrente</p>
          <span className="text-white text-2xl font-bold tracking-tight leading-none">
            € <OdometerValue value={currentMonthTotal} />
          </span>
        </div>
      </header>

      {/* Search Bar */}
      {showSearchBar && (
        <div className="fixed top-36 left-0 right-0 z-30 px-4 flex justify-center animate-slide-down">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca esercente, importo o data..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {/* 
        List Container 
        Spacer adjusted to h-44 (176px) to match new overlay height of 160px.
        Card starts at 176px, well clear of the fade.
      */}
      <div className="flex-1 flex flex-col h-full w-full">
        {loading && !expenses.length ? (
          <div className="flex-1 flex items-center justify-center pt-48">
            <div className="shimmer w-48 h-32 rounded-2xl" />
          </div>
        ) : (
          <VirtualizedExpenseList
            expenses={expenses}
            lastAddedId={lastAddedId}
            onExpenseClick={setSelectedExpense}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            paddingClassName={showSearchBar ? 'h-[16.5rem]' : 'h-44'}
          />
        )}
      </div>

      {/* 
        BOTTOM GRADIENT OVERLAY
        Sits above the list but below the dock pill.
        h-40 matches the top overlay for consistency.
      */}
      <div className="fixed bottom-0 left-0 right-0 h-40 z-20 pointer-events-none footer-gradient-overlay" />

      {/* Floating Bottom Dock (Pill Inferiore) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="relative px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-0 flex justify-center pointer-events-auto">
          <div className="dock-pill dock-pill-row items-center justify-between px-4 py-3 max-w-sm w-full gap-4 shadow-xl">
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="dock-button"><Moon className="w-5 h-5" /></button>
              <button onClick={toggleSearchBar} className="dock-button"><Search className="w-5 h-5" /></button>
              <button onClick={() => setSettingsOpen(true)} className="dock-button"><Menu className="w-5 h-5" /></button>
            </div>
            <button onClick={handleSelectPhoto} className="fab-button">
              <Plus className="w-9 h-9" />
            </button>
          </div>
        </div>
      </nav>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} showTrigger={false} />

      {showSuccess && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="glass-strong flex items-center gap-3 px-5 py-3 rounded-full">
            <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-success" />
            </div>
            <span className="text-foreground font-medium">Operazione completata!</span>
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