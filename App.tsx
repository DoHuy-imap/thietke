
import React, { useState, useEffect } from 'react';
import InputForm from './components/InputForm';
import ResultDisplay from './components/ResultDisplay';
import GalleryView from './components/GalleryView';
import LoginScreen from './components/LoginScreen';
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, ImageGenerationResult, ProductType, VisualStyle, QualityLevel, SeparatedAssets, ProductImageMode, DesignPlan, AnalysisModel, CostBreakdown } from './types';
import { generateArtDirection, generateDesignImage, separateDesignComponents, regeneratePromptFromPlan, removeObjectWithMask, estimateRequestCost } from './services/geminiService';
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

const App: React.FC = () => {
  const { user } = useAuth();
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

  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown>({
      analysisInputTokens: 0,
      analysisOutputTokens: 0,
      analysisCostVND: 0,
      generationImageCount: 0,
      generationCostVND: 0,
      totalCostVND: 0
  });

  useEffect(() => {
    const breakdown = estimateRequestCost(request);
    setCostBreakdown(breakdown);
  }, [request]);

  const [artDirection, setArtDirection] = useState<ArtDirectionResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<ImageGenerationResult>({ imageUrls: [], loading: false, error: null });
  const [refinementResult] = useState<ImageGenerationResult>({ imageUrls: [], loading: false, error: null });
  const [separatedAssets, setSeparatedAssets] = useState<SeparatedAssets>({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });
  const [isSaving] = useState(false);

  const handleInputChange = (field: keyof ArtDirectionRequest, value: any) => setRequest(prev => ({ ...prev, [field]: value }));

  const handleAnalyze = async () => {
    if (!request.mainHeadline) return;
    setAnalysisError(null);
    setIsAnalyzing(true);
    try {
      const direction = await generateArtDirection(request);
      setArtDirection(direction);
    } catch (err: any) {
      setAnalysisError(err.message || "Lỗi khi kết nối.");
    } finally { setIsAnalyzing(false); }
  };

  const handleUpdatePlan = async (updatedPlan: DesignPlan) => {
    if (!artDirection) return;
    try {
      const result = await regeneratePromptFromPlan(updatedPlan, request, artDirection.recommendedAspectRatio, artDirection.layout_suggestion);
      setArtDirection(result);
    } catch (err: any) { alert("Lỗi cập nhật."); }
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
      setImageResult(prev => ({ imageUrls: append ? [...prev.imageUrls, ...urls] : urls, loading: false, error: null }));
    } catch (err: any) {
      setImageResult(prev => ({ ...prev, loading: false, error: (err as Error).message }));
    }
  };

  const handleSeparateLayout = async (selectedImage: string, mode: 'full' | 'background') => {
    setSeparatedAssets(prev => ({ ...prev, loading: true }));
    try {
      const result = await separateDesignComponents("", artDirection?.recommendedAspectRatio || "1:1", request.quality, selectedImage, mode);
      setSeparatedAssets({ ...result, loading: false, error: null });
    } catch (err: any) { setSeparatedAssets(prev => ({ ...prev, loading: false, error: "Lỗi tách nền" })); }
  };

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <div className="container mx-auto px-4 py-6 h-screen flex flex-col relative z-10">
        <header className="flex items-center justify-between mb-6 shrink-0 bg-slate-900/40 p-4 rounded-3xl border border-white/5 backdrop-blur-md z-50">
          <div className="flex items-center gap-4"><MapMiniLogo /><div><h1 className="text-xl font-black text-white tracking-tighter uppercase">Thiết kế M.A.P</h1><p className="text-[10px] text-[#FFD300] font-bold uppercase tracking-widest opacity-80">Professional AI Studio</p></div></div>
          <div className="flex items-center gap-6">
             <nav className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/50 flex gap-1">
                 <button onClick={() => setActiveTab('studio')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'studio' ? 'bg-slate-700 text-[#FFD300]' : 'text-slate-500'}`}>Studio</button>
                 <button onClick={() => setActiveTab('gallery')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'gallery' ? 'bg-slate-700 text-[#FFD300]' : 'text-slate-500'}`}>Thư Viện</button>
             </nav>
             <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700"><div className="w-8 h-8 bg-[#FFD300] rounded-full flex items-center justify-center font-black text-sm text-black">{user.displayName.charAt(0).toUpperCase()}</div><div className="text-left hidden sm:block"><p className="text-xs text-white font-bold">{user.displayName}</p></div></button>
          </div>
        </header>

        <main className="flex-grow overflow-hidden min-h-0 pb-2">
           {activeTab === 'studio' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 h-full"><InputForm values={request} onChange={handleInputChange} onSubmit={handleAnalyze} isGenerating={isAnalyzing} costBreakdown={costBreakdown} /></div>
                  <div className="lg:col-span-8 h-full">
                    <ResultDisplay 
                      request={request} artDirection={artDirection} imageResult={imageResult} refinementResult={refinementResult} isAnalyzing={isAnalyzing} analysisError={analysisError} isUpdatingPlan={false} onGenerateImages={handleGenerateFinalImages} onUpdatePlan={handleUpdatePlan} onRegenerateImage={() => {}} onSeparateLayout={handleSeparateLayout} onRefineImage={() => {}} onSmartRemove={removeObjectWithMask} onResetRefinement={() => {}} separatedAssets={separatedAssets} onSaveDesign={() => {}} isSaving={isSaving}
                    />
                  </div>
              </div>
           ) : <GalleryView />}
        </main>
      </div>
    </div>
  );
};

export default App;
