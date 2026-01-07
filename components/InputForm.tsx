
import React, { useRef, useMemo, useState } from 'react';
import { ArtDirectionRequest, ProductType, VisualStyle, ColorMode, QualityLevel, ProductImageMode, ReferenceImageConfig, AnalysisModel } from '../types';
import { getClosestAspectRatio } from '../services/geminiService';

interface InputFormProps {
  values: ArtDirectionRequest;
  onChange: (field: keyof ArtDirectionRequest, value: any) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  estimatedCost?: number;
}

const InputForm: React.FC<InputFormProps> = ({ values, onChange, onSubmit, isGenerating, estimatedCost = 0 }) => {
  const assetInputRef = useRef<HTMLInputElement>(null);
  const headlineImageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const referenceAttributeLabels: Record<string, string> = {
    'Subject': 'Chủ thể',
    'Style': 'Phong cách',
    'Composition': 'Bố cục',
    'Color': 'Màu & Ánh sáng',
    'Decor': 'Trang trí',
    'Typography': 'Typography'
  };

  const refAttributeKeys = ['Subject', 'Style', 'Composition', 'Color', 'Decor', 'Typography'];

  const estimatedOutput = useMemo(() => {
    if (!values.width || !values.height) return null;
    const w = parseFloat(values.width);
    const h = parseFloat(values.height);
    if (isNaN(w) || isNaN(h) || w === 0 || h === 0) return null;

    let maxDim = 1024;
    if (values.quality === QualityLevel.MEDIUM) maxDim = 2048;
    if (values.quality === QualityLevel.HIGH) maxDim = 4096;

    const closestRatioLabel = getClosestAspectRatio(values.width, values.height);
    const ratioValues: Record<string, number> = {
      "1:1": 1.0, "3:4": 3/4, "4:3": 4/3, "9:16": 9/16, "16:9": 16/9
    };
    const ratioVal = ratioValues[closestRatioLabel];

    let pxWidth, pxHeight;
    if (ratioVal >= 1) {
        pxWidth = maxDim;
        pxHeight = Math.round(maxDim / ratioVal);
    } else {
        pxHeight = maxDim;
        pxWidth = Math.round(maxDim * ratioVal);
    }
    return { pixels: `${pxWidth} x ${pxHeight} px`, ratio: closestRatioLabel };
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

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
        if (reader.result) {
            const newImage: ReferenceImageConfig = {
                id: Date.now().toString() + index,
                image: reader.result as string,
                attributes: []
            };
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
                <input type="file" ref={headlineImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'mainHeadlineImage')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nội Dung Phụ</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-slate-500 h-16 resize-none text-sm"
              placeholder="Tiêu đề phụ, ngày tháng, website..."
              value={values.secondaryText}
              onChange={(e) => onChange('secondaryText', e.target.value)}
            />
          </div>
        </div>
        
        <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
            <div className="flex justify-between items-center mb-2">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Logo Thương Hiệu</label>
               {values.logoImage && <button onClick={() => onChange('logoImage', null)} className="text-xs text-red-400 hover:text-red-300">Xóa Logo</button>}
            </div>
            {!values.logoImage ? (
                <div onClick={() => logoInputRef.current?.click()} className="w-full h-16 border border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-500 transition-colors gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="text-xs text-slate-400">Tải lên Logo (PNG/JPG)</span>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-700">
                   <div className="w-12 h-12 bg-white/5 rounded border border-slate-600 flex items-center justify-center overflow-hidden"><img src={values.logoImage} alt="Logo" className="w-full h-full object-contain" /></div>
                   <div className="flex-1"><p className="text-xs text-slate-300">Đã tải lên logo</p></div>
                </div>
            )}
            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'logoImage')} />
        </div>

        <div className="p-3 bg-blue-900/10 rounded-lg border border-blue-500/20">
            <label className="block text-sm font-medium text-blue-200 mb-1 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Phông Chữ & Typography
            </label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-500 h-20 resize-none text-sm"
              placeholder="Vd: Dùng Sans-serif đậm..."
              value={values.fontPreferences}
              onChange={(e) => onChange('fontPreferences', e.target.value)}
            />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Yêu Cầu Bố Cục & Mô Tả</label>
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-slate-500 h-24 resize-none text-sm mb-3"
            placeholder="Mô tả bối cảnh..."
            value={values.layoutRequirements}
            onChange={(e) => onChange('layoutRequirements', e.target.value)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Hình Ảnh Sản Phẩm (Assets)</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
             <button
                onClick={() => onChange('productImageMode', ProductImageMode.REALISTIC)}
                className={`p-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 transition-all ${values.productImageMode === ProductImageMode.REALISTIC ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
             >
                Làm Nét & Giữ Nguyên
             </button>
             <button
                onClick={() => onChange('productImageMode', ProductImageMode.STYLIZED)}
                className={`p-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 transition-all ${values.productImageMode === ProductImageMode.STYLIZED ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
             >
                AI Cách Điệu
             </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {values.assetImages.map((img, idx) => (
              <div key={idx} className="relative w-12 h-12 rounded overflow-hidden border border-slate-600 group"><img src={img} alt="asset" className="w-full h-full object-cover" /><button onClick={() => removeAsset(idx)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs">X</button></div>
            ))}
            <button onClick={() => assetInputRef.current?.click()} className="w-12 h-12 rounded border border-dashed border-slate-500 flex items-center justify-center text-slate-400 hover:text-purple-500">+</button>
          </div>
          <input type="file" multiple ref={assetInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'assetImages')} />
        </div>

        <div className="space-y-4">
           <div className="flex justify-between items-center border-b border-slate-700 pb-2">
            <label className="text-sm font-medium text-slate-300">Ảnh Tham Khảo (Tối đa 3)</label>
           </div>
           <div className="flex flex-col gap-4">
               {values.referenceImages.map((refImg, idx) => (
                   <div key={refImg.id} className="border border-slate-600 rounded-lg p-3 bg-slate-900/50">
                       <div className="flex gap-3 items-start">
                           <div className="w-20 h-20 flex-shrink-0 bg-slate-800 rounded border border-slate-700 overflow-hidden relative group">
                                <img src={refImg.image} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                                <button onClick={() => removeReferenceImage(idx)} className="absolute top-0 right-0 bg-black/60 text-white p-1 hover:bg-red-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                           </div>
                           <div className="flex-1">
                               <p className="text-xs font-semibold text-slate-400 mb-2">Lấy ý tưởng về:</p>
                               <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                   {refAttributeKeys.map((attr) => (
                                     <label key={attr} className="flex items-center space-x-2 cursor-pointer group">
                                       <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${refImg.attributes.includes(attr) ? 'bg-purple-600 border-purple-600' : 'border-slate-600'}`}>{refImg.attributes.includes(attr) && <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}</div>
                                       <input type="checkbox" className="hidden" checked={refImg.attributes.includes(attr)} onChange={() => toggleReferenceAttribute(idx, attr)} />
                                       <span className="text-[10px] text-slate-400">{referenceAttributeLabels[attr] || attr}</span>
                                     </label>
                                   ))}
                               </div>
                           </div>
                       </div>
                   </div>
               ))}
               {values.referenceImages.length < 3 && (
                   <div onClick={() => refInputRefs.current[values.referenceImages.length]?.click()} className="w-full h-12 border border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-500 transition-all gap-2 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="text-xs font-medium">Thêm ảnh tham khảo {values.referenceImages.length + 1}</span>
                   </div>
               )}
               {[0, 1, 2].map((i) => (<input key={i} type="file" ref={(el) => { refInputRefs.current[i] = el; }} className="hidden" accept="image/*" onChange={(e) => { handleReferenceImageUpload(e, i); e.target.value = ''; }} />))}
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phong Cách Hình Ảnh</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm outline-none" value={values.visualStyle} onChange={(e) => onChange('visualStyle', e.target.value)}>
              {Object.values(VisualStyle).map((style) => (<option key={style} value={style}>{visualStyleLabels[style] || style}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Chế Độ Màu</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm outline-none" value={values.colorMode} onChange={(e) => onChange('colorMode', e.target.value)}>
               <option value={ColorMode.AUTO}>Tự động</option>
               <option value={ColorMode.CUSTOM}>Tùy chỉnh</option>
               <option value={ColorMode.BRAND_LOGO}>Màu Logo</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-700/50 mt-2">
           <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs text-slate-300 mb-1">Số Lượng Ảnh</label>
                   <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                      {[1, 2, 3].map(num => (
                        <button key={num} onClick={() => onChange('batchSize', num)} className={`flex-1 text-xs py-1.5 rounded transition-all ${values.batchSize === num ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>{num}</button>
                      ))}
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs text-slate-300 mb-1">Chất Lượng Ảnh</label>
                   <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none h-[30px]" value={values.quality} onChange={(e) => onChange('quality', e.target.value)}>
                     <option value={QualityLevel.LOW}>Thấp (1K)</option>
                     <option value={QualityLevel.MEDIUM}>Trung bình (2K)</option>
                     <option value={QualityLevel.HIGH}>Cao (4K)</option>
                   </select>
                 </div>
             </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700 mt-2">
        <div className="mb-4 space-y-2">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mô Hình Phân Tích</label>
             <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => onChange('analysisModel', AnalysisModel.FLASH)} className={`p-2 rounded-lg text-xs font-medium border flex flex-col items-center justify-center gap-1 ${values.analysisModel === AnalysisModel.FLASH ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                    <span>Flash (Nhanh)</span>
                 </button>
                 <button onClick={() => onChange('analysisModel', AnalysisModel.PRO)} className={`p-2 rounded-lg text-xs font-medium border flex flex-col items-center justify-center gap-1 ${values.analysisModel === AnalysisModel.PRO ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                    <span>Pro (Kỹ lưỡng)</span>
                 </button>
             </div>
        </div>
        
        <div className="mb-4 flex items-center justify-between px-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
             <span className="text-[10px] text-slate-400 font-bold uppercase">Ước tính:</span>
             <span className="text-sm text-emerald-400 font-mono font-black">{formatCurrency(estimatedCost)}</span>
        </div>

        <button
          onClick={onSubmit}
          disabled={isGenerating || !values.mainHeadline}
          className={`w-full py-3 px-6 rounded-lg text-white font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${isGenerating || !values.mainHeadline ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-[1.02]'}`}
        >
          {isGenerating ? 'Đang Phân Tích...' : 'Phân Tích & Sản Xuất'}
        </button>
      </div>
    </div>
  );
};

export default InputForm;
