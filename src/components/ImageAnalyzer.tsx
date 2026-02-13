import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Check } from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
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
  vat_number?: string;
  address?: string;
  items: any[];
}

interface ImageAnalyzerProps {
  imageFile: File;
  onClose: () => void;
  onSuccess: () => void;
}

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

  // Sync totalString with expenseData.total whenever it changes (e.g. from analysis)
  useEffect(() => {
    if (expenseData && expenseData.total !== undefined) {
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
          
          // OTTIMIZZAZIONE: Ridotto maxDim a 1024 per velocizzare l'upload
          const maxDim = 1024; 
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = (height / width) * maxDim; width = maxDim; }
            else { width = (width / height) * maxDim; height = maxDim; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function analyzeReceipt() {
    try {
      const base64Image = await compressImage(imageFile);
      
      console.log("Calling Edge Function at:", `${SUPABASE_URL}/functions/v1/analyze-receipt`);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ image: base64Image })
      });

      if (!response.ok) throw new Error("Errore durante l'analisi");

      const result = await response.json();
      
      // LOGGING ESTREMO LATO CLIENT
      console.log("DATI RICEVUTI DA SUPABASE (Raw):", result);
      
      if (!result.success || !result.data) {
        console.warn("Dati incompleti o errore API:", result);
        throw new Error("Dati non validi");
      }

      const receivedData = result.data;
      console.log("Mapping dati frontend:", receivedData);

      // MAPPING DEI DATI DALL'IA
      setExpenseData({
        merchant: receivedData.description || "Sconosciuto",
        expense_date: new Date().toISOString().split("T")[0],
        total: receivedData.amount || 0,
        currency: "EUR",
        category: receivedData.category || "",
        vat_number: "",
        address: "",
        items: []
      });

    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Errore Analisi",
        description: "Impossibile analizzare l'immagine. Verifica la connessione.",
        variant: "destructive"
      });
      setExpenseData({ 
        merchant: "", 
        expense_date: new Date().toISOString().split("T")[0], 
        total: 0, 
        currency: "EUR", 
        category: "", 
        vat_number: "",
        address: "",
        items: [] 
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Permettiamo numeri, punti e virgole
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
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ 
          to: recipientEmails, 
          expense: emailPayload, 
          imageBase64: base64Image 
        })
      });

      if (!emailResponse.ok) throw new Error("Errore email");

      // MAP TO DB SCHEMA (transactions table)
      const dbPayload = {
        merchant: expenseData.merchant,
        date: expenseData.expense_date, // Mapped to date
        amount: emailPayload.total,     // Mapped to amount
        currency: expenseData.currency,
        category: expenseData.category,
        vat_number: expenseData.vat_number,
        address: expenseData.address,
        items: expenseData.items,
        image_url: publicUrl,
        sent_to_email: recipientEmails.join(", "),
        sent_at: new Date().toISOString()
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
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0 bg-card/80 backdrop-blur-md z-10">
          <h2 className="text-lg font-bold text-foreground">Analisi Giustificativo</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </header>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-hide">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-secondary/30 border border-border/50 shadow-sm mb-6 shrink-0">
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
            <div className="flex flex-col gap-5 animate-slide-up pb-4">
              
              {/* Merchant */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Esercente</Label>
                <Input 
                  value={expenseData.merchant || ""} 
                  onChange={(e) => setExpenseData({...expenseData, merchant: e.target.value})} 
                  className="rounded-2xl h-14 px-4 text-lg font-medium bg-secondary/30 border-transparent focus:bg-background focus:border-primary/50 transition-all shadow-sm appearance-none"
                  placeholder="Nome Esercente"
                />
              </div>

              {/* Data e Totale Flex Row - FORZATURA IOS */}
              <div className="flex gap-4 w-full">
                
                {/* DATA: 35% */}
                <div className="space-y-2 flex-none" style={{ width: '35%' }}>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Data</Label>
                  <Input 
                    type="date" 
                    value={expenseData.expense_date || ""} 
                    onChange={(e) => setExpenseData({...expenseData, expense_date: e.target.value})} 
                    className="w-full rounded-2xl h-14 px-4 text-base bg-secondary/30 border-transparent focus:bg-background focus:border-primary/50 transition-all shadow-sm min-w-0 appearance-none" 
                    style={{ WebkitAppearance: 'none' }}
                  />
                </div>

                {/* TOTALE: 42% */}
                <div className="space-y-2 flex-none" style={{ width: '42%' }}>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Totale</Label>
                  <div className="relative w-full">
                    <Input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0,00"
                      value={totalString}
                      onChange={handleAmountChange} 
                      className="w-full rounded-2xl h-14 pl-4 pr-10 text-lg font-bold text-right bg-secondary/30 border-transparent focus:bg-background focus:border-primary/50 transition-all shadow-sm min-w-0 appearance-none" 
                      style={{ WebkitAppearance: 'none' }}
                    />
                     <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">€</span>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Categoria</Label>
                <Input 
                  value={expenseData.category || ""} 
                  onChange={(e) => setExpenseData({...expenseData, category: e.target.value})} 
                  className="rounded-2xl h-14 px-4 text-base bg-secondary/30 border-transparent focus:bg-background focus:border-primary/50 transition-all shadow-sm appearance-none"
                  placeholder="Categoria Spesa"
                />
              </div>
              
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        {!analyzing && expenseData && !sent && (
          <div className="p-5 border-t border-border/50 bg-card/80 backdrop-blur-md shrink-0 z-10">
            <Button 
              onClick={handleSend} 
              disabled={sending} 
              className="w-full h-14 rounded-full font-bold text-base bg-primary text-primary-foreground hover:opacity-90 shadow-lg active:scale-95 transition-all"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  Invio in corso...
                </>
              ) : (
                "Conferma e Salva"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}