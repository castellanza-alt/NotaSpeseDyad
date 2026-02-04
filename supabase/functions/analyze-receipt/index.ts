import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image: string; // base64 data URL
}

function parseGeminiResponse(rawText: string) {
  console.log("[analyze-receipt] Parsing raw text:", rawText);

  // 1. TENTATIVO JSON (Regex Aggressiva)
  // Estrae tutto ciò che è compreso tra la prima parentesi graffa aperta e l'ultima chiusa
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const cleanJson = jsonMatch[0];
      console.log("[analyze-receipt] JSON estratto via Regex:", cleanJson);
      return JSON.parse(cleanJson);
    }
  } catch (e) {
    console.warn("[analyze-receipt] JSON Regex fallito:", e);
  }

  // 2. TENTATIVO FALLBACK (Pipe)
  if (rawText.includes("|")) {
    const parts = rawText.split("|").map(p => p.trim());
    if (parts.length >= 3) {
      let amountStr = parts[0].replace(/[^0-9.,]/g, "").replace(",", ".");
      return {
        amount: parseFloat(amountStr) || 0,
        category: parts[1],
        description: parts[2]
      };
    }
  }
  throw new Error("Formato risposta non riconosciuto (Né JSON valido né Pipe)");
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. VERIFICA API KEY
    const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("gemini_api_key");
    
    if (!API_KEY) {
      console.error("[analyze-receipt] ERRORE CRITICO: API Key mancante.");
      throw new Error("Configurazione Server incompleta.");
    }

    const { image }: AnalyzeRequest = await req.json();
    if (!image) throw new Error("Payload immagine vuoto.");

    // 2. GESTIONE BASE64
    let mimeType = "image/jpeg";
    let base64Data = image;

    if (image.includes(",")) {
      const parts = image.split(",");
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) mimeType = mimeMatch[1];
    }

    // 3. PROMPT RIGIDO E CATEGORIE
    const prompt = `Analizza lo scontrino e estrai i dati.
    
    CATEGORIE AMMESSE (USARE SOLO QUESTE):
    - Vitto Oltre Comune
    - Alloggio Oltre Comune
    - Vitto Estero
    - Alloggio Estero
    - Vitto Comune
    - Alloggio Comune
    - Taxi
    - Spese trasporti
    - Spese Rappresentanza
    - Altri Costi

    LOGICA GEOGRAFICA (COMUNE DI RIFERIMENTO: MILANO):
    - Se l'indirizzo/città è MILANO -> Usa categorie "...Comune".
    - Se l'indirizzo/città NON è Milano (es. Roma, Napoli, Monza) -> Usa categorie "...Oltre Comune".
    - Se Valuta estera o indirizzo estero -> Usa categorie "...Estero".

    FORMATO OUTPUT OBBLIGATORIO (JSON):
    Restituisci SOLO un oggetto JSON valido nel seguente formato, senza markdown (no \`\`\`), senza commenti:
    {"amount": 12.50, "category": "Vitto Comune", "description": "Nome Esercente"}

    Se non riesci a generare il JSON, usa il formato di emergenza: IMPORTO|CATEGORIA|DESCRIZIONE`;

    console.log("[analyze-receipt] Chiamata a gemini-flash-latest...");

    // 4. CHIAMATA GEMINI (ENDPOINT AGGIORNATO)
    // URL Corretto: gemini-flash-latest
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 800,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[analyze-receipt] GEMINI API ERROR (${response.status}):`, errorBody);
      throw new Error(`Errore AI Provider: ${response.status} - ${errorBody.substring(0, 150)}...`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("[analyze-receipt] Risposta Grezza:", rawText);

    // Parsing
    const data = parseGeminiResponse(rawText);

    const sanitizedData = {
      amount: typeof data.amount === "number" ? data.amount : (parseFloat(String(data.amount).replace(',', '.')) || 0),
      category: data.category || "Altri Costi",
      description: data.description || "Spesa"
    };

    return new Response(
      JSON.stringify({ success: true, data: sanitizedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[analyze-receipt] SERVER_ERROR_CAUGHT:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Errore sconosciuto nel server",
        details: "Controlla i log della Edge Function."
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});