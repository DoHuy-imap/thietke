
import React, { useState, useEffect, useCallback } from 'react';
import InputForm from './components/InputForm';
import ResultDisplay from './components/ResultDisplay';
import GalleryView from './components/GalleryView';
import LoginScreen from './components/LoginScreen';
import { 
  ArtDirectionRequest, ArtDirectionResponse, ColorOption, ImageGenerationResult, 
  ProductType, VisualStyle, QualityLevel, SeparatedAssets, DesignPlan, 
  StudioImage 
} from './types';
import { 
  generateArtDirection, generateDesignImage, separateDesignComponents, 
  regeneratePromptFromPlan, removeObjectWithMask, estimateRequestCost 
} from './services/geminiService';
import { saveDesignToHistory } from './services/historyDb';
import { useAuth } from './contexts/UserContext';

// Define initialRequest outside to ensure reference stability
const initialRequest: ArtDirectionRequest = {
  productType: ProductType.POSTER,
  mainHeadline: '',
  typoReferenceImage: null,
  secondaryText: '',
  layoutRequirements: '',
  visualStyle: VisualStyle.MODERN_TECH,
  colorOption: ColorOption.AI_CUSTOM,
  customColors: ['#FFD300', '#000000', '#FFFFFF'],
  useCMYK: false,
  width: '60',
  height: '90',
  assetImages: [],
  logoImage: null,
  referenceImages: [], 
  batchSize: 1,
  quality: QualityLevel.LOW
};

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

