
import React, { useState, useEffect } from 'react';
import { ArtDirectionRequest, ArtDirectionResponse, ImageGenerationResult, SeparatedAssets, DesignPlan, LayoutSuggestion } from '../types';
import LayoutEditor from './LayoutEditor';
import SmartRemover from './SmartRemover';
import { convertLayoutToPrompt, upscaleImageTo4K } from '../services/geminiService';

const triggerDownload = (base64Data: string, fileName: string) => {
  try {
    const parts = base64Data.split(';base64,');
    if (parts.length !== 2) return false;
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
    const blob = new Blob([uInt8Array], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
    return true;
  } catch (e) { return false; }
};

interface ResultDisplayProps {
  request: ArtDirectionRequest;
  artDirection: ArtDirectionResponse | null;
  imageResult: ImageGenerationResult;
  refinementResult: ImageGenerationResult;
  isAnalyzing: boolean;
  analysisError: string | null;
  isUpdatingPlan: boolean;
  onGenerateImages: (finalPrompt: string, append?: boolean, layoutMask?: string | null) => void;
  onUpdatePlan: (updatedPlan: DesignPlan) => void;
  onRegenerateImage: (prompt: string) => void;
  onSeparateLayout: (selectedImage: string, mode: 'full' | 'background') => void;
  onRefineImage: (sourceImage: string, instruction: string) => void;
  onSmartRemove: (sourceImage: string, maskBase64: string, textDescription: string) => void;
  onResetRefinement: () => void;
  separatedAssets: SeparatedAssets;
  onSaveDesign: (selectedImageUrl: string, finalPromptUsed: string) => void;
  isSaving: boolean;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
  request,
  artDirection, 
  imageResult, 
  refinementResult,
  isAnalyzing,
  analysisError,
  isUpdatingPlan,
  onGenerateImages,
  onUpdatePlan,
  onSeparateLayout,
  onRefineImage,
  onSmartRemove,
  onResetRefinement,
  separatedAssets: externalAssets,
  onSaveDesign,
  isSaving
}) => {
  const [editablePrompt, setEditablePrompt] = useState('');
  const [localPlan, setLocalPlan] = useState<DesignPlan | null>(null);
  const [localLayout, setLocalLayout] = useState<LayoutSuggestion | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSmartRemover, setShowSmartRemover] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [layoutMask, setLayoutMask] = useState<string | null>(null);
  const [isUpscalingLayer, setIsUpscalingLayer] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const criteriaList: { key: keyof DesignPlan; label: string }[] = [
      { key: 'subject', label: 'Chủ thể & Nội dung' },
      { key: 'styleContext', label: 'Phong cách & Bối cảnh' },
      { key: 'composition', label: 'Bố cục & Góc nhìn' },
      { key: 'colorLighting', label: 'Màu sắc & Ánh sáng' },
      { key: 'decorElements', label: 'Chi tiết trang trí' },
      { key: 'typography', label: 'Typography & Font' },
  ];

  useEffect(() => {
    if (artDirection) {
      setEditablePrompt(artDirection.final_prompt);
      setLocalPlan(artDirection.designPlan);
      setLocalLayout(artDirection.layout_suggestion);
      setLayoutMask(null); 
    }
  }, [artDirection]);

  useEffect(() => {
    setSelectedImage(null);
    setShowSmartRemover(false);
    onResetRefinement();
  }, [imageResult.imageUrls, onResetRefinement]);

  // Giả lập thanh tiến trình khi đang vẽ ảnh (thường Nano Banana Pro mất 10-20s)
  useEffect(() => {
    let interval: any;
    if (imageResult.loading) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 90) return prev + Math.random() * 5;
          return prev;
        });
      }, 800);
    } else {
      setLoadingProgress(0);
      if (interval) clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [imageResult.loading]);

  const handleLayoutConfirm = (mask: string) => {
      if (!localLayout) return;
      setLayoutMask(mask);
      const layoutInstruction = convertLayoutToPrompt(localLayout);
      setEditablePrompt(prev => prev.split('\n\n### SPATIAL LAYOUT ###')[0] + layoutInstruction);
  };
  
  const handleGenerateClick = (append: boolean) => {
      if (imageResult.loading) return;
      onGenerateImages(editablePrompt, append, layoutMask);
  };

  const handleDownload4K = async (url: string) => {
      if (!artDirection) return;
      setIsUpscaling(true);
      try {
          const upscaleUrl = await upscaleImageTo4K(url, artDirection.recommendedAspectRatio);
          triggerDownload(upscaleUrl, `map-design-4k-${Date.now()}.png`);
      } catch (e) { alert("Lỗi nâng cấp 4K."); }
      finally { setIsUpscaling(false); }
  };

  const handleStartSeparation = () => {
      if (!selectedImage) return;
      onSeparateLayout(selectedImage, 'full');
  };

  const handleUpscaleLayer = async (url: string, type: string) => {
      if (!url) return;
      setIsUpscalingLayer(type);
      try {
          const res = await upscaleImageTo4K(url, artDirection?.recommendedAspectRatio || "1:1");
          triggerDownload(res, `map-layer-${type}-4k.png`);
      } catch(e) { alert("Lỗi upscale layer."); }
      finally { setIsUpscalingLayer(null); }
  };

  if (analysisError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-red-950/20 rounded-[3rem] border border-red-500/30 p-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-500 mb-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h3 className="text-2xl font-black text-white uppercase mb-4 tracking-tighter">Lỗi Phân Tích Kỹ Thuật</h3>
        <p className="text-red-400 font-bold max-w-md mx-auto">{analysisError}</p>
        <button onClick={() => window.location.reload()} className="mt-10 px-10 py-3 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 shadow-xl transition-all">Tải lại Studio</button>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-900/40 rounded-[3.5rem] border border-white/5 backdrop-blur-xl">
             <div className="relative"><div className="w-24 h-24 border-4 border-[#FFD300]/20 rounded-full"></div><div className="absolute inset-0 w-24 h-24 border-4 border-[#FFD300] border-t-transparent rounded-full animate-spin"></div></div>
             <h3 className="text-xl font-black text-white uppercase mt-12 tracking-[0.2em] animate-pulse">Director đang xử lý...</h3>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8 overflow-y-auto pr-3 relative scrollbar-hide pb-20">
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center p-6 backdrop-blur-3xl" onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage} alt="Full" className="max-h-[88vh] max-w-full rounded-3xl shadow-2xl border border-white/10" />
            <p className="text-[10px] text-slate-500 font-black uppercase mt-6 tracking-[0.5em]">Nhấn để đóng</p>
        </div>
      )}
      
      {showSmartRemover && selectedImage && (
          <SmartRemover 
            imageUrl={selectedImage} 
            onClose={() => setShowSmartRemover(false)} 
            isProcessing={refinementResult.loading} 
            onProcess={(mask, text) => onSmartRemove(selectedImage, mask, text)} 
            resultUrl={null} 
            aspectRatio={artDirection?.recommendedAspectRatio || "1:1"}
          />
      )}

      {artDirection && localPlan && (
        <div className="bg-slate-900/80 rounded-[3.5rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-3xl flex-shrink-0 animate-fade-in-down">
           <div className="p-10 pb-6 border-b border-white/5 bg-slate-950/50">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Moodboard Summary</h3>
                    <p className="text-[10px] text-[#FFD300] font-black uppercase tracking-widest mt-1.5 opacity-80">
                      Kích thước: {request.width} x {request.height} cm ● {artDirection.recommendedAspectRatio}
                    </p>
                 </div>
                 <div className="flex items-center gap-4">
                    <span className="text-[10px] text-white font-black uppercase bg-slate-800/80 px-5 py-2.5 rounded-2xl border border-white/10">{request.productType}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="p-6 bg-slate-950/80 rounded-[2.5rem] border border-white/5 shadow-inner group flex gap-4">
                       <div className="flex-1">
                          <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block mb-2">Tiêu đề & Nội dung chính</span>
                          <h4 className="text-white font-black text-xl uppercase tracking-tight mb-2">{request.mainHeadline}</h4>
                          <p className="text-xs text-slate-400 font-bold italic line-clamp-2">"{request.secondaryText}"</p>
                       </div>
                       {request.mainHeadlineImage && <div className="w-20 h-20 bg-slate-800 rounded-2xl overflow-hidden border border-white/10 shadow-lg"><img src={request.mainHeadlineImage} className="w-full h-full object-cover" alt="Typo" /></div>}
                    </div>
                    <div className="flex flex-wrap gap-4">
                       {request.logoImage && <div className="w-20 h-20 bg-white rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl p-1.5"><img src={request.logoImage} className="w-full h-full object-contain" alt="Logo" /></div>}
                       <div className="flex gap-2.5">
                           {request.assetImages.map((img, i) => (<div key={i} className="w-20 h-20 bg-slate-800 rounded-3xl overflow-hidden border-2 border-white/5 shadow-2xl group relative transition-transform hover:scale-105"><img src={img} className="w-full h-full object-cover" alt="Product" /></div>))}
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block ml-2">Moodboard References ({request.referenceImages.length})</span>
                    <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                       {request.referenceImages.map((ref, i) => (<div key={i} className="flex-shrink-0 group relative w-28 h-28 rounded-[2rem] overflow-hidden border-2 border-white/5 shadow-2xl cursor-help"><img src={ref.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Ref" /><div className="absolute inset-0 bg-black/70 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">{ref.attributes.map(attr => (<span key={attr} className="text-[8px] text-[#FFD300] font-black uppercase tracking-tighter truncate">✦ {attr}</span>))}</div></div>))}
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="p-10 space-y-10">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {criteriaList.map((item) => (
                    <div key={item.key} className="bg-slate-950/60 p-7 rounded-[2.5rem] border border-white/5 hover:border-[#FFD300]/20 transition-all shadow-inner group"><h4 className="text-[10px] text-slate-600 font-black uppercase mb-4 tracking-[0.2em] flex items-center gap-2 group-hover:text-slate-400 transition-colors"><div className="w-2 h-2 bg-[#FFD300] rounded-full shadow-[0_0_10px_rgba(255,211,0,0.5)]"></div>{item.label}</h4><textarea value={localPlan[item.key] || ''} onChange={(e) => setLocalPlan(prev => prev ? {...prev, [item.key]: e.target.value} : null)} className="w-full bg-transparent text-slate-300 text-[11px] font-bold outline-none resize-none min-h-[85px] leading-relaxed scrollbar-hide" /></div>
                ))}
             </div>

             {localLayout && <LayoutEditor layout={localLayout} onLayoutChange={(updated) => setLocalLayout(updated)} onConfirm={handleLayoutConfirm} onUpdateDescription={() => {}} isUpdatingDescription={false} />}

             <div className="space-y-5">
                <div className="flex justify-between items-center px-6"><h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>AI Final Design Prompt</h4></div>
                <div className="bg-slate-950 rounded-[3rem] p-10 border border-white/5 shadow-inner relative overflow-hidden group"><textarea className="w-full bg-transparent text-slate-400 text-[12px] font-mono leading-loose outline-none resize-none min-h-[180px] relative z-10 scrollbar-hide" value={editablePrompt} onChange={(e) => setEditablePrompt(e.target.value)} /></div>
             </div>

             <div className="flex gap-6">
                 <button onClick={() => localPlan && onUpdatePlan(localPlan)} disabled={isUpdatingPlan} className="flex-1 py-7 bg-slate-800/80 hover:bg-slate-700 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-white/5 shadow-xl">Cập nhật Kế hoạch</button>
                 <button 
                    onClick={() => handleGenerateClick(false)} 
                    disabled={imageResult.loading} 
                    className={`flex-[2] py-7 font-black rounded-3xl shadow-2xl transition-all uppercase tracking-widest text-[11px] border-t-2 border-white/20 flex items-center justify-center gap-3
                        ${imageResult.loading ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-[#FFD300] hover:bg-[#FFC000] text-black'}`}
                 >
                    {imageResult.loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                          Đang Khởi Tạo...
                        </>
                    ) : 'Sản Xuất Hình Ảnh'}
                 </button>
             </div>
           </div>
        </div>
      )}

      {/* Nano Banana Pro Production Interface */}
      {(imageResult.imageUrls.length > 0 || imageResult.loading) && (
          <div className="flex-grow flex flex-col gap-10 pb-32 mt-6">
            <div className="flex items-center justify-between px-6">
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Studio Output</h3>
                <button 
                    onClick={() => handleGenerateClick(true)} 
                    disabled={imageResult.loading} 
                    className={`text-[10px] border-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all
                        ${imageResult.loading ? 'border-slate-700 text-slate-600' : 'text-[#FFD300] border-[#FFD300]/20 hover:text-white hover:border-[#FFD300]'}`}
                >
                    {imageResult.loading ? 'Đang thực hiện...' : 'Thêm biến thể'}
                </button>
            </div>
            
            {imageResult.loading && (
                <div className="w-full min-h-[450px] bg-slate-950/80 rounded-[4rem] border border-white/10 flex flex-col items-center justify-center gap-10 relative overflow-hidden backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                     <div className="absolute inset-0 bg-gradient-to-br from-[#FFD300]/5 to-blue-500/10 opacity-40"></div>
                     <div className="relative z-10 flex flex-col items-center w-full max-w-md px-10">
                        <div className="relative mb-8">
                            <div className="w-28 h-28 border-4 border-[#FFD300]/10 rounded-full"></div>
                            <div className="absolute top-0 left-0 w-28 h-28 border-4 border-[#FFD300] border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }}></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg viewBox="0 0 24 24" className="w-12 h-12 text-[#FFD300] animate-pulse" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                        
                        <div className="text-center mb-6">
                           <h4 className="text-white font-black uppercase tracking-[0.5em] text-lg mb-2">Nano Banana Pro</h4>
                           <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Thiết kế Full Frame • {artDirection?.recommendedAspectRatio || "1:1"}</p>
                        </div>

                        {/* Thanh tiến trình giả lập */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5 mb-4">
                           <div 
                             className="h-full bg-gradient-to-r from-[#FFD300] to-[#FFA000] transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,211,0,0.5)]" 
                             style={{ width: `${loadingProgress}%` }}
                           ></div>
                        </div>
                        
                        <div className="flex justify-between w-full text-[9px] font-black uppercase tracking-widest text-slate-600 italic">
                            <span>Initializing Render</span>
                            <span>{Math.round(loadingProgress)}%</span>
                        </div>

                        <div className="mt-10 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm animate-pulse">
                           <p className="text-[9px] text-[#FFD300] font-black uppercase tracking-widest text-center">Đang xử lý thiết kế toàn diện... Vui lòng không đóng Studio</p>
                        </div>
                     </div>
                </div>
            )}

            {imageResult.error && (
                <div className="bg-red-500/10 border border-red-500/30 p-10 rounded-[3rem] mx-4 text-center animate-shake">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h4 className="text-white font-black uppercase tracking-widest mb-2">Lỗi Sản Xuất Ảnh</h4>
                    <p className="text-red-400 font-bold text-xs mb-6 max-w-md mx-auto line-clamp-2">"{imageResult.error}"</p>
                    <button onClick={() => handleGenerateClick(false)} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Thử lại phiên làm việc</button>
                </div>
            )}

            {imageResult.imageUrls.length > 0 && !imageResult.loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 px-4 animate-fade-in-up">
                    {imageResult.imageUrls.map((url, idx) => (<div key={idx} className={`group relative rounded-[3.5rem] overflow-hidden border-2 transition-all duration-700 cursor-pointer bg-slate-900 shadow-2xl ${selectedImage === url ? 'border-[#FFD300] ring-[12px] ring-[#FFD300]/5 scale-[0.98]' : 'border-white/5 hover:border-white/20'}`} onClick={() => setSelectedImage(selectedImage === url ? null : url)}><div className="w-full aspect-square relative overflow-hidden"><img src={url} alt="Result" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[3px]"><button onClick={(e) => { e.stopPropagation(); setLightboxImage(url); }} className="p-6 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-3xl border border-white/20 shadow-2xl transition-all active:scale-75">🔍</button></div></div></div>))}
                </div>
            )}
          </div>
      )}

      {/* Layer Separation Results */}
      {(externalAssets.background || externalAssets.textLayer || (externalAssets.decor && externalAssets.decor.length > 0) || externalAssets.loading) && (
          <div className="bg-slate-900/90 rounded-[3rem] p-10 border border-[#FFD300]/20 backdrop-blur-3xl animate-fade-in-up mt-8 shadow-2xl mb-40 relative overflow-hidden">
             {externalAssets.loading && <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm"><div className="w-16 h-16 border-4 border-[#FFD300] border-t-transparent rounded-full animate-spin"></div></div>}
             <div className="flex justify-between items-center mb-8"><h3 className="text-white font-black text-xl uppercase tracking-tighter">Hồ sơ Tách Lớp Chuyên Nghiệp</h3></div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-4">
                    <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest text-center block">Layer 1: Nền (Background)</span>
                    <div className="aspect-square bg-black rounded-3xl overflow-hidden border border-white/5 relative group">{externalAssets.background ? <img src={externalAssets.background} className="w-full h-full object-cover" alt="BG" /> : <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs font-bold uppercase">Trống</div>}
                       {externalAssets.background && (
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all">
                                <button onClick={() => handleUpscaleLayer(externalAssets.background!, 'bg')} disabled={!!isUpscalingLayer} className="px-6 py-3 bg-white text-black text-[9px] font-black uppercase rounded-2xl hover:bg-gray-200 shadow-lg">{isUpscalingLayer === 'bg' ? 'Đang xử lý...' : 'Tải File In 4K'}</button>
                           </div>
                       )}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest text-center block">Layer 2: Trang trí (Decor)</span>
                    <div className="aspect-square bg-white/5 rounded-3xl overflow-hidden border border-white/5 relative group">{externalAssets.decor[0] ? <img src={externalAssets.decor[0]} className="w-full h-full object-cover" alt="Decor" /> : <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs font-bold uppercase">Trống</div>}
                       {externalAssets.decor[0] && (
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all">
                                <button onClick={() => handleUpscaleLayer(externalAssets.decor[0]!, 'decor')} disabled={!!isUpscalingLayer} className="px-6 py-3 bg-white text-black text-[9px] font-black uppercase rounded-2xl hover:bg-gray-200 shadow-lg">{isUpscalingLayer === 'decor' ? 'Đang xử lý...' : 'Tải File In 4K'}</button>
                           </div>
                       )}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <span className="text-[9px] text-[#FFD300] font-black uppercase tracking-widest text-center block">Layer 3: Nội dung (Text & Logo)</span>
                    <div className="aspect-square bg-white/5 rounded-3xl overflow-hidden border border-white/5 relative group">{externalAssets.textLayer ? <img src={externalAssets.textLayer} className="w-full h-full object-cover" alt="Text" /> : <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs font-bold uppercase">Trống</div>}
                       {externalAssets.textLayer && (
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all">
                                <button onClick={() => handleUpscaleLayer(externalAssets.textLayer!, 'text')} disabled={!!isUpscalingLayer} className="px-6 py-3 bg-white text-black text-[9px] font-black uppercase rounded-2xl hover:bg-gray-200 shadow-lg">{isUpscalingLayer === 'text' ? 'Đang xử lý...' : 'Tải File In 4K'}</button>
                           </div>
                       )}
                    </div>
                 </div>
             </div>
          </div>
      )}

      {selectedImage && (
        <div className="bg-slate-950/90 border-t border-white/10 p-10 fixed bottom-0 left-0 right-0 z-[60] backdrop-blur-3xl animate-fade-in-up shadow-[0_-30px_60px_rgba(0,0,0,0.8)]">
           <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
             <div className="flex items-center gap-8"><div className="w-20 h-20 rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl transform -rotate-3"><img src={selectedImage} className="w-full h-full object-cover" alt="Sel" /></div><div><h3 className="text-white font-black text-2xl uppercase tracking-tighter">Trung Tâm Hậu Kỳ</h3><p className="text-[10px] text-[#FFD300] font-black uppercase tracking-widest mt-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>Chế độ kiểm duyệt & xuất bản</p></div></div>
             <div className="flex flex-wrap justify-center gap-5">
                 <button onClick={() => onSaveDesign(selectedImage, editablePrompt)} disabled={isSaving} className="px-10 py-5 bg-slate-900 hover:bg-slate-850 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl border border-white/10 shadow-xl transition-all disabled:opacity-50">Lưu Thư Viện</button>
                 <button onClick={handleStartSeparation} disabled={externalAssets.loading} className="px-10 py-5 bg-slate-950 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-2xl hover:bg-blue-500/10 transition-all uppercase tracking-widest shadow-xl">{externalAssets.loading ? 'Đang phân tích...' : 'Tách Lớp Đồ Họa'}</button>
                 <button onClick={() => setShowSmartRemover(true)} className="px-10 py-5 bg-slate-950 border border-red-500/20 text-red-400 text-[10px] font-black rounded-2xl hover:bg-red-500/10 transition-all uppercase tracking-widest shadow-xl">AI Eraser</button>
                 <button onClick={() => handleDownload4K(selectedImage)} disabled={isUpscaling} className="px-12 py-5 bg-gradient-to-br from-[#FFD300] to-[#FFA000] text-black text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 border-t-2 border-white/30">{isUpscaling ? 'Đang Nâng Cấp...' : 'Tải File In (4K)'}</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
