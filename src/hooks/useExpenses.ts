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
  // properties that might or might not exist in the new table, keeping them optional for now
  items?: any;
  sent_to_email?: string | null;
  sent_at?: string | null;
  vat_number?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
        .from("transactions" as any)
        .select("*")
        .order("date", { ascending: false })
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

      let resultData = (data as any[])?.map(item => ({
        ...item,
        // Map any differing columns if necessary, but we are assuming schema match or update
        // If the DB returns 'amount' and 'date', it matches our new interface.
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
      console.error("Error fetching transactions:", error);
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
    const { data, error } = await supabase
      .from("transactions" as any)
      .insert({ ...expense, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    setExpenses(prev => [data, ...prev]);
    setLastAddedId(data.id);
    setTimeout(() => setLastAddedId(null), 3000);
    return data;
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase
      .from("transactions" as any)
      .delete()
      .eq("id", id);
      
    if (error) throw error;
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  // RESTORE - No-op
  async function restoreExpense(id: string) {
    console.warn("Restore not available");
  }

  // HARD DELETE
  async function permanentlyDeleteExpense(id: string) {
    const { error } = await supabase
      .from("transactions" as any)
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