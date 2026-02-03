import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Download, LogOut, Loader2, ChevronRight, PlusCircle, MinusCircle, Database, X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Expense } from "@/hooks/useExpenses"; 
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const emailSchema = z.string().email("Email non valida");

interface SettingsSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  expenses?: Expense[];
  onDataGenerated?: () => void;
}

export function SettingsSheet({ open: controlledOpen, onOpenChange, showTrigger = true, expenses = [], onDataGenerated }: SettingsSheetProps) {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };
  
  const [emails, setEmails] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(profile?.is_default_email || false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);
  
  useEffect(() => {
    if (profile?.default_emails) {
      setEmails(profile.default_emails);
    } else {
      setEmails([""]);
    }
    if (profile?.is_default_email !== undefined) {
      setIsDefault(profile.is_default_email);
    }
  }, [profile]);

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
    const newErrors = [...emailErrors];
    newErrors[index] = "";
    setEmailErrors(newErrors);
  };

  const handleAddEmail = () => {
    if (emails.length < 3) {
      setEmails([...emails, ""]);
      setEmailErrors([...emailErrors, ""]);
    }
  };

  const handleRemoveEmail = (index: number) => {
    const newEmails = emails.filter((_, i) => i !== index);
    setEmails(newEmails.length > 0 ? newEmails : [""]);
    setEmailErrors(emailErrors.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const newErrors: string[] = [];
    const validEmails: string[] = [];

    emails.forEach((email, index) => {
      if (email.trim()) {
        const result = emailSchema.safeParse(email.trim());
        if (!result.success) {
          newErrors[index] = "Inserisci un'email valida";
        } else {
          validEmails.push(email.trim());
        }
      }
    });

    setEmailErrors(newErrors);

    if (newErrors.some(error => error !== "")) {
      toast({
        title: "Errore di validazione",
        description: "Correggi gli errori nelle email.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        default_emails: validEmails.length > 0 ? validEmails : null,
        is_default_email: isDefault
      });
      setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDemoData = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      // TARGET: FEBBRAIO 2026
      const demoExpenses = [
        { merchant: "Frecciarossa", category: "Trasporti", total: 89.50, day: 2 },
        { merchant: "Ristorante Milano", category: "Ristorazione", total: 142.00, day: 5 },
        { merchant: "Taxi Go", category: "Trasporti", total: 18.50, day: 6 },
        { merchant: "Apple Store", category: "Shopping", total: 129.00, day: 10 },
        { merchant: "Caffè degli Artisti", category: "Ristorazione", total: 6.50, day: 12 },
        { merchant: "Amazon EU", category: "Shopping", total: 45.99, day: 15 },
        { merchant: "Distributore Q8", category: "Trasporti", total: 72.00, day: 18 },
        { merchant: "Esselunga", category: "Spesa", total: 156.45, day: 20 },
        { merchant: "Uber", category: "Trasporti", total: 25.00, day: 24 },
        { merchant: "Libreria Mondadori", category: "Shopping", total: 32.50, day: 27 },
      ];

      for (const item of demoExpenses) {
        // Construct date: 2026-02-DD
        const dayStr = item.day.toString().padStart(2, '0');
        const dateStr = `2026-02-${dayStr}`;

        await supabase.from("expenses").insert({
          user_id: user.id,
          merchant: item.merchant,
          category: item.category,
          total: item.total,
          currency: "EUR",
          expense_date: dateStr,
          created_at: new Date(dateStr).toISOString()
        });
      }

      toast({
        title: "Dati Generati",
        description: "10 spese create per Febbraio 2026",
      });
      onDataGenerated?.();
      setOpen(false);
    } catch (error) {
      console.error("Error generating data:", error);
      toast({ title: "Errore", description: "Impossibile generare i dati", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const headers = ["Data", "Esercente", "Importo", "Valuta", "Categoria"];
      const rows = expenses.map(e => [
        e.expense_date || "", 
        e.merchant || "", 
        e.total?.toString() || "", 
        e.currency || "EUR", 
        e.category || ""
      ]);
      const csvContent = [
        headers.join(","), 
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const file = new File([blob], "nota-spese-export.csv", { type: "text/csv" });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Archivio Spese" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nota-spese-export.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Esportato",
          description: "Il file CSV è stato scaricato"
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Errore",
        description: "Impossibile esportare l'archivio",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <SheetTrigger asChild>
          <button className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary transition-all duration-200">
            <Settings className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          </button>
        </SheetTrigger>
      )}
      
      <SheetContent 
        side="top" 
        className="bg-background border-b border-border/50 rounded-b-[2rem] h-[85vh] pt-safe-top pb-safe-bottom overflow-y-auto [&>button]:hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="pb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground text-xl font-semibold">Impostazioni</SheetTitle>
            <button 
              onClick={() => setOpen(false)}
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-transform active:scale-95"
              aria-label="Chiudi impostazioni"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-8">
          {/* Demo Data Section */}
          <section className="space-y-4">
             <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Area Sviluppatore
            </h3>
            <button 
              onClick={handleGenerateDemoData} 
              disabled={generating}
              className="w-full flex items-center justify-between bg-card rounded-2xl p-4 card-shadow
                         disabled:opacity-50 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="icon-pill-muted bg-primary/10 text-primary">
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Genera Dati Demo</p>
                  <p className="text-xs text-muted-foreground">
                    Crea 10 spese per Febbraio 2026
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            </button>
          </section>

          {/* Email Settings Section */}
          <section className="space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email Destinatari
            </h3>
            
            <div className="bg-card rounded-2xl p-4 card-shadow space-y-4">
              {emails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    type="email" 
                    placeholder={`email${index + 1}@esempio.com`} 
                    value={email} 
                    onChange={e => handleEmailChange(index, e.target.value)} 
                    className="flex-1 bg-secondary/50 border-0 rounded-xl h-12 px-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  {emails.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveEmail(index)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <MinusCircle className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ))}
              {emailErrors.map((error, index) => error && (
                <p key={`error-${index}`} className="text-xs text-destructive">{error}</p>
              ))}
              
              {emails.length < 3 && (
                <Button 
                  variant="outline" 
                  onClick={handleAddEmail} 
                  className="w-full h-12 rounded-full border-dashed"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Aggiungi Email
                </Button>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  id="default-email" 
                  checked={isDefault} 
                  onCheckedChange={checked => setIsDefault(!!checked)}
                  className="rounded-md border-muted-foreground/30"
                />
                <span className="text-sm text-foreground">
                  Imposta come predefinita
                </span>
              </label>
              
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salva"
                )}
              </Button>
            </div>
          </section>

          {/* Export Section */}
          <section className="space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Archivio Storico
            </h3>
            
            <button 
              onClick={handleExportCSV} 
              disabled={exporting || expenses.length === 0}
              className="w-full flex items-center justify-between bg-card rounded-2xl p-4 card-shadow
                         disabled:opacity-50 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="icon-pill-muted">
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Esporta CSV</p>
                  <p className="text-xs text-muted-foreground">
                    {expenses.length} {expenses.length === 1 ? "spesa" : "spese"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            </button>
          </section>

          {/* Sign Out Section */}
          <section className="pt-4 border-t border-border/30">
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full
                         text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              <span className="font-medium">Esci</span>
            </button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}