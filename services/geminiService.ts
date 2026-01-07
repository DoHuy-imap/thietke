
import { GoogleGenAI, Type } from "@google/genai";
import { 
  ArtDirectionRequest, ArtDirectionResponse, ColorOption, DesignPlan, 
  LayoutSuggestion, SeparatedAssets, QualityLevel, CostBreakdown, SubjectAsset
} from "../types";

// Sử dụng model Pro cho việc lập kế hoạch và sản xuất chất lượng cao
const MODEL_PLANNING = "gemini-3-pro-preview";
const MODEL_PRODUCTION = "gemini-3-pro-image-preview";

const QUALITY_BOOSTERS = "professional commercial graphic design, advertising award winning style, high fidelity, vector quality sharp text, premium product photography lighting, 8k resolution, clean sharp edges";
const NEGATIVE_PROMPT = "blurry, low quality, messy composition, distorted logo, text errors, watermark, signature, lowres, grainy, frame, slanted, perspective mockup, extra limbs, bad anatomy, noisy background";

export const LAYOUT_TAG = "\n\n### DESIGN LAYOUT COORDINATES ###\n";

const extractBase64AndMime = (dataUrl: string | null): { mimeType: string, data: string } | null => {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2]
  };
};

// Hàm tiện ích: Resize ảnh base64 để giảm payload tránh lỗi 400 Payload Too Large
const resizeImageBase64 = (base64Str: string, maxWidth = 1536): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let { width, height } = img;
      // Chỉ resize nếu ảnh lớn hơn maxWidth
      if (width > maxWidth || height > maxWidth) {
        const ratio = Math.min(maxWidth / width, maxWidth / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      } else {
        resolve(base64Str); // Giữ nguyên nếu nhỏ
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Sử dụng PNG để giữ độ trong suốt (alpha channel)
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str); // Fallback nếu lỗi load ảnh
  });
};

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key chưa được cấu hình. Vui lòng chọn API Key tại màn hình đăng nhập.");
  return new GoogleGenAI({ apiKey });
};

export const estimateRequestCost = (request: ArtDirectionRequest): CostBreakdown => {
    const baseCost = 25; 
    const productionCost = request.batchSize * (request.quality === QualityLevel.HIGH ? 25 : 12);
    return {
        analysisInputTokens: 0, analysisOutputTokens: 0, analysisCostVND: baseCost,
        generationImageCount: request.batchSize, generationCostVND: productionCost,
        totalCostVND: baseCost + productionCost
    };
};

