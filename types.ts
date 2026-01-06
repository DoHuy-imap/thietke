
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
  FOLLOW_REF = 'Follow Reference' // New option
}

export enum ColorMode {
  AUTO = 'Auto',
  CUSTOM = 'Custom',
  BRAND_LOGO = 'Brand Logo' // New option
}

export enum QualityLevel {
  LOW = '1K',
  MEDIUM = '2K',
  HIGH = '4K'
}

export enum ProductImageMode {
  REALISTIC = 'Realistic', // Làm nét, giữ nguyên chi tiết, tách nền
  STYLIZED = 'Stylized'    // AI Cách điệu, vẽ lại
}

// New Enum for Analysis Model Selection
export enum AnalysisModel {
  FLASH = 'Flash', // gemini-3-flash-preview
  PRO = 'Pro'      // gemini-3-pro-preview
}

export interface ReferenceImageConfig {
  id: string;
  image: string; // Base64 string
  attributes: string[]; // 'Subject', 'Style', 'Composition', 'Color', 'Decor', 'Typography'
}

export interface ArtDirectionRequest {
  productType: ProductType;
  // Content Text Split
  mainHeadline: string;
  mainHeadlineImage: string | null; // Image reference specifically for the headline style
  secondaryText: string;
  
  visualStyle: VisualStyle;
  colorMode: ColorMode;
  customColors: string[];
  
  // Design Requirements
  layoutRequirements: string; // Specific placement instructions & Scene description merged
  fontPreferences: string; // New field for typography/font usage
  
  width: string;
  height: string;
  
  // Assets & Logo
  logoImage: string | null; // Base64 string for Brand Logo
  assetImages: string[]; // Base64 strings
  productImageMode: ProductImageMode; // How to treat the asset images

  // Updated to support multiple references
  referenceImages: ReferenceImageConfig[]; 
  
  batchSize: 1 | 2 | 3;
  quality: QualityLevel;
  
  // New field for Model Selection
  analysisModel: AnalysisModel;
}

// New Interface for Decomposed Plan
export interface DesignPlan {
  subject: string;        // Chủ thể chính & Nội dung phụ
  styleContext: string;   // Bối cảnh & Phong cách
  composition: string;    // Bố cục & Góc máy
  colorLighting: string;  // Màu sắc & Ánh sáng
  decorElements: string;  // Chi tiết trang trí
  typography: string;     // Typography (Chữ)
}

// --- NEW LAYOUT TYPES ---
export interface LayoutRect {
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage 0-100
  height: number; // Percentage 0-100
}

export interface LayoutElement {
  id: string;
  name: string;
  type: 'subject' | 'text' | 'decor' | 'logo';
  color: string; // Hex for UI display
  rect: LayoutRect;
  zIndex?: number;
  image?: string; // Optional: Image content for visual preview
  imageRatio?: number; // Optional: Width/Height ratio of the contained image
}

export interface LayoutSuggestion {
  canvas_ratio: string; // e.g., "9:16"
  elements: LayoutElement[];
}
// ------------------------

export interface ArtDirectionResponse {
  designPlan: DesignPlan; // Structured plan
  layout_suggestion: LayoutSuggestion; // NEW FIELD
  analysis: string;       // General summary
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
  subjects: string[]; // Multiple subject layers
  decor: string[];    // Multiple decor layers
  lighting: string | null; // Lighting/Atmosphere layer
  loading: boolean;
  error: string | null;
}

// --- HISTORY DB TYPES ---
export interface DesignDNA {
  id?: number; // Auto-incremented by IndexedDB
  createdAt: number; // Timestamp
  author?: string; // NEW: The user who created this design
  
  // Core Visuals
  thumbnail: string; // Base64 of the generated image (for gallery view)
  
  // Reconstruction Data
  finalPrompt: string;
  designPlan: DesignPlan;
  layout: LayoutSuggestion;
  
  // Request Context (To refill form)
  requestData: ArtDirectionRequest;
  
  // Saved Assets (To work offline/reload)
  // We store Base64 strings here to keep it simple, though Blobs are more efficient
  assets: {
    type: 'user_asset' | 'logo' | 'reference' | 'headline_ref';
    data: string; 
  }[];

  seed?: number; // Optional if we support seeding later
  recommendedAspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}
