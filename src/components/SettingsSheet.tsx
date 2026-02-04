import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Download, LogOut, Loader2, ChevronRight, PlusCircle, MinusCircle, Database, X, Trash2, RotateCcw, ArrowLeft, AlertTriangle } from "lucide-react";
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
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    
    if (data) setTrashItems(data);
    setLoadingTrash(false);
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreExpense(id);
      setTrashItems(prev => prev.filter(item => item.id !== id));
      toast({ title: "Recuperata", description: "La nota è stata ripristinata" });
      onDataGenerated?.(); // Trigger refresh of main list
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

  const handleGenerateDemoData = async () => {
    if (!user) return;
    
    // RESTRICTION: Only Admin
    if (user.email !== 'admin@preview.dev') {
        toast({
            title: "Accesso Negato",
            description: "Solo l'account Administrator può generare i dati demo.",
            variant: "destructive"
        });
        return;
    }

    setGenerating(true);
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-indexed

      // Dati coerenti con le categorie richieste
      const demoExpenses = [
        { merchant: "Trenitalia S.p.A.", category: "Spese trasporti", total: 89.90, day: 2 },
        { merchant: "Hotel Splendid Roma", category: "Alloggio Oltre Comune", total: 145.00, day: 2 },
        { merchant: "Ristorante La Carbonara", category: "Vitto Oltre Comune", total: 45.50, day: 2 },
        { merchant: "Taxi Roma Capitale", category: "Taxi", total: 22.00, day: 3 },
        { merchant: "Ristorante Da Vittorio", category: "Spese Rappresentanza", total: 230.00, day: 5 },
        { merchant: "Bar Centrale Milano", category: "Vitto Comune", total: 12.50, day: 8 },
        { merchant: "Uber", category: "Taxi", total: 18.40, day: 10 },
        { merchant: "Starbucks London", category: "Vitto Estero", total: 14.50, day: 12 }, 
        { merchant: "Hilton London", category: "Alloggio Estero", total: 320.00, day: 12 },
        { merchant: "Cancelleria Ufficio", category: "Altri Costi", total: 42.00, day: 15 },
        { merchant: "Italo Treno", category: "Spese trasporti", total: 65.00, day: 20 },
        { merchant: "Trattoria Milanese", category: "Vitto Comune", total: 35.00, day: 22 },
      ];

      for (const item of demoExpenses) {
        // Usa una data fissa nel mese corrente (mezzogiorno per evitare problemi di timezone)
        const safeDay = Math.min(item.day, 28); 
        const date = new Date(year, month, safeDay, 12, 0, 0);
        const dateStr = format(date, "yyyy-MM-dd");

        await supabase.from("expenses").insert({
          user_id: user.id,
          merchant: item.merchant,
          category: item.category,
          total: item.total,
          currency: "EUR",
          expense_date: dateStr,
          created_at: new Date().toISOString()
        });
      }

      toast({
        title: "Dati Admin Generati",
        description: `Create ${demoExpenses.length} note spese per il mese corrente.`,
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
                    <p className="text-sm font-medium text-foreground">Genera Dati Demo (Admin)</p>
                    <p className="text-xs text-muted-foreground">
                      Crea dati test nel mese corrente
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
                            <span>{item.expense_date ? format(new Date(item.expense_date), "d MMM yyyy", { locale: it }) : "-"}</span>
                            <span>•</span>
                            <span className="text-foreground font-medium">€{item.total?.toFixed(2)}</span>
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