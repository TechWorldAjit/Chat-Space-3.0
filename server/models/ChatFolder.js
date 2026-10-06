import mongoose from "mongoose";

const chatFolderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    chats: [
      {
        chatType: {
          type: String,
          enum: ["direct", "group"],
          required: true,
        },
        chatId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const ChatFolder = mongoose.model("ChatFolder", chatFolderSchema);

export default ChatFolder;
