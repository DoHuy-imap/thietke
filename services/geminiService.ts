
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, DesignPlan, LayoutSuggestion, AnalysisModel, SeparatedAssets, QualityLevel, CostBreakdown } from "../types";

// Using gemini-3-pro-image-preview for high-quality image generation as per guidelines
const MODEL_IMAGE_GEN = "gemini-3-pro-image-preview"; 
const QUALITY_BOOSTERS = "masterpiece, best quality, highres, 8k resolution, highly detailed, professional photography, cinematic lighting, sharp focus, hdr, smooth texture";
const NEGATIVE_PROMPT = "coordinates, numeric values, X=, Y=, percentage symbols, bounding boxes, wireframes, technical labels, blueprint lines, user interface elements, crosshair, crop marks, text overlaying important objects, distorted text, messy layout";

// Helper: Safe extract base64
const safeExtractBase64 = (dataUrl: string | null): string | null => {
  if (!dataUrl) return null;
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : null;
};

// Always create a new instance right before making an API call to ensure latest API key
const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key chưa được cấu hình.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Ước tính chi phí chi tiết dựa trên token và số lượng ảnh.
 */
export const estimateRequestCost = (request: ArtDirectionRequest): CostBreakdown => {
    // 1. Phân tích (Analysis Phase)
    const rateInputPer1k = request.analysisModel === AnalysisModel.PRO ? 35 : 2; // VND
    const rateOutputPer1k = request.analysisModel === AnalysisModel.PRO ? 105 : 6; // VND
    
    // Estimate Input Tokens
    const textChars = (request.mainHeadline + request.secondaryText + request.layoutRequirements + request.fontPreferences).length;
    const textTokens = Math.ceil(textChars / 4);
    
    let imageInputCount = 0;
    if (request.mainHeadlineImage) imageInputCount++;
    if (request.logoImage) imageInputCount++;
    imageInputCount += request.assetImages.length;
    imageInputCount += request.referenceImages.length;
    
    const imageInputTokens = imageInputCount * 258;
    const systemInstructionTokens = 1000;
    const totalInputTokens = textTokens + imageInputTokens + systemInstructionTokens;
    
    // Output tokens (thường plan trả về 1000-1500 tokens)
    const estimatedOutputTokens = 1500; 

    const analysisCost = ((totalInputTokens / 1000) * rateInputPer1k) + ((estimatedOutputTokens / 1000) * rateOutputPer1k);

    // 2. Sản xuất (Production Phase - Image Generation)
    // Giá tham khảo: 1K ~ 500đ, 2K ~ 1200đ, 4K ~ 2500đ mỗi ảnh
    let pricePerImage = 500;
    if (request.quality === QualityLevel.MEDIUM) pricePerImage = 1200;
    if (request.quality === QualityLevel.HIGH) pricePerImage = 2500;
    
    const productionCost = request.batchSize * pricePerImage;

    return {
        analysisInputTokens: totalInputTokens,
        analysisOutputTokens: estimatedOutputTokens,
        analysisCostVND: Math.round(analysisCost),
        generationImageCount: request.batchSize,
        generationCostVND: productionCost,
        totalCostVND: Math.round(analysisCost + productionCost)
    };
};

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
  const elementsDesc = layout.elements.map(el => 
    `- ${el.name} (${el.type}): x=${el.rect.x.toFixed(1)}%, y=${el.rect.y.toFixed(1)}%, width=${el.rect.width.toFixed(1)}%, height=${el.rect.height.toFixed(1)}%`
  ).join('\n');
  return `\n\n### SPATIAL LAYOUT ###\nPosition these elements strictly according to the provided mask and coordinates:\n${elementsDesc}`;
};

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  // Create a new instance right before use
  const ai = getGeminiClient();
  const modelId = request.analysisModel === AnalysisModel.PRO ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  const referenceContext = request.referenceImages.map((ref, idx) => `Reference ${idx + 1} focus: ${ref.attributes.join(', ')}.`);

  let colorInstruction = request.colorMode === ColorMode.BRAND_LOGO 
      ? "EXTRACT AND APPLY COLORS FROM THE PROVIDED LOGO." 
      : (request.colorMode === ColorMode.CUSTOM ? `Color Palette: ${request.customColors.join(', ')}` : 'Auto selection based on style.');

  const parts: any[] = [{ text: `
    Project Type: ${request.productType}
    Main Title: "${request.mainHeadline}"
    Secondary Content: "${request.secondaryText}"
    Visual Style: ${request.visualStyle}
    Colors: ${colorInstruction}
    Font Prefs: ${request.fontPreferences}
    Creative Context: ${referenceContext}
    Asset Mode: ${request.productImageMode}
  ` }];
  
  if (request.mainHeadlineImage) {
    const data = safeExtractBase64(request.mainHeadlineImage);
    if (data) parts.push({ text: "TYPOGRAPHY STYLE REFERENCE:", inlineData: { mimeType: "image/png", data } });
  }

  if (request.logoImage) {
    const data = safeExtractBase64(request.logoImage);
    if (data) parts.push({ text: "BRAND LOGO:", inlineData: { mimeType: "image/png", data } });
  }
  
  request.assetImages.forEach((img, idx) => {
    const data = safeExtractBase64(img);
    if (data) parts.push({ text: `PRODUCT ASSET ${idx + 1}:`, inlineData: { mimeType: "image/png", data } });
  });

  const response = await ai.models.generateContent({
    model: modelId,
    contents: { parts },
    config: {
      systemInstruction: "You are a Senior Art Director. Create a 6-criteria plan. Return JSON. Coordinates 0-100.",
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

  // Extract text property directly as per guidelines
  const text = response.text;
  if (!text) throw new Error("No response text");
  const result = JSON.parse(text) as ArtDirectionResponse;
  result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
  return result;
};

export const generateDesignImage = async (
  prompt: string, 
  aspectRatio: string, 
  batchSize: number, 
  imageSize: string,
  _assetImages: string[] = [],
  _logoImage: string | null = null,
  layoutMask?: string | null 
): Promise<string[]> => {
  const parts: any[] = [{ text: `${prompt}\n\nSTRICT NEGATIVE PROMPT: ${NEGATIVE_PROMPT}\n\nTARGET ASPECT RATIO: ${aspectRatio}` }];

  if (layoutMask) {
    const maskData = safeExtractBase64(layoutMask);
    if (maskData) parts.push({ text: "SPATIAL LAYOUT MASK:", inlineData: { mimeType: "image/png", data: maskData } });
  }

  const promises = Array.from({ length: batchSize }).map(async () => {
    // Create fresh client for each parallel call to ensure correct key usage
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: { parts },
      config: {
         // Use imageConfig for nano banana series models
         imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any }
      } 
    });
    
    // Iterate through all parts to find the image part, as per guidelines
    if (result.candidates && result.candidates[0].content.parts) {
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    return null;
  });

  const results = await Promise.all(promises);
  return results.filter((url): url is string => url !== null);
};

