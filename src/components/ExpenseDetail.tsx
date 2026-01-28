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
  const [total, setTotal] = useState(expense.total?.toString() || "0");
  const [category, setCategory] = useState(expense.category || "");
  const [expenseDate, setExpenseDate] = useState(expense.expense_date || "");

  const formattedDate = expense.expense_date 
    ? format(new Date(expense.expense_date), "d MMMM yyyy", { locale: it })
    : "—";

  const formattedTotal = expense.total?.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) || "0,00";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("expenses")
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
      const { error } = await supabase
        .from("expenses")
        .update({
          merchant,
          total: parseFloat(total) || 0,
          category,
          expense_date: expenseDate,
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
      
      {/* Modal Card - Scrollable content, fixed structure */}
      <div className="relative w-full max-w-md max-h-[85vh] expense-modal-card overflow-hidden animate-scale-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
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
                  type="number"
                  step="0.01"
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
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">{formattedDate}</p>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {expense.merchant || "Sconosciuto"}
                </h3>
                <p className="text-3xl font-bold text-archive-header">
                  €{formattedTotal}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {expense.category || "Altro"}
                </p>
              </div>

              {/* Receipt Preview */}
              {expense.image_url && (
                <button
                  onClick={() => setShowReceipt(!showReceipt)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
                >
                  <Receipt className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {showReceipt ? "Nascondi Scontrino" : "Vedi Scontrino"}
                  </span>
                </button>
              )}

              {showReceipt && expense.image_url && (
                <div className="rounded-xl overflow-hidden border border-border">
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
        <div className="p-5 pt-3 flex gap-3 border-t border-border flex-shrink-0">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded-full"
              >
                Annulla
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-full bg-archive-header hover:brightness-110"
                style={{ background: 'hsl(var(--archive-header))' }}
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
                className="flex-1 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
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
                className="flex-1 rounded-full"
                style={{ background: 'hsl(var(--archive-header))' }}
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
