
import React, { useState } from 'react';
import InputForm from './components/InputForm';
import ResultDisplay from './components/ResultDisplay';
import GalleryView from './components/GalleryView';
import LoginScreen from './components/LoginScreen';
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, ImageGenerationResult, ProductType, VisualStyle, QualityLevel, SeparatedAssets, ProductImageMode, DesignPlan, AnalysisModel } from './types';
import { generateArtDirection, generateDesignImage, separateDesignComponents, refineDesignImage, regeneratePromptFromPlan, removeObjectWithMask } from './services/geminiService';
import { saveDesignToHistory } from './services/historyDb';
import { useAuth } from './contexts/UserContext';

const MapMiniLogo = () => (
  <div className="w-10 h-10 bg-black border-2 border-[#FFD300] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFD300]/10 overflow-hidden">
     <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1.5">
        <path d="M50 15C42 15 35 22 35 30C35 35 38 40 42 42V55H58V42C62 40 65 35 65 30C65 22 58 15 50 15Z" stroke="white" strokeWidth="4"/>
        <path d="M42 55L35 75L50 85L65 75L58 55H42Z" fill="#FFD300" stroke="white" strokeWidth="4"/>
        <path d="M42 55L35 75" stroke="#E91E63" strokeWidth="6"/>
        <path d="M50 55V85" stroke="#FFD300" strokeWidth="6"/>
        <path d="M58 55L65 75" stroke="#00BCD4" strokeWidth="6"/>
     </svg>
  </div>
);

const createThumbnail = (base64Image: string, maxWidth: number = 300): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = () => {
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve(base64Image);
      }
    };
    img.onerror = () => resolve(base64Image);
  });
};

