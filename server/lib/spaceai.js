import { GoogleGenAI } from "@google/genai";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Message from "../models/Messages.js";
import cloudinary from "./cloudinary.js";
import { connectDB } from "./db.js";

export const SPACEAI_EMAIL = "spaceai@system.local";
export const SPACEAI_NAME = "SpaceAI";
export const SPACEAI_BIO = "SpaceAI — Your AI Assistant powered by Google Gemini";
export const SPACEAI_AVATAR =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=256&q=80";

let cachedSpaceAIUser = null;

/**
 * Get or create the persistent SpaceAI user in MongoDB
 */
export const getOrCreateSpaceAIUser = async () => {
  await connectDB();
  if (cachedSpaceAIUser) {
    try {
      const existing = await User.findById(cachedSpaceAIUser._id);
      if (existing) return existing;
    } catch {
      // Continue to query DB
    }
  }

  let spaceAI = await User.findOne({
    $or: [{ email: SPACEAI_EMAIL }, { isAI: true }],
  });

  if (!spaceAI) {
    const salt = await bcrypt.genSalt(10);
    const randomPassword = crypto.randomBytes(32).toString("hex") + "SpaceAI!123";
    const hashedPassword = await bcrypt.hash(randomPassword, salt);

    spaceAI = await User.create({
      fullName: SPACEAI_NAME,
      email: SPACEAI_EMAIL,
      password: hashedPassword,
      bio: SPACEAI_BIO,
      profilePic: SPACEAI_AVATAR,
      isAI: true,
    });
    console.log("SpaceAI system user initialized in MongoDB with ID:", spaceAI._id);
  } else {
    // Ensure isAI and profile details are up to date
    let updated = false;
    if (!spaceAI.isAI) {
      spaceAI.isAI = true;
      updated = true;
    }
    if (!spaceAI.profilePic) {
      spaceAI.profilePic = SPACEAI_AVATAR;
      updated = true;
    }
    if (updated) {
      await spaceAI.save();
    }
  }

  cachedSpaceAIUser = spaceAI;
  return spaceAI;
};

/**
 * Get the GoogleGenAI client instance
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_NEW_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY_NOT_CONFIGURED");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Detect whether the user prompt is requesting an image generation
 */
export const isImagePrompt = (text) => {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim().toLowerCase();

  const patterns = [
    /^generate\s+(an?\s+)?image/i,
    /^create\s+(an?\s+)?image/i,
    /^draw\s+(an?\s+)?/i,
    /^make\s+(an?\s+)?(image|picture|photo)/i,
    /^paint\s+(an?\s+)?/i,
    /^render\s+(an?\s+)?(an?\s+)?image/i,
    /^picture\s+of\s+/i,
    /^photo\s+of\s+/i,
    /^illustration\s+of\s+/i,
    /^\/imagine\s+/i,
    /^\/image\s+/i,
    /generate\s+(an?\s+)?image\s+of/i,
    /create\s+(an?\s+)?image\s+of/i,
    /draw\s+(an?\s+)?image\s+of/i,
    /make\s+(an?\s+)?picture\s+of/i,
  ];

  return patterns.some((pattern) => pattern.test(trimmed));
};

/**
 * Clean and extract the core prompt for image generation
 */
export const extractImagePrompt = (text) => {
  if (!text) return "";
  let prompt = text.trim();
  prompt = prompt.replace(/^\/imagine\s+/i, "");
  prompt = prompt.replace(/^\/image\s+/i, "");
  prompt = prompt.replace(/^(please\s+)?(can\s+you\s+)?generate\s+(an?\s+)?image\s+(of|for|showing)?\s*/i, "");
  prompt = prompt.replace(/^(please\s+)?(can\s+you\s+)?create\s+(an?\s+)?image\s+(of|for|showing)?\s*/i, "");
  prompt = prompt.replace(/^(please\s+)?(can\s+you\s+)?draw\s+(an?\s+)?(image\s+(of|for|showing)?\s*)?/i, "");
  prompt = prompt.replace(/^(please\s+)?(can\s+you\s+)?make\s+(an?\s+)?(picture|photo|image)\s+(of|for|showing)?\s*/i, "");
  return prompt.trim() || text.trim();
};

