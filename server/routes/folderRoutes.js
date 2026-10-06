import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  addChatToFolder,
  removeChatFromFolder,
} from "../controllers/folderController.js";

const folderRouter = express.Router();

folderRouter.get("/", protectRoute, getFolders);
folderRouter.post("/", protectRoute, createFolder);
folderRouter.put("/:folderId", protectRoute, renameFolder);
folderRouter.delete("/:folderId", protectRoute, deleteFolder);
folderRouter.post("/:folderId/add-chat", protectRoute, addChatToFolder);
folderRouter.post("/:folderId/remove-chat", protectRoute, removeChatFromFolder);

export default folderRouter;
