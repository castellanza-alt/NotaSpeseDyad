import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { X, Trash2, Pencil, Receipt, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Expense } from "@/hooks/useExpenses";

interface ExpenseDetailProps {
  expense: Expense;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}

export function ExpenseDetail({ expense, onClose, onDelete, onUpdate }: ExpenseDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  
  const [merchant, setMerchant] = useState(expense.merchant || "");
  // Initialize total with comma for display
  const [total, setTotal] = useState(expense.amount?.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0,00");
  const [category, setCategory] = useState(expense.category || "");
  const [expenseDate, setExpenseDate] = useState(expense.date || "");

  const formattedDate = expense.date 
    ? format(new Date(expense.date), "d MMMM yyyy", { locale: it })
    : "—";

  const formattedTotal = expense.amount?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("transactions" as any)
        .delete()
        .eq("id", expense.id);
      
      if (error) throw error;
      onDelete();
      onClose();
    } catch (error) {
      console.error("Error deleting expense:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert comma to dot for parsing
      const parsedTotal = parseFloat(total.replace(',', '.')) || 0;

      const { error } = await supabase
        .from("transactions" as any)
        .update({
          merchant,
          amount: parsedTotal,
          category,
          date: expenseDate,
        })
        .eq("id", expense.id);
      
      if (error) throw error;
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating expense:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Card - Added bg-card and styling */}
      <div className="relative w-full max-w-md max-h-[85vh] bg-card text-card-foreground rounded-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="text-lg font-bold">
            {isEditing ? "Modifica Spesa" : "Dettaglio Spesa"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content - Scrollable area */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Esercente</label>
                <Input
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Importo (€)</label>
                <Input
                  type="text" 
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Categoria</label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Data</label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground mb-1 font-medium tracking-wide uppercase">{formattedDate}</p>
                <h3 className="text-2xl font-bold mb-2">
                  {expense.merchant || "Sconosciuto"}
                </h3>
                <p className="text-4xl font-bold text-primary tracking-tight">
                  €{formattedTotal}
                </p>
                <div className="inline-block mt-3 px-3 py-1 bg-secondary rounded-full">
                  <p className="text-sm font-medium text-secondary-foreground">
                    {expense.category || "Altro"}
                  </p>
                </div>
              </div>

              {/* Receipt Preview */}
              {expense.image_url && (
                <button
                  onClick={() => setShowReceipt(!showReceipt)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/50"
                >
                  <Receipt className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {showReceipt ? "Nascondi Scontrino" : "Vedi Scontrino"}
                  </span>
                </button>
              )}

              {showReceipt && expense.image_url && (
                <div className="rounded-2xl overflow-hidden border border-border/50 bg-black/5">
                  <img 
                    src={expense.image_url} 
                    alt="Scontrino" 
                    className="w-full h-auto"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="p-5 pt-4 flex gap-3 border-t border-border/50 bg-card/50 backdrop-blur-sm">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded-full h-12"
              >
                Annulla
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-full h-12 bg-primary hover:brightness-110"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Salva
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Elimina
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
                className="flex-1 rounded-full h-12 bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
              >
                <Pencil className="w-5 h-5 mr-2" />
                Modifica
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}