/**
 * Generate an image using Gemini / Imagen and upload to Cloudinary
 */
export const generateAIImageReply = async (promptText) => {
  try {
    const ai = getGeminiClient();
    const prompt = extractImagePrompt(promptText);

    let base64Image = null;

    // Try Imagen 3 first via generateImages
    try {
      const imagenResponse = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
        },
      });

      if (
        imagenResponse &&
        imagenResponse.generatedImages &&
        imagenResponse.generatedImages.length > 0 &&
        imagenResponse.generatedImages[0].image?.imageBytes
      ) {
        base64Image = imagenResponse.generatedImages[0].image.imageBytes;
      }
    } catch (imagenErr) {
      console.warn("Imagen generation error, attempting fallback:", imagenErr.message);
    }

    // Multimodal image generation models
    const imageCandidateModels = [
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-3.1-flash-lite-image",
      "gemini-2.5-flash-image",
    ];

    for (const imgModel of imageCandidateModels) {
      if (base64Image) break;
      try {
        const contentResponse = await ai.models.generateContent({
          model: imgModel,
          contents: prompt,
          config: {
            responseModalities: ["IMAGE"],
          },
        });

        const candidate = contentResponse?.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
              base64Image = part.inlineData.data;
              break;
            }
          }
        }
      } catch (modelErr) {
        console.warn(`Image generation with ${imgModel} attempt:`, modelErr.message);
      }
    }

    if (!base64Image) {
      throw new Error("NO_IMAGE_DATA_GENERATED");
    }

    // Upload to Cloudinary to get permanent HTTPS URL
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64Image}`,
      {
        folder: "spaceai_media",
      }
    );

    return {
      success: true,
      imageUrl: uploadResult.secure_url,
      caption: `Image generated for: "${prompt}"`,
    };
  } catch (error) {
    console.error("AI Image Generation Error:", error.message);
    if (error.message === "GEMINI_API_KEY_NOT_CONFIGURED") {
      return {
        success: false,
        error: "GEMINI_API_KEY_NOT_CONFIGURED",
        fallbackText:
          "SpaceAI is ready, but GEMINI_API_KEY is not configured yet. Please configure the GEMINI_API_KEY in the backend .env file.",
      };
    }
    return {
      success: false,
      error: error.message,
      fallbackText: "SpaceAI was unable to generate the requested image. Please try again with a different prompt.",
    };
  }
};

/**
 * Generate a text response using Gemini with multi-turn conversation memory
 */
export const generateAITextReply = async (userId, newPrompt) => {
  try {
    const ai = getGeminiClient();
    const spaceAIUser = await getOrCreateSpaceAIUser();

    // Fetch the last 20 messages between the user and SpaceAI to maintain memory
    const historyMessages = await Message.find({
      $or: [
        { senderId: userId, receiverId: spaceAIUser._id },
        { senderId: spaceAIUser._id, receiverId: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20);

    // Reverse to chronological order (oldest to newest)
    const chronologicalHistory = historyMessages.reverse();

    const contents = [];

    for (const msg of chronologicalHistory) {
      const isUserMsg = msg.senderId.toString() === userId.toString();
      if (msg.text && msg.text.trim()) {
        contents.push({
          role: isUserMsg ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      }
    }

    // Append the current prompt if not already the last history entry
    const lastContent = contents[contents.length - 1];
    if (!lastContent || lastContent.role !== "user" || lastContent.parts[0]?.text !== newPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: newPrompt }],
      });
    }

    // Generate content using Gemini
    let responseText = "";

    const candidateModels = [
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ];
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction:
              "You are SpaceAI, an intelligent, helpful, and friendly AI assistant built into the Quick Chat application. Provide clear, conversational, helpful, and nicely formatted answers. When answering coding, tech, or general questions, keep explanations engaging and accessible.",
          },
        });

        if (response && response.text) {
          responseText = response.text;
          break;
        } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          responseText = response.candidates[0].content.parts[0].text;
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`Attempt with ${modelName} failed:`, modelErr.message);
      }
    }

    if (!responseText) {
      throw lastError || new Error("EMPTY_GEMINI_RESPONSE");
    }

    return {
      success: true,
      reply: responseText,
    };
  } catch (error) {
    console.error("AI Text Generation Error:", error.message);
    if (error.message === "GEMINI_API_KEY_NOT_CONFIGURED") {
      return {
        success: false,
        error: "GEMINI_API_KEY_NOT_CONFIGURED",
        fallbackText:
          "SpaceAI is ready, but GEMINI_API_KEY is not configured yet. Please add your GEMINI_API_KEY in the backend .env file.",
      };
    }
    return {
      success: false,
      error: error.message,
      fallbackText: "SpaceAI is temporarily unavailable. Please try again.",
    };
  }
};

/**
 * Generate a concise group conversation summary and key takeaways
 */
export const generateGroupSummary = async (messages, groupName = "Group") => {
  try {
    const ai = getGeminiClient();

    if (!messages || messages.length === 0) {
      return {
        success: false,
        message: "No messages to summarize.",
      };
    }

    // Format conversation history (limit to last 100 messages)
    const recentMessages = messages.slice(-100);
    const conversationTranscript = recentMessages
      .map((m) => {
        const senderName = m.senderId?.fullName || "Member";
        const content = m.text || (m.image ? "[Shared an Image]" : "");
        return `${senderName}: ${content}`;
      })
      .filter((line) => line.trim().length > 0)
      .join("\n");

    const systemInstruction = `You are an expert AI summarizer for the chat application Quick Chat.
