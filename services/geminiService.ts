
import { GoogleGenAI, Type } from "@google/genai";
import { 
  ArtDirectionRequest, ArtDirectionResponse, ColorOption, DesignPlan, 
  LayoutSuggestion, SeparatedAssets, QualityLevel, CostBreakdown,
  ReferenceAttribute 
} from "../types";

// Sử dụng model Pro duy nhất cho việc lập kế hoạch vì đây là "Art Director" tốt nhất
const MODEL_PLANNING = "gemini-3-pro-preview";
const MODEL_PRODUCTION = "gemini-3-pro-image-preview";

const QUALITY_BOOSTERS = "professional commercial graphic design, advertising award winning style, high fidelity, vector quality sharp text, premium product photography lighting, 8k resolution, clean sharp edges";
const NEGATIVE_PROMPT = "blurry, low quality, messy composition, distorted logo, text errors, watermark, signature, lowres, grainy, frame, slanted, perspective mockup, extra limbs, bad anatomy, noisy background";

export const LAYOUT_TAG = "\n\n### DESIGN LAYOUT ###\n";

export const estimateRequestCost = (request: ArtDirectionRequest): CostBreakdown => {
    const baseCost = 25; // Pro planning cost
    const productionCost = request.batchSize * (request.quality === QualityLevel.HIGH ? 25 : 12);

    return {
        analysisInputTokens: 0,
        analysisOutputTokens: 0,
        analysisCostVND: baseCost,
        generationImageCount: request.batchSize,
        generationCostVND: productionCost,
        totalCostVND: baseCost + productionCost
    };
};

export const getClosestAspectRatio = (width: string, height: string): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
  const w = parseFloat(width);
  const h = parseFloat(height);
  if (isNaN(w) || isNaN(h) || h === 0) return "1:1";
  
  const currentRatio = w / h;
  const supportedRatios: { label: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", val: number }[] = [
    { label: "1:1", val: 1.0 },
    { label: "3:4", val: 0.75 },
    { label: "4:3", val: 1.3333 },
    { label: "9:16", val: 0.5625 },
    { label: "16:9", val: 1.7777 }
  ];
  
  return supportedRatios.reduce((prev, curr) => 
    Math.abs(curr.val - currentRatio) < Math.abs(prev.val - currentRatio) ? curr : prev
  ).label;
};

