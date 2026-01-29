import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Profile {
  id: string;
  user_id: string;
  default_emails: string[] | null; // Changed to array of strings
  is_default_email: boolean;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [user, authLoading]);

  async function fetchProfile() {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    console.log("Current user ID:", user.id);

    try {
      setLoading(true);
      console.log("Attempting to fetch or create profile for user:", user.id);

      const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (selectError) {
        console.error("Error during profile SELECT:", {
          message: selectError.message,
          status: selectError.code,
          details: selectError.details,
          fullError: selectError,
          queryResult: existingProfile,
        });
        throw selectError;
      }

      if (existingProfile) {
        console.log("Profile found:", existingProfile);
        setProfile(existingProfile);
      } else {
        console.log("No profile found for user, attempting to create a new one.");
        const { data: newProfile, error: upsertError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            default_emails: user.user_metadata?.email ? [user.user_metadata.email] : null, // Initialize with an array
            is_default_email: false,
          }, { onConflict: 'id' })
          .select()
          .single();

        if (upsertError) {
          console.error("Error during profile UPSERT:", {
            message: upsertError.message,
            status: upsertError.code,
            details: upsertError.details,
            fullError: upsertError,
          });
          throw upsertError;
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

    console.log("Current user ID for update:", user.id);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating profile:", {
          message: error.message,
          status: error.code,
          details: error.details,
          fullError: error,
        });
        throw error;
      }
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