export const getClosestAspectRatio = (width: string, height: string): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
  const w = parseFloat(width);
  const h = parseFloat(height);
  if (isNaN(w) || h === 0) return "1:1";
  const currentRatio = w / h;
  const supportedRatios: { label: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", val: number }[] = [
    { label: "1:1", val: 1.0 }, { label: "3:4", val: 0.75 }, { label: "4:3", val: 1.3333 },
    { label: "9:16", val: 0.5625 }, { label: "16:9", val: 1.7777 }
  ];
  return supportedRatios.reduce((prev, curr) => Math.abs(curr.val - currentRatio) < Math.abs(prev.val - currentRatio) ? curr : prev).label;
};

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  const ai = getGeminiClient();
  const targetRatio = getClosestAspectRatio(request.width, request.height);
  let colorInstr = request.colorOption === ColorOption.BRAND_LOGO 
    ? "Analyze the Brand Logo colors and use them as the primary theme." 
    : request.colorOption === ColorOption.CUSTOM ? `Strictly use HEX: ${request.customColors.join(', ')}.` : "AI Custom professional colors.";

  // CMYK Instruction
  if (request.useCMYK) {
      colorInstr += " [STRICT CMYK MODE: Use only printable colors strictly within the CMYK gamut suitable for offset printing. Avoid neon, fluorescent, or out-of-gamut RGB brights. Colors should appear rich, matte, and print-safe.]";
  }

  const promptParts: any[] = [{ text: `
    ROLE: EXPERT ART DIRECTOR.
    TASK: ANALYZE REFERENCES AND CREATE A DETAILED DESIGN PLAN.

    STRICT CONTENT RULES (DO NOT HALLUCINATE TEXT):
    1. Primary Headline: "${request.mainHeadline}" (Must appear exactly as written).
    2. Secondary Text: "${request.secondaryText}" (Must appear exactly as written).
    3. Do NOT invent addresses, phone numbers, or slogans not provided above.

    INPUT SPECS:
    - Product: ${request.productType} (Real Physical Size: ${request.width}cm x ${request.height}cm, Aspect Ratio: ${targetRatio})
    - Strategy Directive: "${request.layoutRequirements}"
    - Base Style: ${request.visualStyle}
    - Colors: ${colorInstr}
    
    REFERENCE ANALYSIS LOGIC (STRICT 6-CRITERIA MAPPING):
    Analyze all attached images. For each Reference Image, look at its assigned 'Attributes' and map them to the corresponding Design Plan key below:
    
    1. subject (Chủ thể & Nội dung): Derive from 'Subject' attribute. How is the product/model shown?
    2. styleContext (Phong cách & Bối cảnh): Derive from 'Style' attribute. What is the mood/era/environment?
    3. composition (Bố cục & Góc nhìn): Derive from 'Composition' attribute. How are elements arranged? (Prioritize user's 'Strategy Directive').
    4. colorLighting (Màu sắc & Ánh sáng): Derive from 'Color' attribute. What is the palette and lighting scheme?
    5. decorElements (Chi tiết trang trí): Derive from 'Decoration' attribute. What shapes, lines, or textures are used?
    6. typography (Typography & Font): 
       - PRIMARY SOURCE: The provided 'CRITICAL Typography Reference' image (if exists).
       - SECONDARY SOURCE: Reference Ideas with 'Typo' attribute.
       - Define font style, weight, and treatment strictly.

    ASSET HANDLING:
    - If Subject Assets are provided with 'AI background removal', explicitly plan to ISOLATE them from their original background and place them into the new 'styleContext'.
  ` }];

  // Resize images before sending to Analysis to prevent 400 errors here as well
  if (request.logoImage) {
    const resizedLogo = await resizeImageBase64(request.logoImage);
    const data = extractBase64AndMime(resizedLogo);
    if (data) {
        promptParts.push({ text: "Brand Logo (Keep colors and shape):" });
        promptParts.push({ inlineData: data });
    }
  }

  if (request.typoReferenceImage) {
    const resizedTypo = await resizeImageBase64(request.typoReferenceImage);
    const data = extractBase64AndMime(resizedTypo);
    if (data) {
        promptParts.push({ text: "CRITICAL Typography Reference (Follow this font style):" });
        promptParts.push({ inlineData: data });
    }
  }

  // Process reference images sequentially to resize
  for (let idx = 0; idx < request.referenceImages.length; idx++) {
    const ref = request.referenceImages[idx];
    const resizedRef = await resizeImageBase64(ref.image);
    const data = extractBase64AndMime(resizedRef);
    if (data) {
        promptParts.push({ text: `Ref Idea ${idx+1} (Extract attributes: ${ref.attributes.join(', ')}):` });
        promptParts.push({ inlineData: data });
    }
  }

  const response = await ai.models.generateContent({
    model: MODEL_PLANNING,
    contents: { parts: promptParts },
    config: {
      systemInstruction: "You are a professional Senior Art Director. Output JSON strictly following the 6-criteria Design Plan. Never change the provided input text.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          designPlan: { type: Type.OBJECT, properties: { subject: {type: Type.STRING}, styleContext: {type: Type.STRING}, composition: {type: Type.STRING}, colorLighting: {type: Type.STRING}, decorElements: {type: Type.STRING}, typography: {type: Type.STRING} }, required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] },
          layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
          analysis: { type: Type.STRING },
          final_prompt: { type: Type.STRING },
          recommendedAspectRatio: { type: Type.STRING, enum: ["1:1", "3:4", "4:3", "9:16", "16:9"] },
        },
        required: ["designPlan", "layout_suggestion", "analysis", "final_prompt", "recommendedAspectRatio"],
      }
    }
  });

  const result = JSON.parse(response.text) as ArtDirectionResponse;
  result.recommendedAspectRatio = targetRatio;
  result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
  return result;
};

