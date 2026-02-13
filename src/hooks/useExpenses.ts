import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export interface Expense {
  id: string;
  user_id: string;
  merchant: string | null;
  date: string | null;
  amount: number | null;
  currency: string;
  category: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  items?: any;
  sent_to_email?: string | null;
  sent_at?: string | null;
  vat_number?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deleted_at?: string | null;
}

const PAGE_SIZE = 30;
const SEARCH_LIMIT = 200;

interface UseExpensesOptions {
  limit?: number;
  paginated?: boolean;
  searchQuery?: string;
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const { limit, paginated = true, searchQuery = "" } = options;
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  const fetchExpenses = useCallback(async (isInitial = true) => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);
      
      const isSearching = searchQuery.trim().length > 0;
      
      let query = supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      } else if (isSearching) {
        query = query.limit(SEARCH_LIMIT);
      } else if (paginated) {
        const start = isInitial ? 0 : expenses.length;
        query = query.range(start, start + PAGE_SIZE - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      // MAPPING DB (expenses) -> APP (Expense interface)
      let resultData = (data as any[])?.map(item => ({
        ...item,
        date: item.expense_date, // Map DB 'expense_date' to App 'date'
        amount: item.total       // Map DB 'total' to App 'amount'
      })) || [];

      // Client-Side Filtering if searching
      if (isSearching && resultData.length > 0) {
        const lowerQ = searchQuery.toLowerCase().trim();
        resultData = resultData.filter(e => {
          const merchant = e.merchant?.toLowerCase() || "";
          const category = e.category?.toLowerCase() || "";
          const amountStr = e.amount?.toString() || "";
          const amountComma = amountStr.replace('.', ',');
          
          let dateStr = "";
          let dayStr = "";
          if (e.date) {
            const d = new Date(e.date);
            dateStr = format(d, "d MMMM yyyy", { locale: it }).toLowerCase();
            dayStr = format(d, "EEEE", { locale: it }).toLowerCase();
          }

          return (
            merchant.includes(lowerQ) ||
            category.includes(lowerQ) ||
            amountStr.includes(lowerQ) ||
            amountComma.includes(lowerQ) ||
            dateStr.includes(lowerQ) ||
            dayStr.includes(lowerQ)
          );
        });
      }

      if (isInitial) {
        setExpenses(resultData);
        setHasMore(isSearching ? false : (data?.length || 0) === PAGE_SIZE && !limit);
      } else {
        setExpenses(prev => [...prev, ...resultData]);
        setHasMore((data?.length || 0) === PAGE_SIZE);
      }
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, limit, paginated, searchQuery, expenses.length]);

  useEffect(() => {
    fetchExpenses(true);
  }, [user, searchQuery]); 

  async function addExpense(expense: Omit<Expense, "id" | "user_id" | "created_at" | "updated_at">) {
    if (!user) return null;
    
    // MAPPING APP -> DB
    const dbPayload = {
      ...expense,
      user_id: user.id,
      expense_date: expense.date, // Map App 'date' to DB 'expense_date'
      total: expense.amount,      // Map App 'amount' to DB 'total'
      // Remove unmapped fields if spread included them (though Omit protects somewhat)
      date: undefined, 
      amount: undefined
    };

    // Clean up undefined
    delete (dbPayload as any).date;
    delete (dbPayload as any).amount;

    const { data, error } = await supabase
      .from("expenses")
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    
    // Map response back to App
    const newExpense: Expense = {
      ...(data as any),
      date: (data as any).expense_date,
      amount: (data as any).total
    };
    
    setExpenses(prev => [newExpense, ...prev]);
    setLastAddedId(newExpense.id);
    setTimeout(() => setLastAddedId(null), 3000);
    return newExpense;
  }

  async function deleteExpense(id: string) {
    // Soft delete if column exists, or hard delete? 
    // Usually standard delete for now unless we implement logic
    // But SettingsSheet uses soft delete logic. Let's assume soft delete if deleted_at exists.
    // Actually, let's stick to simple delete for the main list, but use update deleted_at
    const { error } = await supabase
      .from("expenses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
      
    if (error) throw error;
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  async function restoreExpense(id: string) {
    const { error } = await supabase
      .from("expenses")
      .update({ deleted_at: null })
      .eq("id", id);
      
    if (error) {
       console.warn("Restore failed", error);
       throw error;
    }
  }

  async function permanentlyDeleteExpense(id: string) {
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
  }

  return { 
    expenses, 
    loading, 
    loadingMore,
    hasMore,
    addExpense,
    deleteExpense,
    restoreExpense,
    permanentlyDeleteExpense,
    refetch: () => fetchExpenses(true), 
    loadMore: () => fetchExpenses(false),
    lastAddedId 
  };
}