const App: React.FC = () => {
  const { user, logout, deleteAccountData } = useAuth();
  const [activeTab, setActiveTab] = useState<'studio' | 'gallery'>('studio');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [request, setRequest] = useState<ArtDirectionRequest>({
    productType: ProductType.POSTER,
    mainHeadline: '',
    mainHeadlineImage: null,
    secondaryText: '',
    layoutRequirements: '',
    fontPreferences: '',
    visualStyle: VisualStyle.MODERN_TECH,
    colorMode: ColorMode.AUTO,
    customColors: ['#7c3aed', '#2563eb'],
    width: '',
    height: '',
    assetImages: [],
    logoImage: null,
    productImageMode: ProductImageMode.REALISTIC,
    referenceImages: [], 
    batchSize: 1,
    quality: QualityLevel.LOW,
    analysisModel: AnalysisModel.FLASH
  });

  const [artDirection, setArtDirection] = useState<ArtDirectionResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false); 
  const [imageResult, setImageResult] = useState<ImageGenerationResult>({ imageUrls: [], loading: false, error: null });
  const [refinementResult, setRefinementResult] = useState<ImageGenerationResult>({ imageUrls: [], loading: false, error: null });
  const [separatedAssets, setSeparatedAssets] = useState<SeparatedAssets>({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: keyof ArtDirectionRequest, value: any) => {
    setRequest(prev => ({ ...prev, [field]: value }));
  };

  const handleAnalyze = async () => {
    if (!request.mainHeadline && !request.layoutRequirements) return;
    setImageResult({ imageUrls: [], loading: false, error: null });
    setRefinementResult({ imageUrls: [], loading: false, error: null });
    setSeparatedAssets({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null }); 
    setArtDirection(null);
    setIsAnalyzing(true);
    try {
      const direction = await generateArtDirection(request);
      setArtDirection(direction);
    } catch (err: any) {
      setImageResult(prev => ({ ...prev, error: err.message || "Lỗi khi phân tích yêu cầu." }));
    } finally { setIsAnalyzing(false); }
  };

  const handleUpdatePlan = async (updatedPlan: DesignPlan) => {
    if (!artDirection) return;
    setIsUpdatingPlan(true);
    try {
      const result = await regeneratePromptFromPlan(updatedPlan, request, artDirection.recommendedAspectRatio, artDirection.layout_suggestion);
      setArtDirection(result);
    } catch (err: any) {
      alert("Lỗi khi cập nhật kế hoạch: " + (err as Error).message);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleGenerateFinalImages = async (finalPrompt: string, append: boolean = false, layoutMask: string | null = null) => {
    setImageResult(prev => ({ ...prev, loading: true, error: null }));
    try {
      const urls = await generateDesignImage(
        finalPrompt,
        artDirection?.recommendedAspectRatio || "1:1",
        request.batchSize,
        request.quality,
        request.assetImages,
        request.logoImage,
        layoutMask
      );
      setImageResult(prev => ({
        imageUrls: append ? [...prev.imageUrls, ...urls] : urls,
        loading: false,
        error: null
      }));
    } catch (err: any) {
      setImageResult(prev => ({ ...prev, loading: false, error: (err as Error).message || "Lỗi khi tạo ảnh." }));
    }
  };

  const handleSeparateLayout = async (selectedImage: string, mode: 'full' | 'background') => {
    if (!artDirection) return;
    setSeparatedAssets(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await separateDesignComponents(
        artDirection.final_prompt,
        artDirection.recommendedAspectRatio,
        request.quality,
        selectedImage,
        mode
      );
      setSeparatedAssets({ ...result, loading: false, error: null });
    } catch (err: any) {
      setSeparatedAssets(prev => ({ ...prev, loading: false, error: (err as Error).message || "Lỗi khi tách nền." }));
    }
  };

  const handleRefineImage = async (sourceImage: string, instruction: string) => {
    if (!artDirection) return;
    setRefinementResult(prev => ({ ...prev, loading: true, error: null }));
    try {
      const urls = await refineDesignImage(
        sourceImage,
        instruction,
        artDirection.recommendedAspectRatio,
        request.quality
      );
      setRefinementResult({ imageUrls: urls, loading: false, error: null });
    } catch (err: any) {
      setRefinementResult(prev => ({ ...prev, loading: false, error: (err as Error).message || "Lỗi khi hiệu chỉnh ảnh." }));
    }
  };

  const handleSmartRemove = async (sourceImage: string, maskBase64: string, textDescription: string) => {
    setRefinementResult(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await removeObjectWithMask(sourceImage, maskBase64, textDescription);
      if (res) {
        setRefinementResult(prev => ({ ...prev, imageUrls: [res, ...prev.imageUrls], loading: false, error: null }));
      } else {
        throw new Error("Không thể xử lý xóa vật thể.");
      }
    } catch (err: any) {
      setRefinementResult(prev => ({ ...prev, loading: false, error: (err as Error).message || "Lỗi khi xóa vật thể." }));
    }
  };

  const handleSaveDesign = async (selectedImageUrl: string, finalPromptUsed: string) => {
    if (!artDirection || !user) return;
    setIsSaving(true);
    try {
      const thumbnail = await createThumbnail(selectedImageUrl);
      const assetsToSave = [
        ...request.assetImages.map(img => ({ type: 'user_asset' as const, data: img })),
        ...(request.logoImage ? [{ type: 'logo' as const, data: request.logoImage }] : []),
        ...(request.mainHeadlineImage ? [{ type: 'headline_ref' as const, data: request.mainHeadlineImage }] : []),
        ...request.referenceImages.map(ref => ({ type: 'reference' as const, data: ref.image }))
      ];

      await saveDesignToHistory({
        thumbnail,
        finalPrompt: finalPromptUsed, 
        designPlan: artDirection.designPlan,
        layout: artDirection.layout_suggestion,
        requestData: { ...request },
        author: user.displayName, 
        assets: assetsToSave,
        recommendedAspectRatio: artDirection.recommendedAspectRatio
      });
      
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (saveError) {
      alert("Không thể lưu thiết kế.");
    } finally { setIsSaving(false); }
  };

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-[#FFD300]/30">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FFD300]/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 h-screen flex flex-col">
        <header className="flex items-center justify-between mb-6 shrink-0 bg-slate-900/40 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
             <MapMiniLogo />
             <div>
               <h1 className="text-xl font-black text-white tracking-tighter uppercase">Thiết kế M.A.P</h1>
               <div className="flex items-center gap-2">
                 <p className="text-[10px] text-[#FFD300] font-bold uppercase tracking-widest opacity-80">Creativity is endless</p>
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
             <nav className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/50 flex gap-1">
                 <button onClick={() => setActiveTab('studio')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'studio' ? 'bg-slate-700 text-[#FFD300] shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>Studio</button>
                 <button onClick={() => setActiveTab('gallery')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'gallery' ? 'bg-slate-700 text-[#FFD300] shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>Thư Viện</button>
             </nav>

             <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 bg-slate-800/80 hover:bg-slate-700 px-4 py-2 rounded-2xl border border-slate-700 transition-all"
                >
                   <div className="w-8 h-8 bg-[#FFD300] rounded-full flex items-center justify-center font-black text-sm text-black">
                      {user.displayName.charAt(0).toUpperCase()}
                   </div>
                   <div className="text-left hidden sm:block">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Nhà thiết kế</p>
                      <p className="text-xs text-white font-bold">{user.displayName}</p>
                   </div>
                   <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                   </svg>
                </button>

                {showUserMenu && (
                   <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)}></div>
                    <div className="absolute right-0 mt-3 w-64 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-30 overflow-hidden py-2 animate-scale-up">
                       <div className="px-5 py-4 border-b border-slate-800 mb-2">
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Đăng nhập với</p>
                          <p className="text-sm text-white font-black truncate">{user.displayName}</p>
                       </div>
                       
                       <button onClick={logout} className="w-full px-5 py-3 text-left hover:bg-slate-800 flex items-center gap-3 text-slate-300 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="text-xs font-bold">Đăng xuất</span>
                       </button>

                       <button 
                         onClick={async () => {
                           if(window.confirm('XÓA VĨNH VIỄN toàn bộ thiết kế của bạn? Hành động này không thể hoàn tác.')) {
                             await deleteAccountData();
                           }
                         }}
                         className="w-full px-5 py-3 text-left hover:bg-red-900/10 flex items-center gap-3 text-red-400 transition-colors"
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-xs font-bold">Xóa dữ liệu cá nhân</span>
                       </button>
                    </div>
                   </>
                )}
             </div>
          </div>
        </header>

        <main className="flex-grow overflow-hidden min-h-0 pb-2">
           {activeTab === 'studio' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 h-full min-h-[500px]">
                    <InputForm values={request} onChange={handleInputChange} onSubmit={handleAnalyze} isGenerating={isAnalyzing || imageResult.loading} />
                  </div>
                  <div className="lg:col-span-8 h-full min-h-[500px]">
                    <ResultDisplay 
                      request={request} artDirection={artDirection} imageResult={imageResult} refinementResult={refinementResult} isAnalyzing={isAnalyzing} isUpdatingPlan={isUpdatingPlan}
                      onGenerateImages={handleGenerateFinalImages} onUpdatePlan={handleUpdatePlan} onRegenerateImage={() => {}} onSeparateLayout={handleSeparateLayout}
                      onRefineImage={handleRefineImage} onSmartRemove={handleSmartRemove} onResetRefinement={() => {}} separatedAssets={separatedAssets} onSaveDesign={handleSaveDesign} isSaving={isSaving}
                    />
                  </div>
              </div>
           ) : (
              <div className="h-full max-w-7xl mx-auto w-full">
                 <GalleryView />
              </div>
           )}
        </main>
      </div>

      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
           <div className="bg-emerald-900/90 border border-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-md">
              <div className="bg-emerald-500 rounded-full p-1.5 shadow-lg shadow-emerald-500/20"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
              <div><h4 className="font-black text-sm uppercase tracking-widest">Đã lưu thành công</h4><p className="text-[10px] text-emerald-200 font-bold uppercase mt-0.5">Mẫu thiết kế đã sẵn sàng trong thư viện</p></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
