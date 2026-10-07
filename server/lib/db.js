import mongoose from "mongoose";
import "dotenv/config";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

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

  try {
    const sanitizedUri = mongoUri.replace(/:[^:@]*@/, ":****@");
    console.log(`Connecting to MongoDB (${sanitizedUri})...`);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50,
      minPoolSize: 5,
      retryWrites: true,
    });

    console.log("Successfully connected to MongoDB");
    isConnecting = false;
  } catch (error) {
    isConnecting = false;
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export const isAtlasConnected = () => mongoose.connection.readyState === 1;