export const suggestNewLayout = async (direction: ArtDirectionResponse, request: ArtDirectionRequest): Promise<LayoutSuggestion> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: MODEL_PLANNING,
    contents: { parts: [{ text: `Analyze the Design Plan: ${JSON.stringify(direction.designPlan)} and the user's layout directive: "${request.layoutRequirements}". Suggest a completely NEW creative layout JSON. Ensure the layout fits the aspect ratio ${direction.recommendedAspectRatio}. Output ONLY the layout_suggestion object.` }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
        }
      }
    }
  });
  return JSON.parse(response.text).layout_suggestion;
};

export const generateDesignImage = async (prompt: string, aspectRatio: string, batchSize: number, imageSize: string, _assets: SubjectAsset[] = [], _logo: string | null = null, mask?: string | null): Promise<string[]> => {
  const ai = getGeminiClient();
  
  // Consolidate text into ONE part to prevent 400 errors.
  let fullTextPrompt = `${prompt}. Professional commercial design quality. High-end advertising style.`;
  if (mask) fullTextPrompt += " Follow the element positions in the provided layout mask exactly.";
  if (_logo) fullTextPrompt += " Include the provided brand logo perfectly.";
  
  const imageParts: any[] = [];

  // Resize and prepare assets sequentially to ensure data integrity
  for (let idx = 0; idx < _assets.length; idx++) {
    const asset = _assets[idx];
    const resizedAsset = await resizeImageBase64(asset.image);
    const data = extractBase64AndMime(resizedAsset);
    if (data) {
      imageParts.push({ inlineData: data });
      if (asset.removeBackground) {
        // Strong instruction for background removal
        fullTextPrompt += ` [IMPORTANT] For Asset ${idx + 1}, performing digital cutout. EXTRACT the subject from its original background and composite it seamlessly into the new design. Do NOT include the original background of the asset.`;
      } else {
        fullTextPrompt += ` Use Asset ${idx + 1} as a reference for the product look.`;
      }
    }
  }

  if (_logo) {
    const resizedLogo = await resizeImageBase64(_logo);
    const data = extractBase64AndMime(resizedLogo);
    if (data) imageParts.push({ inlineData: data });
  }

  if (mask) {
    // Mask usually doesn't need high res, resize to save tokens
    const resizedMask = await resizeImageBase64(mask, 1024);
    const data = extractBase64AndMime(resizedMask);
    if (data) imageParts.push({ inlineData: data });
  }

  // Standard Multimodal structure: [TextPart, ImagePart1, ImagePart2, ...]
  const contents = {
    parts: [
      { text: `${fullTextPrompt}. Negative: ${NEGATIVE_PROMPT}` },
      ...imageParts
    ]
  };

  const urls: string[] = [];
  
  // EXECUTE SEQUENTIALLY to avoid 400/429 errors from concurrency on heavy image tasks
  for (let i = 0; i < batchSize; i++) {
    try {
      const result = await ai.models.generateContent({
        model: MODEL_PRODUCTION,
        contents,
        config: { 
            imageConfig: { 
                aspectRatio: aspectRatio as any, 
                imageSize: imageSize as any 
            } 
        } 
      });
      const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData?.data) {
        urls.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    } catch (e) {
      console.error(`Production attempt ${i+1} failed:`, e);
      // We continue to try the next one even if one fails
    }
  }

  if (urls.length === 0) throw new Error("Tất cả nỗ lực sản xuất đều thất bại (400). Hãy kiểm tra lại API Key hoặc giảm độ phức tạp của brief.");
  return urls;
};

