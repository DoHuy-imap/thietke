
export enum ProductType {
  POSTER = 'Poster',
  STANDEE = 'Standee',
  BACKDROP = 'Backdrop',
  BANNER = 'Banner',
  SOCIAL_POST = 'Social Media Post',
  FLYER = 'Flyer'
}

export enum VisualStyle {
  MODERN_TECH = 'Modern Tech',
  LUXURY = 'Luxury',
  VINTAGE = 'Vintage',
  FESTIVE = 'Festive',
  MINIMALIST = 'Minimalist',
  CORPORATE = 'Corporate',
  CYBERPUNK = 'Cyberpunk',
  NATURAL_ORGANIC = 'Natural/Organic',
  FOLLOW_REF = 'Follow Reference'
}

export enum ColorMode {
  AUTO = 'Auto',
  CUSTOM = 'Custom',
  BRAND_LOGO = 'Brand Logo'
}

export enum QualityLevel {
  LOW = '1K',
  MEDIUM = '2K',
  HIGH = '4K'
}

export enum ProductImageMode {
  REALISTIC = 'Realistic',
  STYLIZED = 'Stylized'
}

export enum AnalysisModel {
  FLASH = 'Flash',
  PRO = 'Pro'
}

export interface ReferenceImageConfig {
  id: string;
  image: string;
  attributes: string[];
}

// --- COST CALCULATION TYPES ---
export interface CostBreakdown {
  analysisInputTokens: number;
  analysisOutputTokens: number;
  analysisCostVND: number;
  generationImageCount: number;
  generationCostVND: number;
  totalCostVND: number;
}
// ------------------------------

export interface ArtDirectionRequest {
  productType: ProductType;
  mainHeadline: string;
  mainHeadlineImage: string | null;
  secondaryText: string;
  visualStyle: VisualStyle;
  colorMode: ColorMode;
  customColors: string[];
  layoutRequirements: string;
  fontPreferences: string;
  width: string;
  height: string;
  logoImage: string | null;
  assetImages: string[];
  productImageMode: ProductImageMode;
  referenceImages: ReferenceImageConfig[]; 
  batchSize: 1 | 2 | 3;
  quality: QualityLevel;
  analysisModel: AnalysisModel;
}

export interface DesignPlan {
  subject: string;
  styleContext: string;
  composition: string;
  colorLighting: string;
  decorElements: string;
  typography: string;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutElement {
  id: string;
  name: string;
  type: 'subject' | 'text' | 'decor' | 'logo';
  color: string;
  rect: LayoutRect;
  zIndex?: number;
  image?: string;
  imageRatio?: number;
}

export interface LayoutSuggestion {
  canvas_ratio: string;
  elements: LayoutElement[];
}

export interface ArtDirectionResponse {
  designPlan: DesignPlan;
  layout_suggestion: LayoutSuggestion;
  analysis: string;
  final_prompt: string;
  recommendedAspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}

export interface ImageGenerationResult {
  imageUrls: string[];
  loading: boolean;
  error: string | null;
}

export interface SeparatedAssets {
  background: string | null;
  textLayer: string | null;
  subjects: string[];
  decor: string[];
  lighting: string | null;
  loading: boolean;
  error: string | null;
}

export interface DesignDNA {
  id?: number;
  createdAt: number;
  author?: string;
  thumbnail: string;
  finalPrompt: string;
  designPlan: DesignPlan;
  layout: LayoutSuggestion;
  requestData: ArtDirectionRequest;
  assets: {
    type: 'user_asset' | 'logo' | 'reference' | 'headline_ref';
    data: string; 
  }[];
  seed?: number;
  recommendedAspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}
