
import { GoogleGenAI, Type } from "@google/genai";
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, DesignPlan, LayoutSuggestion, AnalysisModel, SeparatedAssets } from "../types";

// --- CẤU HÌNH MÔ HÌNH ---
const MODEL_IMAGE_GEN = "gemini-3-pro-image-preview"; 

// --- CÁC CÂU LỆNH BỔ TRỢ CHẤT LƯỢNG ---
const QUALITY_BOOSTERS = "masterpiece, best quality, highres, 8k resolution, highly detailed, professional photography, cinematic lighting, sharp focus, hdr, smooth texture";

const NEGATIVE_PROMPT = "coordinates, numeric values, X=, Y=, percentage symbols, bounding boxes, wireframes, technical labels, blueprint lines, user interface elements, crosshair, crop marks, text overlaying important objects, distorted text, messy layout";

const SYSTEM_INSTRUCTION = `
You are a professional "AI Art Director".
**TASK:** Analyze the request and return a JSON structure containing a Design Plan (Keywords) and a Spatial Layout.

### ⚠️ COST OPTIMIZATION MODE (STRICT):
1.  **OUTPUT FORMAT:** For the 'designPlan' (Vietnamese), use **KEYWORDS** and **SHORT PHRASES** only.
2.  **NO SENTENCES:** Do NOT write full sentences.
3.  **SEPARATOR:** Use commas.

### SPATIAL LAYOUT GENERATION (JSON):
You must generate a 'layout_suggestion' containing bounding boxes (0-100 scale).
- **Elements:** Boxes for 'Main Subject', 'Headline Text', 'Secondary Text', 'Logo', 'Decor'.

### OUTPUT FORMAT (JSON)
Return a JSON object with:
1.  "designPlan": Object containing 6 Vietnamese keyword strings.
2.  "layout_suggestion": JSON object with 'canvas_ratio' and 'elements'.
3.  "analysis": Extremely brief summary (max 10 words).
4.  "final_prompt": The optimized English prompt.
5.  "recommendedAspectRatio": The best ratio.
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    designPlan: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        styleContext: { type: Type.STRING },
        composition: { type: Type.STRING },
        colorLighting: { type: Type.STRING },
        decorElements: { type: Type.STRING },
        typography: { type: Type.STRING }
      },
      required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"]
    },
    layout_suggestion: {
      type: Type.OBJECT,
      properties: {
        canvas_ratio: { type: Type.STRING },
        elements: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["subject", "text", "decor", "logo"] },
              color: { type: Type.STRING },
              rect: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER }
                },
                required: ["x", "y", "width", "height"]
              }
            },
            required: ["name", "type", "color", "rect"]
          }
        }
      },
      required: ["canvas_ratio", "elements"]
    },
    analysis: { type: Type.STRING },
    final_prompt: { type: Type.STRING },
    recommendedAspectRatio: { type: Type.STRING, enum: ["1:1", "3:4", "4:3", "9:16", "16:9"] },
  },
  required: ["designPlan", "layout_suggestion", "analysis", "final_prompt", "recommendedAspectRatio"],
};

/**
 * Hàm khởi tạo đối tượng AI an toàn. 
 * Đảm bảo chỉ được gọi BÊN TRONG các hàm chức năng.
 */
const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API Key chưa được thiết lập. Vui lòng kết nối API Key bằng cách nhấn nút 'Kết nối API Key' trong Studio hoặc đăng nhập lại.");
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
  return `\n\n### LAYOUT ###\nUse the following spatial composition as a guide (do not render coordinates):\n${elementsDesc}`;
};

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  // Khởi tạo trễ
  const ai = getAiInstance();
  const modelId = getAnalysisModelId(request.analysisModel);

  try {
    const parts: any[] = [];
    const mainHeadlinesFormatted = Array.isArray(request.mainHeadline) 
        ? request.mainHeadline.filter(h => h.trim() !== '').join(' | ') 
        : request.mainHeadline;
        
    const secondaryTextFormatted = Array.isArray(request.secondaryText)
        ? request.secondaryText.filter(t => t.trim() !== '').join(' | ')
        : request.secondaryText;

    let colorInstruction = request.colorMode === ColorMode.BRAND_LOGO 
        ? "STRICTLY USE COLORS EXTRACTED FROM BRAND LOGO." 
        : (request.colorMode === ColorMode.CUSTOM ? `Palette: ${request.customColors.join(', ')}` : 'Auto');

    let promptText = `
      Type: ${request.productType} (${request.width}x${request.height}cm)
      Headline: "${mainHeadlinesFormatted}"
      Sub-content: "${secondaryTextFormatted}"
      Logo: ${request.logoImage ? "Yes" : "No"}
      Style: ${request.visualStyle}
      Color: ${colorInstruction}
      Layout Requirements: ${request.layoutRequirements}
    `;

    parts.push({ text: promptText });
    
    // Đính kèm hình ảnh
    const logoData = safeExtractBase64(request.logoImage);
    if (logoData) parts.push({ inlineData: { mimeType: "image/png", data: logoData } });
    
    request.assetImages.forEach(img => {
      const data = safeExtractBase64(img);
      if (data) parts.push({ inlineData: { mimeType: "image/png", data } });
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("AI không phản hồi. Thử lại sau.");
    
    const result = JSON.parse(text) as ArtDirectionResponse;
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
  } catch (error: any) {
    console.error("[Gemini] Error:", error);
    throw error;
  }
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
  const ai = getAiInstance();
  
  try {
    const fullPrompt = `${prompt}\n\nSTRICT NEGATIVE: ${NEGATIVE_PROMPT}`;
    const parts: any[] = [{ text: fullPrompt }];

    if (layoutMask) {
      const maskData = safeExtractBase64(layoutMask);
      if (maskData) parts.push({ inlineData: { mimeType: "image/png", data: maskData } });
    }

    if (logoImage) {
      const data = safeExtractBase64(logoImage);
      if (data) parts.push({ inlineData: { mimeType: "image/png", data } });
    }

    assetImages.forEach(img => {
      const data = safeExtractBase64(img);
      if (data) parts.push({ inlineData: { mimeType: "image/png", data } });
    });
    
    const promises = Array.from({ length: batchSize }).map(async () => {
      const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
    });

    const results = await Promise.all(promises);
    return results.filter((url): url is string => url !== null);
  } catch (error) {
    throw error;
  }
};

export const refineDesignImage = async (sourceImageBase64: string, instruction: string, aspectRatio: string, imageSize: string): Promise<string[]> => {
  const ai = getAiInstance();
  const data = safeExtractBase64(sourceImageBase64);
  if (!data) throw new Error("Ảnh không hợp lệ");

  const response = await ai.models.generateContent({
    model: MODEL_IMAGE_GEN,
    contents: {
      parts: [
        { text: `Edit: ${instruction}` },
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
    const ai = getAiInstance();
    const data = safeExtractBase64(sourceImageBase64);
    if (!data) throw new Error("Ảnh không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: {
            parts: [
                { text: "UPSCALER 4K: Preserve original details exactly." },
                { inlineData: { mimeType: "image/png", data } }
            ]
        },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: "4K" } },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Nâng cấp thất bại");
};

export const removeObjectWithMask = async (originalImageBase64: string, maskImageBase64: string, textInstruction?: string): Promise<string | null> => {
    const ai = getAiInstance();
    const originalData = safeExtractBase64(originalImageBase64);
    const maskData = safeExtractBase64(maskImageBase64);
    if (!originalData || !maskData) throw new Error("Dữ liệu ảnh/mask không hợp lệ");

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: {
            parts: [
                { text: `Inpaint: ${textInstruction || 'Remove object'}` },
                { inlineData: { mimeType: "image/png", data: originalData } },
                { inlineData: { mimeType: "image/png", data: maskData } }
            ]
        }
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
};

export const regeneratePromptFromPlan = async (
    updatedPlan: DesignPlan,
    originalRequest: ArtDirectionRequest,
    _currentAspectRatio: string,
    currentLayout: LayoutSuggestion | null 
): Promise<ArtDirectionResponse> => {
    const ai = getAiInstance();
    const modelId = getAnalysisModelId(originalRequest.analysisModel);

    const prompt = `Synthesize Design Plan into professional English prompt. PLAN: ${JSON.stringify(updatedPlan)}. LAYOUT: ${currentLayout ? 'Active' : 'N/A'}`;

    const response = await ai.models.generateContent({
        model: modelId, 
        contents: { parts: [{ text: prompt }] },
        config: {
            systemInstruction: "You are a professional prompt engineer.",
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
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
  const ai = getAiInstance();
  const data = safeExtractBase64(sourceImageBase64);
  if (!data) throw new Error("Ảnh không hợp lệ");

  const instruction = mode === 'background' ? "EXTRACT BACKGROUND ONLY." : "EXTRACT SUBJECTS ONLY.";

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

  let resultImage: string | null = null;
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      resultImage = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  return mode === 'background' ? { background: resultImage } : { subjects: resultImage ? [resultImage] : [] };
};
