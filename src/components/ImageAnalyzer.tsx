import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Send, Loader2, Check, FileText } from "lucide-react";
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
          const maxDim = 1600;
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
      const { data, error } = await supabase.functions.invoke("analyze-receipt", {
        body: { image: base64Image },
      });
      if (error) throw error;
      setExpenseData(data.data);
    } catch (error: any) {
      console.error(error);
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
      
      // Upload to storage
      const fileName = `${session.user.id}/${Date.now()}.jpg`;
      const blob = await (await fetch(base64Image)).blob();
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, blob);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(fileName);

      // Invoke Email Function
      const { error: emailError } = await supabase.functions.invoke("send-expense-email", {
        body: { to: recipientEmails, expense: expenseData, imageBase64: base64Image },
      });
      if (emailError) throw emailError;

      // Save to DB
      await addExpense({
        ...expenseData,
        image_url: publicUrl,
        sent_to_email: recipientEmails[0],
        sent_at: new Date().toISOString(),
      });

      setSent(true);
      setTimeout(onSuccess, 1500);
    } catch (error: any) {
      toast({ title: "Errore invio", description: error.message, variant: "destructive" });
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
                <Input value={expenseData.merchant} onChange={(e) => setExpenseData({...expenseData, merchant: e.target.value})} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase mb-1 block">Data</Label>
                  <Input type="date" value={expenseData.date} onChange={(e) => setExpenseData({...expenseData, date: e.target.value})} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase mb-1 block">Totale (€)</Label>
                  <Input type="number" step="0.01" value={expenseData.total} onChange={(e) => setExpenseData({...expenseData, total: parseFloat(e.target.value)})} className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-1 block">Categoria</Label>
                <Input value={expenseData.category} onChange={(e) => setExpenseData({...expenseData, category: e.target.value})} className="rounded-xl" />
              </div>
            </div>
          )}
        </div>

        {!analyzing && expenseData && !sent && (
          <div className="p-5 border-t">
            <Button onClick={handleSend} disabled={sending} className="w-full h-14 rounded-full font-bold">
              {sending ? <Loader2 className="animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
              Invia ad Amministrazione
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}