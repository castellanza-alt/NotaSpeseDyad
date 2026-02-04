import { useState, useMemo } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl";
import { Expense } from "@/hooks/useExpenses";
import { MapPin, ShoppingBag, Utensils, Car, Briefcase, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "@/hooks/useTheme";

interface ExpenseMapProps {
  expenses: Expense[];
}

// Token pubblico di default o da env
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbTdnY3d4dm4wMGR2MmFzY3V1b2ZtY3F4In0.PhhB6yXyC3ZcWl6e6w3l6g"; // Token placeholder se manca

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
    // Se non ci sono coordinate reali, generiamo coordinate demo attorno a Milano per visualizzare qualcosa
    // In produzione, usare solo e.latitude && e.longitude
    return expenses.map((e, i) => {
      if (e.latitude && e.longitude) return e;
      
      // MOCK DATA per demo (rimuovere in prod se si hanno dati reali)
      // Genera punti attorno a Milano (45.4642, 9.1900)
      const lat = 45.4642 + (Math.random() - 0.5) * 0.1;
      const lng = 9.1900 + (Math.random() - 0.5) * 0.1;
      return { ...e, latitude: lat, longitude: lng };
    });
  }, [expenses]);

  const initialViewState = {
    latitude: 45.4642,
    longitude: 9.1900,
    zoom: 11
  };

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative border border-border/50 shadow-inner bg-secondary/10">
      <Map
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle={theme === 'dark' ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="bottom-right" />

        {locations.map((expense, index) => {
            const Icon = categoryIcons[expense.category || ""] || MapPin;
            return (
                <Marker
                    key={`marker-${index}`}
                    longitude={expense.longitude || 0}
                    latitude={expense.latitude || 0}
                    anchor="bottom"
                    onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        setPopupInfo(expense);
                    }}
                >
                    <div className="flex flex-col items-center cursor-pointer transition-transform hover:scale-110 active:scale-95">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background">
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="w-1 h-2 bg-primary/50" />
                    </div>
                </Marker>
            );
        })}

        {popupInfo && (
          <Popup
            anchor="top"
            longitude={popupInfo.longitude || 0}
            latitude={popupInfo.latitude || 0}
            onClose={() => setPopupInfo(null)}
            closeButton={false}
            className="z-50"
            offset={10}
          >
            <div className="relative bg-card text-card-foreground p-3 rounded-xl shadow-xl min-w-[200px] border border-border">
                <button 
                    onClick={() => setPopupInfo(null)}
                    className="absolute top-1 right-1 p-1 rounded-full hover:bg-secondary"
                >
                    <X className="w-3 h-3 text-muted-foreground" />
                </button>
                
                <h4 className="font-bold text-sm pr-4">{popupInfo.merchant || "Sconosciuto"}</h4>
                <p className="text-xs text-muted-foreground mb-2">
                    {popupInfo.expense_date ? format(new Date(popupInfo.expense_date), "d MMM yyyy", { locale: it }) : ""}
                </p>
                
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary">
                        {popupInfo.category || "Altro"}
                    </span>
                    <span className="font-bold text-primary">
                        €{popupInfo.total?.toFixed(2)}
                    </span>
                </div>
            </div>
          </Popup>
        )}
      </Map>
      
      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[100] text-white p-6 text-center">
            <div>
                <p className="font-bold text-lg mb-2">Configurazione Mancante</p>
                <p className="text-sm opacity-80">Aggiungi VITE_MAPBOX_TOKEN nel file .env per visualizzare la mappa.</p>
            </div>
        </div>
      )}
    </div>
  );
}