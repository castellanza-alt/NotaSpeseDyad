import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Expense {
  id: string;
  user_id: string;
  merchant: string | null;
  expense_date: string | null;
  total: number | null;
  currency: string;
  category: string | null;
  items: any;
  image_url: string | null;
  sent_to_email: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 30;

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
      
      let query = supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      // Search filters (Server side)
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`merchant.ilike.${q},category.ilike.${q}`);
      }

      if (limit) {
        query = query.limit(limit);
      } else if (paginated) {
        const start = isInitial ? 0 : expenses.length;
        query = query.range(start, start + PAGE_SIZE - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (isInitial) {
        setExpenses(data || []);
        setHasMore((data?.length || 0) === PAGE_SIZE && !limit);
      } else {
        setExpenses(prev => [...prev, ...(data || [])]);
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
  }, [user, searchQuery]); // Re-fetch when user or search query changes

  async function addExpense(expense: Omit<Expense, "id" | "user_id" | "created_at" | "updated_at">) {
    if (!user) return null;
    const { data, error } = await supabase
      .from("expenses")
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
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  return { 
    expenses, 
    loading, 
    loadingMore,
    hasMore,
    addExpense,
    deleteExpense,
    refetch: () => fetchExpenses(true), 
    loadMore: () => fetchExpenses(false),
    lastAddedId 
  };
}