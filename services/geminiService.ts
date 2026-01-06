
// @google/genai guidelines: Use process.env.API_KEY and correct model names.
import { GoogleGenAI, Type } from "@google/genai";
import { ArtDirectionRequest, ArtDirectionResponse, ColorMode, DesignPlan, LayoutSuggestion, AnalysisModel } from "../types";

// --- HYBRID MODEL STRATEGY CONFIGURATION ---
const MODEL_IMAGE_GEN = "gemini-3-pro-image-preview"; 

// --- QUALITY BOOSTERS ---
const QUALITY_BOOSTERS = "masterpiece, best quality, highres, 8k resolution, highly detailed, professional photography, cinematic lighting, sharp focus, hdr, smooth texture";

// --- STRICT NEGATIVE PROMPT ---
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

const getAnalysisModelId = (model: AnalysisModel) => model === AnalysisModel.PRO ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  // Always use process.env.API_KEY as per instructions
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelId = getAnalysisModelId(request.analysisModel);

  try {
    const parts: any[] = [];
    const isBrandLogoMode = request.colorMode === ColorMode.BRAND_LOGO;
    const hasUserAssets = request.assetImages.length > 0;
    
    const mainHeadlinesFormatted = Array.isArray(request.mainHeadline) 
        ? request.mainHeadline.filter(h => h.trim() !== '').join(' | ') 
        : request.mainHeadline;
        
    const secondaryTextFormatted = Array.isArray(request.secondaryText)
        ? request.secondaryText.filter(t => t.trim() !== '').join(' | ')
        : request.secondaryText;

    let colorInstruction = isBrandLogoMode ? "STRICTLY USE COLORS EXTRACTED FROM BRAND LOGO." : (request.colorMode === 'Custom' ? `Palette: ${request.customColors.join(', ')}` : 'Auto');

    let allRefInstructions = "";
    request.referenceImages.forEach((refImg, index) => {
        const i = index + 1;
        let activeAttributes = [...refImg.attributes];
        if (activeAttributes.length > 0) {
            allRefInstructions += `-- REF ${i}: Copy [${activeAttributes.join(', ')}].\n`;
        }
    });

    let promptText = `
      Type: ${request.productType} (${request.width}x${request.height}cm)
      Headline: "${mainHeadlinesFormatted}"
      Sub-content: "${secondaryTextFormatted}"
      Logo: ${request.logoImage ? "Yes" : "No"}
      User Assets: ${hasUserAssets ? "Priority Hero" : "No"}
      Color: ${colorInstruction}
      Layout/Desc: "${request.layoutRequirements}"
      Font Prefs: "${request.fontPreferences}"
      Style: ${request.visualStyle}
      ${allRefInstructions}
    `;

    parts.push({ text: promptText });
    if (request.logoImage) parts.push({ inlineData: { mimeType: "image/png", data: request.logoImage.split(',')[1] } });
    request.assetImages.forEach(img => parts.push({ inlineData: { mimeType: "image/png", data: img.split(',')[1] } }));
    if (request.mainHeadlineImage) parts.push({ inlineData: { mimeType: "image/png", data: request.mainHeadlineImage.split(',')[1] } });
    request.referenceImages.forEach((refImg, index) => {
        parts.push({ text: `REF ${index + 1}:`});
        parts.push({ inlineData: { mimeType: "image/png", data: refImg.image.split(',')[1] } });
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
    if (!text) throw new Error("No response from AI Director");
    const result = JSON.parse(text) as ArtDirectionResponse;
    if (result.layout_suggestion?.elements) {
        result.layout_suggestion.elements = result.layout_suggestion.elements.map((el, idx) => ({
            ...el, id: el.id || `el-${Date.now()}-${idx}`
        }));
    }
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
  } catch (error) {
    console.error("Error generating art direction:", error);
    throw error;
  }
};

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
    if (!layout || !layout.elements || layout.elements.length === 0) return "";
    
    let promptAddition = "\n\n### SPATIAL GUIDANCE (INVISIBLE MASK) ###\n";
    promptAddition += "An invisible LAYOUT_MASK is attached. Follow these color regions for placement:\n";
    
    layout.elements.forEach((el) => {
        const colorName = el.color.toUpperCase();
        promptAddition += `- The ${colorName} area represents the ${el.type.toUpperCase()} element ("${el.name}").\n`;
    });
    
    promptAddition += "\n⛔ IMPORTANT: DO NOT render any boxes, text coordinates, or the colors themselves. Use them only as spatial boundaries.";
    return promptAddition;
};

