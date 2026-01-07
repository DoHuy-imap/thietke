
import React, { useRef, useMemo, useState } from 'react';
import { ArtDirectionRequest, ProductType, VisualStyle, ColorMode, QualityLevel, ProductImageMode, ReferenceImageConfig, AnalysisModel, CostBreakdown } from '../types';

interface InputFormProps {
  values: ArtDirectionRequest;
  onChange: (field: keyof ArtDirectionRequest, value: any) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  costBreakdown: CostBreakdown;
}

const InputForm: React.FC<InputFormProps> = ({ values, onChange, onSubmit, isGenerating, costBreakdown }) => {
  const assetInputRef = useRef<HTMLInputElement>(null);
  const headlineImageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

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

    const currentRatio = w / h;
    const supportedRatios = [
        { label: "1:1", val: 1.0 },
        { label: "3:4", val: 3/4 },
        { label: "4:3", val: 4/3 },
        { label: "9:16", val: 9/16 },
        { label: "16:9", val: 16/9 }
    ];
    const closest = supportedRatios.reduce((prev, curr) => (Math.abs(curr.val - currentRatio) < Math.abs(prev.val - currentRatio) ? curr : prev));
    let pxWidth, pxHeight;
    if (closest.val >= 1) { pxWidth = maxDim; pxHeight = Math.round(maxDim / closest.val); }
    else { pxHeight = maxDim; pxWidth = Math.round(maxDim * closest.val); }
    return { pixels: `${pxWidth} x ${pxHeight} px`, ratio: closest.label };
  }, [values.width, values.height, values.quality]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'assetImages' | 'mainHeadlineImage' | 'logoImage') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (field === 'assetImages') {
      const newImages: string[] = [...values.assetImages];
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => { if (reader.result) newImages.push(reader.result as string); if (newImages.length === values.assetImages.length + files.length) onChange('assetImages', newImages); };
        reader.readAsDataURL(file);
      });
    } else {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => { if (reader.result) onChange(field, reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  return (
    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm h-full flex flex-col overflow-y-auto relative">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        Yêu Cầu Thiết Kế
      </h2>

      <div className="space-y-5 flex-grow">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1">Loại Sản Phẩm</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none" value={values.productType} onChange={(e) => onChange('productType', e.target.value)}>
              {Object.values(ProductType).map((type) => <option key={type} value={type}>{productTypeLabels[type] || type}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Rộng (cm)</label>
            <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none" value={values.width} onChange={(e) => onChange('width', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cao (cm)</label>
            <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none" value={values.height} onChange={(e) => onChange('height', e.target.value)} />
          </div>
          <div className="col-span-2 -mt-2">
             {estimatedOutput && <div className="bg-slate-900/50 rounded px-3 py-2 border border-slate-700/50 flex items-center justify-between"><span className="text-xs text-slate-300">Độ phân giải: <b className="text-emerald-400 font-mono ml-1">{estimatedOutput.pixels}</b></span><span className="text-[10px] text-slate-500">Tỷ lệ: {estimatedOutput.ratio}</span></div>}
          </div>
        </div>

        <div className="space-y-3 p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Nội Dung</label>
          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none" placeholder="Tiêu đề chính..." value={values.mainHeadline} onChange={(e) => onChange('mainHeadline', e.target.value)} />
          <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none h-16 resize-none text-sm" placeholder="Nội dung phụ..." value={values.secondaryText} onChange={(e) => onChange('secondaryText', e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Ảnh Sản Phẩm & Tài Nguyên</label>
          <div className="flex flex-wrap gap-2">
            {values.assetImages.map((img, idx) => (
              <div key={idx} className="relative w-12 h-12 rounded overflow-hidden border border-slate-600"><img src={img} className="w-full h-full object-cover" alt="asset" /></div>
            ))}
            <button onClick={() => assetInputRef.current?.click()} className="w-12 h-12 rounded border border-dashed border-slate-500 flex items-center justify-center text-slate-400">+</button>
          </div>
          <input type="file" multiple ref={assetInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'assetImages')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phong Cách</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs outline-none" value={values.visualStyle} onChange={(e) => onChange('visualStyle', e.target.value)}>
              {Object.values(VisualStyle).map((style) => <option key={style} value={style}>{visualStyleLabels[style] || style}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Chất Lượng</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs outline-none" value={values.quality} onChange={(e) => onChange('quality', e.target.value)}>
              <option value={QualityLevel.LOW}>1K</option>
              <option value={QualityLevel.MEDIUM}>2K</option>
              <option value={QualityLevel.HIGH}>4K</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700 mt-2 space-y-4">
        <div className="relative">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 flex justify-between items-center cursor-pointer hover:bg-slate-900 transition-colors" onClick={() => setShowBreakdown(!showBreakdown)}>
            <div>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Chi phí ước tính</p>
               <p className="text-lg text-emerald-400 font-black font-mono tracking-tighter">{formatCurrency(costBreakdown.totalCostVND)}</p>
            </div>
            <div className="text-slate-500">
               <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>

          {showBreakdown && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-950 border border-slate-700 p-4 rounded-xl shadow-2xl z-20 animate-fade-in">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Bảng Phân Tích Giá</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-slate-400">Analysis (Brain)</span><span className="text-white font-mono">{formatCurrency(costBreakdown.analysisCostVND)}</span></div>
                <div className="text-[9px] text-slate-600 flex justify-between pl-2"><span>In: {costBreakdown.analysisInputTokens} tkn / Out: {costBreakdown.analysisOutputTokens} tkn</span></div>
                <div className="flex justify-between text-xs mt-2"><span className="text-slate-400">Generation ({costBreakdown.generationImageCount} ảnh)</span><span className="text-white font-mono">{formatCurrency(costBreakdown.generationCostVND)}</span></div>
                <div className="text-[9px] text-slate-600 pl-2">Tier: {values.quality} resolution</div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-emerald-400"><span className="uppercase tracking-tighter">Tổng Cộng</span><span>{formatCurrency(costBreakdown.totalCostVND)}</span></div>
              </div>
            </div>
          )}
        </div>

        <button onClick={onSubmit} disabled={isGenerating || !values.mainHeadline} className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
          {isGenerating ? 'Đang thực hiện...' : 'Bắt đầu Phân Tích'}
        </button>
      </div>
    </div>
  );
};

export default InputForm;