export const upscaleImageTo4K = async (sourceImageBase64: string, aspectRatio: string): Promise<string> => {
    const ai = getGeminiClient();
    const data = safeExtractBase64(sourceImageBase64);
    if (!data) throw new Error("Ảnh không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts: [
            { text: "GENERATE 4K ULTRA HIGH RESOLUTION VERSION." },
            { inlineData: { mimeType: "image/png", data } }
        ]},
        config: {
            imageConfig: { aspectRatio: aspectRatio as any, imageSize: "4K" }
        },
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    throw new Error("Nâng cấp thất bại");
};

export const separateDesignLayers = async (
  sourceImageBase64: string,
  aspectRatio: string,
  imageSize: string
): Promise<SeparatedAssets> => {
  const data = safeExtractBase64(sourceImageBase64);
  if (!data) throw new Error("Ảnh không hợp lệ");

  const results: SeparatedAssets = { background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null };
  const tasks = [
    { mode: 'background', prompt: "EXTRACT ONLY THE PURE BACKGROUND SCENE." },
    { mode: 'text_logo', prompt: "EXTRACT ONLY THE TYPOGRAPHY AND LOGOS." }
  ];

  const promises = tasks.map(async (task) => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: { parts: [{ text: task.prompt }, { inlineData: { mimeType: "image/png", data } }]},
      config: { 
         imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any }
      },
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return { mode: task.mode, data: part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null };
  });

  const layerResults = await Promise.all(promises);
  layerResults.forEach(res => {
    if (res.mode === 'background') results.background = res.data;
    if (res.mode === 'text_logo') results.textLayer = res.data;
  });

  return results;
};

export const removeObjectWithMask = async (originalImageBase64: string, maskImageBase64: string, textInstruction?: string): Promise<string | null> => {
    const ai = getGeminiClient();
    const originalData = safeExtractBase64(originalImageBase64);
    const maskData = safeExtractBase64(maskImageBase64);
    if (!originalData || !maskData) throw new Error("Dữ liệu không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts: [
            { text: `AI Eraser Tool: ${textInstruction || 'Seamlessly remove the object'}` },
            { inlineData: { mimeType: "image/png", data: originalData } },
            { inlineData: { mimeType: "image/png", data: maskData } }
        ]}
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};

export const regeneratePromptFromPlan = async (
    updatedPlan: DesignPlan,
    originalRequest: ArtDirectionRequest,
    _currentAspectRatio: string,
    _currentLayout: LayoutSuggestion | null 
): Promise<ArtDirectionResponse> => {
    const ai = getGeminiClient();
    const finalModelId = originalRequest.analysisModel === AnalysisModel.PRO ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const prompt = `Synthesize prompt from design plan: ${JSON.stringify(updatedPlan)}`;

    const response = await ai.models.generateContent({
        model: finalModelId,
        contents: { parts: [{ text: prompt }] },
        config: {
            systemInstruction: "Senior Art Director. Output JSON.",
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

    const text = response.text;
    if (!text) throw new Error("No response text");
    const result = JSON.parse(text) as ArtDirectionResponse;
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
};

export const separateDesignComponents = async (
    _p: string, ar: string, sz: string, img: string, _mode: string
): Promise<SeparatedAssets> => {
    return await separateDesignLayers(img, ar, sz);
};
