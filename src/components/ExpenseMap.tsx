import { useState, useMemo } from "react";
import { Map, Overlay } from "pigeon-maps";
import { Expense } from "@/hooks/useExpenses";
import { MapPin, ShoppingBag, Utensils, Car, Briefcase, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ExpenseMapProps {
  expenses: Expense[];
}

const categoryIcons: any = {
  "Ristorazione": Utensils,
  "Trasporti": Car,
  "Shopping": ShoppingBag,
  "Lavoro": Briefcase,
};

export function ExpenseMap({ expenses }: ExpenseMapProps) {
  const { theme } = useTheme();
  const [popupInfo, setPopupInfo] = useState<Expense | null>(null);

  // Filtra solo spese con coordinate
  const locations = useMemo(() => {
    return expenses.map((e, i) => {
      // Usa coordinate reali se presenti
      if (e.latitude && e.longitude) return e;
      
      // MOCK DATA: Genera punti attorno a Milano (45.4642, 9.1900) per demo
      // In produzione questo blocco else si può rimuovere
      const lat = 45.4642 + (Math.random() - 0.5) * 0.08;
      const lng = 9.1900 + (Math.random() - 0.5) * 0.08;
      return { ...e, latitude: lat, longitude: lng };
    });
  }, [expenses]);

  // Provider mappe:
  // Light: OpenStreetMap standard
  // Dark: CartoDB Dark Matter (molto elegante per il tema scuro)
  const mapTiler = (x: number, y: number, z: number, dpr?: number) => {
    return theme === 'dark'
      ? `https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/${z}/${x}/${y}${dpr && dpr >= 2 ? '@2x' : ''}.png`
      : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  };

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative border border-border/50 shadow-inner bg-secondary/10">
      <Map 
        defaultCenter={[45.4642, 9.1900]} 
        defaultZoom={12} 
        provider={mapTiler}
        dprs={[1, 2]} // Supporto retina display
      >
        {locations.map((expense, index) => {
          const Icon = categoryIcons[expense.category || ""] || MapPin;
          
          // Coordinate sicure (fallback a Milano se mancano, anche se il filtro sopra dovrebbe prevenirlo)
          const lat = expense.latitude || 45.4642;
          const lng = expense.longitude || 9.1900;

          return (
            <Overlay key={`marker-${index}`} anchor={[lat, lng]} offset={[0, 0]}>
              <div 
                className="group relative -translate-x-1/2 -translate-y-full cursor-pointer transition-transform hover:scale-110 hover:z-50"
                onClick={(e) => {
                  e.stopPropagation(); // Previeni click sulla mappa
                  setPopupInfo(expense);
                }}
              >
                {/* Marker Pin */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-background transition-colors",
                    popupInfo?.id === expense.id ? "bg-primary text-primary-foreground scale-110" : "bg-card text-foreground"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {/* Pin Point */}
                  <div className={cn(
                     "w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] -mt-[1px]",
                     popupInfo?.id === expense.id ? "border-t-primary" : "border-t-card" // Colore punta triangolo deve matchare il cerchio
                  )} />
                  
                  {/* Shadow */}
                  <div className="w-3 h-1 bg-black/20 rounded-full blur-[1px] mt-0.5" />
                </div>
              </div>
            </Overlay>
          );
        })}

        {/* POPUP OVERLAY */}
        {popupInfo && popupInfo.latitude && popupInfo.longitude && (
          <Overlay anchor={[popupInfo.latitude, popupInfo.longitude]} offset={[0, 0]}>
             {/* 
                Posizioniamo il popup sopra il marker.
                offset verticale manuale: -50px (marker height approx) - 10px (spacing)
             */}
             <div 
               className="absolute bottom-[50px] left-1/2 -translate-x-1/2 z-[100] animate-scale-in origin-bottom"
               onClick={(e) => e.stopPropagation()}
             >
                <div className="relative bg-card text-card-foreground p-3 rounded-xl shadow-2xl min-w-[200px] border border-border/50">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setPopupInfo(null); }}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-background border border-border shadow-sm hover:bg-secondary transition-colors z-10"
                    >
                        <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                    
                    <h4 className="font-bold text-sm pr-2 truncate max-w-[180px]">{popupInfo.merchant || "Sconosciuto"}</h4>
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">
                        {popupInfo.expense_date ? format(new Date(popupInfo.expense_date), "d MMM yyyy", { locale: it }) : ""}
                    </p>
                    
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/50 text-foreground/80">
                            {popupInfo.category || "Altro"}
                        </span>
                        <span className="font-bold text-primary text-sm">
                            €{popupInfo.total?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Freccetta popup */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-b border-r border-border/50 rotate-45" />
                </div>
             </div>
          </Overlay>
        )}
      </Map>
    </div>
  );
}