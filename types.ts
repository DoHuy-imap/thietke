
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
  FOLLOW_REF = 'Style from idea'
}

export enum ColorOption {
  AI_CUSTOM = 'AI Custom Color',
  BRAND_LOGO = 'Brand Logo Color',
  CUSTOM = 'Manual Hex Color'
}

export enum QualityLevel {
  LOW = '1K',
  MEDIUM = '2K',
  HIGH = '4K'
}

export type ReferenceAttribute = 'Subject' | 'Composition' | 'Decoration' | 'Style' | 'Color' | 'Typo';

export interface ReferenceImageConfig {
  id: string;
  image: string;
  attributes: ReferenceAttribute[];
}

export interface SubjectAsset {
  image: string;
  removeBackground: boolean;
}

export interface ArtDirectionRequest {
  productType: ProductType;
  mainHeadline: string;
  typoReferenceImage: string | null; // Mới: Tham chiếu Typo cạnh Headline
  secondaryText: string;
  layoutRequirements: string;
  visualStyle: VisualStyle;
  colorOption: ColorOption;
  customColors: string[];
  useCMYK: boolean; // Mới: Chế độ màu in ấn
  width: string; // cm
  height: string; // cm
  logoImage: string | null;
  assetImages: SubjectAsset[]; // Đổi từ string[] sang SubjectAsset[]
  referenceImages: ReferenceImageConfig[]; // Max 3
  batchSize: 1 | 2 | 3;
  quality: QualityLevel;
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

export interface StudioImage {
  url: string;
  isNew: boolean;
}

export interface ImageGenerationResult {
  images: StudioImage[];
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

export interface CostBreakdown {
  analysisInputTokens: number;
  analysisOutputTokens: number;
  analysisCostVND: number;
  generationImageCount: number;
  generationCostVND: number;
  totalCostVND: number;
}

export interface DesignDNA {
  id?: number;
  thumbnail: string;
  requestData: ArtDirectionRequest;
  designPlan: DesignPlan;
  recommendedAspectRatio: string;
  author: string;
  createdAt: number;
  seed?: number;
}
