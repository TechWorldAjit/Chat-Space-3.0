import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import groupRouter from "./routes/groupRoutes.js";
import folderRouter from "./routes/folderRoutes.js";
import { getOrCreateSpaceAIUser } from "./lib/spaceai.js";
import { initSocket, io, userSocketMap } from "./lib/socket.js";
export { io, userSocketMap };

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Welcome to Quick Chat API");
});
app.use("/api/status", (req, res) => res.json({ success: true, message: "Server is live" }));

app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);
app.use("/api/ai", aiRouter);
app.use("/api/groups", groupRouter);
app.use("/api/folders", folderRouter);

const initializeDatabase = async () => {
  try {
    await connectDB();
    await getOrCreateSpaceAIUser();
  } catch (error) {
    console.error("Database initialization error:", error.message);
  }
};

await initializeDatabase();

const startServer = (port) => {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy. Trying ${nextPort} instead.`);
      server.removeAllListeners("error");
      startServer(nextPort);
      return;
    }

    console.error(error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(
      `Server is running on PORT: ${port} => http://localhost:${port}/api/status`
    );
  });
};

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 5001;
  startServer(PORT);
}

export default server;
