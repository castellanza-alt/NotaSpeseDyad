import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    // Corretto recupero della chiave API (MAIUSCOLO come da standard Supabase Secrets)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("[analyze-receipt] Missing GEMINI_API_KEY");
      throw new Error("La chiave API di Gemini non è configurata.");
    }

    const { image }: AnalyzeRequest = await req.json();

    if (!image) {
      throw new Error("Nessuna immagine fornita per l'analisi.");
    }

    // Extract base64 data from data URL
    const base64Data = image.split(",")[1] || image;

    const prompt = `Sei un esperto contabile. Analizza questo scontrino fiscale o fattura.
    Estrai i dati ESCLUSIVAMENTE in formato JSON puro, senza markdown, senza commenti.
    
    Struttura JSON richiesta:
    {
      "merchant": "nome del negozio o azienda",
      "date": "YYYY-MM-DD",
      "total": 0.00,
      "currency": "EUR",
      "category": "Una tra: Ristorazione, Trasporti, Spesa, Lavoro, Shopping, Altro",
      "vat_number": "solo cifre o codice fiscale",
      "address": "indirizzo completo se presente",
      "items": [
        { "name": "nome prodotto", "quantity": 1, "price": 0.00 }
      ]
    }

    Regole:
    - Se la data non c'è, usa la data di oggi.
    - Se il totale ha la virgola, convertilo in punto (es. 10,50 -> 10.50).
    - Cerca l'indirizzo in alto o in fondo allo scontrino.
    - Se un campo non è leggibile, lascialo come stringa vuota o 0.`;

    console.log("[analyze-receipt] Sending request to gemini-flash-latest...");

    // STRICTLY USING gemini-flash-latest AS REQUESTED
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
      throw new Error(`Errore API Gemini: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("[analyze-receipt] Gemini response received");

    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Logica di estrazione JSON robusta
    let jsonString = rawText;
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonString = rawText.substring(firstBrace, lastBrace + 1);
    }

    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("[analyze-receipt] JSON Parse error. Raw text was:", rawText);
      throw new Error("Impossibile leggere i dati dallo scontrino (JSON non valido).");
    }

    const sanitizedData = {
      merchant: data.merchant || "Sconosciuto",
      date: data.date || new Date().toISOString().split("T")[0],
      total: typeof data.total === "number" ? data.total : (parseFloat(String(data.total).replace(',', '.')) || 0),
      currency: data.currency || "EUR",
      category: data.category || "Altro",
      vat_number: data.vat_number || "",
      address: data.address || "",
      items: Array.isArray(data.items) ? data.items : [],
    };
    
    console.log("[analyze-receipt] Success. Total found:", sanitizedData.total);

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