export const separateDesignComponents = async (_p: string, ar: string, sz: string, img: string): Promise<SeparatedAssets> => {
  const ai = getGeminiClient();
  const sourceData = extractBase64AndMime(img);
  if (!sourceData) throw new Error("Invalid image data.");

  const results: SeparatedAssets = { background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null };
  const tasks = [
    { 
      mode: 'bg', 
      p: "STRICT EXTRACTION: Remove only typography and logos. Keep all background decorations, environments, and subjects exactly as is. Output the pure static visual background." 
    },
    { 
      mode: 'txt', 
      p: "STRICT EXTRACTION: Extract only text content and brand logos onto a PURE WHITE background. Do not add any extra elements." 
    }
  ];

  const promises = tasks.map(async (t) => {
    const res = await ai.models.generateContent({
      model: MODEL_PRODUCTION,
      contents: { parts: [{ text: t.p }, { inlineData: sourceData }]},
      config: { imageConfig: { aspectRatio: ar as any, imageSize: sz as any } },
    });
    return { mode: t.mode, data: res.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data };
  });

  const resArray = await Promise.all(promises);
  resArray.forEach(r => {
    if (r.mode === 'bg' && r.data) results.background = `data:image/png;base64,${r.data}`;
    if (r.mode === 'txt' && r.data) results.textLayer = `data:image/png;base64,${r.data}`;
  });
  return results;
};

export const removeObjectWithMask = async (source: string, mask: string, instr?: string): Promise<string | null> => {
    const ai = getGeminiClient();
    const sourceData = extractBase64AndMime(source);
    const maskData = extractBase64AndMime(mask);
    if (!sourceData || !maskData) return null;
    const response = await ai.models.generateContent({
        model: MODEL_PRODUCTION,
        contents: { parts: [{ text: `Eraser tool task: ${instr || 'Cleanly remove and rebuild the background.'}` }, { inlineData: sourceData }, { inlineData: maskData }]}
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return data ? `data:image/png;base64,${data}` : null;
};

export const regeneratePromptFromPlan = async (plan: DesignPlan, req: ArtDirectionRequest, ar: string, lay: any): Promise<ArtDirectionResponse> => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: MODEL_PLANNING,
        contents: { parts: [{ text: `Regenerate a production prompt and layout based on updated plan: ${JSON.stringify(plan)}` }] },
        config: {
            systemInstruction: "Expert Art Director. Output JSON.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    designPlan: { type: Type.OBJECT, properties: { subject: {type: Type.STRING}, styleContext: {type: Type.STRING}, composition: {type: Type.STRING}, colorLighting: {type: Type.STRING}, decorElements: {type: Type.STRING}, typography: {type: Type.STRING} }, required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] },
                    layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
                    analysis: { type: Type.STRING },
                    final_prompt: { type: Type.STRING },
                    recommendedAspectRatio: { type: Type.STRING, enum: ["1:1", "3:4", "4:3", "9:16", "16:9"] },
                },
                required: ["designPlan", "layout_suggestion", "analysis", "final_prompt", "recommendedAspectRatio"],
            },
        },
    });
    const result = JSON.parse(response.text) as ArtDirectionResponse;
    result.recommendedAspectRatio = ar as any;
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
};

export const upscaleImageTo4K = async (image: string, aspectRatio: string): Promise<string> => {
  const ai = getGeminiClient();
  const sourceData = extractBase64AndMime(image);
  if (!sourceData) throw new Error("Invalid image data.");

  const response = await ai.models.generateContent({
    model: MODEL_PRODUCTION,
    contents: {
      parts: [
        { text: "Enhance and upscale this image to 4K resolution while maintaining perfect fidelity." },
        { inlineData: sourceData }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: "4K"
      }
    }
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part?.inlineData?.data) throw new Error("Upscale failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
  let prompt = LAYOUT_TAG;
  layout.elements.forEach(el => {
    prompt += `- ${el.name} (${el.type}): x:${Math.round(el.rect.x)}%, y:${Math.round(el.rect.y)}%, w:${Math.round(el.rect.width)}%, h:${Math.round(el.rect.height)}%\n`;
  });
  return prompt;
};
