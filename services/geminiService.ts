
import { GoogleGenAI, Type } from "@google/genai";
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, DesignPlan, LayoutSuggestion, AnalysisModel, SeparatedAssets } from "../types";

const MODEL_IMAGE_GEN = "gemini-3-pro-image-preview"; 
const QUALITY_BOOSTERS = "masterpiece, best quality, highres, 8k resolution, highly detailed, professional photography, cinematic lighting, sharp focus, hdr, smooth texture";
const NEGATIVE_PROMPT = "coordinates, numeric values, X=, Y=, percentage symbols, bounding boxes, wireframes, technical labels, blueprint lines, user interface elements, crosshair, crop marks, text overlaying important objects, distorted text, messy layout";

// Helper: Safe extract base64
const safeExtractBase64 = (dataUrl: string | null): string | null => {
  if (!dataUrl) return null;
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : null;
};

// Helper: Get AI Client safely (Lazy Load)
const getGeminiClient = () => {
  // Lấy key mới nhất từ môi trường hoặc localStorage mỗi khi hàm này được gọi
  const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
  
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    throw new Error("API Key chưa được kết nối. Vui lòng nhấn vào tên người dùng và chọn 'Kết nối lại API Key'.");
  }
  
  // Khởi tạo SDK instance mới tại chỗ
  return new GoogleGenAI({ apiKey });
};

