import mongoose from "mongoose";
import "dotenv/config";
import dns from "node:dns";

if (process.platform === "darwin") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch {}
}

let isConnecting = false;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (isConnecting) return;
  isConnecting = true;

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    isConnecting = false;
    const errorMsg = "MONGO_URI environment variable is missing";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const primaryUri = mongoUri.trim();
  const fallbackUri = primaryUri.startsWith("mongodb+srv://")
    ? "mongodb://dfp:Ajit%401234@ac-u2qwwcv-shard-00-00.qlnzjij.mongodb.net:27017,ac-u2qwwcv-shard-00-01.qlnzjij.mongodb.net:27017,ac-u2qwwcv-shard-00-02.qlnzjij.mongodb.net:27017/?ssl=true&replicaSet=atlas-peitxr-shard-0&authSource=admin&appName=Cluster0"
    : "mongodb+srv://dfp:Ajit%401234@cluster0.qlnzjij.mongodb.net/?appName=Cluster0";

  const connectOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    const sanitizedUri = primaryUri.replace(/:[^:@]*@/, ":****@");
    console.log(`Connecting to MongoDB (${sanitizedUri})...`);
    await mongoose.connect(primaryUri, connectOptions);
    console.log("Successfully connected to MongoDB");
    isConnecting = false;
  } catch (primaryError) {
    console.warn("Primary MongoDB URI connection failed:", primaryError.message);
    try {
      const sanitizedFallback = fallbackUri.replace(/:[^:@]*@/, ":****@");
      console.log(`Retrying with alternate MongoDB format (${sanitizedFallback})...`);
      await mongoose.connect(fallbackUri, connectOptions);
      console.log("Successfully connected to MongoDB via fallback format");
      isConnecting = false;
    } catch (fallbackError) {
      isConnecting = false;
      console.error("All MongoDB connection attempts failed:", fallbackError.message);
      throw primaryError;
    }
  }
};

export const isAtlasConnected = () => mongoose.connection.readyState === 1;
