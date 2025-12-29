import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const supabaseAnonKey =
      req.headers.get("apikey") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SB_ANON_KEY") ??
      "";
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration for auth", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
      });
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request body. Expected JSON.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { image } = body || {};
    if (!image) {
      return new Response(
        JSON.stringify({ success: false, error: "No image provided" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate image data URL format
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Invalid image format. Expected data URL starting with data:image/",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Check for Gemini API key
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-flash";
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Gemini API key not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Extract creator info using Gemini Vision with retry logic
    const extractedData = await extractWithRetry(
      image,
      geminiApiKey,
      geminiModel,
      3
    );

    // 5. Return extracted data
    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Extraction error:", error);
    const errorMessage =
      error?.message || error?.toString() || "Failed to extract creator info";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Retry extraction with different detail levels if first attempt fails
 */
async function extractWithRetry(
  image: string,
  apiKey: string,
  model: string,
  maxRetries = 3
): Promise<any> {
  const strategies = ["high", "auto", "low"]; // Try high detail first, then auto, then low

  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(
        `Attempt ${i + 1}/${maxRetries} with detail level: ${strategies[i]}`
      );

      const result = await callGeminiVision(
        image,
        apiKey,
        model,
        strategies[i]
      );

      // Validate that we got required fields
      if (result.handle && result.followers) {
        console.log("Extraction successful");
        return result;
      }

      console.warn("Missing required fields, retrying...");
    } catch (error: any) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      lastError = error;

      // Don't retry on authentication errors
      if (error.message.includes("API key") || error.message.includes("401")) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw (
    lastError ||
    new Error("Failed to extract creator info after multiple attempts")
  );
}

/**
 * Call Gemini API to extract creator information from screenshot
 */
async function callGeminiVision(
  imageDataUrl: string,
  apiKey: string,
  model: string,
  detailLevel: string = "high"
): Promise<any> {
  const extractionPrompt = `You are an AI assistant specialized in extracting creator information from social media profile screenshots.

Analyze this social media profile screenshot and extract the following information with HIGH ACCURACY:

**REQUIRED FIELDS (Must extract these):**
1. **Handle/Username**: The @username or handle
   - Look for @ symbol followed by text
   - Usually near the profile picture or at the top
   - Examples: "@fashionblogger", "@tech_reviews", "@fitness_coach"

2. **Follower Count**: Number of followers/subscribers
   - May say "Followers", "Subscribers", "fans", etc.
   - Format as shown (e.g., "125K", "1.2M", "10,500", or exact number)
   - Usually displayed prominently near profile picture
   - Examples: "125K followers", "1.2M subscribers", "10,500 Followers"

**OPTIONAL FIELDS (Extract if visible):**
3. **Contact Info**: Email address, website URL, or contact link from bio
   - Look in bio/description area
   - Examples: "hello@example.com", "www.mysite.com", "link in bio"

4. **Platform**: Detect which social media platform this is
   - Options: "tiktok", "instagram", "youtube", "twitter", "facebook"
   - Use visual cues: UI design, button shapes, color schemes
   - If uncertain, set to null

5. **Location**: Geographic location if visible in bio
   - Usually in bio section
   - Examples: "Los Angeles, CA", "New York", "London, UK"

6. **Niche/Category**: What content category/niche
   - Infer from bio text, profile description, or visible content
   - Examples: "Fashion", "Tech", "Gaming", "Beauty", "Food", "Travel", "Fitness"

**CONFIDENCE SCORING:**
For each field, provide a confidence score (0.0 to 1.0) based on:
- 0.9-1.0: Clearly visible and unambiguous
- 0.7-0.9: Visible but slightly unclear or partially obscured
- 0.5-0.7: Inferred or low quality visibility
- 0.0-0.5: Guessed or very uncertain

**IMPORTANT INSTRUCTIONS:**
- If you cannot find a field with reasonable confidence, set it to null (don't guess)
- Be VERY CAREFUL with follower counts - extract exact format shown
- Pay attention to "K" (thousands) vs "M" (millions) vs exact numbers
- Platform detection: look at the entire UI design, not just one element
- Handle should include @ symbol if it's shown in the image

**OUTPUT FORMAT:**
Return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks):

{
  "handle": "@username or null",
  "followers": "125K" or "1.2M" or "10500" or null,
  "contact": "email@example.com or URL or null",
  "platform": "tiktok" | "instagram" | "youtube" | "twitter" | "facebook" | null,
  "location": "City, State/Country or null",
  "niche": "Content category or null",
  "confidence": {
    "handle": 0.95,
    "followers": 0.90,
    "contact": 0.75,
    "platform": 0.99,
    "location": 0.60,
    "niche": 0.70
  }
}

Remember: Accuracy is more important than completeness. Use null for uncertain fields.`;

  let mimeType: string;
  let base64Data: string;

  try {
    const parsed = parseDataUrl(imageDataUrl);
    mimeType = parsed.mimeType;
    base64Data = parsed.base64Data;
  } catch (parseError: any) {
    throw new Error(`Invalid image data URL: ${parseError.message}`);
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: extractionPrompt,
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = `Gemini API error: ${
        errorData.error?.message || errorData.message || response.statusText
      }`;
    } catch (e) {
      // If JSON parsing fails, use the status text
      const text = await response.text().catch(() => "");
      if (text) {
        errorMessage = `Gemini API error: ${text}`;
      }
    }
    throw new Error(errorMessage);
  }

  let result;
  try {
    result = await response.json();
  } catch (jsonError) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to parse Gemini API response: ${
        jsonError.message
      }. Response: ${text.substring(0, 200)}`
    );
  }

  const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!extractedText) {
    console.error("Empty response from Gemini API:", result);
    throw new Error("Empty response from Gemini API. Please try again.");
  }

  // Parse the AI response (Gemini sometimes wraps JSON in markdown code blocks)
  try {
    // Try to extract JSON from markdown code blocks first
    const jsonMatch = extractedText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    const jsonString = jsonMatch ? jsonMatch[1] : extractedText.trim();

    // Remove any leading/trailing whitespace and try to find JSON object
    const cleanJson = jsonString.trim();
    const jsonObjectMatch = cleanJson.match(/\{[\s\S]*\}/);
    const finalJsonString = jsonObjectMatch ? jsonObjectMatch[0] : cleanJson;

    const extractedData = JSON.parse(finalJsonString);

    // Ensure confidence object exists
    if (!extractedData.confidence) {
      extractedData.confidence = {
        handle: 0.5,
        followers: 0.5,
        contact: 0.5,
        platform: 0.5,
        location: 0.5,
        niche: 0.5,
      };
    }

    return extractedData;
  } catch (parseError: any) {
    console.error(
      "Failed to parse AI response. Raw text:",
      extractedText.substring(0, 500)
    );
    throw new Error(
      `Failed to parse AI response: ${parseError.message}. Please ensure the image contains a valid social media profile.`
    );
  }
}

function parseDataUrl(dataUrl: string): {
  mimeType: string;
  base64Data: string;
} {
  try {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(
        "Invalid image data URL format. Expected format: data:image/type;base64,data"
      );
    }
    return { mimeType: match[1], base64Data: match[2] };
  } catch (error) {
    throw new Error(`Failed to parse image data URL: ${error.message}`);
  }
}
