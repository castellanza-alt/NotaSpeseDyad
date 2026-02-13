import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Profile {
  id: string;
  user_id: string;
  default_emails: string[] | null;
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
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [user, authLoading]);

  async function fetchProfile(retry = true) {
    if (!user) return;

    try {
      setLoading(true);
      console.log("Fetching profile for:", user.id);
      
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
         console.error("Error fetching profile:", error);
         throw error;
      }

      // If not found and retry is allowed, wait and try again (Trigger latency)
      if (!data && retry) {
        console.log("Profile not found yet. Waiting for DB trigger (2000ms)...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryResult = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
            
        data = retryResult.data;
        error = retryResult.error;
        
        if (error) throw error;
      }

      if (data) {
        console.log("Profile loaded:", data);
        setProfile(data);
      } else {
        // Fallback creation if trigger failed or didn't fire
        console.log("Profile still not found. Attempting fallback creation...");
        const { data: newProfile, error: upsertError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            default_emails: user.user_metadata?.email ? [user.user_metadata.email] : null,
            is_default_email: false,
          }, { onConflict: 'id' })
          .select()
          .single();

        if (upsertError) {
             console.error("Fallback creation failed:", upsertError);
             throw upsertError;
        }
        
        console.log("Fallback profile created:", newProfile);
        setProfile(newProfile);
      }
    } catch (error: any) {
      console.error("Critical profile error:", error);
      toast({
          title: "Errore Profilo",
          description: "Impossibile caricare il profilo utente. Ricarica la pagina.",
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
        .eq("id", user.id)
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
      console.error("Update error:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare le impostazioni",
        variant: "destructive",
      });
      throw error;
    }
  }

  return { profile, loading, updateProfile, refetch: () => fetchProfile(false) };
}