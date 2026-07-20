import React, { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { ShoppingBag, Calendar, CheckCircle, Share2, Printer, ChevronLeft, Bluetooth } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Sale } from '../types';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { supabase } from '../services/supabaseClient';

export default function ReceiptView({ sale, receiptId, onBack }: { sale?: Sale, receiptId?: string, onBack?: () => void }) {
  const { language, currentShop, printerConnected, connectPrinter, printReceipt, t, formatPrice } = useStore();
  const { showToast } = useUI();
  
  const [displaySale, setDisplaySale] = useState<Sale | null>(null);
  const [shopData, setShopData] = useState<any>(null); // To store name, logo, phone, address
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
        // If receiptId is present, we strictly fetch from Supabase as requested
        if (receiptId) {
            setLoading(true);
            try {
                // SECURITY DEFINER RPC: knowing the unguessable sale id is the
                // capability. A direct table read would be blocked by RLS for
                // completed sales, which used to break every shared receipt link.
                const { data: rpcData, error: saleError } = await supabase
                    .rpc('get_receipt', { _sale_id: receiptId });
                const saleData = Array.isArray(rpcData) ? rpcData[0] : rpcData;

                if (saleError || !saleData) {
                    console.error("Sale not found", saleError);
                    setLoading(false);
                    return;
                }

                // Map DB snake_case to CamelCase (Sale type)
                const mappedSale: Sale = {
                    id: saleData.id,
                    shopId: saleData.shop_id,
                    timestamp: saleData.timestamp,
                    total: saleData.total,
                    subtotal: saleData.subtotal,
                    tax: saleData.tax,
                    paymentMethod: saleData.payment_method,
                    orderStatus: saleData.order_status,
                    items: saleData.items, // JSONB comes as object
                    currency: saleData.currency,
                    exchangeRate: saleData.exchange_rate,
                    customerId: saleData.customer_id,
                    tableId: saleData.table_id
                };
                setDisplaySale(mappedSale);

                // Fetch Shop details for header
                const { data: shopRes } = await supabase
                    .from('shops')
                    .select('name, logo_url, address, phone')
                    .eq('id', saleData.shop_id)
                    .single();
                
                if (shopRes) {
                    setShopData({
                        name: shopRes.name,
                        logoUrl: shopRes.logo_url,
                        address: shopRes.address,
                        phone: shopRes.phone
                    });
                }

            } catch (err) {
                console.error("Error loading public receipt:", err);
            } finally {
                setLoading(false);
            }
        } else if (sale) {
            // Fallback to passed object (e.g. from POS success screen)
            setDisplaySale(sale);
            setShopData(currentShop);
        }
    };
    loadData();
  }, [sale, receiptId, currentShop]);

  const handleThermalPrint = async () => {
      if (!displaySale) return;
      
      let isConnected = printerConnected;
      if (!isConnected) {
          isConnected = await connectPrinter();
      }

      if (isConnected) {
          await printReceipt(displaySale);
          showToast("Printed successfully", "success");
      } else {
          showToast("Printer connection failed", "error");
      }
  };

  if (loading) return <div className="p-12 text-center text-gray-400 font-bold">Loading Order Data...</div>;
  if (!displaySale) return <div className="p-8 text-center text-gray-500">Receipt Not Found</div>;

  // Use shopData or currentShop fallback
  const sName = shopData?.name || currentShop?.name || "Shop Name";
  const sLogo = shopData?.logoUrl || currentShop?.logoUrl;
  const sAddress = shopData?.address || currentShop?.address;
  const sPhone = shopData?.phone || currentShop?.phone;

  // Construct the shareable URL robustly using Hash
  const getShareUrl = () => {
      try {
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}#/r/${displaySale.id}`;
      } catch (e) {
        return window.location.href;
      }
  };

  const shareUrl = getShareUrl();

  // Use formatPrice from context if available, otherwise strict 0 decimal fallback
  const displayPrice = (amount: number) => {
      if (formatPrice) return formatPrice(amount);
      return new Intl.NumberFormat('km-KH', { 
          style: 'currency', 
          currency: 'KHR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
      }).format(amount);
  };

  const finalSubtotal = displaySale.subtotal || displaySale.total;
  const finalTax = displaySale.tax || 0;
  const finalTotal = displaySale.total;
  
  const totalDiscount = displaySale.items.reduce((sum, item) => {
      return sum + ((item.appliedDiscount?.amountSaved || 0) * item.quantity);
  }, 0);

  const discountRules = Array.from(new Set(displaySale.items
      .filter(i => i.appliedDiscount)
      .map(i => i.appliedDiscount?.name)
  )).filter(Boolean);

  // Gross subtotal (before discount)
  const grossSubtotal = finalSubtotal + totalDiscount;

  // Helper to format payment method into its correct category label.
  const getPaymentMethodLabel = (method?: string) => {
      if (!method) return 'UNKNOWN';
      const labels: Record<string, string> = {
          cash: language === 'km' ? 'សាច់ប្រាក់' : 'Cash',
          khqr: 'KHQR',
          dity_card: 'DiTy Card',
          // "Jompeak" (ជំពាក់) = pay-later / owe. Must NOT be shown as generic "Credit".
          credit: language === 'km' ? 'ជំពាក់' : 'Credit (Jompeak)',
          online_pending: language === 'km' ? 'អនឡាញ' : 'Online',
      };
      if (labels[method]) return labels[method];
      // Custom/bank methods: show the name cleanly instead of shouting it.
      return method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const paymentLabel = getPaymentMethodLabel(displaySale.paymentMethod);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex justify-center items-start overflow-y-auto print:bg-white print:p-0 print:block">
        <div className="bg-white w-full max-w-[380px] shadow-xl rounded-none md:rounded-xl overflow-hidden relative print:shadow-none print:w-full print:max-w-none print:rounded-none">
            
            {/* Back Button */}
            <button 
                onClick={() => {
                    if (onBack) {
                        onBack();
                    } else if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        window.location.href = '/';
                    }
                }}
                className="absolute top-4 left-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600 print:hidden z-10"
                title="Back"
            >
                <ChevronLeft size={20} />
            </button>

            {/* Thermal paper ragged top effect (css only) - Hide in Print */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-200 via-white to-gray-200 opacity-50 print:hidden"></div>

            <div className="p-8 pb-4 text-center border-b border-dashed border-gray-300 print:p-0 print:pb-2 print:pt-4">
                {sLogo ? (
                    <div className="w-24 h-24 mx-auto mb-4 rounded-xl overflow-hidden shadow-sm border border-gray-100 print:w-20 print:h-20 print:mb-2 print:grayscale print:border-none">
                        <img src={sLogo} alt="Shop Logo" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="flex justify-center mb-4 print:mb-2">
                        <Logo className="w-20 h-20 print:grayscale" textClassName="text-2xl print:text-black" />
                    </div>
                )}
                
                <h1 className={`text-xl font-bold text-gray-800 mb-1 print:text-black ${language === 'km' ? 'font-display' : 'font-display'}`}>{sName}</h1>
                <p className="text-xs text-gray-500 uppercase tracking-widest print:text-black">Official Receipt</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-green-600 bg-green-50 py-1 px-3 rounded-full text-xs font-bold w-fit mx-auto print:hidden">
                    <CheckCircle size={12} />
                    <span>Paid via {paymentLabel}</span>
                </div>
                <p className="hidden print:block text-xs font-bold uppercase mt-1">Paid: {paymentLabel}</p>
            </div>

            <div className="p-6 space-y-4 print:p-0 print:pt-2">
                <div className="flex justify-between items-center text-xs text-gray-500 print:text-black">
                    <div className="flex items-center gap-1">
                        <Calendar size={12} className="print:hidden" />
                        <span>{new Date(displaySale.timestamp).toLocaleDateString()}</span>
                    </div>
                    <span className="font-mono">#{displaySale.id.slice(-6)}</span>
                </div>

                <div className="border-t border-dashed border-gray-200 my-4 print:my-2 print:border-black"></div>

                <div className="space-y-3 print:space-y-1">
                    {displaySale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm print:text-xs text-gray-800 print:text-black">
                            <div className="flex-1">
                                <p className={`font-bold ${language === 'km' ? 'font-display' : ''}`}>{item.name}</p>
                                <p className="text-gray-400 text-xs print:text-black">
                                    {item.quantity} x {displayPrice(item.price)}
                                    {item.variantName && ` (${item.variantName})`}
                                </p>
                            </div>
                            <p className="font-bold">{displayPrice(item.price * item.quantity)}</p>
                        </div>
                    ))}
                </div>

                <div className="border-t border-dashed border-gray-200 my-4 print:my-2 print:border-black"></div>

                <div className="space-y-2 text-sm print:text-xs">
                    <div className="flex justify-between text-gray-500 print:text-black">
                        <span>Subtotal</span>
                        <span>{displayPrice(grossSubtotal)}</span>
                    </div>
                    
                    {totalDiscount > 0 && (
                        <div className="flex justify-between text-red-500 print:text-black font-medium">
                            <span>Discount</span>
                            <span>-{displayPrice(totalDiscount)}</span>
                        </div>
                    )}

                    {finalTax > 0 && (
                        <div className="flex justify-between text-gray-500 print:text-black">
                            <span>VAT / Tax</span>
                            <span>{displayPrice(finalTax)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-lg font-bold text-gray-900 pt-2 print:text-black print:text-sm">
                        <span>Total</span>
                        <span>{displayPrice(finalTotal)}</span>
                    </div>
                </div>

                {discountRules.length > 0 && (
                    <div className="mt-4 pt-2 border-t border-dashed border-gray-200 text-xs text-gray-500 text-center print:text-black">
                        <p className="font-bold mb-1">Note:</p>
                        <p>Discounts Applied: {discountRules.join(', ')}</p>
                    </div>
                )}
            </div>

            <div className="bg-gray-50 p-6 border-t border-gray-100 text-center print:bg-white print:p-0 print:border-none print:mt-4">
                <div className="flex justify-center mb-4 print:hidden">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        {/* QR Code with Brand Color */}
                        <QRCode 
                            value={shareUrl} 
                            size={100} 
                            level="L" 
                            fgColor="#312e81"
                        />
                    </div>
                </div>
                
                <p className="text-xs text-gray-400 mb-6 print:text-black print:mb-2 break-all">{shareUrl}</p>
                
                <p className="text-[10px] text-gray-400 max-w-xs mx-auto mb-6 print:text-black print:mb-2">
                    {sAddress} <br/> {sPhone}
                </p>

                <div className="flex flex-col gap-2 print:hidden">
                    <button 
                        onClick={handleThermalPrint}
                        className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 flex items-center justify-center gap-2"
                    >
                        <Bluetooth size={18} /> {t('ord.print_thermal')}
                    </button>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                if (navigator.share) {
                                    navigator.share({
                                        title: `Receipt from ${sName}`,
                                        text: `Receipt #${displaySale.id.slice(-6)} for ${displayPrice(finalTotal)}`,
                                        url: shareUrl,
                                    });
                                } else {
                                    navigator.clipboard.writeText(shareUrl);
                                    showToast("Link copied to clipboard", "success");
                                }
                            }}
                            className="flex-1 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            <Share2 size={16} /> Share
                        </button>
                        <button 
                            onClick={() => window.print()}
                            className="flex-1 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            <Printer size={16} /> A4 Print
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Print Footer specific */}
            <div className="hidden print:block text-center text-[10px] mt-4 font-bold">
                POWERED BY LITTLE TONY APP
            </div>
        </div>
    </div>
  );
}