// --- NEW VALIDATION FUNCTION ---
export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    // Thử gọi một request siêu nhẹ để kiểm tra key
    // Dùng gemini-1.5-flash để kiểm tra vì nó ổn định và nhanh
    await ai.models.generateContent({
      model: 'gemini-1.5-flash', 
      contents: { parts: [{ text: 'Hi' }] },
      config: { maxOutputTokens: 1 }
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};
// ------------------------------

// --- COST ESTIMATION UTILS ---
export const estimateRequestCost = (request: ArtDirectionRequest): number => {
    const ratePer1kTokens = request.analysisModel === AnalysisModel.PRO ? 90 : 2;
    
    // Estimate Text Tokens (1 token ~= 4 chars)
    const textData = JSON.stringify(request);
    const textTokens = Math.ceil(textData.length / 4);
    
    // Estimate Image Tokens
    let imageCount = 0;
    if (request.mainHeadlineImage) imageCount++;
    if (request.logoImage) imageCount++;
    imageCount += request.assetImages.length;
    imageCount += request.referenceImages.length;
    
    const imageTokens = imageCount * 258;
    const systemInstructionTokens = 500;
    const totalInputTokens = textTokens + imageTokens + systemInstructionTokens;
    
    // Estimated Output
    const estimatedOutputTokens = 1500; 
    const outputRatePer1k = request.analysisModel === AnalysisModel.PRO ? 270 : 8;

    const inputCost = (totalInputTokens / 1000) * ratePer1kTokens;
    const outputCost = (estimatedOutputTokens / 1000) * outputRatePer1k;
    
    return Math.round(inputCost + outputCost);
};

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
  const elementsDesc = layout.elements.map(el => 
    `- ${el.name} (${el.type}): x=${el.rect.x.toFixed(1)}%, y=${el.rect.y.toFixed(1)}%, width=${el.rect.width.toFixed(1)}%, height=${el.rect.height.toFixed(1)}%`
  ).join('\n');
  return `\n\n### SPATIAL LAYOUT ###\nPosition these elements strictly according to the provided mask and coordinates:\n${elementsDesc}`;
};

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  // LAZY INITIALIZATION: Client SDK & Key are loaded here
  const ai = getGeminiClient();
  
  // MAP MODEL THEO CHẾ ĐỘ: Flash -> gemini-1.5-flash, Pro -> gemini-1.5-pro
  // Các model này hỗ trợ Vision (xử lý ảnh) tốt hơn phiên bản cũ
  const modelId = request.analysisModel === AnalysisModel.PRO ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

  const referenceContext = request.referenceImages.map((ref, idx) => 
    `Reference ${idx + 1} focus: ${ref.attributes.join(', ')}.`
  ).join(' ');

  let colorInstruction = request.colorMode === ColorMode.BRAND_LOGO 
      ? "EXTRACT AND APPLY COLORS FROM THE PROVIDED LOGO." 
      : (request.colorMode === ColorMode.CUSTOM ? `Color Palette: ${request.customColors.join(', ')}` : 'Auto selection based on style.');

  const parts: any[] = [{ text: `
    Project Type: ${request.productType}
    Main Title: "${request.mainHeadline}"
    Secondary Content (CRITICAL: Split each line into a separate layout element): 
    "${request.secondaryText}"
    Visual Style: ${request.visualStyle}
    Colors: ${colorInstruction}
    Font Prefs: ${request.fontPreferences}
    Creative Context: ${referenceContext}
    Asset Mode: ${request.productImageMode}
  ` }];
  
  if (request.mainHeadlineImage) {
    const data = safeExtractBase64(request.mainHeadlineImage);
    if (data) {
      parts.push({ text: "TYPOGRAPHY STYLE REFERENCE FOR MAIN TITLE:" });
      parts.push({ inlineData: { mimeType: "image/png", data } });
    }
  }

  if (request.logoImage) {
    const data = safeExtractBase64(request.logoImage);
    if (data) {
      parts.push({ text: "BRAND LOGO IMAGE (Place as overlay):" });
      parts.push({ inlineData: { mimeType: "image/png", data } });
    }
  }
  
  request.assetImages.forEach((img, idx) => {
    const data = safeExtractBase64(img);
    if (data) {
      parts.push({ text: `PRODUCT ASSET ${idx + 1}:` });
      parts.push({ inlineData: { mimeType: "image/png", data } });
    }
  });

  request.referenceImages.forEach((ref, idx) => {
    const data = safeExtractBase64(ref.image);
    if (data) {
      parts.push({ text: `STYLE REFERENCE ${idx + 1} FOR ${ref.attributes.join(', ')}:` });
      parts.push({ inlineData: { mimeType: "image/png", data } });
    }
  });

  const response = await ai.models.generateContent({
    model: modelId,
    contents: { parts },
    config: {
      systemInstruction: "You are a Senior Art Director. Create a 6-criteria plan. Split 'Secondary Content' by newline. If TYPOGRAPHY STYLE REFERENCE provided, apply it. Return JSON. Coordinates 0-100. RECOMMENDED ASPECT RATIO MUST BE ONE OF: '1:1', '3:4', '4:3', '9:16', '16:9'.",
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
  result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
  return result;
};

export const generateDesignImage = async (
  prompt: string, 
  aspectRatio: string, 
  batchSize: number, 
  imageSize: string,
  assetImages: string[] = [],
  logoImage: string | null = null,
  layoutMask?: string | null 
): Promise<string[]> => {
  // LAZY INITIALIZATION
  const ai = getGeminiClient();
  const parts: any[] = [{ text: `${prompt}\n\nSTRICT NEGATIVE PROMPT: ${NEGATIVE_PROMPT}` }];

  if (layoutMask) {
    const maskData = safeExtractBase64(layoutMask);
    if (maskData) {
      parts.push({ text: "SPATIAL LAYOUT MASK (STRICTLY FOLLOW COMPOSITION):" });
      parts.push({ inlineData: { mimeType: "image/png", data: maskData } });
    }
  }

  if (logoImage) {
    const data = safeExtractBase64(logoImage);
    if (data) {
      parts.push({ text: "BRAND LOGO OVERLAY:" });
      parts.push({ inlineData: { mimeType: "image/png", data } });
    }
  }

  assetImages.forEach((img, idx) => {
    const data = safeExtractBase64(img);
    if (data) {
      parts.push({ text: `MAIN SUBJECT ${idx + 1}:` });
      parts.push({ inlineData: { mimeType: "image/png", data } });
    }
  });
  
  const promises = Array.from({ length: batchSize }).map(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: { parts },
      config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } },
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
  });

  const results = await Promise.all(promises);
  return results.filter((url): url is string => url !== null);
};

export const refineDesignImage = async (
  sourceImageBase64: string,
  instruction: string,
  aspectRatio: string,
  imageSize: string
): Promise<string[]> => {
  // LAZY INITIALIZATION
  const ai = getGeminiClient();
  const data = safeExtractBase64(sourceImageBase64);
  if (!data) throw new Error("Ảnh không hợp lệ");

  const response = await ai.models.generateContent({
    model: MODEL_IMAGE_GEN,
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: data } },
        { text: instruction },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: imageSize as any,
      },
    },
  });

  const urls: string[] = [];
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        urls.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }
  }
  return urls;
};

