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

export const saveUpload = async (base64OrUrl, fileName = "file", req = null) => {
  if (!base64OrUrl) return "";

  if (
    typeof base64OrUrl === "string" &&
    (base64OrUrl.startsWith("http://") || base64OrUrl.startsWith("https://"))
  ) {
    return base64OrUrl;
  }

  try {
    const uploadResponse = await cloudinary.uploader.upload(base64OrUrl, {
      resource_type: "auto",
      folder: "chat_files",
    });
    if (uploadResponse && uploadResponse.secure_url) {
      return uploadResponse.secure_url;
    }
  } catch (cloudErr) {
    console.error("Cloudinary upload failed:", cloudErr.message);
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new Error("Cloud upload failed: " + cloudErr.message);
    }
  }

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
      const host = req.get("host") || "localhost:5001";
      const protocol = req.protocol || "http";
      return `${protocol}://${host}/uploads/${uniqueName}`;
    }
    return `http://localhost:5001/uploads/${uniqueName}`;
  } catch (fsErr) {
    console.error("Local file storage fallback failed:", fsErr);
    throw new Error("Unable to save file: " + fsErr.message);
  }
};