export const regeneratePromptFromPlan = async (
    updatedPlan: DesignPlan,
    originalRequest: ArtDirectionRequest,
    _currentAspectRatio: string,
    currentLayout: LayoutSuggestion | null 
): Promise<ArtDirectionResponse> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelId = getAnalysisModelId(originalRequest.analysisModel);

    try {
        const prompt = `
            REFINE DESIGN PROMPT.
            PLAN DETAILS: ${JSON.stringify(updatedPlan)}
            LAYOUT COLOR MAPPING: ${currentLayout ? currentLayout.elements.map(e => `${e.color} -> ${e.name}`).join(', ') : 'N/A'}
            
            Synthesize into a professional English prompt. 
            ⛔ STRICT RULE: DO NOT include X/Y coordinates or numeric positions.
        `;

        const response = await ai.models.generateContent({
            model: modelId, 
            contents: { parts: [{ text: prompt }] },
            config: {
                systemInstruction: "You are a senior prompt engineer. Write creative prompts without technical jargon or coordinates.",
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
            },
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI update");
        const result = JSON.parse(text) as ArtDirectionResponse;
        result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
        return result;
    } catch (error) {
        console.error("Error regenerating prompt from plan:", error);
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
  try {
    const fullPrompt = `${prompt}\n\nSTRICT NEGATIVE CONSTRAINTS: ${NEGATIVE_PROMPT}`;
    const parts: any[] = [{ text: fullPrompt }];

    if (layoutMask) {
        parts.push({ text: `
        [LAYOUT_MASK INSTRUCTION]
        The following image is a SEMANTIC SEGMENTATION MASK. 
        It defines the EXACT SPATIAL BOUNDARIES for elements.
        - Treat color blocks as placeholders for the content described in the prompt.
        - ⛔ DO NOT DRAW THE MASK ITSELF.
        - ⛔ DO NOT DRAW COORDINATES, TEXT LABELS, OR BOXES SEEN IN THE MASK.
        ` });
        parts.push({ inlineData: { mimeType: "image/png", data: layoutMask.split(',')[1] } });
    }

    if (logoImage) {
      parts.push({ text: " BRAND LOGO: " });
      parts.push({ inlineData: { mimeType: "image/png", data: logoImage.split(',')[1] } });
    }

    if (assetImages.length > 0) {
       parts.push({ text: " PRODUCT ASSETS: " });
       assetImages.forEach(img => {
          parts.push({ inlineData: { mimeType: "image/png", data: img.split(',')[1] } });
       });
    }
    
    const promises = Array.from({ length: batchSize }).map(async () => {
      // Create new instance before each call as per instructions
      const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await aiInstance.models.generateContent({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio, imageSize: imageSize } },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
    });

    const results = await Promise.all(promises);
    return results.filter((url): url is string => url !== null);
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const refineDesignImage = async (sourceImageBase64: string, instruction: string, aspectRatio: string, imageSize: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `Edit instruction: ${instruction}. Keep layout consistent. No technical numbers.`;
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: sourceImageBase64.split(',')[1] } }
        ]
      },
      config: { imageConfig: { aspectRatio, imageSize } },
    });
    const urls: string[] = [];
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) urls.push(`data:image/png;base64,${part.inlineData.data}`);
    }
    return urls;
  } catch (error) {
    console.error("Error refining image:", error);
    throw error;
  }
};

export const upscaleImageTo4K = async (sourceImageBase64: string, aspectRatio: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const prompt = "UPSCALER: Generate 4K version. Sharpen details, PRESERVE original content and colors exactly. NO NEW ELEMENTS.";
        const response = await ai.models.generateContent({
            model: MODEL_IMAGE_GEN,
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/png", data: sourceImageBase64.split(',')[1] } }
                ]
            },
            config: { imageConfig: { aspectRatio: aspectRatio, imageSize: "4K" } },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        throw new Error("No image generated from upscale request");
    } catch (error) {
        console.error("Error upscaling image:", error);
        throw error;
    }
};

