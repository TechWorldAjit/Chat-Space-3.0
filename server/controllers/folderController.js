import ChatFolder from "../models/ChatFolder.js";

/**
 * Get all private folders for current user
 * GET /api/folders
 */
export const getFolders = async (req, res) => {
  try {
    const userId = req.user._id;
    const folders = await ChatFolder.find({ userId }).sort({ createdAt: 1 });
    return res.json({ success: true, folders });
  } catch (error) {
    console.error("Get Folders Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

/**
 * Create a new private folder
 * POST /api/folders
 */
export const createFolder = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user._id;

    if (!name || name.trim() === "") {
      return res.json({ success: false, message: "Folder name is required" });
    }

    // Check for duplicate folder name for this user
    const existing = await ChatFolder.findOne({
      userId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existing) {
      return res.json({
        success: false,
        message: "A folder with this name already exists",
      });
    }

    const newFolder = await ChatFolder.create({
      userId,
      name: name.trim(),
      chats: [],
    });

    return res.json({
      success: true,
      folder: newFolder,
      message: "Folder created successfully",
    });
  } catch (error) {
    console.error("Create Folder Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

/**
 * Rename an existing private folder
 * PUT /api/folders/:folderId
 */
export const renameFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body;
    const userId = req.user._id;

    if (!name || name.trim() === "") {
      return res.json({ success: false, message: "Folder name is required" });
    }

    const folder = await ChatFolder.findOne({ _id: folderId, userId });
    if (!folder) {
      return res.json({
        success: false,
        message: "Folder not found or unauthorized",
      });
    }

    folder.name = name.trim();
    await folder.save();

    return res.json({
      success: true,
      folder,
      message: "Folder renamed successfully",
    });
  } catch (error) {
    console.error("Rename Folder Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

/**
 * Delete a private folder
 * DELETE /api/folders/:folderId
 */
export const deleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user._id;

    const folder = await ChatFolder.findOneAndDelete({ _id: folderId, userId });
    if (!folder) {
      return res.json({
        success: false,
        message: "Folder not found or unauthorized",
      });
    }

    return res.json({
      success: true,
      message: "Folder deleted successfully",
    });
  } catch (error) {
    console.error("Delete Folder Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

/**
 * Add a chat (direct or group) to a folder
 * POST /api/folders/:folderId/add-chat
 */
export const addChatToFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { chatType, chatId } = req.body;
    const userId = req.user._id;

    if (!chatType || !chatId) {
      return res.json({
        success: false,
        message: "chatType and chatId are required",
      });
    }

    const folder = await ChatFolder.findOne({ _id: folderId, userId });
    if (!folder) {
      return res.json({
        success: false,
        message: "Folder not found or unauthorized",
      });
    }

    // Check if chat is already inside folder
    const alreadyAdded = folder.chats.some(
      (c) => c.chatId.toString() === chatId.toString()
    );

    if (!alreadyAdded) {
      folder.chats.push({ chatType, chatId });
      await folder.save();
    }

    return res.json({
      success: true,
      folder,
      message: "Chat added to folder",
    });
  } catch (error) {
    console.error("Add Chat To Folder Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

/**
 * Remove a chat from a folder
 * POST /api/folders/:folderId/remove-chat
 */
export const removeChatFromFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { chatId } = req.body;
    const userId = req.user._id;

    if (!chatId) {
      return res.json({ success: false, message: "chatId is required" });
    }

    const folder = await ChatFolder.findOne({ _id: folderId, userId });
    if (!folder) {
      return res.json({
        success: false,
        message: "Folder not found or unauthorized",
      });
    }

    folder.chats = folder.chats.filter(
      (c) => c.chatId.toString() !== chatId.toString()
    );
    await folder.save();

    return res.json({
      success: true,
      folder,
      message: "Chat removed from folder",
    });
  } catch (error) {
    console.error("Remove Chat From Folder Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};
