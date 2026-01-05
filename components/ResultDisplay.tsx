
import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { ArtDirectionRequest, ArtDirectionResponse, ImageGenerationResult, SeparatedAssets, DesignPlan, LayoutSuggestion, QualityLevel } from '../types';
import LayoutEditor from './LayoutEditor';
import SmartRemover from './SmartRemover';
import { convertLayoutToPrompt, upscaleImageTo4K } from '../services/geminiService';

interface AssetCardProps {
  title: string;
  image: string | null;
  loading: boolean;
  isWhiteBg?: boolean;
  onZoom: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ title, image, loading, isWhiteBg, onZoom }) => {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-4 h-48 flex flex-col items-center justify-center animate-pulse">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-xs text-slate-500 font-medium">{title}</span>
        <span className="text-[10px] text-slate-600 mt-1">Đang xử lý (4K)...</span>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="bg-slate-900/30 border border-slate-800 border-dashed rounded-lg p-4 h-48 flex flex-col items-center justify-center text-slate-600">
        <span className="text-xs font-medium mb-1">{title}</span>
        <span className="text-[10px] opacity-50">(Chưa có dữ liệu)</span>
      </div>
    );
  }

  return (
    <div className="group relative bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col shadow-lg">
      <div className={`h-40 w-full relative ${isWhiteBg ? 'bg-white/5' : 'bg-slate-950'} flex items-center justify-center`}>
        <img src={image} alt={title} className="max-w-full max-h-full object-contain p-2" />
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
          <button 
            onClick={onZoom}
            className="p-2 bg-slate-800/90 rounded-full text-white hover:bg-blue-600 transition-colors shadow-lg border border-slate-600"
            title="Xem lớn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <a 
            href={image} 
            download={`${title.replace(/\s+/g, '_')}.png`}
            className="p-2 bg-slate-800/90 rounded-full text-white hover:bg-emerald-600 transition-colors shadow-lg border border-slate-600"
            title="Tải về"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>
      
      <div className="p-2.5 border-t border-slate-700 bg-slate-800/80">
        <p className="text-xs text-center text-slate-300 font-medium truncate" title={title}>{title}</p>
      </div>
    </div>
  );
};

