
import { GoogleGenAI, Type } from "@google/genai";
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, DesignPlan, LayoutSuggestion, AnalysisModel, SeparatedAssets } from "../types";

const MODEL_IMAGE_GEN = "gemini-3-pro-image-preview"; 
const QUALITY_BOOSTERS = "masterpiece, best quality, highres, 8k resolution, highly detailed, professional photography, cinematic lighting, sharp focus, hdr, smooth texture";
const NEGATIVE_PROMPT = "coordinates, numeric values, X=, Y=, percentage symbols, bounding boxes, wireframes, technical labels, blueprint lines, user interface elements, crosshair, crop marks, text overlaying important objects, distorted text, messy layout";

const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API Key chưa được kết nối. Vui lòng nhấn vào tên người dùng và chọn 'Kết nối lại API Key'.");
  }
  return new GoogleGenAI({ apiKey });
};

const getAnalysisModelId = (model: AnalysisModel) => model === AnalysisModel.PRO ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

const safeExtractBase64 = (dataUrl: string | null): string | null => {
  if (!dataUrl) return null;
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : null;
};

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
  const elementsDesc = layout.elements.map(el => 
    `- ${el.name} (${el.type}): x=${el.rect.x.toFixed(1)}%, y=${el.rect.y.toFixed(1)}%, width=${el.rect.width.toFixed(1)}%, height=${el.rect.height.toFixed(1)}%`
  ).join('\n');
  return `\n\n### SPATIAL LAYOUT ###\nPosition these elements strictly according to the provided mask and coordinates:\n${elementsDesc}`;
};

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  const ai = getAi();
  const modelId = getAnalysisModelId(request.analysisModel);

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
      parts.push({ text: "TYPOGRAPHY STYLE REFERENCE FOR MAIN TITLE (Use this font style/effect):" });
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
      systemInstruction: "You are a Senior Art Director. Create a 6-criteria plan. Split 'Secondary Content' by newline into unique text blocks. If a TYPOGRAPHY STYLE REFERENCE is provided, apply its style to the Main Title. Return JSON. Logo should be an overlay. Coordinates are percentages 0-100.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          designPlan: { type: Type.OBJECT, properties: { subject: {type: Type.STRING}, styleContext: {type: Type.STRING}, composition: {type: Type.STRING}, colorLighting: {type: Type.STRING}, decorElements: {type: Type.STRING}, typography: {type: Type.STRING} }, required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] },
          layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
          analysis: { type: Type.STRING },
          final_prompt: { type: Type.STRING },
          recommendedAspectRatio: { type: Type.STRING },
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
  const ai = getAi();
  const parts: any[] = [{ text: `${prompt}\n\nSTRICT NEGATIVE PROMPT: ${NEGATIVE_PROMPT}` }];

  if (layoutMask) {
    const maskData = safeExtractBase64(layoutMask);
    if (maskData) {
      parts.push({ text: "SPATIAL LAYOUT MASK (STRICTLY FOLLOW THIS COMPOSITION):" });
      parts.push({ inlineData: { mimeType: "image/png", data: maskData } });
    }
  }

  if (logoImage) {
    const data = safeExtractBase64(logoImage);
    if (data) {
      parts.push({ text: "BRAND LOGO (NO BACKGROUND OVERLAY):" });
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

export const refineDesignImage = async (sourceImageBase64: string, instruction: string, aspectRatio: string, imageSize: string): Promise<string[]> => {
  const ai = getAi();
  const data = safeExtractBase64(sourceImageBase64);
  if (!data) throw new Error("Ảnh không hợp lệ");

  const response = await ai.models.generateContent({
    model: MODEL_IMAGE_GEN,
    contents: {
      parts: [
        { text: `Refine and improve this design based on: ${instruction}` },
        { inlineData: { mimeType: "image/png", data } }
      ]
    },
    config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } },
  });
  
  const urls: string[] = [];
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) urls.push(`data:image/png;base64,${part.inlineData.data}`);
  }
  return urls;
};

export const upscaleImageTo4K = async (sourceImageBase64: string, aspectRatio: string): Promise<string> => {
    const ai = getAi();
    const data = safeExtractBase64(sourceImageBase64);
    if (!data) throw new Error("Ảnh không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: {
            parts: [
                { text: "GENERATE 4K ULTRA HIGH RESOLUTION VERSION. MAXIMIZE SHARPNESS." },
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
    const ai = getAi();
    const originalData = safeExtractBase64(originalImageBase64);
    const maskData = safeExtractBase64(maskImageBase64);
    if (!originalData || !maskData) throw new Error("Dữ liệu không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: {
            parts: [
                { text: `Eraser task: ${textInstruction || 'Remove the object covered by the white mask'}` },
                { inlineData: { mimeType: "image/png", data: originalData } },
                { inlineData: { mimeType: "image/png", data: maskData } }
            ]
        }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};

export const regeneratePromptFromPlan = async (
    updatedPlan: DesignPlan,
    originalRequest: ArtDirectionRequest,
    _currentAspectRatio: string,
    currentLayout: LayoutSuggestion | null 
): Promise<ArtDirectionResponse> => {
    const ai = getAi();
    const modelId = getAnalysisModelId(originalRequest.analysisModel);
    const prompt = `Synthesize a high-quality creative prompt based on this updated plan: ${JSON.stringify(updatedPlan)}`;

    const response = await ai.models.generateContent({
        model: modelId, 
        contents: { parts: [{ text: prompt }] },
        config: {
            systemInstruction: "Senior Art Director & Prompt Engineer. Output JSON format.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    designPlan: { type: Type.OBJECT, properties: { subject: {type: Type.STRING}, styleContext: {type: Type.STRING}, composition: {type: Type.STRING}, colorLighting: {type: Type.STRING}, decorElements: {type: Type.STRING}, typography: {type: Type.STRING} }, required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] },
                    layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
                    analysis: { type: Type.STRING },
                    final_prompt: { type: Type.STRING },
                    recommendedAspectRatio: { type: Type.STRING },
                },
                required: ["designPlan", "layout_suggestion", "analysis", "final_prompt", "recommendedAspectRatio"],
            },
        },
    });

    const result = JSON.parse(response.text) as ArtDirectionResponse;
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
};

export const separateDesignComponents = async (
  _prompt: string,
  aspectRatio: string,
  imageSize: string,
  sourceImageBase64: string,
  mode: 'full' | 'background'
): Promise<Partial<SeparatedAssets>> => {
  const ai = getAi();
  const data = safeExtractBase64(sourceImageBase64);
  if (!data) throw new Error("Ảnh không hợp lệ");

  const instruction = mode === 'background' ? "EXTRACT ONLY THE BACKGROUND, REMOVE ALL SUBJECTS AND LOGOS." : "EXTRACT ONLY THE MAIN SUBJECTS, REMOVE BACKGROUND.";

  const response = await ai.models.generateContent({
    model: MODEL_IMAGE_GEN,
    contents: {
      parts: [
        { text: instruction },
        { inlineData: { mimeType: "image/png", data } }
      ]
    },
    config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } },
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  const resultImage = part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;

  return mode === 'background' ? { background: resultImage } : { subjects: resultImage ? [resultImage] : [] };
};
