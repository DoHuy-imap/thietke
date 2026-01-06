
import React, { useState, useEffect } from 'react';
import InputForm from './components/InputForm';
import ResultDisplay from './components/ResultDisplay';
import GalleryView from './components/GalleryView';
import SettingsModal from './components/SettingsModal';
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, ImageGenerationResult, ProductType, VisualStyle, QualityLevel, SeparatedAssets, ProductImageMode, DesignPlan, AnalysisModel, DesignDNA } from './types';
import { generateArtDirection, generateDesignImage, separateDesignComponents, refineDesignImage, regeneratePromptFromPlan, removeObjectWithMask } from './services/geminiService';
import { saveDesignToHistory } from './services/historyDb';
import { useUser } from './contexts/UserContext';

// Helper to create a small thumbnail from base64 string
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
        // Save as JPEG with 0.7 quality to save space
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(base64Image); // Fallback
      }
    };
    img.onerror = () => resolve(base64Image);
  });
};

const App: React.FC = () => {
  const { settings, hasCustomKey } = useUser();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'studio' | 'gallery'>('studio');
  const [showSettings, setShowSettings] = useState(false);

  // Form State
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
    
    // Assets
    assetImages: [],
    logoImage: null,
    productImageMode: ProductImageMode.REALISTIC,
    
    referenceImages: [], 
    batchSize: 1,
    quality: QualityLevel.LOW,
    
    // Default to Flash for speed
    analysisModel: AnalysisModel.FLASH
  });

  // Result States
  const [artDirection, setArtDirection] = useState<ArtDirectionResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false); 
  
  const [imageResult, setImageResult] = useState<ImageGenerationResult>({
    imageUrls: [],
    loading: false,
    error: null
  });

  const [refinementResult, setRefinementResult] = useState<ImageGenerationResult>({
    imageUrls: [],
    loading: false,
    error: null
  });

  const [separatedAssets, setSeparatedAssets] = useState<SeparatedAssets>({
    background: null,
    textLayer: null,
    subjects: [],
    decor: [],
    lighting: null,
    loading: false,
    error: null
  });

  // Toast State
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Handlers
  const handleInputChange = (field: keyof ArtDirectionRequest, value: any) => {
    setRequest(prev => ({ ...prev, [field]: value }));
  };

  // STEP 1: Analyze & Plan
  const handleAnalyze = async () => {
    if (!request.mainHeadline && !request.layoutRequirements) return;

    setImageResult(prev => ({ ...prev, loading: false, error: null, imageUrls: [] }));
    setRefinementResult({ imageUrls: [], loading: false, error: null });
    setSeparatedAssets({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null }); 
    setArtDirection(null);
    setIsAnalyzing(true);
    
    try {
      console.log(`Analyzing art direction using model: ${request.analysisModel}`);
      const direction = await generateArtDirection(request);
      setArtDirection(direction);
      setIsAnalyzing(false);
    } catch (err: any) {
      console.error(err);
      setIsAnalyzing(false);
      setImageResult(prev => ({
        ...prev,
        error: err.message || "Có lỗi xảy ra khi phân tích yêu cầu."
      }));
    }
  };
  
  const handleUpdatePlan = async (updatedPlan: DesignPlan) => {
    if (!artDirection) return;
    
    setIsUpdatingPlan(true);
    try {
       // Updated to pass the current layout suggestion (Variable B)
       const newResponse = await regeneratePromptFromPlan(
           updatedPlan, 
           request, 
           artDirection.recommendedAspectRatio,
           artDirection.layout_suggestion // Pass Variable B here
       );
       setArtDirection(newResponse); 
       setIsUpdatingPlan(false);
    } catch (err) {
        console.error(err);
        setIsUpdatingPlan(false);
    }
  };

  // STEP 2: Generate Final Images
  // Updated to accept layoutMask
  const handleGenerateFinalImages = async (finalPrompt: string, append: boolean = false, layoutMask: string | null = null) => {
    if (!artDirection) return;

    setImageResult(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      imageUrls: append ? prev.imageUrls : [] 
    }));
    
    try {
      console.log(`Generating ${request.batchSize} images...`);
      // Pass layoutMask to the service
      const images = await generateDesignImage(
        finalPrompt, 
        artDirection.recommendedAspectRatio, 
        request.batchSize, 
        request.quality, 
        request.assetImages, 
        request.logoImage,
        layoutMask
      );
      
      setImageResult(prev => ({
        imageUrls: append ? [...prev.imageUrls, ...images] : images,
        loading: false,
        error: images.length === 0 ? "Không thể tạo hình ảnh." : null
      }));

      // NOTE: Auto-save removed as per request. Use handleSaveDesign instead.

    } catch (err: any) {
      console.error(err);
      setImageResult(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Có lỗi xảy ra khi tạo hình ảnh."
      }));
    }
  };

  // NEW: Manual Save Handler with Author
  const handleSaveDesign = async (selectedImageUrl: string, finalPromptUsed: string) => {
    if (!artDirection) return;
    
    setIsSaving(true);
    try {
      const thumbnail = await createThumbnail(selectedImageUrl);
      
      // Prepare Assets Array
      const assetsToSave = [
        ...request.assetImages.map(img => ({ type: 'user_asset' as const, data: img })),
        ...(request.logoImage ? [{ type: 'logo' as const, data: request.logoImage }] : []),
        ...(request.mainHeadlineImage ? [{ type: 'headline_ref' as const, data: request.mainHeadlineImage }] : []),
        ...request.referenceImages.map(ref => ({ type: 'reference' as const, data: ref.image }))
      ];

      await saveDesignToHistory({
        thumbnail: thumbnail,
        finalPrompt: finalPromptUsed, 
        designPlan: artDirection.designPlan,
        layout: artDirection.layout_suggestion,
        requestData: request,
        author: settings.displayName, // Save current author
        assets: assetsToSave
      });
      
      // Trigger Toast
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
      
    } catch (saveError) {
      console.error("Manual save failed:", saveError);
      alert("Không thể lưu thiết kế. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateImage = async (newPrompt: string) => {
    if (!artDirection) return;
    handleGenerateFinalImages(newPrompt, false);
  };

  const handleSeparateLayout = async (selectedImage: string, mode: 'full' | 'background' = 'full') => {
    if (!artDirection) return;
    
    setSeparatedAssets(prev => ({ ...prev, loading: true, error: null, background: null, textLayer: null, subjects: [], decor: [], lighting: null }));

    try {
       const result = await separateDesignComponents(
         artDirection.final_prompt,
         artDirection.recommendedAspectRatio,
         request.quality,
         selectedImage, 
         mode
       );
       
       setSeparatedAssets({
         background: result.background,
         textLayer: result.textLayer,
         subjects: result.subjects,
         decor: result.decor,
         lighting: result.lighting,
         loading: false,
         error: (!result.background && result.subjects.length === 0) ? "Không thể tách các thành phần." : null
       });

    } catch (err: any) {
      setSeparatedAssets(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Lỗi khi tách bố cục."
      }));
    }
  };

  const handleRefine = async (sourceImage: string, instruction: string) => {
    if (!artDirection) return;

    setRefinementResult(prev => ({ ...prev, loading: true, error: null, imageUrls: [] }));
    setSeparatedAssets({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });

    try {
      const newImages = await refineDesignImage(
        sourceImage,
        instruction,
        artDirection.recommendedAspectRatio,
        request.quality
      );

      setRefinementResult({
        imageUrls: newImages,
        loading: false,
        error: newImages.length === 0 ? "Không thể hiệu chỉnh hình ảnh." : null
      });

    } catch (err: any) {
      setRefinementResult(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Lỗi khi hiệu chỉnh hình ảnh."
      }));
    }
  };
  
  const handleSmartRemove = async (sourceImage: string, maskBase64: string) => {
      setRefinementResult(prev => ({ ...prev, loading: true, error: null, imageUrls: [] }));
      setSeparatedAssets({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });
      
      try {
          const result = await removeObjectWithMask(sourceImage, maskBase64);
          
          setRefinementResult({
              imageUrls: result ? [result] : [],
              loading: false,
              error: !result ? "Không thể xóa vật thể." : null
          });
          
      } catch (err: any) {
          setRefinementResult(prev => ({
              ...prev,
              loading: false,
              error: err.message || "Lỗi khi xóa vật thể."
          }));
      }
  };

  const handleResetRefinement = () => {
    setRefinementResult({ imageUrls: [], loading: false, error: null });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-purple-500/30">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 h-screen flex flex-col">
        <header className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
               <span className="text-white font-bold text-xl">Ai</span>
             </div>
             <div>
               <h1 className="text-xl font-bold text-white tracking-tight">Thiết kế M.A.P</h1>
               <div className="flex items-center gap-2">
                 <p className="text-xs text-slate-400">Powered by Gemini</p>
                 {hasCustomKey && (
                     <span className="text-[9px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">BYOK Active</span>
                 )}
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Navigation Tabs */}
             <div className="bg-slate-900/50 p-1 rounded-lg border border-slate-700/50 flex gap-1">
                 <button
                   onClick={() => setActiveTab('studio')}
                   className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                     activeTab === 'studio' 
                     ? 'bg-slate-700 text-white shadow' 
                     : 'text-slate-400 hover:text-white hover:bg-slate-800'
                   }`}
                 >
                   Studio Sáng Tạo
                 </button>
                 <button
                   onClick={() => setActiveTab('gallery')}
                   className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                     activeTab === 'gallery' 
                     ? 'bg-slate-700 text-white shadow' 
                     : 'text-slate-400 hover:text-white hover:bg-slate-800'
                   }`}
                 >
                   Thư Viện Mẫu
                 </button>
             </div>

             {/* Login Button */}
             <button 
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all border border-slate-700 flex items-center gap-2 font-bold text-sm shadow-lg shadow-black/20"
                title={`Login (Đang dùng: ${settings.displayName})`}
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login
             </button>
          </div>
        </header>

        {/* Tab Content Rendering */}
        <main className="flex-grow overflow-hidden min-h-0 pb-2">
           {activeTab === 'studio' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 h-full min-h-[500px]">
                    <InputForm 
                      values={request} 
                      onChange={handleInputChange} 
                      onSubmit={handleAnalyze} 
                      isGenerating={isAnalyzing || imageResult.loading}
                    />
                  </div>

                  <div className="lg:col-span-8 h-full min-h-[500px]">
                    <ResultDisplay 
                      request={request}
                      artDirection={artDirection} 
                      imageResult={imageResult}
                      refinementResult={refinementResult}
                      isAnalyzing={isAnalyzing}
                      isUpdatingPlan={isUpdatingPlan}
                      onGenerateImages={handleGenerateFinalImages}
                      onUpdatePlan={handleUpdatePlan}
                      onRegenerateImage={handleRegenerateImage}
                      onSeparateLayout={handleSeparateLayout}
                      onRefineImage={handleRefine}
                      onSmartRemove={handleSmartRemove}
                      onResetRefinement={handleResetRefinement}
                      separatedAssets={separatedAssets}
                      onSaveDesign={handleSaveDesign}
                      isSaving={isSaving}
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

      {/* SUCCESS TOAST */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
           <div className="bg-emerald-900/90 border border-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 backdrop-blur-sm">
              <div className="bg-emerald-500 rounded-full p-1">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                 </svg>
              </div>
              <div>
                 <h4 className="font-bold text-sm">Đã lưu thành công!</h4>
                 <p className="text-xs text-emerald-200">Thiết kế đã được thêm vào Thư viện mẫu.</p>
              </div>
           </div>
        </div>
      )}

      {/* Settings Modal - Not Strict Anymore */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} isStrict={false} />}
    </div>
  );
};

export default App;
