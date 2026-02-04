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

  // 1. TENTATIVO JSON (Regex pulita)
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const cleanJson = jsonMatch[0];
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
  throw new Error("Formato risposta non riconosciuto");
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. VERIFICA API KEY (Case Insensitive Check)
    // Controlliamo sia MAIUSCOLO che minuscolo per evitare errori banali
    const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("gemini_api_key");
    
    if (!API_KEY) {
      console.error("[analyze-receipt] ERRORE CRITICO: Nessuna API Key trovata nei Secrets.");
      throw new Error("Configurazione Server incompleta (API Key mancante).");
    }

    // Auth Check (Opzionale ma raccomandato)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      // Non blocchiamo per ora per facilitare il debug, ma logghiamo
      console.warn("[analyze-receipt] Warning: Manca header Authorization");
    }

    const { image }: AnalyzeRequest = await req.json();
    if (!image) throw new Error("Payload immagine vuoto.");

    // 2. GESTIONE BASE64 E MIME TYPE
    // Il frontend invia "data:image/jpeg;base64,..."
    // Dobbiamo separare header e dati
    let mimeType = "image/jpeg";
    let base64Data = image;

    if (image.includes(",")) {
      const parts = image.split(",");
      base64Data = parts[1];
      
      // Estrai il mime type reale se presente
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
        console.log(`[analyze-receipt] Mime-Type rilevato: ${mimeType}`);
      }
    }

    // HEIC CHECK: Se è HEIC, lo logghiamo. Gemini potrebbe supportarlo, ma è rischioso.
    if (mimeType.toLowerCase().includes("heic")) {
      console.warn("[analyze-receipt] ATTENZIONE: Rilevato formato HEIC. Potrebbe causare errori se non convertito.");
      // Forziamo mime jpeg nel tentativo di ingannare il parser se i dati sono stati convertiti ma l'header no
      // Oppure lo lasciamo passare sperando in Gemini. Per sicurezza usiamo jpeg se siamo incerti.
    }

    // 3. PROMPT E LOGICA
    const prompt = `Sei un estrattore dati per note spese. Analizza l'immagine.
    
    LOGICA GEOGRAFICA (Cruciale):
    - Cerca indirizzi o riferimenti a città nello scontrino.
    - SE trovi "Milano" o indirizzi di Milano -> Usa categorie che finiscono con "...Comune" (es. "Vitto Comune", "Alloggio Comune").
    - SE trovi città DIVERSE da Milano -> Usa categorie che finiscono con "...Oltre Comune" (es. "Vitto Oltre Comune", "Alloggio Oltre Comune").
    - SE trovi valuta non Euro o riferimenti esteri -> Usa "...Estero".

    FORMATO OUTPUT (Priorità Assoluta JSON):
    Restituisci ESCLUSIVAMENTE un oggetto JSON valido:
    {"amount": 12.50, "category": "Vitto Comune", "description": "Nome Esercente"}

    FALLBACK:
    Se fallisci il JSON, usa: IMPORTO|CATEGORIA|DESCRIZIONE`;

    console.log("[analyze-receipt] Chiamata a Gemini 1.5 Flash in corso...");

    // 4. CHIAMATA GEMINI (Con Error Handling Avanzato)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
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
      // Leggiamo il corpo dell'errore per capire PERCHÉ fallisce (es. 400 Image too large, 403 Key invalid)
      const errorBody = await response.text();
      console.error(`[analyze-receipt] GEMINI API ERROR (${response.status}):`, errorBody);
      throw new Error(`Errore AI Provider: ${response.status} - ${errorBody.substring(0, 100)}...`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("[analyze-receipt] Risposta Grezza AI:", rawText);

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
    // 5. CATCH-ALL PER EVITARE 500 GENERICI
    // Logghiamo l'errore completo nel sistema di log di Supabase
    console.error("[analyze-receipt] SERVER_ERROR_CAUGHT:", error);
    
    // Restituiamo un 500 "controllato" con messaggio JSON
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Errore sconosciuto nel server",
        details: "Controlla i log della Edge Function per i dettagli."
      }),
      { 
        status: 500, // Manteniamo 500 per segnalare il fallimento al client
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});