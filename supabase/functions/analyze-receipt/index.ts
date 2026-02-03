import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image: string; // base64 data URL
}

// Mapbox Token (should be in env vars, but using a placeholder or public free tier if available, otherwise we skip geocoding or mock it)
// For this implementation, we will try to use the user's provided Gemini to ESTIMATE coordinates if no geocoding service is configured,
// or we will set up the structure to call a Geocoding API if a key is present.
// Since we don't have a Mapbox/Google Maps key yet, we will ask Gemini to extract the address, 
// and we will rely on a secondary step or client-side geocoding if needed, OR we can ask Gemini to estimate coordinates (less precise).
// Better approach: Extract address, then client-side or server-side geocoding.
// Let's stick to extraction first.

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[analyze-receipt] Unauthorized access attempt", authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("[analyze-receipt] Missing GEMINI_API_KEY");
      throw new Error("La chiave API di Gemini non è configurata nelle impostazioni del progetto.");
    }

    const { image }: AnalyzeRequest = await req.json();

    if (!image) {
      throw new Error("Nessuna immagine fornita per l'analisi.");
    }

    // Extract base64 data from data URL
    const base64Data = image.split(",")[1] || image;

    // UPDATED PROMPT: Added vat_number and address
    const prompt = `Analizza questo scontrino fiscale. Estrai i dati in formato JSON rigoroso.
    Campi richiesti:
    - merchant (nome negozio)
    - date (formato YYYY-MM-DD)
    - total (numero decimale, usa il punto)
    - currency (es. EUR)
    - category (es. Ristorazione, Trasporti, Spesa, Lavoro, Altro)
    - items (lista di oggetti con name, quantity, price)
    - vat_number (Partita IVA se presente, solo numeri/lettere, niente spazi)
    - address (Indirizzo COMPLETO con Via, Civico, Città, CAP. Se mancano parti, estrai quello che c'è)

    Se un campo non è leggibile, lascialo vuoto o a 0. Non inventare dati.`;

    console.log("[analyze-receipt] Sending request to Gemini (model: gemini-flash-latest)...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[analyze-receipt] Gemini API error details:", errorText);
      throw new Error(`Errore API Gemini: ${response.status} - Controlla i log su Supabase.`);
    }

    const result = await response.json();
    console.log("[analyze-receipt] Gemini response received");

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = text.replace(/```json|```/g, "").trim();

    let data;
    try {
      data = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("[analyze-receipt] JSON Parse error:", cleanedText);
      throw new Error("Impossibile leggere la risposta dell'AI (JSON non valido).");
    }

    // 2. Geocoding Step (Simplified for now using OpenStreetMap Nominatim or similar free service if possible, 
    // OR just passing the address for the client to handle. 
    // For robust server-side, we'd need a key. 
    // Let's TRY to fetch coordinates using a public Nominatim instance (Rate limited, but okay for low volume demo)
    // IMPORTANT: In production, use a paid/key-based service like Mapbox or Google Maps.
    
    let latitude = null;
    let longitude = null;

    if (data.address && data.address.length > 5) {
      try {
        console.log(`[analyze-receipt] Attempting geocoding for: ${data.address}`);
        // Using OpenStreetMap Nominatim (Free, requires User-Agent)
        const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(data.address)}&limit=1`;
        
        const geoResponse = await fetch(geoUrl, {
          headers: {
            "User-Agent": "NotaSpeseApp/1.0" 
          }
        });

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData && geoData.length > 0) {
            latitude = parseFloat(geoData[0].lat);
            longitude = parseFloat(geoData[0].lon);
            console.log(`[analyze-receipt] Geocoding success: ${latitude}, ${longitude}`);
          }
        }
      } catch (geoError) {
        console.warn("[analyze-receipt] Geocoding failed:", geoError);
        // Non-blocking error
      }
    }

    // Sanitize and default values
    const sanitizedData = {
      merchant: data.merchant || "Sconosciuto",
      date: data.date || new Date().toISOString().split("T")[0],
      total: typeof data.total === "number" ? data.total : (parseFloat(data.total) || 0),
      currency: data.currency || "EUR",
      category: data.category || "Altro",
      items: Array.isArray(data.items) ? data.items : [],
      vat_number: data.vat_number || null,
      address: data.address || null,
      latitude: latitude,
      longitude: longitude
    };

    return new Response(
      JSON.stringify({ success: true, data: sanitizedData }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[analyze-receipt] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