export const upscaleImageTo4K = async (sourceImageBase64: string, aspectRatio: string): Promise<string> => {
    // LAZY INITIALIZATION
    const ai = getGeminiClient();
    const data = safeExtractBase64(sourceImageBase64);
    if (!data) throw new Error("Ảnh không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: {
            parts: [
                { text: "GENERATE 4K ULTRA HIGH RESOLUTION VERSION. MAXIMIZE SHARPNESS AND DETAIL FOR PRINTING." },
                { inlineData: { mimeType: "image/png", data } }
            ]
        },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: "4K" } },
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    throw new Error("Nâng cấp thất bại");
};

export const removeObjectWithMask = async (originalImageBase64: string, maskImageBase64: string, textInstruction?: string): Promise<string | null> => {
    // LAZY INITIALIZATION
    const ai = getGeminiClient();
    const originalData = safeExtractBase64(originalImageBase64);
    const maskData = safeExtractBase64(maskImageBase64);
    if (!originalData || !maskData) throw new Error("Dữ liệu không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: {
            parts: [
                { text: `AI Eraser Tool: ${textInstruction || 'Seamlessly remove the object covered by the white mask and reconstruct the background'}` },
                { inlineData: { mimeType: "image/png", data: originalData } },
                { inlineData: { mimeType: "image/png", data: maskData } }
            ]
        }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};

export const separateDesignLayers = async (
  sourceImageBase64: string,
  aspectRatio: string,
  imageSize: string
): Promise<SeparatedAssets> => {
  // LAZY INITIALIZATION
  const ai = getGeminiClient();
  const data = safeExtractBase64(sourceImageBase64);
  if (!data) throw new Error("Ảnh không hợp lệ");

  const results: SeparatedAssets = {
    background: null,
    textLayer: null,
    subjects: [],
    decor: [],
    lighting: null,
    loading: false,
    error: null
  };

  const tasks = [
    { mode: 'background', prompt: "EXTRACT ONLY THE PURE BACKGROUND SCENE, REMOVE ALL TEXT, LOGOS, AND MAIN SUBJECTS." },
    { mode: 'decor', prompt: "EXTRACT ONLY THE DECORATIVE ELEMENTS AND GRAPHICS. PLACE THEM ON A SOLID PURE WHITE (#FFFFFF) BACKGROUND." },
    { mode: 'text_logo', prompt: "EXTRACT ONLY THE TYPOGRAPHY, TEXT, AND LOGOS. PLACE THEM ON A SOLID PURE WHITE (#FFFFFF) BACKGROUND." }
  ];

  const promises = tasks.map(async (task) => {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: {
        parts: [
          { text: task.prompt },
          { inlineData: { mimeType: "image/png", data } }
        ]
      },
      config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } },
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return { mode: task.mode, data: part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null };
  });

  const layerResults = await Promise.all(promises);
  layerResults.forEach(res => {
    if (res.mode === 'background') results.background = res.data;
    if (res.mode === 'decor') results.decor = res.data ? [res.data] : [];
    if (res.mode === 'text_logo') results.textLayer = res.data;
  });

  return results;
};

// Compatibility export
export const separateDesignComponents = async (
    _p: string, ar: string, sz: string, img: string, mode: string
): Promise<SeparatedAssets> => {
    const res = await separateDesignLayers(img, ar, sz);
    return res;
};

export const regeneratePromptFromPlan = async (
    updatedPlan: DesignPlan,
    originalRequest: ArtDirectionRequest,
    _currentAspectRatio: string,
    currentLayout: LayoutSuggestion | null 
): Promise<ArtDirectionResponse> => {
    // LAZY INITIALIZATION
    const ai = getGeminiClient();
    
    // MAP MODEL THEO CHẾ ĐỘ: Flash -> gemini-1.5-flash, Pro -> gemini-1.5-pro
    // Cập nhật để đảm bảo tính nhất quán khi tái tạo plan
    const finalModelId = originalRequest.analysisModel === AnalysisModel.PRO ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
    
    const prompt = `Synthesize a high-quality creative prompt based on this updated plan: ${JSON.stringify(updatedPlan)}`;

    const response = await ai.models.generateContent({
        model: finalModelId, 
        contents: { parts: [{ text: prompt }] },
        config: {
            systemInstruction: "Senior Art Director. Output JSON. RECOMMENDED ASPECT RATIO MUST BE ONE OF: '1:1', '3:4', '4:3', '9:16', '16:9'.",
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
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
};
