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
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const { limit, paginated = true } = options;
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Fetch initial page
  const fetchExpenses = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      let query = supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      // If limit is provided, use it (for non-paginated usage like RecentExpenses)
      if (limit) {
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        setExpenses(data || []);
        setHasMore(false);
      } else if (paginated) {
        // Paginated mode
        query = query.range(0, PAGE_SIZE - 1);
        const { data, error } = await query;
        if (error) throw error;
        setExpenses(data || []);
        setHasMore((data?.length || 0) === PAGE_SIZE);
      } else {
        // Fetch all (legacy mode)
        const { data, error } = await query;
        if (error) throw error;
        setExpenses(data || []);
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  }, [user, limit, paginated]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore || limit) return;

    try {
      setLoadingMore(true);
      const startIndex = expenses.length;
      const endIndex = startIndex + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false })
        .range(startIndex, endIndex);

      if (error) throw error;

      if (data && data.length > 0) {
        setExpenses((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more expenses:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [user, expenses.length, loadingMore, hasMore, limit]);

  useEffect(() => {
    if (user) {
      fetchExpenses();
    } else {
      setExpenses([]);
      setLoading(false);
    }
  }, [user, fetchExpenses]);

  async function addExpense(expense: Omit<Expense, "id" | "user_id" | "created_at" | "updated_at">) {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          ...expense,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Add to state and mark as new
      setExpenses((prev) => [data, ...prev]);
      setLastAddedId(data.id);
      
      // Clear the "new" marker after animation
      setTimeout(() => {
        setLastAddedId(null);
      }, 3000);
      
      return data;
    } catch (error) {
      console.error("Error adding expense:", error);
      throw error;
    }
  }

  return { 
    expenses, 
    loading, 
    loadingMore,
    hasMore,
    addExpense, 
    refetch: fetchExpenses, 
    loadMore,
    lastAddedId 
  };
}
