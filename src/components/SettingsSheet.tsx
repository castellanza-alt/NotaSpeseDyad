import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Settings, Download, LogOut, Loader2, ChevronRight } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useExpenses } from "@/hooks/useExpenses";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Email non valida");

interface SettingsSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function SettingsSheet({ open: controlledOpen, onOpenChange, showTrigger = true }: SettingsSheetProps) {
  const { profile, updateProfile } = useProfile();
  const { expenses } = useExpenses();
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
  
  const [email, setEmail] = useState(profile?.default_email || "");
  const [isDefault, setIsDefault] = useState(profile?.is_default_email || false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [emailError, setEmailError] = useState("");
  
  // Sync email state with profile
  useEffect(() => {
    if (profile?.default_email) {
      setEmail(profile.default_email);
    }
    if (profile?.is_default_email !== undefined) {
      setIsDefault(profile.is_default_email);
    }
  }, [profile]);

  const handleSave = async () => {
    setEmailError("");
    if (email) {
      const result = emailSchema.safeParse(email);
      if (!result.success) {
        setEmailError("Inserisci un'email valida");
        return;
      }
    }
    setSaving(true);
    try {
      await updateProfile({
        default_email: email || null,
        is_default_email: isDefault
      });
      setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
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
      
      <SheetContent className="bg-background border-l border-border/50 pt-safe-top pb-safe-bottom overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-foreground text-xl font-semibold">Impostazioni</SheetTitle>
        </SheetHeader>

        <div className="space-y-8">
          {/* Email Settings Section */}
          <section className="space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email Destinatario
            </h3>
            
            <div className="bg-card rounded-2xl p-4 card-shadow space-y-4">
              <Input 
                type="email" 
                placeholder="email@esempio.com" 
                value={email} 
                onChange={e => {
                  setEmail(e.target.value);
                  setEmailError("");
                }} 
                className="bg-secondary/50 border-0 rounded-xl h-12 px-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
              />
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
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
