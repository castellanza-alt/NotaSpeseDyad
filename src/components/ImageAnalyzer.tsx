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
  const { user } = useAuth();
  const { profile } = useProfile();
  const { addExpense } = useExpenses();
  const { toast } = useToast();
  
  const [imageUrl, setImageUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const defaultEmail = profile?.is_default_email && profile?.default_email 
    ? profile.default_email 
    : "wdellavedova@j-invest.eu";

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    analyzeReceipt();
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  async function compressImage(file: File, maxSizeKB: number = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          
          const maxDim = 1920;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height / width) * maxDim;
              width = maxDim;
            } else {
              width = (width / height) * maxDim;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          
          let quality = 0.8;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);
          
          while (dataUrl.length > maxSizeKB * 1024 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
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

      if (data?.data) {
        setExpenseData(data.data);
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Errore analisi",
        description: error.message || "Impossibile analizzare lo scontrino",
        variant: "destructive",
      });
      setExpenseData({
        merchant: "",
        date: new Date().toISOString().split("T")[0],
        total: 0,
        currency: "EUR",
        category: "",
        items: [],
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadImage(): Promise<string | null> {
    if (!user) return null;
    
    try {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const base64 = await compressImage(imageFile);
      const base64Data = base64.split(",")[1];
      const bytes = atob(base64Data);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        arr[i] = bytes.charCodeAt(i);
      }
      const blob = new Blob([arr], { type: "image/jpeg" });

      const { error } = await supabase.storage
        .from("receipts")
        .upload(fileName, blob);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  }

  async function handleSend() {
    if (!expenseData) return;
    
    setSending(true);
    try {
      const storedImageUrl = await uploadImage();
      setUploadedImageUrl(storedImageUrl);

      const base64Image = await compressImage(imageFile);

      const { error: emailError } = await supabase.functions.invoke("send-expense-email", {
        body: {
          to: defaultEmail,
          expense: expenseData,
          imageBase64: base64Image,
        },
      });

      if (emailError) throw emailError;

      await addExpense({
        merchant: expenseData.merchant,
        expense_date: expenseData.date,
        total: expenseData.total,
        currency: expenseData.currency,
        category: expenseData.category,
        items: expenseData.items,
        image_url: storedImageUrl,
        sent_to_email: defaultEmail,
        sent_at: new Date().toISOString(),
      });

      setSent(true);
      
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error: any) {
      console.error("Send error:", error);
      toast({
        title: "Errore invio",
        description: error.message || "Impossibile inviare la nota spese",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  function updateField(field: keyof ExpenseData, value: any) {
    if (!expenseData) return;
    setExpenseData({ ...expenseData, [field]: value });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md max-h-[90vh] expense-modal-card overflow-hidden animate-scale-in flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Analisi Scontrino</h2>
          <button
            onClick={onClose}
            disabled={sending}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary transition-all duration-200"
          >
            <X className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Image Preview */}
          <div className="relative aspect-[4/3] max-h-48 mx-auto rounded-2xl overflow-hidden bg-secondary/30 card-shadow">
            <img
              src={imageUrl}
              alt="Scontrino"
              className="w-full h-full object-contain"
            />
            {analyzing && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                  <div className="icon-pill w-14 h-14 mx-auto mb-3 animate-pulse-soft">
                    <FileText className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-muted-foreground">Analisi in corso...</p>
                </div>
              </div>
            )}
            {sent && (
              <div className="absolute inset-0 bg-success/20 backdrop-blur-sm flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center success-pulse">
                  <Check className="w-10 h-10 text-success" strokeWidth={1.5} />
                </div>
              </div>
            )}
          </div>

          {/* Data Form */}
          {!analyzing && expenseData && !sent && (
            <div className="bg-secondary/30 rounded-2xl p-5 space-y-5 animate-slide-up">
              {/* Merchant */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                  Esercente
                </Label>
                <Input
                  value={expenseData.merchant}
                  onChange={(e) => updateField("merchant", e.target.value)}
                  className="bg-secondary/50 border-0 rounded-xl h-12 px-4 text-foreground w-full"
                />
              </div>
              
              {/* Date */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                  Data
                </Label>
                <Input
                  type="date"
                  value={expenseData.date}
                  onChange={(e) => updateField("date", e.target.value)}
                  className="bg-secondary/50 border-0 rounded-xl h-12 px-4 text-foreground w-full"
                />
              </div>
              
              {/* Total */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                  Totale
                </Label>
                <div className="flex gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    value={expenseData.total}
                    onChange={(e) => updateField("total", parseFloat(e.target.value))}
                    className="flex-1 bg-secondary/50 border-0 rounded-xl h-12 px-4 text-foreground min-w-0"
                  />
                  <Input
                    value={expenseData.currency}
                    onChange={(e) => updateField("currency", e.target.value)}
                    className="w-20 bg-secondary/50 border-0 rounded-xl h-12 px-3 text-foreground text-center flex-shrink-0"
                  />
                </div>
              </div>
              
              {/* Category */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                  Categoria
                </Label>
                <Input
                  value={expenseData.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="bg-secondary/50 border-0 rounded-xl h-12 px-4 text-foreground w-full"
                />
              </div>

              {/* Recipient info */}
              <div className="pt-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  Destinatario: <span className="text-foreground font-medium">{defaultEmail}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Send Button */}
        {!analyzing && expenseData && !sent && (
          <div className="border-t border-border p-5">
            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base
                         shadow-lg shadow-primary/25 transition-all duration-200
                         hover:shadow-xl hover:shadow-primary/30
                         active:scale-[0.98]"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Invio in corso...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" strokeWidth={1.5} />
                  Invia ad Amministrazione
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
