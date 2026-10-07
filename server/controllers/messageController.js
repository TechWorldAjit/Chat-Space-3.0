import Message from "../models/Messages.js";
import User from "../models/User.js";
import { saveUpload } from "../lib/uploadHelper.js";
import { io, userSocketMap } from "../lib/socket.js";
import {
  isImagePrompt,
  generateAITextReply,
  generateAIImageReply,
  SPACEAI_EMAIL,
} from "../lib/spaceai.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;

    const [filteredUsers, unseenAgg] = await Promise.all([
      User.find({ _id: { $ne: userId } })
        .select("-password")
        .sort({ fullName: 1 })
        .lean(),
      Message.aggregate([
        { $match: { receiverId: userId, seen: false } },
        { $group: { _id: "$senderId", count: { $sum: 1 } } },
      ]),
    ]);

    const unseenMessages = {};
    if (Array.isArray(unseenAgg)) {
      unseenAgg.forEach((item) => {
        if (item._id) unseenMessages[item._id.toString()] = item.count;
      });
    }

    res.json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    console.error("getUsersForSidebar error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const [messages] = await Promise.all([
      Message.find({
        $or: [
          { senderId: myId, receiverId: selectedUserId },
          { senderId: selectedUserId, receiverId: myId },
        ],
      })
        .sort({ createdAt: 1 })
        .lean(),
      Message.updateMany(
        { senderId: selectedUserId, receiverId: myId, seen: false },
        { $set: { seen: true } }
      ),
    ]);

    res.json({ success: true, messages });
  } catch (error) {
    console.error("getMessages error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.findByIdAndUpdate(id, { $set: { seen: true } });
    res.json({ success: true });
  } catch (error) {
    console.error("markMessageAsSeen error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, fileData, fileName, fileType, fileSize, folderFileCount } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    let imageUrl;
    let uploadedFileUrl;

    if (image && !fileData) {
      imageUrl = await saveUpload(image, "image.jpg", req);
    }

    if (fileData) {
      uploadedFileUrl = await saveUpload(fileData, fileName || "file", req);
      if (fileType === "image" || (image && !imageUrl)) {
        imageUrl = uploadedFileUrl;
      }
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      fileUrl: uploadedFileUrl,
      fileName,
      fileType,
      fileSize,
      folderFileCount,
    });

    const receiverUser = await User.findById(receiverId).select("isAI email").lean();
    const isReceiverAI =
      receiverUser?.isAI || receiverUser?.email === SPACEAI_EMAIL;

    if (isReceiverAI) {
      res.json({ success: true, newMessage });

      (async () => {
        try {
          let aiMessage;

          if (text && isImagePrompt(text)) {
            const imageResult = await generateAIImageReply(text);
            if (imageResult.success) {
              aiMessage = await Message.create({
                senderId: receiverId,
                receiverId: senderId,
                text: "",
                image: imageResult.imageUrl,
                seen: true,
              });
            } else {
              aiMessage = await Message.create({
                senderId: receiverId,
                receiverId: senderId,
                text: imageResult.fallbackText,
                seen: true,
              });
            }
          } else {
            const promptText = text || (imageUrl ? "Analyze this uploaded image" : "Hello SpaceAI");
            const textResult = await generateAITextReply(senderId, promptText);
            aiMessage = await Message.create({
              senderId: receiverId,
              receiverId: senderId,
              text: textResult.success ? textResult.reply : textResult.fallbackText,
              seen: true,
            });
          }

          if (io) {
            io.to(senderId.toString()).emit("newMessage", aiMessage);
            const senderSocketId = userSocketMap[senderId.toString()];
            if (senderSocketId && senderSocketId !== senderId.toString()) {
              io.to(senderSocketId).emit("newMessage", aiMessage);
            }
          }
        } catch (aiErr) {
          console.error("Async SpaceAI response error:", aiErr);
          const fallbackMsg = await Message.create({
            senderId: receiverId,
            receiverId: senderId,
            text: "SpaceAI is temporarily unavailable. Please try again.",
            seen: true,
          });
          if (io) {
            io.to(senderId.toString()).emit("newMessage", fallbackMsg);
          }
        }
      })();

      return;
    }

    if (io) {
      io.to(receiverId.toString()).emit("newMessage", newMessage);
      const receiverSocketId = userSocketMap[receiverId];
      if (receiverSocketId && receiverSocketId !== receiverId.toString()) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }
    }

    return res.json({ success: true, newMessage });
  } catch (error) {
    console.error("sendMessage error:", error.message);
    res.json({ success: false, message: error.message });
  }
};