Your job is to accurately and concisely summarize the conversation that took place in the group "${groupName}".
Output a clean, valid JSON object with the following structure:
{
  "summary": "A concise paragraph summarizing the main topics, discussions, and decisions in the conversation.",
  "keyTakeaways": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3"
  ]
}
Ensure the summary is accurate to the messages provided, objective, and does not hallucinate facts. Return only JSON.`;

    const candidateModels = [
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ];

    let rawResponse = "";
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Summarize this group chat conversation:\n\n${conversationTranscript}`,
                },
              ],
            },
          ],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          },
        });

        if (response && response.text) {
          rawResponse = response.text;
          break;
        } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          rawResponse = response.candidates[0].content.parts[0].text;
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(
          `Attempt with ${modelName} for group summary failed:`,
          modelErr.message
        );
      }
    }

    if (!rawResponse) {
      throw lastError || new Error("EMPTY_GEMINI_SUMMARY_RESPONSE");
    }

    let parsed = null;
    try {
      parsed = JSON.parse(
        rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim()
      );
    } catch {
      parsed = {
        summary: rawResponse,
        keyTakeaways: ["Key points captured in summary above."],
      };
    }

    return {
      success: true,
      summary: parsed.summary || "Summary could not be generated.",
      keyTakeaways: Array.isArray(parsed.keyTakeaways)
        ? parsed.keyTakeaways
        : [],
    };
  } catch (error) {
    console.error("AI Group Summary Error:", error.message);
    if (error.message === "GEMINI_API_KEY_NOT_CONFIGURED") {
      return {
        success: false,
        error: "GEMINI_API_KEY_NOT_CONFIGURED",
        fallbackText:
          "Gemini is ready, but GEMINI_API_KEY is not configured in the backend .env.",
      };
    }
    return {
      success: false,
      error: error.message,
      fallbackText:
        "Unable to generate AI summary at this moment. Please try again.",
    };
  }
};

