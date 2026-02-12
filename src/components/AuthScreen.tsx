import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Error signing in:", error);
      toast({
        title: "Errore Login",
        description: error.message || "Impossibile accedere con Google",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  // Funzione per il login rapido di sviluppo
  const handleDevLogin = async () => {
    setLoading(true);
    const devEmail = "admin@preview.dev";
    const devPassword = "adminpassword123";

    try {
      // 1. Tentativo di Login diretto
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: devEmail,
        password: devPassword,
      });

      if (!signInError && signInData.session) {
        toast({
          title: "Accesso Admin",
          description: "Bentornato amministratore",
        });
        return; // Login riuscito, l'auth state listener farà il resto
      }

      // 2. Analisi dell'errore
      if (signInError) {
        console.log("Login failed:", signInError.message);

        // Caso A: Email non confermata
        if (signInError.message.includes("Email not confirmed")) {
          toast({
            title: "Verifica Email Richiesta",
            description: "Account esistente ma non confermato. Controlla la posta o disabilita 'Confirm Email' su Supabase > Auth > Providers.",
            variant: "destructive"
          });
          return;
        }

        // Caso B: Credenziali invalide (probabilmente l'utente non esiste)
        if (signInError.message.includes("Invalid login credentials")) {
          console.log("User not found, attempting registration...");
          
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: devEmail,
            password: devPassword,
            options: {
              data: {
                full_name: "Admin User",
              }
            }
          });

          if (signUpError) {
            // Se la registrazione fallisce (es. rate limit, o utente esiste già in altro modo)
            throw signUpError;
          }

          // Registrazione avvenuta. Controlliamo se abbiamo la sessione.
          if (signUpData.session) {
             toast({
              title: "Account Creato",
              description: "Accesso effettuato come Amministratore.",
            });
            // L'auth state listener gestirà il redirect
          } else if (signUpData.user && !signUpData.session) {
            // Utente creato ma serve conferma email (comune nei nuovi progetti Supabase)
             toast({
              title: "Account Creato - Verifica Necessaria",
              description: "Vai su Supabase > Authentication e conferma manualmente l'utente admin@preview.dev, oppure clicca il link nella email simulata.",
              duration: 6000,
            });
          }
          return;
        }
        
        // Altri errori imprevisti
        throw signInError;
      }

    } catch (error: any) {
      console.error("Dev login critical error:", error);
      toast({
        title: "Errore Login",
        description: error.message || "Errore sconosciuto durante il login",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-top safe-bottom">
      {/* 
         Removed manual gradient backgrounds.
         The body background (image) now shows through.
      */}
      
      {/* Decorative glows - Keep subtle */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none mix-blend-overlay" />
      <div className="fixed bottom-1/3 right-1/3 w-80 h-80 bg-accent/15 rounded-full blur-[80px] pointer-events-none mix-blend-overlay" />

      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-20">
        <ThemeToggle />
      </div>
      
      {/* Card Container - Glass Effect */}
      <div className="relative z-10 w-full max-w-xs chunky-card-3d p-8 flex flex-col items-center justify-center animate-fade-in rounded-3xl">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-3 tracking-tight drop-shadow-sm">
            Nota Spese
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Gestisci le tue spese in un click
          </p>
        </div>

        {/* Auth Section */}
        <div className="w-full space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base gap-3 transition-all duration-200 shadow-lg"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continua con Google
              </>
            )}
          </Button>

          {/* Dev Login Button */}
          <Button
            variant="ghost"
            onClick={handleDevLogin}
            disabled={loading}
            className="w-full h-12 rounded-xl border-2 border-dashed border-destructive/30 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 mt-2 bg-background/50"
          >
            <ShieldAlert className="h-4 w-4" />
            Login Amministratore (Dev)
          </Button>
        </div>
      </div>
    </div>
  );
}