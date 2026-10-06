import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cloudinary from "./cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Upload a file/image to Cloudinary with fallback to local disk storage
 * @param {string} base64OrUrl
 * @param {string} fileName
 * @param {object} req - Express request object
 * @returns {Promise<string>} Uploaded URL
 */
export const saveUpload = async (base64OrUrl, fileName = "file", req = null) => {
  if (!base64OrUrl) return "";

  // If already a remote URL, return it
  if (
    typeof base64OrUrl === "string" &&
    (base64OrUrl.startsWith("http://") || base64OrUrl.startsWith("https://"))
  ) {
    return base64OrUrl;
  }

  // 1. Try uploading to Cloudinary
  try {
    const uploadResponse = await cloudinary.uploader.upload(base64OrUrl, {
      resource_type: "auto",
      folder: "chat_files",
    });
    if (uploadResponse && uploadResponse.secure_url) {
      return uploadResponse.secure_url;
    }
  } catch (cloudErr) {
    console.warn(
      `Cloudinary upload failed (${cloudErr.message}). Storing file locally on server.`
    );
  }

  // 2. Fallback: Save file locally to server/uploads/
  try {
    const matches = base64OrUrl.match(/^data:([^;]+);base64,(.+)$/);
    const base64Data = matches ? matches[2] : base64OrUrl;
    const ext =
      fileName && fileName.includes(".") ? path.extname(fileName) : ".bin";
    const uniqueName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

    if (req) {
      const host = req.get("host") || "localhost:5005";
      const protocol = req.protocol || "http";
      return `${protocol}://${host}/uploads/${uniqueName}`;
    }
    return `http://localhost:5005/uploads/${uniqueName}`;
  } catch (fsErr) {
    console.error("Local file storage fallback failed:", fsErr);
    throw new Error("Unable to save file: " + fsErr.message);
  }
};
