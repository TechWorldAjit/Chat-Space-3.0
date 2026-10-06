import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  aiChat,
  aiGenerateImage,
  aiGroupSummary,
} from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.post("/chat", protectRoute, aiChat);
aiRouter.post("/generate-image", protectRoute, aiGenerateImage);
aiRouter.post("/group-summary/:groupId", protectRoute, aiGroupSummary);

export default aiRouter;

