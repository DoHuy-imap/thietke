
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, DesignPlan, LayoutSuggestion, AnalysisModel, SeparatedAssets, QualityLevel, CostBreakdown } from "../types";

// Sử dụng gemini-3-pro-image-preview cho việc tạo ảnh chất lượng cao
const MODEL_IMAGE_GEN = "gemini-3-pro-image-preview"; 
const QUALITY_BOOSTERS = "masterpiece, best quality, highres, 8k resolution, highly detailed, professional photography, cinematic lighting, sharp focus, hdr, smooth texture";
const NEGATIVE_PROMPT = "mockup, frame, wall background, room, interior, photo of a poster, holding poster, person holding, slanted view, perspective distortion, coordinates, numeric values, X=, Y=, percentage symbols, bounding boxes, wireframes, technical labels, blueprint lines, user interface elements, crosshair, crop marks, text overlaying important objects, distorted text, messy layout";

// Helper: Tính toán tỷ lệ khung hình gần nhất được hỗ trợ
export const getClosestAspectRatio = (width: string, height: string): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
  const w = parseFloat(width);
  const h = parseFloat(height);
  if (isNaN(w) || isNaN(h) || h === 0) return "1:1";
  
  const currentRatio = w / h;
  const supportedRatios: { label: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", val: number }[] = [
    { label: "1:1", val: 1.0 },
    { label: "3:4", val: 3/4 },
    { label: "4:3", val: 4/3 },
    { label: "9:16", val: 9/16 },
    { label: "16:9", val: 16/9 }
  ];
  
  return supportedRatios.reduce((prev, curr) => 
    Math.abs(curr.val - currentRatio) < Math.abs(prev.val - currentRatio) ? curr : prev
  ).label;
};

// Helper: Trích xuất base64 an toàn
const safeExtractBase64 = (dataUrl: string | null): string | null => {
  if (!dataUrl) return null;
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : null;
};

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key chưa được cấu hình.");
  }
  return new GoogleGenAI({ apiKey });
};

