import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Download, LogOut, Loader2, ChevronRight, PlusCircle, MinusCircle, Database, X, Trash2, RotateCcw, ArrowLeft, AlertTriangle, Network } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useExpenses, Expense } from "@/hooks/useExpenses"; 
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const emailSchema = z.string().email("Email non valida");

interface SettingsSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  expenses: Expense[]; 
  onDataGenerated?: () => void;
}

export function SettingsSheet({ open: controlledOpen, onOpenChange, showTrigger = true, expenses, onDataGenerated }: SettingsSheetProps) {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const { restoreExpense, permanentlyDeleteExpense } = useExpenses();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
    // Reset views when closing
    if (!value) {
      setTimeout(() => setView("main"), 300);
    }
  };
  
  const [view, setView] = useState<"main" | "trash">("main");
  const [emails, setEmails] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(profile?.is_default_email || false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);

  // Trash State
  const [trashItems, setTrashItems] = useState<Expense[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  
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

  useEffect(() => {
    if (view === "trash" && open) {
      fetchTrash();
    }
  }, [view, open]);

  const fetchTrash = async () => {
    if (!user) return;
    setLoadingTrash(true);
    try {
      const { data, error } = await supabase
        .from("expenses") // Updated from transactions
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      
      if (error) {
         console.warn("Trash fetch failed", error);
         setTrashItems([]);
      } else {
         // Map for Trash View display
         const mappedData = (data as any[]).map(item => ({
             ...item,
             date: item.expense_date,
             amount: item.total
         }));
         setTrashItems(mappedData || []);
      }
    } catch (e) {
      console.error("Trash fetch error", e);
    } finally {
      setLoadingTrash(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreExpense(id);
      setTrashItems(prev => prev.filter(item => item.id !== id));
      toast({ title: "Recuperata", description: "La nota è stata ripristinata" });
      onDataGenerated?.(); 
    } catch (e) {
      toast({ title: "Errore", description: "Impossibile ripristinare", variant: "destructive" });
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await permanentlyDeleteExpense(id);
      setTrashItems(prev => prev.filter(item => item.id !== id));
      toast({ title: "Eliminata", description: "Nota rimossa definitivamente" });
    } catch (e) {
      toast({ title: "Errore", description: "Impossibile eliminare", variant: "destructive" });
    }
  };

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

  const handleConnectionTest = async () => {
    if (!user) {
      toast({ title: "Login Richiesto", description: "Devi essere loggato per il test", variant: "destructive" });
      return;
    }

    setTestingConnection(true);
    try {
      // 1. Log URL being used (visible in console)
      // Extract project ID from URL for display
      const currentUrl = (supabase as any).supabaseUrl || "Unknown";
      console.log("TESTING CONNECTION TO:", currentUrl);

      // 2. Attempt Insert into EXPENSES (was transactions)
      const { data, error } = await supabase.from("expenses").insert({
        merchant: "Test Connessione",
        total: 1, // was amount
        currency: "EUR",
        user_id: user.id,
        created_at: new Date().toISOString()
      }).select().single();

      if (error) {
        console.error("TEST FAILED:", error);
        toast({
          title: "TEST FALLITO",
          description: `URL: ${currentUrl.substring(8, 25)}... | Err: ${error.code} - ${error.message}`,
          variant: "destructive",
          duration: 10000
        });
      } else {
        toast({
          title: "TEST RIUSCITO",
          description: `Inserito ID: ${(data as any).id} su ${currentUrl.substring(8, 25)}...`,
          className: "bg-emerald-500 text-white"
        });
        // Cleanup
        await supabase.from("expenses").delete().eq("id", (data as any).id);
        onDataGenerated?.();
      }

    } catch (e: any) {
      toast({ title: "Errore Critico", description: e.message, variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleGenerateDemoData = async () => {
    if (!user) return;
    
    setGenerating(true);
    try {
      const datasets = [
        { year: 2025, month: 11, label: "Dicembre 2025" },
        { year: 2026, month: 0, label: "Gennaio 2026" },
        { year: 2026, month: 1, label: "Febbraio 2026" },
      ];

      const baseExpenses = [
        { m: "Bar Milano Centrale", c: "Vitto Comune", a: 4.50 },
        { m: "Taxi 3570", c: "Taxi", a: 18.00 },
        { m: "Trenitalia Frecciarossa", c: "Spese trasporti", a: 89.00 },
        { m: "Ristorante Da Enzo Roma", c: "Vitto Oltre Comune", a: 45.00 },
        { m: "Hotel Artemide", c: "Alloggio Oltre Comune", a: 150.00 },
        { m: "Uber", c: "Taxi", a: 22.50 },
        { m: "Cancelleria Ufficio", c: "Altri Costi", a: 12.90 },
        { m: "Pranzo di Lavoro - Clienti", c: "Spese Rappresentanza", a: 120.00 },
        { m: "Starbucks", c: "Vitto Comune", a: 8.50 },
        { m: "Italo Treno", c: "Spese trasporti", a: 56.00 },
        { m: "Trattoria Milanese", c: "Vitto Comune", a: 35.00 },
        { m: "Autogrill Cantagallo", c: "Vitto Oltre Comune", a: 14.50 },
        { m: "Parcheggio Linate", c: "Spese trasporti", a: 28.00 },
        { m: "Metro Milano ATM", c: "Spese trasporti", a: 2.20 },
        { m: "Cena Sociale", c: "Spese Rappresentanza", a: 200.00 },
      ];

      let count = 0;

      for (const ds of datasets) {
        for (let i = 0; i < 15; i++) {
            const template = baseExpenses[i % baseExpenses.length];
            const day = Math.floor(Math.random() * 28) + 1;
            const date = new Date(ds.year, ds.month, day, 12, 0, 0);
            const dateStr = format(date, "yyyy-MM-dd");
            const amount = template.a + (Math.random() * 10 - 5); 

            // Updated to insert into 'expenses' with correct columns
            await supabase.from("expenses").insert({
              user_id: user.id,
              merchant: template.m,
              category: template.c,
              total: parseFloat(amount.toFixed(2)), // was amount
              currency: "EUR",
              expense_date: dateStr, // was date
              created_at: new Date().toISOString()
            });
            count++;
        }
      }

      toast({
        title: "Dati Demo Generati",
        description: `Create ${count} note spese di test per ${user.email}`,
      });
      onDataGenerated?.();
      setOpen(false);
    } catch (error) {
      console.error("Error generating data:", error);
      toast({ title: "Errore", description: "Impossibile generare dati", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const headers = ["Data", "Esercente", "Importo", "Valuta", "Categoria"];
      const rows = expenses.map(e => [
        e.date || "", 
        e.merchant || "", 
        e.amount?.toString() || "", 
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
        toast({ title: "Esportato", description: "CSV scaricato" });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile esportare", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch (error) { console.error(error); }
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
        className="bg-background border-b border-border/50 rounded-b-[2rem] h-[85vh] pt-safe-top pb-safe-bottom overflow-y-auto [&>button]:hidden flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="pb-6 shrink-0">
          <div className="flex items-center justify-between">
            {view === "trash" ? (
              <button 
                onClick={() => setView("main")}
                className="flex items-center gap-2 text-foreground font-semibold hover:opacity-70 transition-opacity"
              >
                <ArrowLeft className="w-5 h-5" />
                Cestino
              </button>
            ) : (
              <SheetTitle className="text-foreground text-xl font-semibold">Impostazioni</SheetTitle>
            )}
            
            <button 
              onClick={() => setOpen(false)}
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-transform active:scale-95"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </SheetHeader>

        {view === "main" ? (
          <div className="space-y-8 pb-10">
            
            {/* Trash Entry Button */}
            <section className="space-y-4">
               <button 
                onClick={() => setView("trash")} 
                className="w-full flex items-center justify-between bg-card rounded-2xl p-4 card-shadow
                           transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="icon-pill-muted bg-orange-500/10 text-orange-600">
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Recupera note cancellate</p>
                    <p className="text-xs text-muted-foreground">
                      Gestisci il cestino
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
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
                </Button>
              </div>
            </section>

             {/* Demo Data Section */}
            <section className="space-y-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Area Sviluppatore (TEST MODE)
              </h3>
              
              {/* TEST CONNECTION BUTTON */}
              <button 
                onClick={handleConnectionTest} 
                disabled={testingConnection}
                className="w-full flex items-center justify-between bg-card rounded-2xl p-4 card-shadow mb-3
                          disabled:opacity-50 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] border border-red-500/10"
              >
                <div className="flex items-center gap-3">
                  <div className="icon-pill-muted bg-red-500/10 text-red-500">
                    {testingConnection ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Network className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Test Connessione DB</p>
                    <p className="text-xs text-muted-foreground">
                      Verifica URL e permessi scrittura
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </button>

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
                    <p className="text-sm font-medium text-foreground">Genera Dati Demo (Tutti)</p>
                    <p className="text-xs text-muted-foreground">
                      Crea dati test (Dic 25 - Feb 26)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </button>
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
        ) : (
          /* TRASH VIEW */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {loadingTrash ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : trashItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 pb-20">
                <Trash2 className="w-16 h-16 mb-4 stroke-1" />
                <p>Il cestino è vuoto</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pb-safe-bottom">
                 <div className="px-1 py-2">
                   <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-3 text-amber-600 text-xs mb-4">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p>Le note eliminate possono essere recuperate qui o rimosse definitivamente.</p>
                   </div>
                 </div>

                 {trashItems.map(item => (
                   <div key={item.id} className="bg-card rounded-2xl p-4 border border-border/50 flex items-center justify-between shadow-sm animate-fade-in">
                      <div className="overflow-hidden mr-3">
                         <h4 className="font-bold text-foreground truncate">{item.merchant || "Sconosciuto"}</h4>
                         <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{item.date ? format(new Date(item.date), "d MMM yyyy", { locale: it }) : "-"}</span>
                            <span>•</span>
                            <span className="text-foreground font-medium">€{item.amount?.toFixed(2)}</span>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                         <button 
                            onClick={() => handleRestore(item.id)}
                            className="w-9 h-9 rounded-full bg-secondary text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                            title="Ripristina"
                         >
                            <RotateCcw className="w-4 h-4" />
                         </button>
                         <button 
                            onClick={() => handlePermanentDelete(item.id)}
                            className="w-9 h-9 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                            title="Elimina per sempre"
                         >
                            <X className="w-4 h-4" strokeWidth={2.5} />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}