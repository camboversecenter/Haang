import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Plus, Search, Edit2, Package, Sparkles, ScanBarcode, Camera, Share2, QrCode as QrIcon, X, Upload, Image as ImageIcon, Loader2, Layers, Trash2, AlertCircle, ToggleRight, ToggleLeft, Infinity, Tags, FolderEdit, PenTool, History, Clock, FileText, Download, Wand2, ChevronLeft, Save, ChevronDown } from 'lucide-react';
import { Product, ProductAttribute, ProductVariant } from '../types';
import { generateProductDescription, generateProductImage, lookupProductByBarcode } from '../services/geminiService';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { uploadProductImage, deleteFile } from '../services/storageService';
import QRCode from 'react-qr-code';
import { MAX_PRODUCTS_LIMIT } from '../store/StoreContext';

export default function Inventory() {
  const { products, categories, addProduct, updateProduct, renameCategory, deleteCategory, t, language, currentShop, settings, getProductActivities, fetchMoreActivities, hasMoreActivities, formatPrice } = useStore();
  const { showToast, showAlert, showConfirm } = useUI();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
  
  const [uploading, setUploading] = useState(false); // Used for spinner inside image box
  const [saving, setSaving] = useState(false); // Used for main save button
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  
  const [qrModal, setQrModal] = useState<{type: 'shop' | 'product', data: any} | null>(null);

  const [form, setForm] = useState<Partial<Product>>({
    name: '', price: 0, stock: 0, trackStock: true, category: '', imageUrl: 'https://picsum.photos/200', barcode: '', description: ''
  });

  const [activeModalTab, setActiveModalTab] = useState<'details' | 'activity'>('details');

  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const isLimitReached = products.length >= MAX_PRODUCTS_LIMIT;

  // --------------------------------------------------------

  const handleOpenModal = (product?: Product) => {
    if (!product && isLimitReached) {
        showToast(t('toast.prod_limit'), 'error');
        return;
    }

    setActiveModalTab('details');
    setPendingFile(null); // Reset pending file on open

    if (product) {
      setEditingProduct(product);
      setForm({ ...product, trackStock: product.trackStock ?? true, description: product.description || '' });
      setAttributes(product.attributes || []);
      setVariants(product.variants || []);
    } else {
      setEditingProduct(null);
      setForm({ name: '', price: 0, stock: 0, trackStock: true, category: '', imageUrl: 'https://picsum.photos/200', barcode: '', description: '' });
      setAttributes([]);
      setVariants([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
      setIsModalOpen(false);
  };

  const handleSave = async () => {
    // Validations with explicit checks
    if (!form.name || form.name.trim() === '') {
        showToast(t('toast.fill_prod_name'), "error");
        const nameInput = document.getElementById('product-name-input');
        if (nameInput) nameInput.focus();
        return;
    }
    
    // Ensure price is treated as a number
    if (form.price === undefined || form.price === null || isNaN(Number(form.price))) {
        showToast("Please enter a valid price", "error");
        return;
    }
    
    setSaving(true);

    try {
        let finalImageUrl = form.imageUrl;

        // --- CONDITION 2: Delete OLD image FIRST, then Upload NEW one ---
        if (pendingFile) {
            // 1. Check if we are updating an existing product with a previous image
            if (editingProduct && editingProduct.imageUrl && editingProduct.imageUrl !== 'https://picsum.photos/200' && !editingProduct.imageUrl.startsWith('blob:')) {
                 // 2. DELETE OLD
                 console.log("Deleting old image first...");
                 await deleteFile(editingProduct.imageUrl);
            }

            // 3. UPLOAD NEW
            const uploadedUrl = await uploadProductImage(pendingFile);
            if (uploadedUrl) {
                finalImageUrl = uploadedUrl;
            } else {
                showToast("Failed to upload image.", "error");
                setSaving(false);
                return;
            }
        }
        
        let calculatedStock = Number(form.stock) || 0;
        if (variants.length > 0) {
            calculatedStock = variants.reduce((sum, v) => sum + v.stock, 0);
        }

        const productData = {
            id: editingProduct ? editingProduct.id : Date.now().toString(),
            shopId: editingProduct?.shopId || currentShop?.id || '',
            name: form.name.trim(),
            description: form.description,
            price: Number(form.price),
            stock: calculatedStock,
            trackStock: form.trackStock,
            category: form.category || 'General',
            imageUrl: finalImageUrl || 'https://picsum.photos/200',
            barcode: form.barcode,
            attributes: attributes.length > 0 ? attributes : undefined,
            variants: variants.length > 0 ? variants : undefined
        };

        if (editingProduct) {
            await updateProduct(productData);
            showToast("Product updated", "success");
        } else {
            await addProduct(productData);
            showToast("Product added", "success");
        }
        
        setIsModalOpen(false);
    } catch (e) {
        console.error(e);
        showToast("Error saving product", "error");
    } finally {
        setSaving(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          
          // Revoke old blob if needed to free memory
          if (form.imageUrl && form.imageUrl.startsWith('blob:')) {
              URL.revokeObjectURL(form.imageUrl);
          }

          setPendingFile(file);
          setForm(prev => ({ ...prev, imageUrl: URL.createObjectURL(file) }));
      }
  };

  const handleGenerateAiImage = async () => {
      if (!form.name) {
          showToast("Please enter name first", "error");
          return;
      }
      setUploading(true); // Use local uploading state for the spinner inside image box

      // Revoke old blob if needed
      if (form.imageUrl && form.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(form.imageUrl);
      }

      const file = await generateProductImage(form.name);
      if (file) {
          setPendingFile(file);
          setForm(prev => ({ ...prev, imageUrl: URL.createObjectURL(file) }));
          showToast(t('toast.logo_gen'), "success");
      } else {
          showToast(t('alert.gen_fail_title'), "error");
      }
      setUploading(false);
  };

  const handleGenerateDescription = async () => {
      if (!form.name) {
          showToast("Please enter name first", "error");
          return;
      }
      setLoadingAi(true);
      const desc = await generateProductDescription(form.name, language);
      if (desc) {
          setForm(prev => ({ ...prev, description: desc }));
      }
      setLoadingAi(false);
  };

  const performBarcodeLookup = async (code: string) => {
      setLoadingLookup(true);
      showToast("Searching for product info...", "info");
      
      try {
          const info = await lookupProductByBarcode(code, language);
          if (info) {
              setForm(prev => ({
                  ...prev,
                  name: info.name || prev.name,
                  description: info.description || prev.description,
                  category: info.category || prev.category
              }));
              showToast("Found product details!", "success");
          } else {
              showToast("No product info found for this barcode", "info");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingLookup(false);
      }
  };

  const handleScan = (code: string) => {
      setForm(prev => ({ ...prev, barcode: code }));
      setShowScanner(false);
      
      // Auto-lookup after scan ONLY if creating a new product
      if (!editingProduct) {
          performBarcodeLookup(code);
      }
  };

  const handleManualLookup = () => {
      if (form.barcode && !editingProduct) {
          performBarcodeLookup(form.barcode);
      }
  };

  const handleLoadMoreActivities = async () => {
      if (!editingProduct) return;
      setLoadingMoreActivities(true);
      await fetchMoreActivities(editingProduct.id);
      setLoadingMoreActivities(false);
  };

  // --- Attribute Logic ---
  const addAttribute = () => {
      if (attributes.length >= 2) {
          showToast("Max 2 attributes supported", "error");
          return;
      }
      setAttributes([...attributes, { name: '', options: [] }]);
  };

  const updateAttributeName = (index: number, name: string) => {
      const newAttrs = [...attributes];
      newAttrs[index].name = name;
      setAttributes(newAttrs);
  };

  const updateAttributeOptions = (index: number, optionsString: string) => {
      const newAttrs = [...attributes];
      newAttrs[index].options = optionsString.split(',').map(s => s.trim()).filter(Boolean);
      setAttributes(newAttrs);
  };

  const removeAttribute = (index: number) => {
      const newAttrs = attributes.filter((_, i) => i !== index);
      setAttributes(newAttrs);
      setVariants([]); 
  };

  const generateVariants = () => {
      if (attributes.length === 0) return;

      let generated: ProductVariant[] = [];
      const basePrice = Number(form.price) || 0;

      if (attributes.length === 1) {
          generated = attributes[0].options.map(opt => ({
              id: `${Date.now()}-${opt}`,
              options: [opt],
              price: basePrice,
              stock: 0
          }));
      } else if (attributes.length === 2) {
          attributes[0].options.forEach(opt1 => {
              attributes[1].options.forEach(opt2 => {
                   generated.push({
                      id: `${Date.now()}-${opt1}-${opt2}`,
                      options: [opt1, opt2],
                      price: basePrice,
                      stock: 0
                   });
              });
          });
      }
      setVariants(generated);
  };

  const updateVariant = (index: number, field: 'price' | 'stock', value: number) => {
      const newVariants = [...variants];
      newVariants[index] = { ...newVariants[index], [field]: value };
      setVariants(newVariants);
  };

  // --- Download QR Logic ---
  const downloadQr = (name: string) => {
      const svg = document.querySelector('#qr-code-container svg');
      if (!svg) return;
      
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      const size = 1000; // High resolution
      canvas.width = size;
      canvas.height = size;
      
      img.onload = () => {
          if (ctx) {
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, size, size);
              const pngFile = canvas.toDataURL("image/png");
              const link = document.createElement("a");
              link.download = `${name.replace(/\s+/g, '_')}_QR.png`;
              link.href = pngFile;
              link.click();
          }
      };
      
      // Handle unicode properly in base64
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // ------------------------

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode?.includes(search)
  );

  const getPublicUrl = (type: 'shop' | 'product', id: string) => {
      try {
        // Use Hash routing for broader compatibility
        const baseUrl = window.location.origin + window.location.pathname; 
        if (type === 'shop') {
            const identifier = currentShop?.id;
            return `${baseUrl}#/s/${identifier}`;
        } else {
            const identifier = currentShop?.id;
            return `${baseUrl}#/s/${identifier}?productId=${id}`;
        }
      } catch (e) {
        return window.location.href;
      }
  };

  const productActivities = editingProduct ? getProductActivities(editingProduct.id) : [];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Search Header */}
      <div className="p-4 bg-slate-50 sticky top-0 z-10 flex flex-col gap-3">
        {/* ... existing header code ... */}
        <div className="flex items-center gap-3">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                type="text" 
                placeholder={t('pos.search')}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border-none bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            <button 
                onClick={() => setIsCategoryManagerOpen(true)}
                className="bg-white text-gray-500 p-3 rounded-2xl items-center justify-center font-bold shadow-sm hover:text-brand-600 hover:bg-brand-50 transition-all active:scale-95"
                title="Manage Categories"
            >
                <Tags size={20} />
            </button>

            {/* Desktop Add Button */}
            <button 
                onClick={() => handleOpenModal()}
                disabled={isLimitReached}
                className={`hidden md:flex bg-brand-600 text-white px-5 py-3 rounded-2xl items-center gap-2 font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all active:scale-95 ${isLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <Plus size={20} />
                <span>{t('inv.add_product')}</span>
            </button>
        </div>

        <div className="flex justify-between items-center text-xs px-1">
             <div className="flex items-center gap-1 text-gray-500 font-bold">
                 {isLimitReached && <AlertCircle size={14} className="text-red-500" />}
                 <span>{t('inv.total_products')}: {products.length}/{MAX_PRODUCTS_LIMIT}</span>
             </div>
        </div>
        
        {/* Shop Sharing Banner */}
        <div className="bg-gradient-to-r from-indigo-500 to-brand-600 rounded-2xl p-4 text-white flex justify-between items-center shadow-lg shadow-brand-500/30">
            <div>
                <h3 className={`font-bold text-lg ${language === 'km' ? 'font-display' : ''}`}>{t('inv.public_link')}</h3>
                <p className="text-white/80 text-xs">Share this link for self-service ordering.</p>
            </div>
            <button 
                onClick={() => setQrModal({type: 'shop', data: currentShop})}
                className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl hover:bg-white/30 transition-colors"
            >
                <QrIcon size={20} />
            </button>
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-4 space-y-3 no-scrollbar">
        {filteredProducts.map((product) => {
            const isTracked = product.trackStock !== false;
            const isUntrackedSoldOut = !isTracked && product.stock <= 0;

            return (
            <div key={product.id} className="bg-white p-3 rounded-2xl shadow-card flex items-center gap-4 group hover:border-brand-200 border border-transparent transition-colors">
                <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => setQrModal({type: 'product', data: product})}>
                    <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-gray-900 truncate text-base ${language === 'km' ? 'font-display' : ''}`}>
                        {product.name}
                    </h3>
                    <p className="text-xs text-gray-400 mb-1">{product.category || 'General'}</p>
                    <div className="flex items-center gap-3">
                        <span className="text-brand-600 font-bold">{formatPrice(product.price)}</span>
                        
                        {isTracked ? (
                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${product.stock <= 0 ? 'bg-red-100 text-red-700' : (product.stock < 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-50 text-green-600')}`}>
                                <Package size={10} />
                                {product.stock <= 0 ? t('inv.out_of_stock') : `${t('inv.stock')}: ${product.stock}`}
                            </div>
                        ) : (
                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${isUntrackedSoldOut ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                {isUntrackedSoldOut ? <AlertCircle size={12} /> : <Infinity size={12} />}
                                <span>{product.stock > 0 ? t('inv.in_stock') : t('inv.out_of_stock')}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                     <button 
                        onClick={() => setQrModal({type: 'product', data: product})}
                        className="p-3 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors"
                        title="Show Product QR"
                    >
                        <QrIcon size={18} />
                    </button>
                    <button 
                        onClick={() => handleOpenModal(product)} 
                        className="p-3 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors"
                    >
                        <Edit2 size={18} />
                    </button>
                </div>
            </div>
            );
        })}
      </div>

      {/* Mobile Floating Action Button (FAB) */}
      <button 
        onClick={() => handleOpenModal()}
        disabled={isLimitReached}
        className={`md:hidden fixed bottom-[90px] right-4 w-14 h-14 bg-brand-600 text-white rounded-full shadow-xl shadow-brand-300 flex items-center justify-center z-30 active:scale-90 transition-transform ${isLimitReached ? 'opacity-50 grayscale' : ''}`}
      >
        <Plus size={28} />
      </button>

      {/* Add/Edit Product Full Page View */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col animate-[slide-up_0.2s_ease-out]">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b border-gray-100 flex justify-between items-center shrink-0 safe-top shadow-sm z-10">
                <button 
                    onClick={handleCloseModal} 
                    className="text-gray-500 font-bold text-sm p-2 -ml-2 rounded-lg hover:bg-gray-100 flex items-center gap-1"
                >
                    <ChevronLeft size={20} />
                    {t('common.cancel')}
                </button>
                <h2 className={`text-lg font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                    {editingProduct ? t('inv.edit') : t('inv.add_product')}
                </h2>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md shadow-brand-200 disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {t('common.save')}
                </button>
            </div>
            
            {/* Tab Switcher (Visible only when editing) */}
            {editingProduct && (
                <div className="px-4 pt-4 bg-slate-50">
                    <div className="flex p-1 bg-white border border-gray-200 rounded-xl">
                        <button 
                            onClick={() => setActiveModalTab('details')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeModalTab === 'details' ? 'bg-brand-50 text-brand-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            <Edit2 size={14} /> {t('var.details')}
                        </button>
                        <button 
                            onClick={() => setActiveModalTab('activity')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeModalTab === 'activity' ? 'bg-brand-50 text-brand-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            <History size={14} /> {t('var.activity')}
                        </button>
                    </div>
                </div>
            )}

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-20">
                {activeModalTab === 'details' ? (
                    <div className="space-y-6 max-w-lg mx-auto">
                        
                        {/* Image Section */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-4">
                            <div className="relative w-32 h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center group">
                                {uploading ? (
                                    <Loader2 className="animate-spin text-brand-600" />
                                ) : form.imageUrl && form.imageUrl.length > 20 ? (
                                    <img src={form.imageUrl} className="w-full h-full object-cover" alt="Product" />
                                ) : (
                                    <div className="text-gray-300 flex flex-col items-center">
                                        <ImageIcon size={32} />
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex gap-2 w-full justify-center">
                                <label className="flex flex-1 justify-center items-center gap-1.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 shadow-sm cursor-pointer hover:bg-gray-100 transition-colors">
                                    <Upload size={16} />
                                    <span>{t('common.upload')}</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={uploading} />
                                </label>
                                
                                <label className="flex flex-1 justify-center items-center gap-1.5 px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-xs font-bold text-brand-700 shadow-sm cursor-pointer hover:bg-brand-100 transition-colors">
                                    <Camera size={16} />
                                    <span>{t('common.camera')}</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} disabled={uploading} />
                                </label>

                                <button 
                                    onClick={handleGenerateAiImage}
                                    disabled={uploading}
                                    className="flex flex-1 justify-center items-center gap-1.5 px-3 py-2.5 bg-purple-50 border border-purple-100 rounded-xl text-xs font-bold text-purple-700 shadow-sm cursor-pointer hover:bg-purple-100 transition-colors"
                                >
                                    <Sparkles size={16} />
                                    <span>{t('common.ai_gen')}</span>
                                </button>
                            </div>
                            {pendingFile && <span className="text-[10px] text-orange-500 font-bold">* Image pending save</span>}
                        </div>

                        {/* Basic Info Section */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-bold text-gray-800 text-sm mb-2 border-b border-gray-100 pb-2">{t('common.basic_info')}</h3>
                            
                            {/* Barcode */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('inv.barcode')}</label>
                                <div className="relative flex gap-2">
                                    <div className="relative flex-1">
                                        <ScanBarcode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input 
                                            className="w-full pl-10 pr-12 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-mono text-gray-700"
                                            value={form.barcode}
                                            onChange={e => setForm({...form, barcode: e.target.value})}
                                            onBlur={handleManualLookup}
                                            placeholder="Scan or type"
                                        />
                                        <button 
                                            onClick={() => setShowScanner(true)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-lg shadow-sm text-brand-600 hover:bg-brand-50 transition-colors"
                                        >
                                            <Camera size={18} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleManualLookup}
                                        disabled={loadingLookup || !form.barcode || !!editingProduct}
                                        className={`bg-brand-100 text-brand-600 p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed`}
                                        title={editingProduct ? "Lookup disabled when editing" : "AI Product Lookup"}
                                    >
                                        {loadingLookup ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    {t('inv.product_name')}
                                    <span className="text-red-500 text-sm">*</span>
                                    {loadingLookup && <Loader2 size={12} className="animate-spin text-brand-500 ml-2" />}
                                </label>
                                <input 
                                    id="product-name-input"
                                    className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-gray-800"
                                    value={form.name}
                                    onChange={e => setForm({...form, name: e.target.value})}
                                    placeholder="e.g. Anchor Beer"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    {t('inv.category')}
                                    {loadingLookup && <Loader2 size={12} className="animate-spin text-brand-500" />}
                                </label>
                                <input 
                                    list="category-suggestions"
                                    className="w-full p-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium"
                                    value={form.category}
                                    onChange={e => setForm({...form, category: e.target.value})}
                                    placeholder="Select or type new category"
                                />
                                <datalist id="category-suggestions">
                                    {categories.map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Description */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        {t('inv.description')}
                                        {loadingLookup && <Loader2 size={12} className="animate-spin text-brand-500" />}
                                    </label>
                                    <button 
                                        onClick={handleGenerateDescription}
                                        disabled={loadingAi}
                                        className="text-[10px] font-bold text-purple-600 flex items-center gap-1 hover:text-purple-800 disabled:opacity-50 bg-purple-50 px-2 py-1 rounded-lg"
                                    >
                                        {loadingAi ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10} />}
                                        {t('inv.auto_write')}
                                    </button>
                                </div>
                                <textarea 
                                    className="w-full p-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-sm h-24 resize-none"
                                    value={form.description}
                                    onChange={e => setForm({...form, description: e.target.value})}
                                    placeholder="Product details..."
                                />
                            </div>
                        </div>

                        {/* Price & Stock Section */}
                        {variants.length === 0 && (
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-gray-800 text-sm mb-4 border-b border-gray-100 pb-2">{t('common.price_inventory')}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                            {t('inv.price')} (៛) <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">៛</span>
                                            <input 
                                                type="number" step="100"
                                                className="w-full pl-8 pr-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-lg text-brand-700"
                                                value={form.price !== undefined && form.price !== null ? form.price : ''}
                                                placeholder="0"
                                                onFocus={e => e.target.select()}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setForm({...form, price: val === '' ? 0 : parseFloat(val) || 0});
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                {form.trackStock ? t('inv.stock') : 'Status'}
                                            </label>
                                            <button 
                                                onClick={() => setForm(prev => ({...prev, trackStock: !prev.trackStock}))}
                                                className="text-[10px] text-brand-600 font-bold flex items-center gap-1"
                                                title="Toggle Stock Tracking"
                                            >
                                                {form.trackStock ? t('inv.track_stock') : 'OFF'}
                                                {form.trackStock ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                            </button>
                                        </div>
                                        
                                        {form.trackStock ? (
                                            <input 
                                                type="number"
                                                className="w-full p-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-lg"
                                                value={form.stock !== undefined && form.stock !== null ? form.stock : ''}
                                                placeholder="0"
                                                onFocus={e => e.target.select()}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setForm({...form, stock: val === '' ? 0 : parseInt(val) || 0});
                                                }}
                                            />
                                        ) : (
                                            <div className="flex bg-gray-50 rounded-xl p-1 border border-gray-200 h-[52px]">
                                                <button 
                                                    onClick={() => setForm({...form, stock: 100})}
                                                    className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.stock && form.stock > 0 ? 'bg-white text-green-600 shadow-sm border border-gray-100' : 'text-gray-400'}`}
                                                >
                                                    {t('inv.in_stock')}
                                                </button>
                                                <button 
                                                    onClick={() => setForm({...form, stock: 0})}
                                                    className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.stock === 0 ? 'bg-white text-red-600 shadow-sm border border-gray-100' : 'text-gray-400'}`}
                                                >
                                                    {t('inv.out_of_stock')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- ATTRIBUTES SECTION --- */}
                        {settings.enableAttributes && (
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                                    <h3 className={`font-bold text-gray-800 text-sm ${language === 'km' ? 'font-display' : ''}`}>{t('inv.attributes')}</h3>
                                    {attributes.length < 2 && (
                                        <button onClick={addAttribute} className="text-brand-600 text-xs font-bold flex items-center gap-1 bg-brand-50 px-2 py-1 rounded-lg">
                                            <Plus size={12} /> {t('inv.add_attribute')}
                                        </button>
                                    )}
                                </div>

                                {attributes.map((attr, idx) => (
                                    <div key={idx} className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                        <div className="flex gap-2 mb-2">
                                            <input 
                                                className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                                placeholder={t('var.attr_name')}
                                                value={attr.name}
                                                onChange={e => updateAttributeName(idx, e.target.value)}
                                            />
                                            <button onClick={() => removeAttribute(idx)} className="p-2 text-gray-400 hover:text-red-500 bg-white rounded-lg border border-gray-200"><Trash2 size={16} /></button>
                                        </div>
                                        <input 
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                            placeholder={t('var.attr_opts')}
                                            value={attr.options.join(', ')}
                                            onChange={e => updateAttributeOptions(idx, e.target.value)}
                                        />
                                    </div>
                                ))}

                                {attributes.length > 0 && variants.length === 0 && (
                                    <button 
                                        onClick={generateVariants}
                                        className="w-full py-3 bg-brand-100 text-brand-700 font-bold rounded-xl text-sm mb-2"
                                    >
                                        {t('inv.gen_variants')}
                                    </button>
                                )}

                                {variants.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-gray-500 text-left">
                                                    <th className="pb-2">{t('var.variant')}</th>
                                                    <th className="pb-2">{t('inv.price')}</th>
                                                    <th className="pb-2">{t('inv.stock')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {variants.map((variant, vIdx) => (
                                                    <tr key={vIdx}>
                                                        <td className="py-2.5 font-medium pr-2">{variant.options.join(' / ')}</td>
                                                        <td className="py-2.5 pr-2">
                                                            <input 
                                                                type="number" step="100"
                                                                className="w-20 p-2 border border-gray-200 rounded-lg bg-gray-50 text-center font-bold"
                                                                value={variant.price === 0 ? '' : variant.price}
                                                                placeholder="0"
                                                                onFocus={e => e.target.select()}
                                                                onChange={(e) => updateVariant(vIdx, 'price', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                        <td className="py-2.5">
                                                            <input 
                                                                type="number"
                                                                className="w-16 p-2 border border-gray-200 rounded-lg bg-gray-50 text-center"
                                                                value={variant.stock === 0 ? '' : variant.stock}
                                                                placeholder="0"
                                                                onFocus={e => e.target.select()}
                                                                onChange={(e) => updateVariant(vIdx, 'stock', parseInt(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <button 
                                            onClick={generateVariants}
                                            className="mt-3 text-xs text-brand-600 font-bold underline"
                                        >
                                            {t('var.regenerate')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    // ACTIVITY LOG TAB (With Pagination)
                    <div className="space-y-4 max-w-lg mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        {productActivities.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <History size={48} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-medium">No activity recorded yet.</p>
                                <p className="text-xs mt-1">Logs older than 3 months are auto-deleted.</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 pb-4">
                                {productActivities.map((activity, idx) => (
                                    <div key={activity.id} className="relative pl-6">
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm
                                            ${activity.type === 'create' ? 'bg-green-500' : ''}
                                            ${activity.type === 'update' ? 'bg-blue-500' : ''}
                                            ${activity.type === 'sale' ? 'bg-brand-600' : ''}
                                            ${activity.type === 'restock' ? 'bg-orange-500' : ''}
                                            ${activity.type === 'delete' ? 'bg-red-500' : ''}
                                            ${activity.type === 'stock_change' ? 'bg-purple-600' : ''}
                                        `}></div>
                                        
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-bold text-gray-800 capitalize">
                                                    {activity.type === 'stock_change' ? 'Stock Adjustment' : activity.type}
                                                </p>
                                                <p className="text-xs text-gray-500">{activity.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-400 font-mono">{new Date(activity.timestamp).toLocaleDateString()}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">{new Date(activity.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            </div>
                                        </div>
                                        <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 font-bold bg-gray-50 w-fit px-2 py-0.5 rounded-full">
                                            <PenTool size={10} /> {activity.performedBy}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {editingProduct && hasMoreActivities(editingProduct.id) && productActivities.length > 0 && (
                            <button 
                                onClick={handleLoadMoreActivities}
                                disabled={loadingMoreActivities}
                                className="w-full py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-100 flex items-center justify-center gap-2"
                            >
                                {loadingMoreActivities ? <Loader2 size={14} className="animate-spin"/> : <ChevronDown size={14} />}
                                Load More History
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-[scale-in_0.2s_ease-out]">
                   <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                       <h3 className="font-bold text-lg text-gray-800">{t('inv.manage_cats')}</h3>
                       <button onClick={() => setIsCategoryManagerOpen(false)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-200">
                           <X size={20} />
                       </button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-2">
                       {categories.map(cat => (
                           <CategoryRow 
                              key={cat} 
                              category={cat} 
                              onRename={renameCategory} 
                              onDelete={deleteCategory} 
                              showConfirm={showConfirm}
                              showToast={showToast}
                              t={t}
                           />
                       ))}
                   </div>
               </div>
          </div>
      )}

      {/* QR Share Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative animate-[scale-in_0.2s_ease-out]">
                <button onClick={() => setQrModal(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20} /></button>
                <div className="p-8 flex flex-col items-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">
                        {qrModal.type === 'shop' ? t('inv.public_link') : 'Product QR'}
                    </h2>

                    <div className="bg-white p-4 rounded-2xl shadow-card border border-gray-100 mb-6" id="qr-code-container">
                        {/* Updated QR Code Color */}
                        <QRCode 
                            value={getPublicUrl(qrModal.type, qrModal.data.id)} 
                            size={200} 
                            level="M"
                            fgColor="#312e81"
                            bgColor="#FFFFFF"
                        />
                    </div>

                    <div className="flex gap-2 w-full">
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(getPublicUrl(qrModal.type, qrModal.data.id));
                                showToast(t('toast.link_copied'), "success");
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            <Share2 size={18} />
                            Copy
                        </button>
                        <button 
                            onClick={() => downloadQr(qrModal.type === 'shop' ? (currentShop?.name || 'Shop') : qrModal.data.name)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
                        >
                            <Download size={18} />
                            Download
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Barcode Scanner Overlay */}
      {showScanner && (
          <BarcodeScanner 
              onScan={handleScan}
              onClose={() => setShowScanner(false)}
          />
      )}
    </div>
  );
}

const CategoryRow = ({ category, onRename, onDelete, showConfirm, showToast, t }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(category);

    const handleSave = async () => {
        if (!newName.trim() || newName === category) {
            setIsEditing(false);
            return;
        }
        await onRename(category, newName);
        showToast(t('toast.cat_renamed'), "success");
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (category === 'General') {
            showToast(t('toast.cant_del_def_cat'), "error");
            return;
        }
        const confirm = await showConfirm(t('alert.del_cat_title'), t('alert.del_cat_msg'));
        if (confirm) {
            await onDelete(category);
            showToast(t('toast.cat_deleted'), "success");
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 p-2 bg-brand-50 rounded-xl">
                <input 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 p-2 text-sm rounded-lg border border-brand-200 outline-none"
                    autoFocus
                />
                <button onClick={handleSave} className="p-2 bg-brand-600 text-white rounded-lg text-xs font-bold">{t('common.save')}</button>
                <button onClick={() => setIsEditing(false)} className="p-2 text-gray-500 text-xs font-bold">{t('common.cancel')}</button>
            </div>
        );
    }

    return (
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 group">
            <span className="font-bold text-gray-700 text-sm">{category}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-white rounded-lg">
                    <FolderEdit size={16} />
                </button>
                {category !== 'General' && (
                    <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};