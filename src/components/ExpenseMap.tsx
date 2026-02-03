import { useState, useMemo } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import { useExpenses } from '@/hooks/useExpenses';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/useTheme';

// Public token for demo/dev purposes.
const MAPBOX_TOKEN = "pk.eyJ1IjoiZXhhbXBsZXVzZXIiLCJhIjoiY2x0eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4In0.xxxxxxxxx"; 

export function ExpenseMap() {
  const navigate = useNavigate();
  const { expenses } = useExpenses();
  const { theme } = useTheme();
  const [popupInfo, setPopupInfo] = useState<any>(null);

  const markers = useMemo(() => expenses.filter(e => e.latitude && e.longitude), [expenses]);

  const mapStyle = theme === 'dark' 
    ? "mapbox://styles/mapbox/dark-v11" 
    : "mapbox://styles/mapbox/light-v11";

  const initialViewState = {
    longitude: markers[0]?.longitude || 12.4964,
    latitude: markers[0]?.latitude || 41.9028,
    zoom: 11
  };

  return (
    <div className="h-screen w-full relative bg-background">
      <div className="absolute top-4 left-4 z-10">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-md shadow-lg flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10 glass px-4 py-2 rounded-full pointer-events-none">
        <span className="text-xs font-bold text-foreground">
          {markers.length} Luoghi
        </span>
      </div>

      {markers.length === 0 ? (
         <div className="flex h-full items-center justify-center flex-col p-10 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Mappa Vuota</h3>
            <p className="text-sm text-muted-foreground">
              Le tue prossime spese con indirizzo appariranno qui.
            </p>
         </div>
      ) : (
        <Map
          initialViewState={initialViewState}
          style={{width: '100%', height: '100%'}}
          mapStyle={mapStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          <NavigationControl position="bottom-right" />

          {markers.map((expense) => (
            <Marker
              key={expense.id}
              longitude={expense.longitude || 0}
              latitude={expense.latitude || 0}
              anchor="bottom"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setPopupInfo(expense);
              }}
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform">
                <span className="text-[10px] text-white font-bold">€</span>
              </div>
            </Marker>
          ))}

          {popupInfo && (
            <Popup
              anchor="top"
              longitude={Number(popupInfo.longitude)}
              latitude={Number(popupInfo.latitude)}
              onClose={() => setPopupInfo(null)}
              closeButton={false}
              className="z-20"
            >
              <div className="p-2 min-w-[150px]">
                <div className="font-bold text-sm mb-1">{popupInfo.merchant}</div>
                <div className="text-xs text-muted-foreground mb-2">{popupInfo.address}</div>
                <div className="text-lg font-black text-primary">
                  €{popupInfo.total?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Popup>
          )}
        </Map>
      )}

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 text-xs px-4 py-2 rounded-lg shadow-lg max-w-[90%] text-center">
        Nota: Per vedere la mappa reale, aggiungi il tuo Token Mapbox in ExpenseMap.tsx
      </div>
    </div>
  );
}