import { useState, useRef, useMemo, useCallback } from "react";
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
  const [showSearchBar, setShowSearchBar] = useState(false); // New state for search bar visibility
  const { theme, toggleTheme } = useTheme();
  const { expenses, loading, refetch, lastAddedId, hasMore, loadingMore, loadMore } = useExpenses();

  // Calculate current month total
  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return expenses
      .filter(expense => {
        if (!expense.expense_date) return false;
        const expenseDate = new Date(expense.expense_date);
        return expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
      })
      .reduce((sum, expense) => sum + (expense.total || 0), 0);
  }, [expenses]);

  // Filter expenses based on search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    
    const query = searchQuery.toLowerCase().trim();
    return expenses.filter(expense => {
      const merchant = (expense.merchant || "").toLowerCase();
      const category = (expense.category || "").toLowerCase();
      const total = expense.total?.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "";
      
      let dateString = "";
      let dayOfWeek = "";
      let monthName = "";
      if (expense.expense_date) {
        const expenseDate = new Date(expense.expense_date);
        dateString = format(expenseDate, "yyyy-MM-dd", { locale: it }).toLowerCase();
        dayOfWeek = format(expenseDate, "EEEE", { locale: it }).toLowerCase();
        monthName = format(expenseDate, "MMMM", { locale: it }).toLowerCase();
      }
      
      return merchant.includes(query) || 
             category.includes(query) || 
             total.includes(query.replace(',', '.')) || // Allow searching with comma or dot
             dateString.includes(query) ||
             dayOfWeek.includes(query) ||
             monthName.includes(query);
    });
  }, [expenses, searchQuery]);

  const handleSelectPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
    e.target.value = "";
  };

  const handleClose = () => {
    setSelectedImage(null);
  };

  const handleSuccess = useCallback(() => {
    setSelectedImage(null);
    
    // Refetch expenses to show new card
    refetch();
    
    // Show success toast
    setShowSuccess(true);
    
    // Hide success toast after delay
    setTimeout(() => {
      setShowSuccess(false);
    }, 2500);
  }, [refetch]);

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
  };

  const handleExpenseClose = () => {
    setSelectedExpense(null);
  };

  const handleExpenseDelete = () => {
    refetch();
  };

  const handleExpenseUpdate = () => {
    refetch();
  };

  const toggleSearchBar = () => {
    setShowSearchBar(prev => !prev);
    if (searchQuery && !showSearchBar) { // Clear search when hiding
      setSearchQuery("");
    }
  };

  return (
    <div className="h-screen flex flex-col archive-gradient overflow-hidden">
      {/* Hidden file input */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Header - Fixed with high z-index */}
      <header className="archive-header flex-shrink-0 z-40">
        <div className="px-6 pt-safe-top pb-6 text-center">
          <p className="text-white/80 text-sm font-medium tracking-wide mb-1">
            Registrati Finora
          </p>
          <div className="flex items-center justify-center">
            <span className="text-white text-4xl font-bold tracking-tight">
              € <OdometerValue value={currentMonthTotal} />
            </span>
          </div>
        </div>
      </header>

      {/* Search Bar - Conditionally rendered */}
      {showSearchBar && (
        <div className="flex-shrink-0 px-4 py-4 z-30 flex justify-center animate-slide-down">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            placeholder="Cerca esercente, categoria, data, importo..."
            isOpen={showSearchBar}
          />
        </div>
      )}

      {/* Cards Container - Virtualized, Scrollable */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="shimmer w-48 h-32 rounded-2xl" />
        </div>
      ) : (
        <VirtualizedExpenseList
          expenses={filteredExpenses}
          lastAddedId={lastAddedId}
          onExpenseClick={handleExpenseClick}
          hasMore={hasMore && !searchQuery}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}

      {/* Bottom spacer for dock */}
      <div className="flex-shrink-0 h-32" />

      {/* Bottom Navigation Dock - Higher z-index than cards */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        {/* Background ribbon matching header */}
        <div className="archive-footer absolute inset-0" />
        
        {/* Dock content */}
        <div className="relative px-4 pb-safe-bottom pt-6">
          <div className="dock-pill flex items-center justify-between px-4 py-3 mx-auto max-w-sm">
            {/* Left Side - Theme & Settings */}
            <div className="flex items-center gap-2">
              {/* Moon / Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="dock-button"
                aria-label={theme === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro"}
              >
                <Moon className="w-5 h-5" strokeWidth={1.5} />
              </button>
              
              {/* Search Button */}
              <button
                onClick={toggleSearchBar}
                className="dock-button"
                aria-label="Cerca spese"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>

              {/* Menu / Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="dock-button"
                aria-label="Impostazioni"
              >
                <Menu className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Right Side - FAB */}
            <button
              onClick={handleSelectPhoto}
              className="fab-button"
              aria-label="Nuovo giustificativo"
            >
              <Plus className="w-7 h-7" strokeWidth={2} />
            </button>
          </div>
        </div>
      </nav>

      {/* Settings Sheet */}
      <SettingsSheet 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        showTrigger={false}
      />

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="glass-strong flex items-center gap-3 px-5 py-3 rounded-full">
            <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-success" strokeWidth={2} />
            </div>
            <span className="text-foreground font-medium">Inviato con successo!</span>
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <ExpenseDetail
          expense={selectedExpense}
          onClose={handleExpenseClose}
          onDelete={handleExpenseDelete}
          onUpdate={handleExpenseUpdate}
        />
      )}

      {/* Image Analyzer Modal */}
      {selectedImage && (
        <ImageAnalyzer 
          imageFile={selectedImage} 
          onClose={handleClose} 
          onSuccess={handleSuccess} 
        />
      )}
    </div>
  );
}