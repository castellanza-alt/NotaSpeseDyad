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

    // 2. Setup Gemini API
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("API Key mancante");
    }

    const { image }: AnalyzeRequest = await req.json();
    if (!image) throw new Error("Immagine mancante");

    // Extract base64
    const base64Data = image.split(",")[1] || image;

    // 3. PROMPT RIGIDO (SYSTEM INSTRUCTION)
    // Richiediamo struttura piatta per velocità massima e conformità user request
    const prompt = `Analizza l'immagine e restituisci SOLO un oggetto JSON.
    Categorie Ammesse: Vitto Oltre Comune, Alloggio Oltre Comune, Vitto Estero, Alloggio Estero, Vitto Comune, Alloggio Comune, Taxi, Spese trasporti, Spese Rappresentanza, Altri Costi.
    
    Logica: 
    - Se lo scontrino è di Milano, usa le voci "Comune". 
    - Se è fuori Milano, usa "Oltre Comune". 
    - Se è estero, usa "Estero".
    
    Formato: {"amount": float, "category": string, "description": string}.
    
    Non aggiungere testo, commenti o blocchi markdown (es. \`\`\`json). Restituisci solo il raw JSON.`;

    console.log("[analyze-receipt] Sending request to gemini-1.5-flash...");
    
    // 4. TIMEOUT CONTROLLER (15 secondi max)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Usiamo gemini-1.5-flash come richiesto (versione stabile di flash-latest)
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
              temperature: 0.1,
              maxOutputTokens: 500,
              responseMimeType: "application/json"
            },
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze-receipt] API Error ${response.status}:`, errorText);
        throw new Error(`Errore Gemini: ${response.status}`);
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      console.log("[analyze-receipt] Gemini Raw Response:", rawText);

      // 6. PULIZIA OUTPUT (Anti-Error)
      // Rimuove markdown code blocks (```json ... ```) se presenti
      let cleanJson = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      
      // Cerca graffe per sicurezza
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }

      let data;
      try {
        data = JSON.parse(cleanJson);
      } catch (e) {
        console.error("[analyze-receipt] JSON Parse Failed. Cleaned text:", cleanJson);
        throw new Error("Risposta IA non valida (JSON corrotto)");
      }

      // Normalizzazione Dati (Mapping richiesto)
      // Il prompt restituisce: amount, category, description
      const sanitizedData = {
        amount: typeof data.amount === "number" ? data.amount : (parseFloat(String(data.amount).replace(',', '.')) || 0),
        category: data.category || "Altri Costi",
        description: data.description || "Spesa"
      };

      console.log("[analyze-receipt] Success. Amount:", sanitizedData.amount);

      return new Response(
        JSON.stringify({ success: true, data: sanitizedData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error("[analyze-receipt] Timeout exceeded (15s)");
        throw new Error("Analisi scaduta (timeout). Riprova con un'immagine più piccola.");
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error("[analyze-receipt] Fatal Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});