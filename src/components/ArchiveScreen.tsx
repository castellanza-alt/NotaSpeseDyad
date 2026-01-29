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
  
  // Debounce search to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
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
    <div className="h-screen flex flex-col archive-gradient overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      <header className="archive-header flex-shrink-0 z-40">
        <div className="px-6 pt-safe-top pb-6 text-center">
          <p className="text-white/80 text-sm font-medium mb-1">Registrati nel mese</p>
          <div className="flex items-center justify-center">
            <span className="text-white text-4xl font-bold tracking-tight">
              € <OdometerValue value={currentMonthTotal} />
            </span>
          </div>
        </div>
      </header>

      {showSearchBar && (
        <div className="flex-shrink-0 px-4 py-4 z-30 flex justify-center animate-slide-down">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca esercente o categoria..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {loading && !expenses.length ? (
        <div className="flex-1 flex items-center justify-center">
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
        />
      )}

      <div className="flex-shrink-0 h-32" />

      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="archive-footer absolute inset-0" />
        <div className="relative px-4 pb-safe-bottom pt-6">
          <div className="dock-pill flex items-center justify-between px-4 py-3 mx-auto max-w-sm">
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="dock-button"><Moon className="w-5 h-5" /></button>
              <button onClick={toggleSearchBar} className="dock-button"><Search className="w-5 h-5" /></button>
              <button onClick={() => setSettingsOpen(true)} className="dock-button"><Menu className="w-5 h-5" /></button>
            </div>
            <button onClick={handleSelectPhoto} className="fab-button"><Plus className="w-7 h-7" /></button>
          </div>
        </div>
      </nav>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} showTrigger={false} />

      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
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