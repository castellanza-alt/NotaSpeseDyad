import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image: string; // base64 data URL
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const prompt = `Analizza questo scontrino fiscale. Estrai i dati in formato JSON rigoroso.
    Campi richiesti:
    - merchant (nome negozio)
    - date (formato YYYY-MM-DD)
    - total (numero decimale, usa il punto)
    - currency (es. EUR)
    - category (es. Ristorazione, Trasporti, Spesa, Lavoro, Altro)
    - items (lista di oggetti con name, quantity, price)

    Se un campo non è leggibile, lascialo vuoto o a 0. Non inventare dati.`;

    console.log("[analyze-receipt] Sending request to Gemini...");

    // Utilizziamo il modello stabile 1.5-flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
            responseMimeType: "application/json", // Forza risposta JSON nativa
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
    
    // Clean up potential markdown formatting just in case
    const cleanedText = text.replace(/```json|```/g, "").trim();

    let data;
    try {
      data = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("[analyze-receipt] JSON Parse error:", cleanedText);
      throw new Error("Impossibile leggere la risposta dell'AI (JSON non valido).");
    }

    // Sanitize and default values
    const sanitizedData = {
      merchant: data.merchant || "Sconosciuto",
      date: data.date || new Date().toISOString().split("T")[0],
      total: typeof data.total === "number" ? data.total : (parseFloat(data.total) || 0),
      currency: data.currency || "EUR",
      category: data.category || "Altro",
      items: Array.isArray(data.items) ? data.items : [],
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