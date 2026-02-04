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

    // PROMPT MIGLIORATO
    const prompt = `Analizza questa immagine di scontrino o fattura con la massima precisione possibile.
    Il tuo compito è fare OCR ed estrarre i dati strutturati.
    
    FOCUS PARTICOLARE SU:
    1. TOTALE: Cerca la cifra finale più alta che rappresenta il pagamento totale. Cerca parole come "TOTALE", "IMPORTO PAGATO", "TOTALE COMPLESSIVO".
    2. DATA: Cerca date nel formato GG/MM/AAAA, AAAA-MM-GG o simili.
    3. ESERCENTE: Il nome del negozio è quasi sempre in alto al centro, spesso in grassetto o con un logo.
    
    Restituisci ESCLUSIVAMENTE un oggetto JSON valido (senza markdown 'json', senza commenti) con questa struttura:
    {
      "merchant": "Nome Negozio",
      "date": "YYYY-MM-DD",
      "total": 12.50,
      "currency": "EUR",
      "category": "Ristorazione | Spesa | Trasporti | Shopping | Altro",
      "vat_number": "Partita IVA (solo numeri)",
      "address": "Indirizzo completo",
      "items": [
         { "name": "prodotto", "quantity": 1, "price": 1.00 }
      ]
    }
    
    Se un campo è illeggibile, lascialo vuoto ("") o 0.`;

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
            temperature: 0.1, // Bassa temperatura per risposte più deterministiche
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