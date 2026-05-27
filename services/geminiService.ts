
import { supabase } from "./supabaseClient";
import { Sale, Product, Booking, Table } from "../types";

// Helper to format currency
const formatCurrency = (amount: number) => `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ៛`;

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g. "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Helper to convert Base64 to File object
const base64ToFile = (base64Data: string, filename: string): File => {
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: 'image/png' });
  return new File([blob], filename, { type: 'image/png' });
};

/**
 * Invokes the 'gemini-api' Edge Function securely.
 */
const invokeGemini = async (action: string, payload: any) => {
  const { data, error } = await supabase.functions.invoke('gemini-api', {
    body: { action, payload }
  });

  if (error) {
    console.error(`Gemini Edge Function Error (${action}):`, error);
    throw new Error(error.message || "Failed to contact AI service");
  }
  return data;
};

export const generateBusinessInsight = async (
  sales: Sale[],
  inventory: Product[],
  language: 'en' | 'km'
): Promise<string> => {
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const lowStockItems = inventory.filter(p => p.stock < 5).map(p => p.name).join(', ');
  const topSelling = sales
    .flatMap(s => s.items)
    .reduce((acc, item) => {
      acc[item.name] = (acc[item.name] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);
  
  const topProduct = Object.entries(topSelling).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const salesSummary = `
    - Total Revenue: ${formatCurrency(totalRevenue)}
    - Top Selling: ${topProduct}
    - Transactions: ${sales.length}
  `;
  const inventorySummary = `
    - Low Stock Items: ${lowStockItems || "None"}
  `;

  try {
    const text = await invokeGemini('business-insight', { salesSummary, inventorySummary, language });
    return text || (language === 'km' ? 'មិនមានទិន្នន័យ' : 'No insights available.');
  } catch (error) {
    return language === 'km' 
      ? "មានបញ្ហាក្នុងការភ្ជាប់ជាមួយ AI សូមព្យាយាមម្តងទៀត។" 
      : "Error connecting to AI Assistant. Please try again.";
  }
};

export const generateProductDescription = async (productName: string, language: 'en' | 'km'): Promise<string> => {
   try {
     const text = await invokeGemini('product-description', { productName, language });
     return text || '';
   } catch (e) {
     return "Error generating text.";
   }
};

export const consultBookingAgent = async (
    bookings: Booking[],
    tables: Table[],
    query: string,
    language: 'en' | 'km'
): Promise<string> => {
    const bookingsContext = bookings.map(b => 
        `- ${b.customerName} (${b.guests} guests) at ${new Date(b.time).toLocaleString()}`
    ).join('\n');

    const tablesContext = tables.map(t => 
        `- ${t.name} (Capacity: ${t.capacity}, Status: ${t.status})`
    ).join('\n');

    const context = `
      Current Tables:
      ${tablesContext}
      Existing Bookings:
      ${bookingsContext || "No bookings yet."}
    `;

    try {
        const text = await invokeGemini('booking-agent', { query, context, language });
        return text || '';
    } catch (e) {
        return "AI Error";
    }
}

export interface ParsedItem {
  name: string;
  quantity: number;
  price: number;
}

export const analyzePaperOrder = async (imageFile: File): Promise<ParsedItem[]> => {
  try {
    const base64Data = await fileToBase64(imageFile);
    const result = await invokeGemini('analyze-paper-order', { 
      imageBase64: base64Data, 
      mimeType: imageFile.type 
    });
    return result || [];
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return [];
  }
};

export const analyzePaymentProof = async (imageFile: File): Promise<{amount: number, currency: string, transactionId?: string}> => {
  try {
    const base64Data = await fileToBase64(imageFile);
    const result = await invokeGemini('analyze-payment-proof', { 
      imageBase64: base64Data, 
      mimeType: imageFile.type 
    });
    return result || { amount: 0, currency: 'KHR' };
  } catch (error) {
    console.error("Gemini Payment Proof Error:", error);
    return { amount: 0, currency: 'KHR' };
  }
};

export const generateLogo = async (shopName: string): Promise<File | null> => {
  try {
    const prompt = `A modern, minimalist, and professional logo design for a business named "${shopName}". Vector art style, clean lines, white background.`;
    const result = await invokeGemini('generate-image', { prompt });
    
    if (result && result.base64) {
      const filename = `logo-${Date.now()}.png`;
      return base64ToFile(result.base64, filename);
    }
    return null;
  } catch (error) {
    console.error("Logo Generation Error:", error);
    return null;
  }
};

export const generateProductImage = async (productName: string): Promise<File | null> => {
  try {
    const prompt = `Professional product photography of "${productName}". Clean white background, studio lighting, high resolution.`;
    const result = await invokeGemini('generate-image', { prompt });

    if (result && result.base64) {
      const filename = `product-${Date.now()}.png`;
      return base64ToFile(result.base64, filename);
    }
    return null;
  } catch (error) {
    console.error("Product Image Gen Error:", error);
    return null;
  }
};

export const lookupProductByBarcode = async (barcode: string, language: 'en' | 'km'): Promise<{name?: string, description?: string, category?: string} | null> => {
  try {
    const result = await invokeGemini('lookup-barcode', { barcode, language });
    return result;
  } catch (error) {
    console.error("Product Lookup Error:", error);
    return null;
  }
}
