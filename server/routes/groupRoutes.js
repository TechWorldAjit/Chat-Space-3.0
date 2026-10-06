import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  createGroup,
  getGroups,
  getGroupById,
  getGroupMessages,
  sendGroupMessage,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  deleteGroup,
} from "../controllers/groupController.js";

const groupRouter = express.Router();

groupRouter.post("/", protectRoute, createGroup);
groupRouter.get("/", protectRoute, getGroups);
groupRouter.get("/:groupId", protectRoute, getGroupById);
groupRouter.get("/:groupId/messages", protectRoute, getGroupMessages);
groupRouter.post("/:groupId/messages", protectRoute, sendGroupMessage);
groupRouter.put("/:groupId", protectRoute, updateGroup);
groupRouter.post("/:groupId/members", protectRoute, addGroupMembers);
groupRouter.delete("/:groupId/members/:memberId", protectRoute, removeGroupMember);
groupRouter.delete("/:groupId", protectRoute, deleteGroup);

export default groupRouter;
