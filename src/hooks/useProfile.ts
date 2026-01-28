import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Profile {
  id: string;
  user_id: string;
  default_email: string | null;
  is_default_email: boolean;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  async function fetchProfile() {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("Attempting to fetch or create profile for user:", user.id);

      // Try to fetch existing profile
      const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (selectError) {
        console.error("Error during profile SELECT:", {
          message: selectError.message,
          status: selectError.code,
          fullError: selectError,
          queryResult: existingProfile,
        });
        throw selectError; // Re-throw to be caught by the outer catch block
      }

      if (existingProfile) {
        console.log("Profile found:", existingProfile);
        setProfile(existingProfile);
      } else {
        console.log("No profile found for user, attempting to create a new one.");
        // Profile does not exist, create it
        const { data: newProfile, error: upsertError } = await supabase
          .from("profiles")
          .upsert({
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            default_email: user.user_metadata?.email || null,
            is_default_email: false, // Default to false for new profiles
          })
          .select()
          .single();

        if (upsertError) {
          console.error("Error during profile UPSERT:", {
            message: upsertError.message,
            status: upsertError.code,
            fullError: upsertError,
            queryResult: newProfile,
          });
          throw upsertError; // Re-throw to be caught by the outer catch block
        }
        console.log("New profile created:", newProfile);
        setProfile(newProfile);
      }
    } catch (error: any) {
      console.error("Unhandled error in fetchProfile (or upsert):", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare o creare il profilo utente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      toast({
        title: "Salvato",
        description: "Impostazioni aggiornate con successo",
      });
      return data;
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare le impostazioni",
        variant: "destructive",
      });
      throw error;
    }
  }

  return { profile, loading, updateProfile, refetch: fetchProfile };
}