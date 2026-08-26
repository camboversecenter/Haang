
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@0.2.0";
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Every AI action here spends the project's GEMINI_API_KEY, so the caller must
 * be a real operator — a signed-in shop owner, or a staff member holding a
 * server-minted session token. The platform's default JWT gate only proves the
 * request carried *some* project key, and the anon key ships inside the public
 * browser bundle, so without this check anyone on the internet could drain the
 * AI quota.
 */
const authorizeCaller = async (req: Request): Promise<boolean> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return false;

  const authHeader = req.headers.get('Authorization') ?? '';
  const staffToken = req.headers.get('x-staff-token') ?? '';

  // 1. Google-authenticated shop owner: the bearer token must resolve to a user.
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (bearer && bearer !== anonKey) {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data, error } = await client.auth.getUser();
    if (!error && data?.user) return true;
  }

  // 2. Staff operator: validate the session token server-side via RLS-backed RPC.
  if (staffToken) {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { 'x-staff-token': staffToken } },
    });
    const { data, error } = await client.rpc('validate_staff_session');
    if (!error && Array.isArray(data) && data.length > 0) return true;
  }

  return false;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!(await authorizeCaller(req))) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: sign in or start a staff session to use AI features.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in Edge Function secrets.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const { action, payload } = await req.json();

    let result;

    switch (action) {
      case 'business-insight': {
        const { salesSummary, inventorySummary, language } = payload;
        const prompt = `
          Act as a business consultant for a small retail shop in Cambodia.
          Here is the current business snapshot:
          ${salesSummary}
          ${inventorySummary}

          Please provide a brief, actionable summary and 2 specific tips to improve sales or inventory management.
          IMPORTANT: The response MUST be in ${language === 'km' ? 'Khmer Language (Cambodian)' : 'English'}.
          Keep it encouraging and professional.
        `;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });
        result = response.text;
        break;
      }

      case 'product-description': {
        const { productName, language } = payload;
        const prompt = `
          Write a short, engaging product description for: "${productName}".
          Context: A retail or F&B shop in Cambodia.
          Language: ${language === 'km' ? 'Khmer' : 'English'}.
          Tone: Friendly and persuasive. Max 50 words.
        `;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });
        result = response.text;
        break;
      }

      case 'booking-agent': {
        const { query, context, language } = payload;
        const prompt = `
          You are a restaurant host assistant.
          User Query: "${query}"
          Context: ${context}
          Task: Check availability or summarize the schedule based on the user's query.
          Response Language: ${language === 'km' ? 'Khmer' : 'English'}.
          Keep it friendly and concise.
        `;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });
        result = response.text;
        break;
      }

      case 'analyze-paper-order': {
        const { imageBase64, mimeType } = payload;
        const prompt = `
          Analyze this image of a paper receipt or handwritten order.
          Extract the items, quantities, and unit prices.
          Return ONLY a JSON array with this structure:
          [
            { "name": "Item Name", "quantity": 1, "price": 4000 }
          ]
          Rules:
          - If quantity is missing, assume 1.
          - If price is total price for line, divide by quantity to get unit price.
          - If currency is USD, convert to Riel (1 USD = 4000 KHR).
          - Ignore tax or subtotal lines, just extract line items.
          - Do NOT wrap in markdown code blocks. Return raw JSON string.
        `;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }
        });
        const text = response.text || '[]';
        result = JSON.parse(text.replace(/```json|```/g, '').trim());
        break;
      }

      case 'analyze-payment-proof': {
        const { imageBase64, mimeType } = payload;
        const prompt = `
          Analyze this payment receipt screenshot (likely from a Cambodian bank app like ABA, ACLEDA, or KHQR).
          Extract: 1. Total Amount Paid (numeric). 2. Currency (KHR or USD). 3. Transaction ID.
          Return ONLY a JSON object: { "amount": 10.50, "currency": "USD", "transactionId": "123" }
          Do NOT wrap in markdown.
        `;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }
        });
        const text = response.text || '{}';
        result = JSON.parse(text.replace(/```json|```/g, '').trim());
        break;
      }

      case 'generate-image': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: prompt }] }
        });
        
        let base64Data = null;
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              base64Data = part.inlineData.data;
              break;
            }
          }
        }
        result = { base64: base64Data };
        break;
      }

      case 'lookup-barcode': {
        const { barcode, language } = payload;
        const prompt = `
          Find product information for the barcode: "${barcode}".
          Output a JSON object with:
          - name: The product name (Translate to ${language === 'km' ? 'Khmer' : 'English'})
          - description: A short, 1-sentence description (in ${language === 'km' ? 'Khmer' : 'English'})
          - category: The product category
          If not found, return null. Do NOT return markdown.
        `;
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview', 
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        
        const text = response.text || '';
        const cleanJson = text.replace(/```json|```/g, '').trim();
        result = cleanJson.toLowerCase().includes('null') ? null : JSON.parse(cleanJson);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
