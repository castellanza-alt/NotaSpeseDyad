import { useMemo } from "react";
import { Expense } from "@/hooks/useExpenses";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Map, TrendingDown, TrendingUp, Share2, Mail } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface MonthlyReportProps {
  expenses: Expense[];
  currentDate: Date;
  total: number;
  children: React.ReactNode;
}

const COLORS = [
  "#10b981", // Emerald (Ristorazione)
  "#3b82f6", // Blue (Trasporti)
  "#f59e0b", // Amber (Shopping)
  "#8b5cf6", // Violet (Lavoro)
  "#ec4899", // Pink (Altro)
  "#64748b", // Slate (Default)
];

export function MonthlyReport({ expenses, currentDate, total, children }: MonthlyReportProps) {
  const { toast } = useToast();

  // Raggruppa le spese per categoria
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    
    expenses.forEach(e => {
      const cat = e.category || "Altro";
      const amount = e.total || 0;
      map.set(cat, (map.get(cat) || 0) + amount);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Logica di Export (CSV + Email)
  const handleExport = async () => {
    const monthName = format(currentDate, "MMMM yyyy", { locale: it });
    
    // 1. Costruzione riepilogo testuale per email body
    const summaryText = `Report Spese - ${monthName}\n\n` +
      `Totale: €${total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}\n\n` +
      `Dettaglio Categorie:\n` +
      categoryData.map(c => `- ${c.name}: €${c.value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`).join("\n");

    // 2. Costruzione CSV
    const csvContent = [
      "Data,Esercente,Categoria,Importo",
      ...expenses.map(e => {
        const date = e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "";
        return `${date},"${e.merchant || ''}","${e.category || ''}",${e.total}`;
      })
    ].join("\n");

    const file = new File([csvContent], `report_${format(currentDate, "yyyy_MM")}.csv`, { type: "text/csv" });

    // Usa Web Share API se disponibile (Mobile nativo)
    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Report Spese ${monthName}`,
          text: summaryText,
          files: [file]
        });
      } catch (err) {
        console.error("Errore condivisione", err);
      }
    } else {
      // Fallback: Mailto link per desktop (senza allegato diretto, ma con testo)
      const subject = encodeURIComponent(`Report Spese: ${monthName}`);
      const body = encodeURIComponent(summaryText);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      
      toast({
        title: "Report generato",
        description: "Apertura client email...",
      });
    }
  };

  // Mockup trend (in futuro collegare a mese precedente reale)
  const trendPercentage = -12; 
  const isPositiveTrend = trendPercentage < 0; 

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="outline-none ring-offset-background transition-transform active:scale-95 cursor-pointer">
          {children}
        </button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-[90vw] max-w-[380px] p-0 overflow-hidden rounded-[2rem] border-border/50 shadow-2xl bg-card/95 backdrop-blur-xl animate-scale-in"
        align="center"
        sideOffset={15}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border/30 bg-secondary/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {format(currentDate, "MMMM yyyy", { locale: it })}
              </p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">Analisi Mensile</h3>
            </div>
            
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isPositiveTrend ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {isPositiveTrend ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              <span>{Math.abs(trendPercentage)}%</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Grafico */}
          <div className="h-[180px] w-full relative">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `€${value.toFixed(2)}`}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      backgroundColor: 'hsl(var(--card))',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      color: 'hsl(var(--foreground))'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Nessun dato
              </div>
            )}
            
            {/* Totale Centro */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Totale</span>
              <span className="text-lg font-bold text-foreground">€{Math.round(total)}</span>
            </div>
          </div>

          {/* Legenda */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {categoryData.slice(0, 4).map((cat, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <div 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate text-foreground/90">{cat.name}</span>
                  <span className="text-[10px] text-muted-foreground">€{cat.value.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Azioni */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/30">
              <Map className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-medium">Mappa</span>
            </button>
            
            <button 
              onClick={handleExport}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/30"
            >
              <Share2 className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Condividi</span>
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}