import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Check, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useExpenses } from "@/hooks/useExpenses";
import { useToast } from "@/hooks/use-toast";

interface ExpenseData {
  merchant: string;
  expense_date: string;
  total: number;
  currency: string;
  category: string;
  items: any[];
  vat_number?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface ImageAnalyzerProps {
  imageFile: File;
  onClose: () => void;
  onSuccess: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  
  const [totalString, setTotalString] = useState("");

  const recipientEmails = profile?.default_emails?.length 
    ? profile.default_emails 
    : ["wdellavedova@j-invest.eu"];

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    analyzeReceipt();
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (expenseData && expenseData.total !== undefined) {
      // Formatta con puntini delle migliaia e virgola decimale per il display iniziale
      const val = expenseData.total 
        ? expenseData.total.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";
      setTotalString(val);
    }
  }, [expenseData?.total]);

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          
          const maxDim = 1024; 
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = (height / width) * maxDim; width = maxDim; }
            else { width = (width / height) * maxDim; height = maxDim; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.5));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function analyzeReceipt() {
    if (!SUPABASE_URL || !ANON_KEY) {
      console.error("Missing Env Vars");
      toast({
        title: "Errore Configurazione",
        description: "Variabili d'ambiente mancanti.",
        variant: "destructive"
      });
      setAnalyzing(false);
      return;
    }

    try {
      const base64Image = await compressImage(imageFile);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': ANON_KEY
        },
        body: JSON.stringify({ image: base64Image })
      });

      if (!response.ok) throw new Error("Errore durante l'analisi");

      const result = await response.json();
      
      setExpenseData({
        merchant: result.data.merchant || "Sconosciuto",
        expense_date: result.data.date || new Date().toISOString().split("T")[0],
        total: result.data.total || 0,
        currency: result.data.currency || "EUR",
        category: result.data.category || "",
        items: result.data.items || [],
        vat_number: result.data.vat_number || null,
        address: result.data.address || null,
        latitude: result.data.latitude || null,
        longitude: result.data.longitude || null
      });

    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Errore Analisi",
        description: "Impossibile analizzare l'immagine.",
        variant: "destructive"
      });
      setExpenseData({ 
        merchant: "", 
        expense_date: new Date().toISOString().split("T")[0], 
        total: 0, 
        currency: "EUR", 
        category: "", 
        items: [] 
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[0-9.,]*$/.test(val)) {
      setTotalString(val);
      const cleanVal = val.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleanVal) || 0;
      
      if (expenseData) {
        setExpenseData({ ...expenseData, total: parsed });
      }
    }
  };

  async function handleSend() {
    if (!expenseData || !session) return;
    
    if (!SUPABASE_URL || !ANON_KEY) {
      toast({ title: "Errore", description: "Configurazione mancante", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const base64Image = await compressImage(imageFile);
      const fileName = `${session.user.id}/${Date.now()}.jpg`;
      const blob = await (await fetch(base64Image)).blob();
      
      await supabase.storage.from("receipts").upload(fileName, blob, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(fileName);

      const cleanVal = totalString.replace(/\./g, '').replace(',', '.');
      const finalTotal = parseFloat(cleanVal) || 0;

      const emailPayload = {
        ...expenseData,
        total: finalTotal,
        date: expenseData.expense_date 
      };

      const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-expense-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': ANON_KEY
        },
        body: JSON.stringify({ 
          to: recipientEmails, 
          expense: emailPayload, 
          imageBase64: base64Image 
        })
      });

      if (!emailResponse.ok) throw new Error("Errore email");

      const dbPayload = {
        merchant: expenseData.merchant,
        expense_date: expenseData.expense_date,
        total: emailPayload.total,
        currency: expenseData.currency,
        category: expenseData.category,
        items: expenseData.items,
        image_url: publicUrl,
        sent_to_email: recipientEmails.join(", "),
        sent_at: new Date().toISOString(),
        vat_number: expenseData.vat_number,
        address: expenseData.address,
        latitude: expenseData.latitude,
        longitude: expenseData.longitude
      };

      await addExpense(dbPayload);

      setSent(true);
      setTimeout(onSuccess, 1500);

    } catch (error: any) {
      console.error("Send error:", error);
      toast({ 
        title: "Errore invio", 
        description: "Riprova.", 
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-md max-h-[90vh] bg-card text-card-foreground rounded-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 className="text-lg font-bold text-foreground">Analisi Giustificativo</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </header>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-secondary/30 border border-border/50">
            <img src={imageUrl} alt="Scontrino" className="w-full h-full object-contain" />
            {analyzing && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-sm">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Analisi IA in corso...</p>
                </div>
              </div>
            )}
            {sent && (
              <div className="absolute inset-0 bg-success/20 flex items-center justify-center backdrop-blur-sm">
                <Check className="w-16 h-16 text-success animate-scale-in" />
              </div>
            )}
          </div>

          {!analyzing && expenseData && !sent && (
            <div className="space-y-3 animate-slide-up">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Esercente</Label>
                <Input 
                  value={expenseData.merchant || ""} 
                  onChange={(e) => setExpenseData({...expenseData, merchant: e.target.value})} 
                  className="rounded-xl h-12 text-base bg-secondary/30" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-1">
                <div className="w-full min-w-0">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Data</Label>
                  <Input 
                    type="date" 
                    value={expenseData.expense_date || ""} 
                    onChange={(e) => setExpenseData({...expenseData, expense_date: e.target.value})} 
                    className="rounded-xl h-12 text-base bg-secondary/30 w-full" 
                  />
                </div>
                <div className="w-full min-w-0">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Totale (€)</Label>
                  <Input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="0,00"
                    value={totalString}
                    onChange={handleAmountChange} 
                    className="rounded-xl h-12 text-base font-medium bg-secondary/30 w-full text-right" 
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Categoria</Label>
                <Input 
                  value={expenseData.category || ""} 
                  onChange={(e) => setExpenseData({...expenseData, category: e.target.value})} 
                  className="rounded-xl h-12 text-base bg-secondary/30" 
                />
              </div>

              {expenseData.address && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/20 border border-border/50">
                   <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                   <p className="text-xs text-muted-foreground break-all">{expenseData.address}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {!analyzing && expenseData && !sent && (
          <div className="p-5 border-t border-border/50 bg-card/50 backdrop-blur-sm">
            <Button 
              onClick={handleSend} 
              disabled={sending} 
              className="w-full h-14 rounded-full font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-lg"
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