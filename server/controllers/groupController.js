import Group from "../models/Group.js";
import Message from "../models/Messages.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import { saveUpload } from "../lib/uploadHelper.js";
import { io, userSocketMap } from "../lib/socket.js";

const emitToGroupMembers = (memberIds, eventName, data) => {
  if (!io || !memberIds || !Array.isArray(memberIds)) return;
  memberIds.forEach((member) => {
    const memberIdStr = member._id ? member._id.toString() : member.toString();
    io.to(memberIdStr).emit(eventName, data);
    const socketId = userSocketMap[memberIdStr];
    if (socketId && socketId !== memberIdStr) {
      io.to(socketId).emit(eventName, data);
    }
  });
};

export const createGroup = async (req, res) => {
  try {
    const { name, description = "", groupPic = "", members = [] } = req.body;
    const adminId = req.user._id;

    if (!name || name.trim() === "") {
      return res.json({ success: false, message: "Group name is required" });
    }

    const memberSet = new Set(members.map((id) => id.toString()));
    memberSet.add(adminId.toString());
    const memberArray = Array.from(memberSet);

    let imageUrl = "";
    if (groupPic && groupPic.startsWith("data:image")) {
      const uploadResponse = await cloudinary.uploader.upload(groupPic, {
        folder: "group_pics",
      });
      imageUrl = uploadResponse.secure_url;
    } else if (groupPic) {
      imageUrl = groupPic;
    }

    const newGroup = await Group.create({
      name: name.trim(),
      description: description.trim(),
      groupPic: imageUrl,
      admin: adminId,
      members: memberArray,
    });

    const populatedGroup = await Group.findById(newGroup._id)
      .populate("admin", "fullName email profilePic bio isAI")
      .populate("members", "fullName email profilePic bio isAI");

    emitToGroupMembers(populatedGroup.members, "newGroupCreated", populatedGroup);

    return res.json({
      success: true,
      group: populatedGroup,
      message: "Group created successfully",
    });
  } catch (error) {
    console.error("Create Group Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({ members: userId })
      .populate("admin", "fullName email profilePic bio isAI")
      .populate("members", "fullName email profilePic bio isAI")
      .sort({ updatedAt: -1 });

    const unseenPromises = groups.map(async (group) => {
      const count = await Message.countDocuments({
        groupId: group._id,
        senderId: { $ne: userId },
        seenBy: { $ne: userId },
      });
      return { id: group._id.toString(), count };
    });
    const results = await Promise.all(unseenPromises);
    const unseenMessages = {};
    results.forEach(({ id, count }) => {
      if (count > 0) unseenMessages[id] = count;
    });

    return res.json({
      success: true,
      groups,
      unseenMessages,
    });
  } catch (error) {
    console.error("Get Groups Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId)
      .populate("admin", "fullName email profilePic bio isAI")
      .populate("members", "fullName email profilePic bio isAI");

    if (!group) {
      return res.json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some(
      (m) => m._id.toString() === userId.toString()
    );
    if (!isMember) {
      return res.json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    return res.json({ success: true, group });
  } catch (error) {
    console.error("Get Group By ID Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some(
      (m) => m.toString() === userId.toString()
    );
    if (!isMember) {
      return res.json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    const messages = await Message.find({ groupId })
      .populate("senderId", "fullName email profilePic bio isAI")
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { groupId, seenBy: { $ne: userId } },
      { $addToSet: { seenBy: userId } }
    );

    return res.json({ success: true, messages });
  } catch (error) {
    console.error("Get Group Messages Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const {
      text = "",
      image = "",
      fileData = "",
      fileName = "",
      fileType = "",
      fileSize = 0,
      folderFileCount = 0,
    } = req.body;
    const senderId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some(
      (m) => m.toString() === senderId.toString()
    );
    if (!isMember) {
      return res.json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    let imageUrl = "";
    let uploadedFileUrl = "";

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
      groupId,
      text,
      image: imageUrl,
      fileUrl: uploadedFileUrl,
      fileName,
      fileType,
      fileSize,
      folderFileCount,
      seenBy: [senderId],
    });

    const populatedMessage = await Message.findById(newMessage._id).populate(
      "senderId",
      "fullName email profilePic bio isAI"
    );

    await Group.findByIdAndUpdate(groupId, { updatedAt: new Date() });

    emitToGroupMembers(group.members, "newGroupMessage", populatedMessage);

    return res.json({ success: true, newMessage: populatedMessage });
  } catch (error) {
    console.error("Send Group Message Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, groupPic } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.json({ success: false, message: "Group not found" });
    }

    if (group.admin.toString() !== userId.toString()) {
      return res.json({
        success: false,
        message: "Only group admin can update group details",
      });
    }

    const updateData = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();

    if (groupPic && groupPic.startsWith("data:image")) {
      const uploadResponse = await cloudinary.uploader.upload(groupPic, {
        folder: "group_pics",
      });
      updateData.groupPic = uploadResponse.secure_url;
    } else if (groupPic !== undefined) {
      updateData.groupPic = groupPic;
    }

    const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, {
      new: true,
    })
      .populate("admin", "fullName email profilePic bio isAI")
      .populate("members", "fullName email profilePic bio isAI");

    emitToGroupMembers(updatedGroup.members, "groupUpdated", updatedGroup);

    return res.json({
      success: true,
      group: updatedGroup,
      message: "Group updated successfully",
    });
  } catch (error) {
    console.error("Update Group Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const addGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.json({ success: false, message: "No members specified" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.json({ success: false, message: "Group not found" });
    }

    if (group.admin.toString() !== userId.toString()) {
      return res.json({
        success: false,
        message: "Only group admin can add members",
      });
    }

    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: { $each: memberIds } } },
      { new: true }
    )
      .populate("admin", "fullName email profilePic bio isAI")
      .populate("members", "fullName email profilePic bio isAI");

    emitToGroupMembers(updatedGroup.members, "groupUpdated", updatedGroup);

    return res.json({
      success: true,
      group: updatedGroup,
      message: "Members added successfully",
    });
  } catch (error) {
    console.error("Add Group Members Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.json({ success: false, message: "Group not found" });
    }

    const isAdmin = group.admin.toString() === currentUserId.toString();
    const isSelf = memberId.toString() === currentUserId.toString();

    if (!isAdmin && !isSelf) {
      return res.json({
        success: false,
        message: "You are not authorized to remove this member",
      });
    }

    let newAdmin = group.admin;
    const remainingMembers = group.members.filter(
      (m) => m.toString() !== memberId.toString()
    );

    if (remainingMembers.length === 0) {
      await Group.findByIdAndDelete(groupId);
      await Message.deleteMany({ groupId });
      emitToGroupMembers([memberId], "groupDeleted", { groupId });
      return res.json({
        success: true,
        message: "Group has been deleted as all members left",
      });
    }

    if (group.admin.toString() === memberId.toString()) {
      newAdmin = remainingMembers[0];
    }

    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      {
        members: remainingMembers,
        admin: newAdmin,
      },
      { new: true }
    )
      .populate("admin", "fullName email profilePic bio isAI")
      .populate("members", "fullName email profilePic bio isAI");

    emitToGroupMembers(
      [...remainingMembers, memberId],
      "groupUpdated",
      updatedGroup
    );

    return res.json({
      success: true,
      group: updatedGroup,
      message: isSelf ? "Left group successfully" : "Member removed successfully",
    });
  } catch (error) {
    console.error("Remove Group Member Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.json({ success: false, message: "Group not found" });
    }

    if (group.admin.toString() !== userId.toString()) {
      return res.json({
        success: false,
        message: "Only group admin can delete the group",
      });
    }

    const memberIds = [...group.members];

    await Group.findByIdAndDelete(groupId);
    await Message.deleteMany({ groupId });

    emitToGroupMembers(memberIds, "groupDeleted", { groupId });

    return res.json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.error("Delete Group Error:", error.message);
    return res.json({ success: false, message: error.message });
  }
};
