import { useMemo, useState } from "react";
import { Expense } from "@/hooks/useExpenses";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Map as MapIcon, TrendingDown, TrendingUp, Share2, ChevronLeft, ChevronRight, X, PieChart as ChartIcon, ListFilter } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { OdometerValue } from "./OdometerValue";
import { cn } from "@/lib/utils";
import { ExpenseMap } from "./ExpenseMap";

interface MonthlyReportProps {
  expenses: Expense[];
  currentDate: Date;
  total: number;
  children: React.ReactNode;
  onMonthChange: (date: Date) => void;
}

const COLORS = [
  "#10b981", // Emerald (Ristorazione)
  "#3b82f6", // Blue (Trasporti)
  "#f59e0b", // Amber (Shopping)
  "#8b5cf6", // Violet (Lavoro)
  "#ec4899", // Pink (Altro)
  "#64748b", // Slate (Default)
];

type ViewMode = 'report' | 'map';

export function MonthlyReport({ expenses, currentDate, total, children, onMonthChange }: MonthlyReportProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('report');

  // Reset view when opening/closing
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setTimeout(() => setViewMode('report'), 300);
  };

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

  const handleExport = async () => {
    const monthName = format(currentDate, "MMMM yyyy", { locale: it });
    
    const summaryText = `Report Spese - ${monthName}\n\n` +
      `Totale: €${total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}\n\n` +
      `Dettaglio Categorie:\n` +
      categoryData.map(c => `- ${c.name}: €${c.value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`).join("\n");

    const csvContent = [
      "Data,Esercente,Categoria,Importo",
      ...expenses.map(e => {
        const date = e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "";
        return `${date},"${e.merchant || ''}","${e.category || ''}",${e.total}`;
      })
    ].join("\n");

    const file = new File([csvContent], `report_${format(currentDate, "yyyy_MM")}.csv`, { type: "text/csv" });

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
      const subject = encodeURIComponent(`Report Spese: ${monthName}`);
      const body = encodeURIComponent(summaryText);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      toast({ title: "Report generato", description: "Apertura client email..." });
    }
  };

  const prevMonth = () => onMonthChange(subMonths(currentDate, 1));
  const nextMonth = () => onMonthChange(addMonths(currentDate, 1));

  const trendPercentage = -12; 
  const isPositiveTrend = trendPercentage < 0; 

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="outline-none ring-offset-background transition-transform active:scale-95 cursor-pointer">
          {children}
        </button>
      </DialogTrigger>
      
      <DialogContent 
        className="w-screen h-screen max-w-none rounded-none border-0 p-0 bg-background flex flex-col overflow-hidden animate-scale-in [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Report Mensile</DialogTitle>
        
        {/* HEADER CUSTOM */}
        <div className="flex items-center justify-between px-6 pt-safe-top pb-4 bg-background/80 backdrop-blur-md border-b border-border/30 z-20">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {viewMode === 'map' ? 'Geolocalizzazione' : 'Analisi Spese'}
            </span>
            <div className="flex items-center gap-2 mt-1">
               <button onClick={prevMonth} className="p-1 -ml-1 hover:bg-secondary rounded-full transition-colors">
                 <ChevronLeft className="w-6 h-6 text-foreground" />
               </button>
               <span className="text-xl font-bold text-foreground capitalize w-32 text-center">
                 {format(currentDate, "MMMM", { locale: it })}
               </span>
               <button onClick={nextMonth} className="p-1 hover:bg-secondary rounded-full transition-colors">
                 <ChevronRight className="w-6 h-6 text-foreground" />
               </button>
            </div>
          </div>

          <button 
            onClick={() => setOpen(false)}
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* CONTENT SWITCHER */}
        <div className="flex-1 overflow-hidden relative">
          
          {viewMode === 'map' ? (
            <div className="w-full h-full p-4 pb-32">
               <ExpenseMap expenses={expenses} />
               
               {/* Floating Toggle Back */}
               <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                 <button 
                    onClick={() => setViewMode('report')}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background shadow-xl font-bold hover:scale-105 transition-transform"
                 >
                    <ListFilter className="w-5 h-5" />
                    Torna al Report
                 </button>
               </div>
            </div>
          ) : (
            <div className="w-full h-full overflow-y-auto p-6 space-y-8 pb-safe-bottom">
              {/* BIG TOTAL */}
              <div className="text-center pt-4">
                <p className="text-muted-foreground text-sm font-medium mb-1">Saldo Totale</p>
                <div className="flex items-baseline justify-center text-foreground">
                  <span className="text-2xl font-medium mr-1 text-muted-foreground">€</span>
                  <span className="text-6xl font-black tracking-tighter tabular-nums">
                    <OdometerValue value={total} />
                  </span>
                </div>
                {/* Trend Pill */}
                <div className="flex justify-center mt-3">
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                      isPositiveTrend ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                    )}>
                    {isPositiveTrend ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    <span>{Math.abs(trendPercentage)}% vs mese scorso</span>
                  </div>
                </div>
              </div>

              {/* GRAFICO GRANDE */}
              <div className="h-[280px] w-full relative -mx-2">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={4}
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
                          borderRadius: '16px', 
                          border: '1px solid var(--border)', 
                          backgroundColor: 'hsl(var(--card))',
                          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                          color: 'hsl(var(--foreground))',
                          fontWeight: 'bold'
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2 opacity-50">
                     <div className="w-16 h-16 rounded-full border-4 border-muted border-t-transparent animate-spin" />
                     <p className="text-sm">Nessun dato per questo mese</p>
                  </div>
                )}
              </div>

              {/* LISTA CATEGORIE */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                  Dettaglio Categorie
                </h4>
                <div className="grid gap-3">
                  {categoryData.map((cat, index) => (
                    <div key={index} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/50 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full shadow-sm ring-2 ring-background" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                        />
                        <span className="font-semibold text-foreground">{cat.name}</span>
                      </div>
                      <span className="font-mono font-medium text-foreground">
                        €{cat.value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AZIONI */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                 <button 
                    onClick={() => setViewMode('map')}
                    className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 transition-colors border border-blue-500/10 active:scale-95"
                 >
                    <MapIcon className="w-6 h-6 mb-1" />
                    <span className="text-sm font-bold">Mappa</span>
                 </button>
                 <button 
                    onClick={handleExport}
                    className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 transition-colors border border-emerald-500/10 active:scale-95"
                 >
                    <Share2 className="w-6 h-6 mb-1" />
                    <span className="text-sm font-bold">Esporta</span>
                 </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}