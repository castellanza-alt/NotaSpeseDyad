import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Send, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useExpenses } from "@/hooks/useExpenses";
import { useToast } from "@/hooks/use-toast";

interface ExpenseData {
  merchant: string;
  date: string;
  total: number;
  currency: string;
  category: string;
  items: any[];
}

interface ImageAnalyzerProps {
  imageFile: File;
  onClose: () => void;
  onSuccess: () => void;
}

// Configurazione Supabase hardcoded per invocazione diretta
const SUPABASE_PROJECT_ID = "iqwbspfvgekhzowqembf";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxd2JzcGZ2Z2VraHpvd3FlbWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDgzMzAsImV4cCI6MjA4NTA4NDMzMH0.-uclokjFwtnKHKDa1EQsBKzDgFgXOruRNybwRi6BITw";

export function ImageAnalyzer({ imageFile, onClose, onSuccess }: ImageAnalyzerProps) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { addExpense } = useExpenses();
  const { toast } = useToast();
  
  const [imageUrl, setImageUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);

  const recipientEmails = profile?.default_emails?.length 
    ? profile.default_emails 
    : ["wdellavedova@j-invest.eu"];

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    analyzeReceipt();
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxDim = 1200; // Ridotto per performance
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = (height / width) * maxDim; width = maxDim; }
            else { width = (width / height) * maxDim; height = maxDim; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function analyzeReceipt() {
    try {
      const base64Image = await compressImage(imageFile);
      
      // Invocazione diretta via fetch per evitare errori SDK
      const response = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/analyze-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': ANON_KEY
        },
        body: JSON.stringify({ image: base64Image })
      });

      if (!response.ok) {
        throw new Error("Errore durante l'analisi del giustificativo");
      }

      const result = await response.json();
      setExpenseData(result.data);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Errore Analisi",
        description: "Impossibile analizzare l'immagine automaticamente.",
        variant: "destructive"
      });
      // Fallback a dati vuoti per permettere inserimento manuale
      setExpenseData({ merchant: "", date: new Date().toISOString().split("T")[0], total: 0, currency: "EUR", category: "", items: [] });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSend() {
    if (!expenseData || !session) return;
    setSending(true);
    try {
      const base64Image = await compressImage(imageFile);
      
      // 1. Upload dell'immagine nello storage
      const fileName = `${session.user.id}/${Date.now()}.jpg`;
      const blob = await (await fetch(base64Image)).blob();
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, blob);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(fileName);

      // 2. Invio email tramite Edge Function (chiamata diretta)
      const emailResponse = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-expense-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': ANON_KEY
        },
        body: JSON.stringify({ 
          to: recipientEmails, 
          expense: expenseData, 
          imageBase64: base64Image 
        })
      });

      if (!emailResponse.ok) {
        throw new Error("Errore durante l'invio dell'email all'amministrazione");
      }

      // 3. Salvataggio nel database locale
      await addExpense({
        ...expenseData,
        image_url: publicUrl,
        sent_to_email: recipientEmails.join(", "),
        sent_at: new Date().toISOString(),
      });

      setSent(true);
      toast({
        title: "Successo",
        description: "Spesa inviata e registrata correttamente",
      });
      setTimeout(onSuccess, 1500);
    } catch (error: any) {
      console.error("Send error:", error);
      toast({ 
        title: "Errore invio", 
        description: error.message || "Si è verificato un errore imprevisto", 
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] expense-modal-card overflow-hidden animate-scale-in flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Analisi Giustificativo</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-auto p-5 space-y-5">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-secondary/30">
            <img src={imageUrl} alt="Scontrino" className="w-full h-full object-contain" />
            {analyzing && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Analisi IA in corso...</p>
                </div>
              </div>
            )}
            {sent && (
              <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
                <Check className="w-16 h-16 text-success animate-scale-in" />
              </div>
            )}
          </div>

          {!analyzing && expenseData && !sent && (
            <div className="space-y-4 animate-slide-up">
              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-1 block">Esercente</Label>
                <Input 
                  value={expenseData.merchant || ""} 
                  onChange={(e) => setExpenseData({...expenseData, merchant: e.target.value})} 
                  className="rounded-xl h-12" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase mb-1 block">Data</Label>
                  <Input 
                    type="date" 
                    value={expenseData.date || ""} 
                    onChange={(e) => setExpenseData({...expenseData, date: e.target.value})} 
                    className="rounded-xl h-12" 
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase mb-1 block">Totale (€)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={expenseData.total || 0} 
                    onChange={(e) => setExpenseData({...expenseData, total: parseFloat(e.target.value) || 0})} 
                    className="rounded-xl h-12" 
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-1 block">Categoria</Label>
                <Input 
                  value={expenseData.category || ""} 
                  onChange={(e) => setExpenseData({...expenseData, category: e.target.value})} 
                  className="rounded-xl h-12" 
                />
              </div>
            </div>
          )}
        </div>

        {!analyzing && expenseData && !sent && (
          <div className="p-5 border-t">
            <Button 
              onClick={handleSend} 
              disabled={sending} 
              className="w-full h-14 rounded-full font-bold bg-primary text-primary-foreground hover:opacity-90"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  Invio in corso...
                </>
              ) : (
                "Invia ad Amministrazione"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}