interface ResultDisplayProps {
  request: ArtDirectionRequest;
  artDirection: ArtDirectionResponse | null;
  imageResult: ImageGenerationResult;
  refinementResult: ImageGenerationResult;
  isAnalyzing: boolean;
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
  isUpdatingPlan,
  onGenerateImages,
  onUpdatePlan,
  onRegenerateImage, 
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
  const [isRefiningPanelOpen, setIsRefiningPanelOpen] = useState(false);
  const [showSmartRemover, setShowSmartRemover] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isUpscalingRefined, setIsUpscalingRefined] = useState(false);
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
    setIsRefiningPanelOpen(false);
    setRefineInstruction('');
    setShowSmartRemover(false);
    onResetRefinement();
  }, [imageResult.imageUrls]);

  useEffect(() => {
    if (selectedImage) {
        onResetRefinement();
        setRefineInstruction('');
        setIsRefiningPanelOpen(false);
        setShowSmartRemover(false);
    }
  }, [selectedImage]);


  const handleRefineSubmit = () => {
    if (selectedImage && refineInstruction) {
      onRefineImage(selectedImage, refineInstruction);
    }
  };

  const handlePlanChange = (key: keyof DesignPlan, value: string) => {
    if (localPlan) {
        setLocalPlan({ ...localPlan, [key]: value });
    }
  };
  
  const handleLayoutConfirm = (mask: string) => {
      if (!localLayout) return;
      setLayoutMask(mask);

      const layoutMarker = "\n\n-- FORCED COMPOSITION LAYOUT (STRICT) --";
      const layoutInstruction = convertLayoutToPrompt(localLayout);
      
      let basePrompt = editablePrompt;
      if (basePrompt.includes(layoutMarker)) {
          basePrompt = basePrompt.split(layoutMarker)[0];
      }
      setEditablePrompt(basePrompt + layoutInstruction);
  };
  
  const handleGenerateClick = (append: boolean) => {
      let finalPromptToSend = editablePrompt;
      const layoutMarker = "-- FORCED COMPOSITION LAYOUT (STRICT) --";

      if (localLayout && !finalPromptToSend.includes(layoutMarker)) {
          const layoutInstruction = convertLayoutToPrompt(localLayout);
          finalPromptToSend += layoutInstruction;
      }
      onGenerateImages(finalPromptToSend, append, layoutMask);
  };

  const handleDownload4K = async () => {
      if (!selectedImage || !artDirection) return;
      setIsUpscaling(true);
      try {
          const upscaleUrl = await upscaleImageTo4K(selectedImage, artDirection.recommendedAspectRatio);
          const link = document.createElement('a');
          link.href = upscaleUrl;
          link.download = `design-4k-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (error) {
          console.error("Upscale failed", error);
          alert("Không thể nâng cấp ảnh lên 4K. Vui lòng thử lại.");
      } finally {
          setIsUpscaling(false);
      }
  };

  const handleDownloadRefined4K = async (url: string) => {
      if (!artDirection) return;
      setIsUpscalingRefined(true);
      try {
          const upscaleUrl = await upscaleImageTo4K(url, artDirection.recommendedAspectRatio);
          const link = document.createElement('a');
          link.href = upscaleUrl;
          link.download = `refined-4k-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (error) {
          console.error("Refined Upscale failed", error);
          alert("Không thể nâng cấp ảnh lên 4K.");
      } finally {
          setIsUpscalingRefined(false);
      }
  };

  const getReferenceSummary = () => {
      if (request.referenceImages.length === 0) return "Không chọn";
      return request.referenceImages.map((img, idx) => {
          if (img.attributes.length === 0) return `Ảnh ${idx + 1} (Không chọn thuộc tính)`;
          return `Ảnh ${idx + 1}: ${img.attributes.join(', ')}`;
      }).join(' | ');
  };

  const calculateCost = () => {
    if (!artDirection) return null;
    const inputString = JSON.stringify(request) + JSON.stringify(localPlan);
    const estInputTokens = Math.ceil(inputString.length / 4);
    const outputString = editablePrompt + (artDirection.analysis || "");
    const estOutputTokens = Math.ceil(outputString.length / 4);
    const RATE_INPUT_PER_1K = 50; 
    const RATE_OUTPUT_PER_1K = 150;
    let pricePerImage = 2000;
    if (request.quality === QualityLevel.MEDIUM) pricePerImage = 4000;
    if (request.quality === QualityLevel.HIGH) pricePerImage = 8000;
    const costInput = Math.ceil((estInputTokens / 1000) * RATE_INPUT_PER_1K);
    const costOutput = Math.ceil((estOutputTokens / 1000) * RATE_OUTPUT_PER_1K);
    const costImages = request.batchSize * pricePerImage;
    const totalCost = costInput + costOutput + costImages;
    return {
        inputTokens: estInputTokens,
        outputTokens: estOutputTokens,
        imageCount: request.batchSize,
        imageQuality: request.quality,
        costInput,
        costOutput,
        costImages,
        totalCost,
        pricePerImage,
        currency: 'VNĐ'
    };
  };
  
  const costData = calculateCost();

  if (!artDirection && !isAnalyzing && !imageResult.loading && imageResult.imageUrls.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed">
        <div className="p-8 max-w-md w-full">
          <h3 className="text-lg font-bold text-slate-300 mb-6 text-center uppercase tracking-wider border-b border-slate-700 pb-3">Quy Trình Sáng Tạo</h3>
          <ul className="text-slate-400 text-sm space-y-3">
             <li className="flex items-start"><span className="text-purple-500 font-bold mr-3 min-w-[20px]">1.</span> <span>Chọn Loại sản phẩm - Kích thước</span></li>
             <li className="flex items-start"><span className="text-purple-500 font-bold mr-3 min-w-[20px]">2.</span> <span>Yêu cầu</span></li>
             <li className="flex items-start"><span className="text-purple-500 font-bold mr-3 min-w-[20px]">3.</span> <span>Lựa chọn Phong cách - Số lượng - Chất lượng</span></li>
             <li className="flex items-start"><span className="text-blue-500 font-bold mr-3 min-w-[20px]">4.</span> <span>Lập kế hoạch - Điều chỉnh bố cục</span></li>
             <li className="flex items-start"><span className="text-emerald-500 font-bold mr-3 min-w-[20px]">5.</span> <span>Tạo file thiết kế - Lưu trữ - Tải về 4k</span></li>
             <li className="flex items-start"><span className="text-red-500 font-bold mr-3 min-w-[20px]">6.</span> <span>Loại bỏ đối tượng - Tải về 4k</span></li>
          </ul>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-800/30 rounded-2xl border border-slate-700/50">
             <div className="w-16 h-16 border-4 border-blue-500 border-t-purple-500 rounded-full animate-spin mb-6"></div>
             <h3 className="text-xl font-bold text-white mb-2">Đang Phân Tích...</h3>
        </div>
    );
  }

  const hasSeparation = separatedAssets.background || separatedAssets.textLayer || separatedAssets.subjects.length > 0 || separatedAssets.decor.length > 0 || separatedAssets.lighting || separatedAssets.loading;

  return (
    <div className="flex flex-col h-full gap-6 overflow-y-auto pr-2 relative">
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-7xl max-h-screen">
            <img src={lightboxImage} alt="Full view" className="max-h-[90vh] max-w-full rounded-lg shadow-2xl" />
            <button className="absolute -top-4 -right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2" onClick={() => setLightboxImage(null)}>✕</button>
          </div>
        </div>
      )}
      
      {showSmartRemover && selectedImage && (
          <SmartRemover 
             imageUrl={selectedImage}
             onClose={() => setShowSmartRemover(false)}
             isProcessing={refinementResult.loading}
             onProcess={(maskBase64, textDescription) => {
                 onSmartRemove(selectedImage, maskBase64, textDescription);
             }}
          />
      )}

      {/* 1. Planning Stage */}
      {artDirection && localPlan && (
        <div className="bg-slate-800/80 rounded-2xl border border-blue-500/30 overflow-hidden shadow-lg backdrop-blur-sm flex-shrink-0 animate-fade-in-down">
           <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 px-6 py-3 border-b border-white/10 flex items-center justify-between">
             <div className="flex items-center gap-2"><span className="text-white text-sm font-bold tracking-wider uppercase">Bảng Kế Hoạch & Bố Cục</span></div>
             <div className="flex items-center gap-3">
                 {isUpdatingPlan && <span className="text-xs text-blue-300 animate-pulse">Đang viết lại Prompt...</span>}
                 <span className="text-slate-400 text-xs bg-slate-900/50 px-2 py-1 rounded">Tỉ lệ đề xuất: {artDirection.recommendedAspectRatio}</span>
             </div>
           </div>
           
           <div className="p-5 space-y-5">
             <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 text-xs">
                 <div><span className="text-slate-500 block">Nội dung phụ:</span><span className="text-slate-200 font-medium">{request.secondaryText || "Không có"}</span></div>
                 <div><span className="text-slate-500 block">Tham Khảo:</span><span className="text-emerald-400 font-medium block leading-tight">{getReferenceSummary()}</span></div>
             </div>

             <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-blue-400 uppercase block">1. Phân Tích & Phân Rã (6 Tiêu Chí)</label>
                    <button onClick={() => localPlan && onUpdatePlan(localPlan)} disabled={isUpdatingPlan} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50">Cập nhật Prompt từ Kế hoạch</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                   {criteriaList.map((item) => (
                       <div key={item.key} className="bg-slate-900/80 p-3 rounded border border-slate-700 flex flex-col h-full">
                           <h4 className="text-[10px] text-blue-300 font-bold uppercase mb-1">{item.label}</h4>
                           <textarea value={localPlan[item.key] || ''} onChange={(e) => handlePlanChange(item.key, e.target.value)} className="w-full bg-transparent text-slate-300 text-xs outline-none resize-none flex-grow min-h-[60px] border-b border-transparent focus:border-blue-500/50 pb-1" />
                       </div>
                   ))}
                </div>
             </div>

             {localLayout && (
                 <div className="mt-2">
                     <LayoutEditor 
                        layout={localLayout}
                        onLayoutChange={(updated) => setLocalLayout(updated)}
                        onConfirm={handleLayoutConfirm}
                        onUpdateDescription={onUpdatePlan}
                        isUpdatingDescription={isUpdatingPlan}
                     />
                 </div>
             )}

             <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">
                    2. Prompt Cuối Cùng (Kỹ sư Prompt AI)
                </label>
                <div className="rounded-lg border border-slate-700 overflow-hidden monaco-editor-container">
                    <Editor
                        height="140px"
                        defaultLanguage="markdown"
                        theme="vs-dark"
                        value={editablePrompt}
                        onChange={(value) => setEditablePrompt(value || '')}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            lineNumbers: 'off',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            padding: { top: 12, bottom: 12 },
                            backgroundColor: '#0f172a',
                            fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
                        }}
                    />
                </div>
             </div>

             {costData && !imageResult.loading && imageResult.imageUrls.length === 0 && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                    <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Ước Tính Chi Phí (Token & Resource)</span>
                        <span className="text-[10px] text-slate-500">Đơn vị: VNĐ</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Input Token ({costData.inputTokens.toLocaleString()} tokens)</span>
                            <span className="text-slate-300">{costData.costInput.toLocaleString()} ₫</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Output Token ({costData.outputTokens.toLocaleString()} tokens)</span>
                            <span className="text-slate-300">{costData.costOutput.toLocaleString()} ₫</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1 md:col-span-2 mt-1">
                            <span className="text-purple-400 font-medium">
                                Tạo Ảnh ({costData.imageCount} ảnh x {costData.pricePerImage.toLocaleString()}₫ - {costData.imageQuality})
                            </span>
                            <span className="text-purple-300 font-medium">{costData.costImages.toLocaleString()} ₫</span>
                        </div>
                        <div className="md:col-span-2 flex justify-between items-center mt-3 pt-2 border-t border-slate-700">
                             <span className="text-sm font-bold text-slate-200">Tổng Cộng Tạm Tính:</span>
                             <span className="text-lg font-bold text-emerald-400 font-mono">
                                 {costData.totalCost.toLocaleString('vi-VN')} {costData.currency}
                             </span>
                        </div>
                    </div>
                </div>
             )}

             {!imageResult.loading && imageResult.imageUrls.length === 0 && (
                 <button onClick={() => handleGenerateClick(false)} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg text-white font-bold shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Xác Nhận & Tiến Hành Tạo Thiết Kế
                 </button>
             )}
           </div>
        </div>
      )}

      {imageResult.imageUrls.length > 0 && (
          <div className="flex-grow flex flex-col gap-4 animate-fade-in-up">
            <h3 className="text-white font-bold text-lg flex items-center gap-2"><span className="w-2 h-6 bg-purple-500 rounded-sm"></span>Kết Quả Thiết Kế</h3>
            <div className={`grid gap-4 ${imageResult.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3'}`}>
                {imageResult.imageUrls.map((url, idx) => (
                <div key={idx} className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer h-auto aspect-auto bg-slate-900 ${selectedImage === url ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-700 hover:border-slate-500'}`} onClick={(e) => { e.stopPropagation(); setSelectedImage(selectedImage === url ? null : url); }}>
                    <img src={url} alt={`Option ${idx + 1}`} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button onClick={(e) => { e.stopPropagation(); setLightboxImage(url); }} className="bg-slate-800/80 p-2 rounded-full text-white hover:bg-blue-600 transition-colors">🔍</button>
                        <span className="text-white font-medium text-sm">Chọn để Sửa/Tách</span>
                    </div>
                    {selectedImage === url && (<div className="absolute top-2 left-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg">✓</div>)}
                </div>
                ))}
            </div>
            <div className="flex justify-center mt-2">
                 {imageResult.loading ? (
                    <div className="flex items-center gap-2 px-6 py-2 bg-slate-800 rounded-full border border-slate-700 animate-pulse"><span className="text-xs text-purple-400 font-medium">Đang vẽ thêm...</span></div>
                 ) : (
                    <button onClick={() => handleGenerateClick(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-full flex items-center gap-2 transition-all border border-slate-600 hover:border-emerald-500 shadow-lg group"><span className="font-medium">Thêm Ý Tưởng Khác (Tính Phí)</span></button>
                 )}
            </div>
          </div>
      )}

      {imageResult.loading && imageResult.imageUrls.length === 0 && (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-700 h-96 flex flex-col items-center justify-center animate-pulse">
            <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 text-sm">Đang hiện thực hóa ý tưởng...</p>
        </div>
      )}

      {selectedImage && !imageResult.loading && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 sticky bottom-0 z-10 shadow-2xl animate-fade-in-up">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-white font-semibold flex items-center gap-2">Đã chọn sản phẩm</h3>
             <div className="flex gap-2">
                 <button 
                   onClick={() => onSaveDesign(selectedImage, editablePrompt)}
                   disabled={isSaving}
                   className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                   </svg>
                   {isSaving ? 'Đang Lưu...' : 'Lưu vào Thư viện'}
                 </button>
                 <button onClick={handleDownload4K} disabled={isUpscaling} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                   </svg>
                   {isUpscaling ? 'Đang Upscale...' : 'Tải Về (Upscale 4K)'}
                 </button>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                 <button onClick={() => setShowSmartRemover(true)} className="w-full bg-slate-900 border border-red-500/50 hover:bg-red-900/10 text-white text-sm py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 group">
                     <span>Xóa Chi Tiết (Magic Eraser)</span>
                 </button>
                 <div className={`border rounded-lg p-3 transition-colors ${isRefiningPanelOpen ? 'border-purple-500 bg-purple-900/20' : 'border-slate-600 bg-slate-900'}`}>
                    <button onClick={() => setIsRefiningPanelOpen(!isRefiningPanelOpen)} className="w-full text-left text-sm font-medium text-white flex items-center justify-between mb-2"><span>Hiệu Chỉnh Bằng Lời (Refine)</span><span className="text-xs text-slate-400">{isRefiningPanelOpen ? '▲' : '▼'}</span></button>
                    {isRefiningPanelOpen && (
                      <div className="mt-2 animate-fade-in">
                         <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-purple-500 outline-none resize-none mb-2" placeholder="Nhập yêu cầu sửa đổi..." rows={2} value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)} />
                         <button onClick={handleRefineSubmit} disabled={!refineInstruction || refinementResult.loading} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs py-2 rounded font-medium">{refinementResult.loading ? 'Đang Xử Lý...' : 'Thực Hiện Hiệu Chỉnh'}</button>
                      </div>
                    )}
                 </div>
              </div>

              <div className="flex flex-col gap-2">
                  <button onClick={() => onSeparateLayout(selectedImage, 'full')} disabled={separatedAssets.loading} className="flex-1 bg-slate-900 border border-slate-600 hover:border-emerald-500 hover:bg-emerald-900/10 rounded-lg p-2 flex items-center justify-center gap-2 transition-all disabled:opacity-50"><span className="text-xs font-medium text-white">Tách Lớp Chi Tiết (Full)</span></button>
                  <button onClick={() => onSeparateLayout(selectedImage, 'background')} disabled={separatedAssets.loading} className="flex-1 bg-slate-900 border border-slate-600 hover:border-blue-500 hover:bg-blue-900/10 rounded-lg p-2 flex items-center justify-center gap-2 transition-all disabled:opacity-50"><span className="text-xs font-medium text-white">Ảnh Sạch (Bỏ Chữ/Logo)</span></button>
              </div>
           </div>
           
           {(refinementResult.loading || refinementResult.imageUrls.length > 0) && (
               <div className="mt-4 pt-4 border-t border-slate-700 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4 items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                      <div className="relative group self-start"><span className="absolute top-2 left-2 bg-slate-800/80 text-xs text-white px-2 py-1 rounded backdrop-blur-sm z-10 border border-slate-600">Ảnh Gốc</span><img src={selectedImage} alt="Original" className="w-full h-48 object-contain rounded-lg border border-slate-600" onClick={() => setLightboxImage(selectedImage)} /></div>
                      <div className="flex flex-col gap-2">
                          <div className="relative group w-full">
                              <span className="absolute top-2 left-2 bg-purple-600/90 text-xs text-white px-2 py-1 rounded backdrop-blur-sm z-10 border border-purple-400 shadow-lg shadow-purple-500/20">Kết Quả Mới</span>
                              {refinementResult.loading ? (<div className="w-full h-48 bg-slate-800 rounded-lg flex flex-col items-center justify-center border border-slate-700 border-dashed animate-pulse"><span className="text-xs text-slate-500">Đang xử lý...</span></div>) : (<img src={refinementResult.imageUrls[0]} alt="Refined" className="w-full h-48 object-contain rounded-lg border-2 border-purple-500 shadow-lg shadow-purple-500/10 cursor-pointer" onClick={() => setLightboxImage(refinementResult.imageUrls[0])} />)}
                          </div>
                          {!refinementResult.loading && refinementResult.imageUrls.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                  <a href={refinementResult.imageUrls[0]} download={`refined-${Date.now()}.png`} className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] py-2 px-2 rounded text-center transition-colors border border-slate-600 truncate">Tải Gốc</a>
                                  <button onClick={() => handleDownloadRefined4K(refinementResult.imageUrls[0])} disabled={isUpscalingRefined} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] py-2 px-2 rounded text-center transition-colors shadow-lg shadow-purple-900/20 flex items-center justify-center gap-1 truncate">{isUpscalingRefined ? '...' : 'Tải 4K'}</button>
                              </div>
                          )}
                      </div>
                  </div>
               </div>
           )}
        </div>
      )}

      {hasSeparation && (
        <div className="mt-4 pt-4 border-t border-slate-700 animate-fade-in-up">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>Kết Quả Tách Lớp & Nguyên Liệu (4K)</h3>
            <div className="space-y-6">
                <div>
                    <h4 className="text-xs text-slate-400 font-bold uppercase mb-2">1. Nền & Ánh Sáng</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <AssetCard title="Background" image={separatedAssets.background} loading={separatedAssets.loading} onZoom={() => separatedAssets.background && setLightboxImage(separatedAssets.background)} />
                         <AssetCard title="Lighting" image={separatedAssets.lighting} loading={separatedAssets.loading} onZoom={() => separatedAssets.lighting && setLightboxImage(separatedAssets.lighting)} />
                    </div>
                </div>
                <div>
                    <h4 className="text-xs text-slate-400 font-bold uppercase mb-2">2. Chủ Thể</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {separatedAssets.loading && separatedAssets.subjects.length === 0 ? (<><AssetCard title="Main Hero" image={null} loading={true} onZoom={()=>{}} /><AssetCard title="Secondary" image={null} loading={true} onZoom={()=>{}} /></>) : (separatedAssets.subjects.map((img, idx) => (<AssetCard key={`sub-${idx}`} title={idx === 0 ? "Main Subject" : "Secondary"} image={img} loading={false} isWhiteBg onZoom={() => setLightboxImage(img)} />)))}
                    </div>
                </div>
                <div>
                    <h4 className="text-xs text-slate-400 font-bold uppercase mb-2">3. Typography</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <AssetCard title="Text Layer" image={separatedAssets.textLayer} loading={separatedAssets.loading} isWhiteBg onZoom={() => separatedAssets.textLayer && setLightboxImage(separatedAssets.textLayer)} />
                    </div>
                </div>
            </div>
            {separatedAssets.error && (<div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-200 text-sm">Lỗi: {separatedAssets.error}</div>)}
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