export const estimateRequestCost = (request: ArtDirectionRequest): CostBreakdown => {
    const rateInputPer1k = request.analysisModel === AnalysisModel.PRO ? 35 : 2; 
    const rateOutputPer1k = request.analysisModel === AnalysisModel.PRO ? 105 : 6; 
    
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
    const estimatedOutputTokens = 1500; 

    const analysisCost = ((totalInputTokens / 1000) * rateInputPer1k) + ((estimatedOutputTokens / 1000) * rateOutputPer1k);

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
  const ai = getGeminiClient();
  const modelId = request.analysisModel === AnalysisModel.PRO ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  const targetRatio = getClosestAspectRatio(request.width, request.height);
  const referenceContext = request.referenceImages.map((ref, idx) => `Reference ${idx + 1} focus: ${ref.attributes.join(', ')}.`);

  let colorInstruction = request.colorMode === ColorMode.BRAND_LOGO 
      ? "EXTRACT AND APPLY COLORS FROM THE PROVIDED LOGO." 
      : (request.colorMode === ColorMode.CUSTOM ? `Color Palette: ${request.customColors.join(', ')}` : 'Auto selection based on style.');

  const parts: any[] = [{ text: `
    STRICT RATIO REQUIREMENT: The aspect ratio MUST be "${targetRatio}" because the requested physical size is ${request.width}x${request.height}cm.
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
      systemInstruction: `You are a Senior Art Director. Create a 6-criteria plan. Return JSON. Coordinates 0-100.
      IMPORTANT: You must use the aspect ratio "${targetRatio}" for both "recommendedAspectRatio" and "layout_suggestion.canvas_ratio".`,
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
  result.recommendedAspectRatio = targetRatio;
  result.layout_suggestion.canvas_ratio = targetRatio;
  result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
  return result;
};

/**
 * Tạo hình ảnh bằng Nano Banana Pro (gemini-3-pro-image-preview)
 */
export const generateDesignImage = async (
  prompt: string, 
  aspectRatio: string, 
  batchSize: number, 
  imageSize: string,
  _assetImages: string[] = [],
  _logoImage: string | null = null,
  layoutMask?: string | null 
): Promise<string[]> => {
  // Yêu cầu AI tạo bản thiết kế phẳng, toàn khung hình, không mockup
  const fullFramePrompt = `${prompt}\n\nSTRICT REQUIREMENT: Generate a CLEAN, FLAT, FULL-FRAME design. NO MOCKUPS. NO BACKGROUND WALLS. NO PHOTOGRAPHIC PERSPECTIVE. THE OUTPUT MUST BE THE DESIGN ITSELF FROM A 90-DEGREE TOP-DOWN VIEW.\n\nSTRICT NEGATIVE PROMPT: ${NEGATIVE_PROMPT}\n\nTARGET ASPECT RATIO: ${aspectRatio}`;

  const parts: any[] = [{ text: fullFramePrompt }];

  if (layoutMask) {
    const maskData = safeExtractBase64(layoutMask);
    if (maskData) parts.push({ text: "SPATIAL LAYOUT MASK:", inlineData: { mimeType: "image/png", data: maskData } });
  }

  // Thực hiện các yêu cầu tạo ảnh
  const promises = Array.from({ length: batchSize }).map(async () => {
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: { parts },
      config: {
         imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any }
      } 
    });
    
    // TRUY XUẤT ẢNH: Lặp qua tất cả các parts để tìm part chứa inlineData (base64)
    if (result.candidates && result.candidates[0].content.parts) {
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    return null;
  });

  const results = await Promise.all(promises);
  const filtered = results.filter((url): url is string => url !== null);
  
  if (filtered.length === 0) {
      throw new Error("Model Nano Banana Pro không trả về dữ liệu hình ảnh. Có thể prompt quá phức tạp hoặc vi phạm chính sách nội dung.");
  }
  return filtered;
};

export const upscaleImageTo4K = async (sourceImageBase64: string, aspectRatio: string): Promise<string> => {
    const ai = getGeminiClient();
    const data = safeExtractBase64(sourceImageBase64);
    if (!data) throw new Error("Ảnh không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts: [
            { text: "GENERATE 4K ULTRA HIGH RESOLUTION VERSION. CLEAN DETAILS. NO NOISE." },
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

export const refineDesignImage = async (
    sourceImageBase64: string,
    instruction: string,
    aspectRatio: string,
    quality: QualityLevel
): Promise<string[]> => {
    const ai = getGeminiClient();
    const data = safeExtractBase64(sourceImageBase64);
    if (!data) throw new Error("Ảnh không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: {
            parts: [
                { text: `Refine this design based on instruction: ${instruction}` },
                { inlineData: { mimeType: "image/png", data } }
            ]
        },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio as any,
                imageSize: quality as any
            }
        },
    });

    const results: string[] = [];
    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                results.push(`data:image/png;base64,${part.inlineData.data}`);
            }
        }
    }
    return results;
};

export const regeneratePromptFromPlan = async (
    updatedPlan: DesignPlan,
    originalRequest: ArtDirectionRequest,
    currentAspectRatio: string,
    _currentLayout: LayoutSuggestion | null 
): Promise<ArtDirectionResponse> => {
    const ai = getGeminiClient();
    const finalModelId = originalRequest.analysisModel === AnalysisModel.PRO ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const prompt = `Synthesize prompt from design plan: ${JSON.stringify(updatedPlan)}. 
    TARGET ASPECT RATIO: ${currentAspectRatio}.`;

    const response = await ai.models.generateContent({
        model: finalModelId,
        contents: { parts: [{ text: prompt }] },
        config: {
            systemInstruction: `Senior Art Director. Output JSON. Aspect ratio MUST be "${currentAspectRatio}".`,
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
    result.recommendedAspectRatio = currentAspectRatio as any;
    result.layout_suggestion.canvas_ratio = currentAspectRatio;
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
};

export const separateDesignComponents = async (
    _p: string, ar: string, sz: string, img: string, _mode: string
): Promise<SeparatedAssets> => {
    return await separateDesignLayers(img, ar, sz);
};
