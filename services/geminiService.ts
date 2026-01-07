
import { GoogleGenAI, Type } from "@google/genai";
import { 
  ArtDirectionRequest, ArtDirectionResponse, ColorOption, DesignPlan, 
  LayoutSuggestion, SeparatedAssets, QualityLevel, CostBreakdown
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

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key chưa được cấu hình.");
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
  const colorInstr = request.colorOption === ColorOption.BRAND_LOGO 
    ? "Analyze the Brand Logo colors and use them as the primary theme." 
    : request.colorOption === ColorOption.CUSTOM ? `Strictly use HEX: ${request.customColors.join(', ')}.` : "AI Custom professional colors.";

  const promptParts: any[] = [{ text: `
    ROLE: SENIOR ART DIRECTOR.
    TASK: CREATE DESIGN BRIEF JSON.
    SPECS: ${request.productType}, ${request.width}x${request.height}cm (${targetRatio}), Headline: "${request.mainHeadline}", Info: "${request.secondaryText}", Style: ${request.visualStyle}.
    COLOR: ${colorInstr}
    STRICT LOGO RULE: If provided, integrate the Brand Logo EXACTLY as is.
  ` }];

  if (request.logoImage) {
    const logoData = extractBase64AndMime(request.logoImage);
    if (logoData) promptParts.push({ inlineData: logoData });
  }

  const response = await ai.models.generateContent({
    model: MODEL_PLANNING,
    contents: { parts: promptParts },
    config: {
      systemInstruction: "You are a professional Art Director. Output JSON format.",
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

export const generateDesignImage = async (prompt: string, aspectRatio: string, batchSize: number, imageSize: string, _assets: string[] = [], _logo: string | null = null, mask?: string | null): Promise<string[]> => {
  const ai = getGeminiClient();
  const fullPrompt = `${prompt}. Professional advertising design. Negative: ${NEGATIVE_PROMPT}`;
  const baseParts: any[] = [{ text: fullPrompt }];
  
  const maskData = extractBase64AndMime(mask);
  if (maskData) { baseParts.push({ text: "Layout guide mask:" }); baseParts.push({ inlineData: maskData }); }

  const logoData = extractBase64AndMime(_logo);
  if (logoData) { baseParts.push({ text: "Use this exact brand logo (preserve identity):" }); baseParts.push({ inlineData: logoData }); }

  _assets.forEach((asset, idx) => {
    const assetData = extractBase64AndMime(asset);
    if (assetData) { baseParts.push({ text: `Subject product asset ${idx + 1}:` }); baseParts.push({ inlineData: assetData }); }
  });

  const promises = Array.from({ length: batchSize }).map(async () => {
    const result = await ai.models.generateContent({
      model: MODEL_PRODUCTION,
      contents: { parts: baseParts },
      config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } } 
    });
    const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
  });

  const urls = (await Promise.all(promises)).filter((u): u is string => u !== null);
  if (urls.length === 0) throw new Error("Production error (400). Please check your prompt and assets.");
  return urls;
};

export const upscaleImageTo4K = async (source: string, ar: string): Promise<string> => {
    const ai = getGeminiClient();
    const sourceData = extractBase64AndMime(source);
    if (!sourceData) throw new Error("Invalid image data.");
    const response = await ai.models.generateContent({
        model: MODEL_PRODUCTION,
        contents: { parts: [{ text: "Upscale and enhance for 4K printing." }, { inlineData: sourceData }]},
        config: { imageConfig: { aspectRatio: ar as any, imageSize: "4K" } },
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (data) return `data:image/png;base64,${data}`;
    throw new Error("Upscale failed.");
};

export const separateDesignComponents = async (_p: string, ar: string, sz: string, img: string): Promise<SeparatedAssets> => {
  const ai = getGeminiClient();
  const sourceData = extractBase64AndMime(img);
  if (!sourceData) throw new Error("Invalid image data.");

  const results: SeparatedAssets = { background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null };
  const tasks = [
    { 
      mode: 'bg', 
      p: "TASK: SEPARATE THE BACKGROUND AND DECORATIONS. Include all environmental effects, atmosphere, particles, glows, and decorative background details. REMOVE ONLY text content, typography, and brand logos. The output should be the full visual scene without any words or branding." 
    },
    { 
      mode: 'txt', 
      p: "TASK: SEPARATE THE TEXT AND LOGO LAYER. Include the Brand Logo, Main Headline text, secondary copy, and all call-to-action elements. PLACE THESE ELEMENTS ON A SOLID, PURE WHITE BACKGROUND. Remove all background imagery and environmental effects." 
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
        contents: { parts: [{ text: `Eraser tool task: ${instr || 'Clean removal and background reconstruction.'}` }, { inlineData: sourceData }, { inlineData: maskData }]}
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return data ? `data:image/png;base64,${data}` : null;
};

export const regeneratePromptFromPlan = async (plan: DesignPlan, req: ArtDirectionRequest, ar: string, lay: any): Promise<ArtDirectionResponse> => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: MODEL_PLANNING,
        contents: { parts: [{ text: `Optimize design prompt for: ${JSON.stringify(plan)}` }] },
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

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
  let prompt = LAYOUT_TAG;
  layout.elements.forEach(el => {
    prompt += `- ${el.name} (${el.type}): x:${Math.round(el.rect.x)}%, y:${Math.round(el.rect.y)}%, w:${Math.round(el.rect.width)}%, h:${Math.round(el.rect.height)}%\n`;
  });
  return prompt;
};