const App: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'studio' | 'gallery'>('studio');
  const [refreshGalleryKey, setRefreshGalleryKey] = useState(0);

  // Use state spread to ensure fresh copy
  const [request, setRequest] = useState<ArtDirectionRequest>({ ...initialRequest });
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    const cost = estimateRequestCost(request);
    setEstimatedCost(cost.totalCostVND);
  }, [request]);

  const [artDirection, setArtDirection] = useState<ArtDirectionResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false); 
  const [imageResult, setImageResult] = useState<ImageGenerationResult>({ images: [], loading: false, error: null });
  const [refinementResult, setRefinementResult] = useState<ImageGenerationResult>({ images: [], loading: false, error: null });
  const [separatedAssets, setSeparatedAssets] = useState<SeparatedAssets>({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: keyof ArtDirectionRequest, value: any) => {
    setRequest(prev => ({ ...prev, [field]: value }));
  };

  const handleResetBrief = useCallback(() => {
    // Force a fresh reset of all states
    setRequest({ ...initialRequest });
    setArtDirection(null);
    setImageResult({ images: [], loading: false, error: null });
    setRefinementResult({ images: [], loading: false, error: null });
    setSeparatedAssets({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });
    setAnalysisError(null);
    // Switch to studio tab just in case
    setActiveTab('studio');
  }, []);

  const handleAnalyze = async () => {
    if (!request.mainHeadline) {
      setAnalysisError("Vui lòng nhập Tiêu đề chính.");
      return;
    }
    setAnalysisError(null);
    setImageResult({ images: [], loading: false, error: null });
    setArtDirection(null);
    setIsAnalyzing(true);
    try {
      const direction = await generateArtDirection(request);
      setArtDirection(direction);
    } catch (err: any) {
      setAnalysisError(err.message || "Lỗi phân tích brief.");
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const handleUpdatePlan = async (updatedPlan: DesignPlan) => {
    if (!artDirection) return;
    setIsUpdatingPlan(true);
    try {
      const result = await regeneratePromptFromPlan(updatedPlan, request, artDirection.recommendedAspectRatio, artDirection.layout_suggestion);
      setArtDirection(result);
    } catch (err: any) {
      setAnalysisError("Cập nhật thất bại: " + err.message);
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
      const newImages: StudioImage[] = urls.map(url => ({ url, isNew: true }));
      setImageResult(prev => ({
          images: append ? [...prev.images.map(img => ({ ...img, isNew: false })), ...newImages] : newImages,
          loading: false,
          error: null
      }));
    } catch (err: any) {
      setImageResult(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleSeparateLayout = async (selectedImage: string) => {
    if (!artDirection) return;
    setSeparatedAssets(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await separateDesignComponents(
        artDirection.final_prompt,
        artDirection.recommendedAspectRatio,
        request.quality,
        selectedImage
      );
      setSeparatedAssets({ ...result, loading: false, error: null });
      
      const layerImages: StudioImage[] = [];
      if (result.background) layerImages.push({ url: result.background, isNew: true });
      if (result.textLayer) layerImages.push({ url: result.textLayer, isNew: true });
      
      if (layerImages.length > 0) {
          setImageResult(prev => ({
              ...prev,
              images: [...prev.images.map(img => ({ ...img, isNew: false })), ...layerImages]
          }));
      }
    } catch (err: any) {
      setSeparatedAssets(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleSmartRemove = async (sourceImage: string, maskBase64: string, textDescription: string) => {
    setRefinementResult(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await removeObjectWithMask(sourceImage, maskBase64, textDescription);
      if (res) {
        const newImg = { url: res, isNew: true };
        setImageResult(prev => ({
           ...prev,
           images: [...prev.images.map(img => ({ ...img, isNew: false })), newImg], 
        }));
        setRefinementResult(prev => ({ ...prev, images: [newImg], loading: false, error: null }));
      }
    } catch (err: any) {
      setRefinementResult(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleSaveDesign = useCallback(async (imageUrl: string) => {
    if (!user || !artDirection) return;
    setIsSaving(true);
    try {
      await saveDesignToHistory({
        thumbnail: imageUrl,
        requestData: JSON.parse(JSON.stringify(request)),
        designPlan: artDirection.designPlan,
        recommendedAspectRatio: artDirection.recommendedAspectRatio,
        author: user.displayName,
      });
      setRefreshGalleryKey(prev => prev + 1);
      alert("Thiết kế đã được lưu vào Thư Viện.");
    } catch (err) {
      console.error("Save error:", err);
      alert("Lỗi khi lưu thiết kế.");
    } finally {
      setIsSaving(false);
    }
  }, [user, artDirection, request]);

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <div className="relative z-10 container mx-auto px-4 py-6 h-screen flex flex-col">
        <header className="flex items-center justify-between mb-6 shrink-0 bg-slate-900/40 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
             <MapMiniLogo />
             <div>
               <h1 className="text-xl font-black text-white uppercase tracking-tighter">M.A.P Studio</h1>
               <p className="text-[9px] text-[#FFD300] font-bold uppercase tracking-widest opacity-80">AI Art Direction & Design Engine</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <nav className="bg-slate-900/80 p-1 rounded-2xl border border-slate-700/50 flex gap-1">
                 <button onClick={() => setActiveTab('studio')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'studio' ? 'bg-slate-700 text-[#FFD300]' : 'text-slate-500 hover:text-slate-300'}`}>Studio</button>
                 <button onClick={() => setActiveTab('gallery')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'gallery' ? 'bg-slate-700 text-[#FFD300]' : 'text-slate-500 hover:text-slate-300'}`}>Gallery</button>
             </nav>
             <button onClick={logout} className="p-2 bg-slate-800 rounded-xl hover:bg-red-900/20 text-slate-500 hover:text-red-400 transition-all">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
        </header>

        <main className="flex-grow overflow-hidden min-h-0 pb-2">
           {activeTab === 'studio' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 h-full min-h-[500px]">
                    <InputForm values={request} onChange={handleInputChange} onSubmit={handleAnalyze} onReset={handleResetBrief} isGenerating={isAnalyzing || imageResult.loading} estimatedCost={estimatedCost} />
                  </div>
                  <div className="lg:col-span-8 h-full min-h-[500px]">
                    <ResultDisplay 
                      request={request} 
                      artDirection={artDirection} 
                      imageResult={imageResult} 
                      refinementResult={refinementResult} 
                      isAnalyzing={isAnalyzing} 
                      analysisError={analysisError}
                      isUpdatingPlan={isUpdatingPlan}
                      onGenerateImages={handleGenerateFinalImages} 
                      onUpdatePlan={handleUpdatePlan} 
                      onRegenerateImage={() => {}} 
                      onSeparateLayout={handleSeparateLayout}
                      onRefineImage={() => {}} 
                      onSmartRemove={handleSmartRemove} 
                      onResetRefinement={() => {}} 
                      separatedAssets={separatedAssets} 
                      onSaveDesign={handleSaveDesign} 
                      isSaving={isSaving}
                    />
                  </div>
              </div>
           ) : <GalleryView key={refreshGalleryKey} />}
        </main>
      </div>
    </div>
  );
};

export default App;
