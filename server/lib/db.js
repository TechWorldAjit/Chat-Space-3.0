import mongoose from "mongoose";
import "dotenv/config";

let fallbackMongod = null;
let isConnectedToAtlas = false;
let isConnecting = false;

/**
 * Fast direct connection to MongoDB Atlas, with instant zero-downtime
 * local fallback if Atlas IP is not yet whitelisted, plus background auto-switch.
 */
export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (isConnecting) return;
  isConnecting = true;

  const mongoUri = process.env.MONGO_URI;

  // 1. Attempt MongoDB Atlas connection first
  if (mongoUri) {
    try {
      const sanitizedUri = mongoUri.replace(/:[^:@]*@/, ":****@");
      console.log(`Connecting to MongoDB Atlas (${sanitizedUri})...`);

      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2500, // Fast 2.5s check so user never waits 10s
        socketTimeoutMS: 45000,
        maxPoolSize: 50,
        minPoolSize: 5,
        retryWrites: true,
      });

      isConnectedToAtlas = true;
      console.log("✓ SUCCESS: Connected directly to MongoDB Atlas cluster! Data will be stored on Atlas.");
      isConnecting = false;
      return;
    } catch (atlasErr) {
      console.warn("\n================ MONGODB ATLAS NOTICE ================");
      console.warn("Could not reach MongoDB Atlas cluster directly:", atlasErr.message);
      if (
        atlasErr.message.includes("SSL alert number 80") ||
        atlasErr.message.includes("whitelist") ||
        atlasErr.message.includes("Could not connect to any servers")
      ) {
        console.warn("\n👉 TO PERSIST TO ATLAS: Add your IP to Atlas Network Access:");
        console.warn("   1. Go to https://cloud.mongodb.com -> Network Access");
        console.warn("   2. Click 'Add IP Address' -> Select 'Allow Access from Anywhere' (0.0.0.0/0)");
        console.warn("   3. Click Confirm.");
      }
      console.warn("⚡ Starting instant local database so you can sign up & test right away without waiting!");
      console.warn("======================================================\n");
    }
  }

  // 2. Instant Local Engine Fallback so signups & logins work immediately (< 200ms)
  try {
    if (!fallbackMongod) {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      fallbackMongod = await MongoMemoryServer.create({
        instance: { dbName: "chatspace" },
      });
    }
    const localUri = fallbackMongod.getUri();
    await mongoose.connect(localUri);
    console.log("✓ Connected to Instant High-Speed Database (Signups & Logins ready immediately).");

    // 3. Background background watcher to switch to Atlas the moment IP is whitelisted
    startAtlasWatcher(mongoUri);
  } catch (localErr) {
    console.error("Database connection failure:", localErr.message);
  } finally {
    isConnecting = false;
  }
};

/**
 * Periodically probe MongoDB Atlas in the background.
 * As soon as the user whitelists their IP, smoothly switch over to Atlas.
 */
let watcherTimer = null;
function startAtlasWatcher(mongoUri) {
  if (watcherTimer || !mongoUri) return;

  watcherTimer = setInterval(async () => {
    if (isConnectedToAtlas) {
      clearInterval(watcherTimer);
      watcherTimer = null;
      return;
    }

    try {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 2000 });
      await client.connect();
      await client.close();

      console.log("\n🎉 DETECTED: MongoDB Atlas IP whitelist is active! Switching to Atlas now...");
      await mongoose.disconnect();
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 50,
        minPoolSize: 5,
      });
      isConnectedToAtlas = true;
      console.log("✓ Successfully connected to MongoDB Atlas! Future data will be stored on Atlas.\n");

      clearInterval(watcherTimer);
      watcherTimer = null;
    } catch {
      // Still waiting for Atlas whitelist, keep retrying quietly
    }
  }, 6000);
}

export const isAtlasConnected = () => isConnectedToAtlas;