export const separateDesignComponents = async (
    originalPrompt: string, 
    aspectRatio: string, 
    _userImageSize: string, 
    referenceImageBase64?: string,
    mode: 'full' | 'background' = 'full'
): Promise<{ background: string | null, textLayer: string | null, subjects: string[], decor: string[], lighting: string | null }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const MAX_QUALITY_SIZE = "4K"; 

  const buildParts = (taskPrompt: string) => {
    const parts: any[] = [{ text: taskPrompt }];
    if (referenceImageBase64) parts.push({ inlineData: { mimeType: "image/png", data: referenceImageBase64.split(',')[1] } });
    return parts;
  };

  const extractImage = (response: any) => {
       for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
  };

  try {
      const bgInstruction = mode === 'background' 
         ? `Based on reference: GENERATE A HIGH-FIDELITY COPY of the image but REMOVE ALL TEXT, HEADLINES, and LOGOS. Keep subject and background.`
         : `Based on reference: GENERATE BACKGROUND ONLY. High Res.`;

      const bgRes = await ai.models.generateContent({ 
          model: MODEL_IMAGE_GEN,
          contents: { parts: buildParts(bgInstruction) }, 
          config: { imageConfig: { aspectRatio, imageSize: MAX_QUALITY_SIZE } } 
      });

      const background = extractImage(bgRes);
      if (mode === 'background') return { background, textLayer: null, subjects: [], decor: [], lighting: null };

      const textPrompt = `Based on reference: TYPOGRAPHY LAYER ONLY on WHITE background.`;
      const subjectMainPrompt = `Based on reference: MAIN HERO SUBJECT on WHITE background.`;
      const subjectSecPrompt = `Based on reference: SECONDARY SUBJECTS on WHITE background.`;
      const decorPrompt = `Based on reference: PROPS/DECOR on WHITE background.`;
      const lightPrompt = `Based on reference: LIGHTING/ATMOSPHERE on BLACK background.`;

      const [textRes, subMainRes, subSecRes, decorRes, lightRes] = await Promise.all([
        ai.models.generateContent({ model: MODEL_IMAGE_GEN, contents: { parts: buildParts(textPrompt) }, config: { imageConfig: { aspectRatio, imageSize: MAX_QUALITY_SIZE } } }),
        ai.models.generateContent({ model: MODEL_IMAGE_GEN, contents: { parts: buildParts(subjectMainPrompt) }, config: { imageConfig: { aspectRatio, imageSize: MAX_QUALITY_SIZE } } }),
        ai.models.generateContent({ model: MODEL_IMAGE_GEN, contents: { parts: buildParts(subjectSecPrompt) }, config: { imageConfig: { aspectRatio, imageSize: MAX_QUALITY_SIZE } } }),
        ai.models.generateContent({ model: MODEL_IMAGE_GEN, contents: { parts: buildParts(decorPrompt) }, config: { imageConfig: { aspectRatio, imageSize: MAX_QUALITY_SIZE } } }),
        ai.models.generateContent({ model: MODEL_IMAGE_GEN, contents: { parts: buildParts(lightPrompt) }, config: { imageConfig: { aspectRatio, imageSize: MAX_QUALITY_SIZE } } })
      ]);

      const subjects = [extractImage(subMainRes), extractImage(subSecRes)].filter(Boolean) as string[];
      return { 
          background, textLayer: extractImage(textRes), subjects,
          decor: [extractImage(decorRes)].filter(Boolean) as string[],
          lighting: extractImage(lightRes)
      };
  } catch (error) {
    console.error("Error separating components:", error);
    throw error;
  }
};

export const removeObjectWithMask = async (originalImageBase64: string, maskImageBase64: string, textInstruction?: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const removalContext = textInstruction ? `Specifically remove: "${textInstruction}".` : "Remove the highlighted object.";
        const prompt = `Inpaint task: ${removalContext} Blend the background perfectly with original texture. NO ARTIFACTS, NO BLUR.`;
        
        const response = await ai.models.generateContent({
            model: MODEL_IMAGE_GEN,
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/png", data: originalImageBase64.split(',')[1] } },
                    { inlineData: { mimeType: "image/png", data: maskImageBase64.split(',')[1] } }
                ]
            }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    } catch (error) {
        console.error("Error removing object with mask:", error);
        throw error;
    }
};

export const updatePlanFromLayout = async (currentPlan: DesignPlan, newLayout: LayoutSuggestion): Promise<DesignPlan> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const prompt = `Update the design plan keywords based on this new layout positioning. Plan: ${JSON.stringify(currentPlan)}. Layout: ${JSON.stringify(newLayout)}. DO NOT USE NUMBERS.`;
        const PLAN_SCHEMA = {
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
        };
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: prompt }] },
            config: {
                systemInstruction: "You are a senior design consultant. Update descriptions to reflect spatial changes without mentioning coordinates.",
                responseMimeType: "application/json",
                responseSchema: PLAN_SCHEMA,
            },
        });
        return JSON.parse(response.text) as DesignPlan;
    } catch (error) {
        console.error("Error updating plan from layout:", error);
        throw error;
    }
};
