import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image: string; // base64 data URL
}

// Funzione helper per pulire e parsare la risposta
function parseGeminiResponse(rawText: string) {
  console.log("[analyze-receipt] Parsing raw text:", rawText);

  // 1. TENTATIVO JSON (Pulizia Maniacale con Regex)
  try {
    // Cerca la prima parentesi graffa aperta e l'ultima chiusa
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const cleanJson = jsonMatch[0];
      console.log("[analyze-receipt] JSON trovato via Regex:", cleanJson);
      return JSON.parse(cleanJson);
    }
  } catch (e) {
    console.warn("[analyze-receipt] Regex JSON parse fallito, tento fallback...", e);
  }

  // 2. TENTATIVO FALLBACK (Pipe Separator)
  // Formato atteso: IMPORTO|CATEGORIA|DESCRIZIONE
  if (rawText.includes("|")) {
    const parts = rawText.split("|").map(p => p.trim());
    if (parts.length >= 3) {
      console.log("[analyze-receipt] Fallback Pipe attivo:", parts);
      let amountStr = parts[0].replace(/[^0-9.,]/g, "").replace(",", ".");
      return {
        amount: parseFloat(amountStr) || 0,
        category: parts[1],
        description: parts[2]
      };
    }
  }

  throw new Error("Impossibile parsare la risposta (Né JSON né Pipe)");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("API Key mancante");

    const { image }: AnalyzeRequest = await req.json();
    if (!image) throw new Error("Immagine mancante");

    const base64Data = image.split(",")[1] || image;

    // 3. PROMPT ESTREMO CON FALLBACK E LOGICA GEOGRAFICA
    const prompt = `Sei un estrattore dati per note spese. Analizza l'immagine.
    
    LOGICA GEOGRAFICA (Cruciale):
    - Cerca indirizzi o riferimenti a città nello scontrino.
    - SE trovi "Milano" o indirizzi di Milano -> Usa categorie che finiscono con "...Comune" (es. "Vitto Comune", "Alloggio Comune").
    - SE trovi città DIVERSE da Milano -> Usa categorie che finiscono con "...Oltre Comune" (es. "Vitto Oltre Comune", "Alloggio Oltre Comune").
    - SE trovi valuta non Euro o riferimenti esteri -> Usa "...Estero".

    FORMATO OUTPUT (Priorità Assoluta JSON):
    Restituisci ESCLUSIVAMENTE un oggetto JSON valido:
    {"amount": 12.50, "category": "Vitto Comune", "description": "Nome Esercente"}

    FALLBACK DI EMERGENZA:
    Se e SOLO SE non riesci a generare JSON, rispondi con una stringa separata da pipe:
    IMPORTO|CATEGORIA|DESCRIZIONE
    
    Non aggiungere MAI markdown (no \`\`\`), non aggiungere commenti. Solo i dati.`;

    console.log("[analyze-receipt] Sending request to gemini-1.5-flash...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
          }],
          generationConfig: {
            temperature: 0.1, // Molto deterministico
            maxOutputTokens: 500,
          },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // LOGGING ESTREMO RICHIESTO
    console.log("[analyze-receipt] RISPOSTA_GEMINI (RAW):", rawText);

    // Parsing con logica robusta
    const data = parseGeminiResponse(rawText);

    // Sanitizzazione finale numeri
    const sanitizedData = {
      amount: typeof data.amount === "number" ? data.amount : (parseFloat(String(data.amount).replace(',', '.')) || 0),
      category: data.category || "Altri Costi",
      description: data.description || "Spesa"
    };

    console.log("[analyze-receipt] Dati finali:", sanitizedData);

    return new Response(
      JSON.stringify({ success: true, data: sanitizedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[analyze-receipt] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});