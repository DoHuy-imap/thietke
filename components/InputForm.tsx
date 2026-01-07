
import React, { useRef, useMemo, useState } from 'react';
import { ArtDirectionRequest, ProductType, VisualStyle, ColorMode, QualityLevel, ProductImageMode, ReferenceImageConfig, AnalysisModel } from '../types';

interface InputFormProps {
  values: ArtDirectionRequest;
  onChange: (field: keyof ArtDirectionRequest, value: any) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  estimatedCost?: number; // New prop for cost display
}

const InputForm: React.FC<InputFormProps> = ({ values, onChange, onSubmit, isGenerating, estimatedCost = 0 }) => {
  const assetInputRef = useRef<HTMLInputElement>(null);
  const headlineImageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Create refs for multiple reference inputs (0, 1, 2)
  const refInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Helper mappings for Vietnamese display
  const productTypeLabels: Record<string, string> = {
    [ProductType.POSTER]: 'Ápp phích (Poster)',
    [ProductType.STANDEE]: 'Standee',
    [ProductType.BACKDROP]: 'Phông nền (Backdrop)',
    [ProductType.BANNER]: 'Băng rôn (Banner)',
    [ProductType.SOCIAL_POST]: 'Bài đăng Mạng Xã Hội',
    [ProductType.FLYER]: 'Tờ rơi (Flyer)'
  };

  const visualStyleLabels: Record<string, string> = {
    [VisualStyle.MODERN_TECH]: 'Công nghệ Hiện đại',
    [VisualStyle.LUXURY]: 'Sang trọng / Cao cấp',
    [VisualStyle.VINTAGE]: 'Cổ điển (Vintage)',
    [VisualStyle.FESTIVE]: 'Lễ hội / Sự kiện',
    [VisualStyle.MINIMALIST]: 'Tối giản (Minimalist)',
    [VisualStyle.CORPORATE]: 'Doanh nghiệp (Corporate)',
    [VisualStyle.CYBERPUNK]: 'Cyberpunk / Tương lai',
    [VisualStyle.NATURAL_ORGANIC]: 'Thiên nhiên / Organic',
    [VisualStyle.FOLLOW_REF]: 'Style ảnh tham khảo'
  };

  // Updated Reference Attributes to match 6-point decomposition
  const referenceAttributeLabels: Record<string, string> = {
    'Subject': 'Chủ thể',
    'Style': 'Phong cách',
    'Composition': 'Bố cục',
    'Color': 'Màu & Ánh sáng',
    'Decor': 'Trang trí',
    'Typography': 'Typography'
  };

  const refAttributeKeys = ['Subject', 'Style', 'Composition', 'Color', 'Decor', 'Typography'];

  // Calculate estimated pixels
  const estimatedOutput = useMemo(() => {
    if (!values.width || !values.height) return null;
    const w = parseFloat(values.width);
    const h = parseFloat(values.height);
    if (isNaN(w) || isNaN(h) || w === 0 || h === 0) return null;

    let maxDim = 1024; // Default Low/1K
    if (values.quality === QualityLevel.MEDIUM) maxDim = 2048; // 2K
    if (values.quality === QualityLevel.HIGH) maxDim = 4096; // 4K

    const currentRatio = w / h;
    const supportedRatios = [
        { label: "1:1", val: 1.0 },
        { label: "3:4", val: 3/4 },
        { label: "4:3", val: 4/3 },
        { label: "9:16", val: 9/16 },
        { label: "16:9", val: 16/9 }
    ];

    const closest = supportedRatios.reduce((prev, curr) => {
        return (Math.abs(curr.val - currentRatio) < Math.abs(prev.val - currentRatio) ? curr : prev);
    });

    let pxWidth, pxHeight;
    if (closest.val >= 1) {
        pxWidth = maxDim;
        pxHeight = Math.round(maxDim / closest.val);
    } else {
        pxHeight = maxDim;
        pxWidth = Math.round(maxDim * closest.val);
    }
    return { pixels: `${pxWidth} x ${pxHeight} px`, ratio: closest.label };
  }, [values.width, values.height, values.quality]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'assetImages' | 'mainHeadlineImage' | 'logoImage') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (field === 'assetImages') {
      const newImages: string[] = [...values.assetImages];
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) newImages.push(reader.result as string);
          if (newImages.length === values.assetImages.length + files.length) {
             onChange('assetImages', newImages);
          }
        };
        reader.readAsDataURL(file);
      });
    } else {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) onChange(field, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAsset = (index: number) => {
    const newImages = [...values.assetImages];
    newImages.splice(index, 1);
    onChange('assetImages', newImages);
  };

  // --- New Logic for Multiple Reference Images ---
  
  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
        if (reader.result) {
            const newRefImages = [...values.referenceImages];
            // Ensure array has capability to store up to index
            while(newRefImages.length <= index) {
                // If we are adding to a slot that doesn't exist yet, we might need logic, but here we assume slots 0,1,2 map to array indices or we check IDs.
                // Simpler approach: Filter existing or create new.
                // We will treat referenceImages as a list. But UI displays 3 fixed slots.
                break;
            }
            
            const newImage: ReferenceImageConfig = {
                id: Date.now().toString() + index,
                image: reader.result as string,
                attributes: [] // Default no attributes selected
            };
            
            // Determine if we are updating an existing one or adding new?
            // Since we can have up to 3, let's just append if count < 3.
            if (values.referenceImages.length < 3) {
                 onChange('referenceImages', [...values.referenceImages, newImage]);
            }
        }
    };
    reader.readAsDataURL(file);
  };
  
  const removeReferenceImage = (index: number) => {
      const newRefImages = [...values.referenceImages];
      newRefImages.splice(index, 1);
      onChange('referenceImages', newRefImages);
  };

  const toggleReferenceAttribute = (imgIndex: number, attr: string) => {
      const newRefImages = [...values.referenceImages];
      const currentAttributes = newRefImages[imgIndex].attributes;
      
      if (currentAttributes.includes(attr)) {
          newRefImages[imgIndex].attributes = currentAttributes.filter(a => a !== attr);
      } else {
          newRefImages[imgIndex].attributes = [...currentAttributes, attr];
      }
      onChange('referenceImages', newRefImages);
  };

  const handleColorChange = (index: number, value: string) => {
    const newColors = [...values.customColors];
    newColors[index] = value;
    onChange('customColors', newColors);
  };

  const addColor = () => {
    if (values.customColors.length < 5) {
        onChange('customColors', [...values.customColors, '#000000']);
    }
  };

  const removeColor = (index: number) => {
    if (values.customColors.length > 1) {
        const newColors = values.customColors.filter((_, i) => i !== index);
        onChange('customColors', newColors);
    }
  };

  const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm h-full flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Bản Yêu Cầu Thiết Kế
      </h2>

      <div className="space-y-5 flex-grow">
        {/* Product Type & Dimensions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1">Loại Sản Phẩm</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
              value={values.productType}
              onChange={(e) => onChange('productType', e.target.value)}
            >
              {Object.values(ProductType).map((type) => (
                <option key={type} value={type}>{productTypeLabels[type] || type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Rộng (cm)</label>
            <input 
              type="number" placeholder="Ví dụ: 60"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              value={values.width} onChange={(e) => onChange('width', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cao (cm)</label>
            <input 
              type="number" placeholder="Ví dụ: 160"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              value={values.height} onChange={(e) => onChange('height', e.target.value)}
            />
          </div>
          {/* Pixel Output Indicator */}
          <div className="col-span-2 -mt-2">
             {estimatedOutput ? (
                <div className="flex flex-col gap-1 bg-slate-900/50 rounded px-3 py-2 border border-slate-700/50">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                            <span className="text-xs text-slate-300 font-medium">Độ phân giải tối đa:</span>
                         </div>
                         <span className="text-emerald-400 font-bold text-xs font-mono">{estimatedOutput.pixels}</span>
                    </div>
                    <div className="flex justify-end items-center gap-2">
                         <span className="text-[10px] text-slate-500">Tỷ lệ chuẩn AI: {estimatedOutput.ratio}</span>
                    </div>
                </div>
             ) : (
                <div className="flex items-center gap-2 px-2 py-1">
                   <span className="text-xs text-slate-600">Nhập kích thước để xem độ phân giải pixel</span>
                </div>
             )}
          </div>
        </div>

        {/* Content Section Split */}
        <div className="space-y-3 p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Thông Tin Nội Dung</label>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tiêu Đề Chính</label>
            <div className="flex gap-2">
                <input
                    type="text"
                    className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-slate-500 font-semibold"
                    placeholder="Ví dụ: KHUYẾN MÃI HÈ"
                    value={values.mainHeadline}
                    onChange={(e) => onChange('mainHeadline', e.target.value)}
                />
                
                {/* Headline Reference Image Uploader */}
                {!values.mainHeadlineImage ? (
                     <button 
                        onClick={() => headlineImageInputRef.current?.click()}
                        className="w-10 h-10 flex-shrink-0 bg-slate-800 border border-dashed border-slate-600 rounded-lg flex items-center justify-center text-slate-500 hover:text-purple-400 hover:border-purple-500 transition-colors group relative"
                        title="Tải ảnh mẫu phông chữ cho tiêu đề"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                     </button>
                ) : (
                    <div className="w-10 h-10 flex-shrink-0 relative rounded-lg overflow-hidden border border-purple-500/50 group">
                        <img src={values.mainHeadlineImage} alt="Style" className="w-full h-full object-cover" />
                        <button 
                           onClick={() => onChange('mainHeadlineImage', null)}
                           className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                        </button>
                    </div>
                )}
                <input 
                    type="file" ref={headlineImageInputRef} className="hidden" accept="image/*"
                    onChange={(e) => handleFileChange(e, 'mainHeadlineImage')} 
                />
            </div>
            {values.mainHeadlineImage && <p className="text-[10px] text-purple-400 mt-1 ml-1">* Đang dùng ảnh làm mẫu style cho tiêu đề</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nội Dung Phụ</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-slate-500 h-16 resize-none text-sm"
              placeholder="Tiêu đề phụ, ngày tháng, website, nội dung chi tiết..."
              value={values.secondaryText}
              onChange={(e) => onChange('secondaryText', e.target.value)}
            />
          </div>
        </div>
        
        {/* LOGO SECTION */}
        <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <div className="flex justify-between items-center mb-2">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Logo Thương Hiệu</label>
               {values.logoImage && (
                  <button onClick={() => onChange('logoImage', null)} className="text-xs text-red-400 hover:text-red-300">Xóa Logo</button>
               )}
            </div>
            
            {!values.logoImage ? (
                <div 
                   onClick={() => logoInputRef.current?.click()}
                   className="w-full h-16 border border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-slate-800/50 transition-colors gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs text-slate-400">Tải lên Logo (PNG/JPG)</span>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-700">
                   <div className="w-12 h-12 bg-white/5 rounded border border-slate-600 flex items-center justify-center overflow-hidden">
                       <img src={values.logoImage} alt="Logo" className="w-full h-full object-contain" />
                   </div>
                   <div className="flex-1">
                       <p className="text-xs text-slate-300">Đã tải lên logo</p>
                       <p className="text-[10px] text-emerald-400">Sẽ giữ nguyên trong thiết kế</p>
                   </div>
                </div>
            )}
            <input 
                type="file" ref={logoInputRef} className="hidden" accept="image/*"
                onChange={(e) => handleFileChange(e, 'logoImage')} 
            />
        </div>

        {/* Typography */}
        <div className="p-3 bg-blue-900/10 rounded-lg border border-blue-500/20">
            <label className="block text-sm font-medium text-blue-200 mb-1 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Phông Chữ & Typography
            </label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-500 h-20 resize-none text-sm"
              placeholder="Vd: Dùng Sans-serif đậm cho tiêu đề, Script mềm mại cho slogan. Ưu tiên font 'Montserrat'..."
              value={values.fontPreferences}
              onChange={(e) => onChange('fontPreferences', e.target.value)}
            />
        </div>

        {/* Layout Requirements */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Yêu Cầu Bố Cục & Mô Tả</label>
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-slate-500 h-24 resize-none text-sm mb-3"
            placeholder="Mô tả bối cảnh, sắp xếp các yếu tố, vị trí logo. (Vd: Logo góc phải, sản phẩm ở giữa nền neon city...)"
            value={values.layoutRequirements}
            onChange={(e) => onChange('layoutRequirements', e.target.value)}
          />
        </div>
        
        {/* Asset Images & Product Processing Mode */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Hình Ảnh Sản Phẩm (Assets)</label>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
             <button
                onClick={() => onChange('productImageMode', ProductImageMode.REALISTIC)}
                className={`p-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                   values.productImageMode === ProductImageMode.REALISTIC 
                   ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' 
                   : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Làm Nét & Giữ Nguyên
             </button>
             <button
                onClick={() => onChange('productImageMode', ProductImageMode.STYLIZED)}
                className={`p-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                   values.productImageMode === ProductImageMode.STYLIZED 
                   ? 'bg-purple-600/20 border-purple-500 text-purple-400' 
                   : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                AI Cách Điệu
             </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {values.assetImages.map((img, idx) => (
              <div key={idx} className="relative w-12 h-12 rounded overflow-hidden border border-slate-600 group">
                <img src={img} alt="asset" className="w-full h-full object-cover" />
                <button 
                  onClick={() => removeAsset(idx)}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs"
                >
                  X
                </button>
              </div>
            ))}
            <button 
              onClick={() => assetInputRef.current?.click()}
              className="w-12 h-12 rounded border border-dashed border-slate-500 flex items-center justify-center text-slate-400 hover:border-purple-500 hover:text-purple-500 transition-colors"
            >
              +
            </button>
          </div>
          <input 
            type="file" multiple ref={assetInputRef} className="hidden" accept="image/*"
            onChange={(e) => handleFileChange(e, 'assetImages')} 
          />
        </div>

        {/* Reference Images (Multi-Slot) */}
        <div className="space-y-4">
           <div className="flex justify-between items-center border-b border-slate-700 pb-2">
            <label className="text-sm font-medium text-slate-300">Ảnh Tham Khảo (Tối đa 3)</label>
            <span className="text-[10px] text-slate-500">
               {values.referenceImages.length}/3 ảnh
            </span>
           </div>
           
           <div className="flex flex-col gap-4">
               {/* Loop to render existing images + 1 add button if < 3 */}
               {values.referenceImages.map((refImg, idx) => (
                   <div key={refImg.id} className="border border-slate-600 rounded-lg p-3 bg-slate-900/50">
                       <div className="flex gap-3 items-start">
                           <div className="w-20 h-20 flex-shrink-0 bg-slate-800 rounded border border-slate-700 overflow-hidden relative group">
                                <img src={refImg.image} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => removeReferenceImage(idx)}
                                    className="absolute top-0 right-0 bg-black/60 text-white p-1 hover:bg-red-500 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                           </div>
                           <div className="flex-1">
                               <p className="text-xs font-semibold text-slate-400 mb-2">Lấy ý tưởng về:</p>
                               <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                   {refAttributeKeys.map((attr) => (
                                     <label key={attr} className="flex items-center space-x-2 cursor-pointer group">
                                       <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${refImg.attributes.includes(attr) ? 'bg-purple-600 border-purple-600' : 'border-slate-600 group-hover:border-purple-500'}`}>
                                            {refImg.attributes.includes(attr) && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                       </div>
                                       <input 
                                         type="checkbox" 
                                         className="hidden"
                                         checked={refImg.attributes.includes(attr)}
                                         onChange={() => toggleReferenceAttribute(idx, attr)}
                                       />
                                       <span className={`text-[10px] ${refImg.attributes.includes(attr) ? 'text-purple-300' : 'text-slate-400'}`}>
                                            {referenceAttributeLabels[attr] || attr}
                                       </span>
                                     </label>
                                   ))}
                               </div>
                           </div>
                       </div>
                   </div>
               ))}

               {/* Add Button Slot */}
               {values.referenceImages.length < 3 && (
                   <div 
                      onClick={() => refInputRefs.current[values.referenceImages.length]?.click()}
                      className="w-full h-12 border border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-slate-800/30 transition-all gap-2 text-slate-500 hover:text-purple-400"
                   >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs font-medium">Thêm ảnh tham khảo {values.referenceImages.length + 1}</span>
                   </div>
               )}
               
               {/* Hidden Inputs for File Upload */}
               {[0, 1, 2].map((i) => (
                  <input 
                    key={i}
                    type="file" 
                    ref={(el) => { refInputRefs.current[i] = el; }} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                        handleReferenceImageUpload(e, i);
                        // Reset input value to allow re-uploading same file if needed (though not strictly necessary here since key changes)
                        e.target.value = '';
                    }} 
                   />
               ))}
           </div>
        </div>

        {/* Style & Color */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phong Cách Hình Ảnh</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm outline-none"
              value={values.visualStyle}
              onChange={(e) => onChange('visualStyle', e.target.value)}
            >
              {Object.values(VisualStyle).map((style) => (
                <option key={style} value={style}>{visualStyleLabels[style] || style}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Chế Độ Màu</label>
            <select
               className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm outline-none"
               value={values.colorMode}
               onChange={(e) => onChange('colorMode', e.target.value)}
            >
               <option value={ColorMode.AUTO}>Tự động (Auto)</option>
               <option value={ColorMode.CUSTOM}>Tùy chỉnh (Custom)</option>
               <option value={ColorMode.BRAND_LOGO}>Theo màu logo thương hiệu</option>
            </select>
          </div>
        </div>
        
        {/* Dynamic Color Inputs */}
        {values.colorMode === ColorMode.CUSTOM && (
            <div className="mt-3 space-y-2">
               <label className="block text-xs text-slate-400 mb-1">Màu Thương Hiệu (Mã Hex)</label>
               {values.customColors.map((color, idx) => (
                 <div key={idx} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => handleColorChange(idx, e.target.value)}
                      className="h-8 w-8 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => handleColorChange(idx, e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-purple-500"
                      placeholder="#000000"
                    />
                    {values.customColors.length > 1 && (
                        <button onClick={() => removeColor(idx)} className="text-slate-500 hover:text-red-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                 </div>
               ))}
               <button 
                 onClick={addColor}
                 className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1"
                 disabled={values.customColors.length >= 5}
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                 </svg>
                 Thêm Màu
               </button>
            </div>
        )}
        
        {values.colorMode === ColorMode.BRAND_LOGO && (
             <div className="mt-3 p-2 bg-emerald-900/20 border border-emerald-500/30 rounded-lg flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                 </svg>
                 <span className="text-xs text-emerald-300">AI sẽ tự động trích xuất màu từ Logo đã tải lên.</span>
             </div>
        )}

        {/* Output Settings (Analysis Model moved out from here) */}
        <div className="pt-2 border-t border-slate-700/50 mt-2">
           <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cài Đặt Đầu Ra</label>
           
           <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs text-slate-300 mb-1">Số Lượng Ảnh</label>
                   <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                      {[1, 2, 3].map(num => (
                        <button
                          key={num}
                          onClick={() => onChange('batchSize', num)}
                          className={`flex-1 text-xs py-1.5 rounded transition-all ${
                            values.batchSize === num ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                   </div>
                 </div>
                 
                 <div>
                   <label className="block text-xs text-slate-300 mb-1">Chất Lượng Ảnh</label>
                   <select
                     className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none h-[30px]"
                     value={values.quality}
                     onChange={(e) => onChange('quality', e.target.value)}
                   >
                     <option value={QualityLevel.LOW}>Thấp (1K)</option>
                     <option value={QualityLevel.MEDIUM}>Trung bình (2K)</option>
                     <option value={QualityLevel.HIGH}>Cao (4K)</option>
                   </select>
                 </div>
             </div>
           </div>
        </div>

      </div>

      <div className="pt-4 border-t border-slate-700 mt-2">
        {/* Analysis Model Selection - MOVED HERE */}
        <div className="mb-4 space-y-2">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Mô Hình Phân Tích (Brain)</span>
                <span className="text-[10px] text-slate-500 font-normal">Biểu phí tham khảo</span>
             </label>
             <div className="grid grid-cols-2 gap-3">
                 <button
                    onClick={() => onChange('analysisModel', AnalysisModel.FLASH)}
                    className={`p-2 rounded-lg text-xs font-medium border flex flex-col items-center justify-center gap-1 transition-all ${
                       values.analysisModel === AnalysisModel.FLASH 
                       ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400' 
                       : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                 >
                    <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Flash (Nhanh)</span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-mono tracking-tighter">~50 VNĐ / 1k tokens</span>
                 </button>

                 <button
                    onClick={() => onChange('analysisModel', AnalysisModel.PRO)}
                    className={`p-2 rounded-lg text-xs font-medium border flex flex-col items-center justify-center gap-1 transition-all ${
                       values.analysisModel === AnalysisModel.PRO
                       ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' 
                       : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                 >
                    <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span>Pro (Thông Minh)</span>
                    </div>
                    <span className="text-[9px] text-orange-400 font-mono tracking-tighter">~500 VNĐ / 1k tokens</span>
                 </button>
             </div>
        </div>
        
        <div className="mb-4 flex items-center justify-between px-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
             <span className="text-[10px] text-slate-400 font-bold uppercase">Chi phí ước tính:</span>
             <span className="text-sm text-emerald-400 font-mono font-black tracking-tighter">
                {formatCurrency(estimatedCost)}
             </span>
        </div>

        <button
          onClick={onSubmit}
          disabled={isGenerating || !values.mainHeadline}
          className={`w-full py-3 px-6 rounded-lg text-white font-semibold shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2
            ${isGenerating || !values.mainHeadline
              ? 'bg-slate-700 cursor-not-allowed text-slate-400'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/25'
            }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang Phân Tích...
            </>
          ) : (
            <>
              Phân Tích & Lập Kế Hoạch
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InputForm;
