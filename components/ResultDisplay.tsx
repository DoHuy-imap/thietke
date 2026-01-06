
import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
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
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([uInt8Array], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
    return true;
  } catch (e) {
    console.error("Download failed", e);
    return false;
  }
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
  separatedAssets,
  onSaveDesign,
  isSaving
}) => {
  const [editablePrompt, setEditablePrompt] = useState('');
  const [localPlan, setLocalPlan] = useState<DesignPlan | null>(null);
  const [localLayout, setLocalLayout] = useState<LayoutSuggestion | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [showSmartRemover, setShowSmartRemover] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [layoutMask, setLayoutMask] = useState<string | null>(null);

  const criteriaList: { key: keyof DesignPlan; label: string }[] = [
      { key: 'subject', label: 'Chủ thể & Nội dung phụ' },
      { key: 'styleContext', label: 'Bối cảnh & Phong cách' },
      { key: 'composition', label: 'Bố cục & Góc máy' },
      { key: 'colorLighting', label: 'Màu sắc & Ánh sáng' },
      { key: 'decorElements', label: 'Chi tiết trang trí' },
      { key: 'typography', label: 'Typography (Chữ)' },
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
    setRefineInstruction('');
    setShowSmartRemover(false);
    onResetRefinement();
  }, [imageResult.imageUrls, onResetRefinement]);

  const handleRefineSubmit = () => {
    if (selectedImage && refineInstruction) {
      onRefineImage(selectedImage, refineInstruction);
    }
  };

  const handleLayoutConfirm = (mask: string) => {
      if (!localLayout) return;
      setLayoutMask(mask);
      const layoutInstruction = convertLayoutToPrompt(localLayout);
      // Cập nhật prompt cuối cùng từ bố cục đã xác nhận
      setEditablePrompt(prev => prev.split('\n\n### LAYOUT ###')[0] + layoutInstruction);
  };
  
  const handleGenerateClick = (append: boolean) => {
      onGenerateImages(editablePrompt, append, layoutMask);
  };

  const handleDownload4K = async (url: string) => {
      if (!artDirection) return;
      setIsUpscaling(true);
      try {
          const upscaleUrl = await upscaleImageTo4K(url, artDirection.recommendedAspectRatio);
          triggerDownload(upscaleUrl, `map-design-4k-${Date.now()}.png`);
      } catch (error) {
          alert("Lỗi server AI Studio (500). Vui lòng thử lại.");
      } finally {
          setIsUpscaling(false);
      }
  };

  const getReferenceSummary = () => {
      if (request.referenceImages.length === 0) return "Không chọn";
      return request.referenceImages.map((img, idx) => `Ảnh ${idx + 1}: ${img.attributes.join(', ')}`).join(' | ');
  };

  // Render Error State
  if (analysisError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-red-950/20 rounded-3xl border border-red-500/30 p-10 animate-fade-in">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4">Lỗi Phân Tích</h3>
        <p className="text-red-400 text-center text-sm font-bold max-w-md leading-relaxed">
          {analysisError}
        </p>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-8 font-black">Vui lòng thử lại hoặc kiểm tra lại thông tin đầu vào</p>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-800/30 rounded-3xl border border-slate-700/50">
             <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-500/20 rounded-full shadow-[0_0_50px_rgba(59,130,246,0.2)]"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-blue-500 border-t-purple-500 rounded-full animate-spin"></div>
             </div>
             <h3 className="text-xl font-black text-white uppercase tracking-widest mt-10">Đang Phân Tích Ý Tưởng...</h3>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-3 animate-pulse">AI Director đang lập kế hoạch thiết kế</p>
        </div>
    );
  }

  if (!artDirection && !imageResult.loading && imageResult.imageUrls.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-800/30 rounded-3xl border border-slate-700/50 border-dashed p-10 overflow-y-auto">
        <div className="max-w-md w-full my-auto text-center">
          <h3 className="text-xl font-black text-white mb-8 uppercase tracking-widest border-b border-slate-700 pb-5">Quy Trình Sáng Tạo</h3>
          <ul className="text-slate-400 text-sm space-y-5 text-left">
             {[
               "Chọn Loại sản phẩm - kích thước",
               "Yêu cầu nội dung & Assets",
               "Lựa chọn Phong cách & Chất lượng",
               "Lập kế hoạch - Điều chỉnh bố cục",
               "Tạo file thiết kế - Lưu trữ",
               "Hậu kỳ chuyên sâu (Tách nền, xóa AI) & Tải về 4K"
             ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</span>
                  <span className="font-bold">{step}</span>
                </li>
             ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8 overflow-y-auto pr-2 relative">
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-xl animate-fade-in" onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage} alt="Full view" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl border border-white/5" />
            <button className="mt-8 px-10 py-4 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest rounded-2xl transition-all">Đóng Xem To</button>
        </div>
      )}
      
      {showSmartRemover && selectedImage && (
          <SmartRemover imageUrl={selectedImage} onClose={() => setShowSmartRemover(false)} isProcessing={refinementResult.loading} onProcess={(mask, text) => onSmartRemove(selectedImage, mask, text)} />
      )}

      {artDirection && localPlan && (
        <div className="bg-slate-800/80 rounded-[2.5rem] border border-blue-500/30 overflow-hidden shadow-2xl backdrop-blur-md flex-shrink-0 animate-fade-in-down">
           <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 px-8 py-4 border-b border-white/5 flex items-center justify-between">
             <span className="text-white text-xs font-black tracking-widest uppercase">Bảng Kế Hoạch Sáng Tạo</span>
             <span className="text-[10px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-full font-bold">AspectRatio: {artDirection.recommendedAspectRatio}</span>
           </div>
           
           <div className="p-8 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-widest">Tiêu đề chính</p>
                    <p className="text-xs text-white font-bold">{request.mainHeadline}</p>
                </div>
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-widest">Nội dung phụ</p>
                    <p className="text-xs text-white font-medium">{request.secondaryText || "Không có"}</p>
                </div>
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-widest">Tham khảo</p>
                    <p className="text-[10px] text-emerald-400 font-bold leading-relaxed">{getReferenceSummary()}</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {criteriaList.map((item) => (
                    <div key={item.key} className="bg-slate-900/50 p-5 rounded-3xl border border-slate-700/50 hover:border-blue-500/30 transition-all">
                        <h4 className="text-[9px] text-blue-400 font-black uppercase mb-2 tracking-widest">{item.label}</h4>
                        <textarea 
                          value={localPlan[item.key] || ''} 
                          onChange={(e) => setLocalPlan(prev => prev ? {...prev, [item.key]: e.target.value} : null)} 
                          className="w-full bg-transparent text-slate-300 text-[11px] font-bold outline-none resize-none min-h-[70px] leading-relaxed" 
                        />
                    </div>
                ))}
             </div>

             <div className="flex justify-between items-center bg-slate-900/80 p-4 rounded-2xl border border-blue-500/20">
                <div>
                   <h4 className="text-white text-xs font-black uppercase tracking-widest">Đồng bộ hóa kế hoạch</h4>
                   <p className="text-[10px] text-slate-500 mt-1 font-medium">Sau khi điều chỉnh 6 tiêu chí, nhấn nút bên phải để cập nhật lại trình bố cục</p>
                </div>
                <button 
                  onClick={() => localPlan && onUpdatePlan(localPlan)} 
                  disabled={isUpdatingPlan}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-6 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-900/40 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingPlan ? "Đang đồng bộ..." : "Cập nhật Trình Bố Cục"}
                </button>
             </div>

             {localLayout && (
                 <LayoutEditor 
                    layout={localLayout} 
                    onLayoutChange={(updated) => setLocalLayout(updated)} 
                    onConfirm={handleLayoutConfirm} 
                    onUpdateDescription={() => {}} // Đã bỏ logic ở editor
                    isUpdatingDescription={false} 
                 />
             )}

             <div className="rounded-3xl border border-slate-700 overflow-hidden shadow-inner bg-slate-950">
                <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">AI Synthesis Prompt (Final)</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-emerald-500 font-black uppercase bg-emerald-500/10 px-2 py-1 rounded">Auto-Synced</span>
                    </div>
                </div>
                <Editor height="120px" defaultLanguage="markdown" theme="vs-dark" value={editablePrompt} onChange={(val) => setEditablePrompt(val || '')} options={{ minimap: { enabled: false }, fontSize: 11, padding: { top: 10, bottom: 10 } }} />
             </div>

             {imageResult.imageUrls.length === 0 && !imageResult.loading && (
                 <button onClick={() => handleGenerateClick(false)} className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-[1.5rem] text-white font-black shadow-2xl shadow-emerald-900/30 transition-all active:scale-95 uppercase tracking-widest">
                    Xác Nhận & Tiến Hành Tạo Thiết Kế
                 </button>
             )}
           </div>
        </div>
      )}

      {imageResult.imageUrls.length > 0 && (
          <div className="flex-grow flex flex-col gap-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <h3 className="text-white font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                   Kết Quả Studio
                   <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold">1 hàng 3 mẫu</span>
                </h3>
                {imageResult.loading ? (
                    <span className="text-[10px] text-purple-400 font-black animate-pulse uppercase tracking-widest">Đang tạo thêm...</span>
                ) : (
                    <button onClick={() => handleGenerateClick(true)} className="text-[10px] text-slate-500 hover:text-white border border-slate-800 px-6 py-2 rounded-full font-black uppercase tracking-widest transition-all">Tạo thêm mẫu mới</button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                {imageResult.imageUrls.map((url, idx) => (
                <div 
                  key={idx} 
                  className={`group relative rounded-[2rem] overflow-hidden border-2 transition-all cursor-pointer bg-slate-900 flex flex-col ${selectedImage === url ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-600'}`} 
                  onClick={() => setSelectedImage(selectedImage === url ? null : url)}
                >
                    <div className="w-full aspect-square relative">
                        <img src={url} alt="Result" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                            <button onClick={(e) => { e.stopPropagation(); setLightboxImage(url); }} className="p-4 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-xl border border-white/10 shadow-2xl transition-all active:scale-90">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                        </div>
                        {selectedImage === url && (
                            <div className="absolute top-4 right-4 bg-emerald-500 text-white p-2 rounded-full shadow-2xl ring-4 ring-white/10 z-10 animate-scale-up">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-black uppercase">Mẫu #{idx+1}</span>
                        <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={selectedImage === url} 
                              onChange={() => setSelectedImage(selectedImage === url ? null : url)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Lựa chọn</span>
                        </div>
                    </div>
                </div>
                ))}
            </div>
          </div>
      )}

      {selectedImage && !imageResult.loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 sticky bottom-0 z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-fade-in-up">
           <div className="flex items-center justify-between mb-8">
             <div>
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Công cụ hiệu chỉnh chuyên sâu</h3>
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mt-1">Đang áp dụng cho mẫu được chọn</p>
             </div>
             <div className="flex gap-3">
                 <button onClick={() => onSaveDesign(selectedImage, editablePrompt)} disabled={isSaving} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl border border-slate-700 transition-all disabled:opacity-50">Lưu Thư Viện</button>
                 <button onClick={() => handleDownload4K(selectedImage)} disabled={isUpscaling} className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-emerald-900/40 transition-all active:scale-95 disabled:opacity-50">
                   {isUpscaling ? 'Đang Kết Xuất 4K...' : 'Tải File In (4K)'}
                 </button>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => onSeparateLayout(selectedImage, 'background')} className="bg-slate-950 border border-blue-500/40 text-blue-400 text-[11px] font-black py-4 rounded-2xl hover:bg-blue-500/10 transition-all uppercase tracking-widest shadow-xl">Tách Nền Chi Tiết</button>
                <button onClick={() => setShowSmartRemover(true)} className="bg-slate-950 border border-red-500/40 text-red-400 text-[11px] font-black py-4 rounded-2xl hover:bg-red-500/10 transition-all uppercase tracking-widest shadow-xl">Xóa Chi Tiết AI</button>
              </div>
              <div className="flex gap-3">
                 <div className="flex-grow bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col">
                    <textarea className="bg-transparent text-white text-[11px] font-bold outline-none h-14 resize-none placeholder-slate-700" placeholder="Yêu cầu hiệu chỉnh bằng lời (Vd: thêm ánh sáng xanh, thay đổi font chữ...)" value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)} />
                    <button onClick={handleRefineSubmit} disabled={!refineInstruction || refinementResult.loading} className="ml-auto mt-2 bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-black px-5 py-2 rounded-xl transition-all uppercase tracking-widest disabled:opacity-30">Thực Hiện Hiệu Chỉnh</button>
                 </div>
              </div>
           </div>
           
           {(refinementResult.loading || refinementResult.imageUrls.length > 0 || separatedAssets.loading || separatedAssets.background) && (
               <div className="mt-8 pt-8 border-t border-slate-800">
                    <h4 className="text-[10px] font-black text-purple-400 uppercase mb-5 tracking-widest">Sản phẩm hậu kỳ:</h4>
                    <div className="flex gap-6 overflow-x-auto pb-4 scroll-smooth">
                        {(refinementResult.loading || separatedAssets.loading) ? (
                            <div className="flex gap-6">
                                <div className="w-40 h-40 bg-slate-950 animate-pulse rounded-2xl border border-slate-800" />
                                <div className="w-40 h-40 bg-slate-950 animate-pulse rounded-2xl border border-slate-800" />
                            </div>
                        ) : (
                            <>
                                {refinementResult.imageUrls.map((url, i) => (
                                    <div key={i} className="flex flex-col gap-3 min-w-[160px] animate-scale-up">
                                        <div className="relative group rounded-2xl overflow-hidden border border-purple-500/50 shadow-2xl bg-black">
                                            <img src={url} className="w-full aspect-square object-contain" alt="Refined" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <button onClick={() => setLightboxImage(url)} className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md">🔍</button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <button onClick={() => triggerDownload(url, `edit-orig-${Date.now()}.png`)} className="w-full py-2 bg-slate-800 text-white text-[9px] font-black rounded-lg uppercase transition-all hover:bg-slate-700">Tải Gốc</button>
                                            <button onClick={() => handleDownload4K(url)} className="w-full py-2 bg-purple-600 text-white text-[9px] font-black rounded-lg uppercase transition-all hover:bg-purple-500">Tải 4K</button>
                                        </div>
                                    </div>
                                ))}
                                {separatedAssets.background && (
                                    <div className="flex flex-col gap-3 min-w-[160px] animate-scale-up">
                                        <div className="relative group rounded-2xl overflow-hidden border border-blue-500/50 shadow-2xl bg-black">
                                            <img src={separatedAssets.background} className="w-full aspect-square object-contain" alt="Separated" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <button onClick={() => setLightboxImage(separatedAssets.background!)} className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md">🔍</button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <button onClick={() => triggerDownload(separatedAssets.background!, `bg-orig-${Date.now()}.png`)} className="w-full py-2 bg-slate-800 text-white text-[9px] font-black rounded-lg uppercase transition-all hover:bg-slate-700">Tải Nền Gốc</button>
                                            <button onClick={() => handleDownload4K(separatedAssets.background!)} className="w-full py-2 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase transition-all hover:bg-blue-500">Tải Nền 4K</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
               </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