/**
 * Helper to extract base64 data and mimeType from a Data URL
 */
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

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  const ai = getGeminiClient();
  const targetRatio = getClosestAspectRatio(request.width, request.height);
  
  const refInstructions = request.referenceImages.map((ref, idx) => {
    return `Reference Image ${idx + 1} Attributes to inherit: ${ref.attributes.join(', ')}. Use only these selected parts.`;
  }).join('\n');

  const colorInstr = request.colorOption === ColorOption.BRAND_LOGO 
    ? "Analyze the Brand Logo colors and use them as the primary theme for the entire design." 
    : request.colorOption === ColorOption.CUSTOM 
    ? `Strictly use this HEX color palette: ${request.customColors.join(', ')}.`
    : "AI Custom: Choose professional advertising colors that harmonize with the subject.";

  const promptParts: any[] = [{ text: `
    ROLE: YOU ARE A WORLD-CLASS SENIOR ART DIRECTOR.
    
    TASK: CREATE A COMPREHENSIVE DESIGN BRIEF FOR AN IMAGE GENERATION ENGINE.
    
    SPECIFICATIONS:
    - Target Output: ${request.productType}
    - Dimensions: ${request.width}cm x ${request.height}cm (Aspect Ratio: ${targetRatio})
    - Main Headline: "${request.mainHeadline}" (Must be large, impactful, and properly integrated)
    - Supporting Info: "${request.secondaryText}"
    - Visual Style: ${request.visualStyle}
    - Layout Strategy: ${request.layoutRequirements}
    
    REFERENCE INHERITANCE:
    ${refInstructions}
    
    COLOR STRATEGY:
    ${colorInstr}

    STRICT ASSET RULES:
    1. BRAND LOGO (CRITICAL): If provided, the Brand Logo image MUST be integrated into the final design exactly as it appears. Simply remove the background of the logo and place it according to the layout. DO NOT ALTER ITS DESIGN, FONT, OR CORE ELEMENTS.
    2. PRODUCT ASSETS: Use provided visual content images as the main subject of the design.
    
    OUTPUT: Provide a JSON Design Plan, a 0-100 coordinate Layout Suggestion, and a MASTER PROMPT for generation.
  ` }];

  const logoData = extractBase64AndMime(request.logoImage);
  if (logoData) {
    promptParts.push({ inlineData: logoData });
  }
  
  request.assetImages.forEach(img => {
    const assetData = extractBase64AndMime(img);
    if (assetData) {
      promptParts.push({ inlineData: assetData });
    }
  });

  request.referenceImages.forEach(ref => {
    const refData = extractBase64AndMime(ref.image);
    if (refData) {
      promptParts.push({ inlineData: refData });
    }
  });

  const response = await ai.models.generateContent({
    model: MODEL_PLANNING,
    contents: { parts: promptParts },
    config: {
      systemInstruction: "You are a professional Art Director. Generate advertising design plans in JSON format using a 0-100 grid for elements.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          designPlan: { 
            type: Type.OBJECT, 
            properties: { 
              subject: {type: Type.STRING}, 
              styleContext: {type: Type.STRING}, 
              composition: {type: Type.STRING}, 
              colorLighting: {type: Type.STRING}, 
              decorElements: {type: Type.STRING}, 
              typography: {type: Type.STRING} 
            }, 
            required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] 
          },
          layout_suggestion: { 
            type: Type.OBJECT, 
            properties: { 
              canvas_ratio: {type: Type.STRING}, 
              elements: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { 
                    id: {type: Type.STRING}, 
                    name: {type: Type.STRING}, 
                    type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, 
                    color: {type: Type.STRING}, 
                    rect: { 
                      type: Type.OBJECT, 
                      properties: { 
                        x: {type: Type.NUMBER}, 
                        y: {type: Type.NUMBER}, 
                        width: {type: Type.NUMBER}, 
                        height: {type: Type.NUMBER} 
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
      }
    }
  });

  const result = JSON.parse(response.text) as ArtDirectionResponse;
  result.recommendedAspectRatio = targetRatio;
  result.final_prompt = `${result.final_prompt}${convertLayoutToPrompt(result.layout_suggestion)}, ${QUALITY_BOOSTERS}`;
  return result;
};

export const generateDesignImage = async (
  prompt: string, 
  aspectRatio: string, 
  batchSize: number, 
  imageSize: string,
  _assets: string[] = [],
  _logo: string | null = null,
  mask?: string | null 
): Promise<string[]> => {
  const ai = getGeminiClient();
  const cleanPrompt = prompt.replace(/[\n\r]/g, ' ').replace(/"/g, "'").trim();
  const fullPrompt = `${cleanPrompt}. Professional commercial advertising design. Negative: ${NEGATIVE_PROMPT}`;
  
  const baseParts: any[] = [{ text: fullPrompt }];
  
  const maskData = extractBase64AndMime(mask);
  if (maskData) {
    baseParts.push({ text: "Layout guide mask:" });
    baseParts.push({ inlineData: maskData });
  }

  const logoData = extractBase64AndMime(_logo);
  if (logoData) {
    baseParts.push({ text: "Use this exact brand logo (preserve identity, remove background):" });
    baseParts.push({ inlineData: logoData });
  }

  _assets.forEach((asset, idx) => {
    const assetData = extractBase64AndMime(asset);
    if (assetData) {
      baseParts.push({ text: `Subject product asset ${idx + 1}:` });
      baseParts.push({ inlineData: assetData });
    }
  });

  const promises = Array.from({ length: batchSize }).map(async () => {
    const result = await ai.models.generateContent({
      model: MODEL_PRODUCTION,
      contents: { parts: baseParts },
      config: { 
        imageConfig: { 
          aspectRatio: aspectRatio as any, 
          imageSize: imageSize as any 
        } 
      } 
    });
    
    const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
  });

  const urls = (await Promise.all(promises)).filter((u): u is string => u !== null);
  if (urls.length === 0) throw new Error("Hệ thống sản xuất hình ảnh đang bận hoặc gặp lỗi (400). Hãy thử lại.");
  return urls;
};

export const upscaleImageTo4K = async (source: string, ar: string): Promise<string> => {
    const ai = getGeminiClient();
    const sourceData = extractBase64AndMime(source);
    if (!sourceData) throw new Error("Invalid source image data.");

    const response = await ai.models.generateContent({
        model: MODEL_PRODUCTION,
        contents: { parts: [{ text: "Upscale and enhance this graphic design for 4K printing, keeping text sharp." }, { inlineData: sourceData }]},
        config: { imageConfig: { aspectRatio: ar as any, imageSize: "4K" } },
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (data) return `data:image/png;base64,${data}`;
    throw new Error("Nâng cấp 4K thất bại.");
};

export const separateDesignComponents = async (_p: string, ar: string, sz: string, img: string): Promise<SeparatedAssets> => {
  const ai = getGeminiClient();
  const sourceData = extractBase64AndMime(img);
  if (!sourceData) throw new Error("Invalid image data.");

  const results: SeparatedAssets = { background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null };
  const tasks = [
    { 
      mode: 'bg', 
      p: "Separate only the Background Layer. Include all environmental effects, atmosphere, lighting, and decorative background elements. Remove the main product subject and all text. Output a clean background asset." 
    },
    { 
      mode: 'txt', 
      p: "Separate only the Object Layer. Include the Brand Logo, Main Headline text, and all supporting content. PLACE THESE ELEMENTS ON A SOLID PURE WHITE BACKGROUND. Remove the background imagery and environmental effects." 
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
        contents: { parts: [
            { text: `Eraser tool: ${instr || 'Clean removal of the masked area. Reconstruct the background realistically.'}` },
            { inlineData: sourceData },
            { inlineData: maskData }
        ]}
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return data ? `data:image/png;base64,${data}` : null;
};

export const refineDesignImage = async (source: string, instr: string, ar: string, q: QualityLevel): Promise<string[]> => {
    const ai = getGeminiClient();
    const sourceData = extractBase64AndMime(source);
    if (!sourceData) return [];

    const response = await ai.models.generateContent({
        model: MODEL_PRODUCTION,
        contents: { parts: [{ text: `Modify design: ${instr}` }, { inlineData: sourceData }]},
        config: { imageConfig: { aspectRatio: ar as any, imageSize: q as any } },
    });
    return (response.candidates?.[0]?.content?.parts || []).filter(p => p.inlineData).map(p => `data:image/png;base64,${p.inlineData!.data}`);
};

export const regeneratePromptFromPlan = async (plan: DesignPlan, req: ArtDirectionRequest, ar: string, lay: any): Promise<ArtDirectionResponse> => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: MODEL_PLANNING,
        contents: { parts: [{ text: `Generate optimized design prompt for this plan: ${JSON.stringify(plan)}` }] },
        config: {
            systemInstruction: "Expert Art Director. Output finalized design brief JSON.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    designPlan: { type: Type.OBJECT, properties: { subject: {type: Type.STRING}, styleContext: {type: Type.STRING}, composition: {type: Type.STRING}, colorLighting: {type: Type.STRING}, decorElements: {type: Type.STRING}, typography: {type: Type.STRING} }, required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] },
                    layout_suggestion: { 
                      type: Type.OBJECT, 
                      properties: { 
                        canvas_ratio: {type: Type.STRING}, 
                        elements: { 
                          type: Type.ARRAY, 
                          items: { 
                            type: Type.OBJECT, 
                            properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, 
                            required: ["name", "type", "color", "rect"] 
                          } 
                        } 
                    }, 
                    required: ["canvas_ratio", "elements"] },
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
    result.final_prompt = `${result.final_prompt}${convertLayoutToPrompt(lay || result.layout_suggestion)}, ${QUALITY_BOOSTERS}`;
    return result;
};

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
  let prompt = LAYOUT_TAG;
  layout.elements.forEach(el => {
    prompt += `- ${el.name} (${el.type}): x:${Math.round(el.rect.x)}%, y:${Math.round(el.rect.y)}%, w:${Math.round(el.rect.width)}%, h:${Math.round(el.rect.height)}%\n`;
  });
  return prompt;
};
