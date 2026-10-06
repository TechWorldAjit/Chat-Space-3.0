import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // Can be a User or a Group (with isGroup: true)
  const [unseenMessages, setUnseenMessages] = useState({});
  const [groupUnseenMessages, setGroupUnseenMessages] = useState({});
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // AI Summary Modal State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryGroupName, setSummaryGroupName] = useState("");

  const { socket, axios, authUser } = useContext(AuthContext);

  // Function to get all users for sidebar
  const getUsers = async () => {
    try {
      const { data } = await axios.get("/api/messages/users");

      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages || {});
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Function to get all groups for current user
  const getGroups = async () => {
    try {
      const { data } = await axios.get("/api/groups");
      if (data.success) {
        setGroups(data.groups);
        setGroupUnseenMessages(data.unseenMessages || {});
      }
    } catch (error) {
      console.error("Failed to load groups:", error.message);
    }
  };

  // Function to get private folders for current user
  const getFolders = async () => {
    try {
      const { data } = await axios.get("/api/folders");
      if (data.success) {
        setFolders(data.folders);
      }
    } catch (error) {
      console.error("Failed to load folders:", error.message);
    }
  };

  // Function to get messages for selected user (1-to-1)
  const getMessages = async (userId) => {
    try {
      setIsAiTyping(false);
      const { data } = await axios.get(`/api/messages/${userId}`);

      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Function to get messages for selected group
  const getGroupMessages = async (groupId) => {
    try {
      setIsAiTyping(false);
      const { data } = await axios.get(`/api/groups/${groupId}/messages`);

      if (data.success) {
        setMessages(data.messages);
        setGroupUnseenMessages((prev) => ({ ...prev, [groupId]: 0 }));
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Function to send message to selected user (1-to-1)
  const sendMessage = async (messageData) => {
    try {
      if (!selectedUser) return;

      // Check if it is a group chat
      if (selectedUser.isGroup) {
        return await sendGroupMessage(messageData);
      }

      const isAI =
        selectedUser?.isAI ||
        selectedUser?.email === "spaceai@system.local" ||
        selectedUser?.fullName === "SpaceAI";

      if (isAI) {
        setIsAiTyping(true);
      }

      if (messageData.fileData || messageData.image) {
        setIsUploadingFile(true);
      }

      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData
      );

      if (data.success) {
        setMessages((prevMessages) => [...prevMessages, data.newMessage]);
        return data;
      } else {
        setIsAiTyping(false);
        toast.error(data.message);
        return data;
      }
    } catch (error) {
      setIsAiTyping(false);
      toast.error(error.message);
      return { success: false, message: error.message };
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Function to send message to selected group
  const sendGroupMessage = async (messageData) => {
    try {
      if (!selectedUser || !selectedUser.isGroup) return;

      if (messageData.fileData || messageData.image) {
        setIsUploadingFile(true);
      }

      const { data } = await axios.post(
        `/api/groups/${selectedUser._id}/messages`,
        messageData
      );

      if (data.success) {
        // Optimistically add if not already received via socket
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.newMessage._id)) return prev;
          return [...prev, data.newMessage];
        });
        return data;
      } else {
        toast.error(data.message);
        return data;
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false, message: error.message };
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Create a new group
  const createGroup = async (groupData) => {
    try {
      const { data } = await axios.post("/api/groups", groupData);
      if (data.success) {
        toast.success(data.message || "Group created successfully");
        const newGroup = { ...data.group, isGroup: true };
        setGroups((prev) => [newGroup, ...prev]);
        setSelectedUser(newGroup);
        return { success: true, group: newGroup };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false, message: error.message };
    }
  };

  // Update group details
  const updateGroup = async (groupId, updateData) => {
    try {
      const { data } = await axios.put(`/api/groups/${groupId}`, updateData);
      if (data.success) {
        toast.success(data.message || "Group updated successfully");
        const updated = { ...data.group, isGroup: true };
        setGroups((prev) =>
          prev.map((g) => (g._id === groupId ? updated : g))
        );
        if (selectedUser?._id === groupId) {
          setSelectedUser(updated);
        }
        return { success: true, group: updated };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  // Add members to group
  const addGroupMembers = async (groupId, memberIds) => {
    try {
      const { data } = await axios.post(`/api/groups/${groupId}/members`, {
        memberIds,
      });
      if (data.success) {
        toast.success("Members added successfully");
        const updated = { ...data.group, isGroup: true };
        setGroups((prev) =>
          prev.map((g) => (g._id === groupId ? updated : g))
        );
        if (selectedUser?._id === groupId) {
          setSelectedUser(updated);
        }
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  // Remove member from group or leave group
  const removeGroupMember = async (groupId, memberId) => {
    try {
      const { data } = await axios.delete(
        `/api/groups/${groupId}/members/${memberId}`
      );
      if (data.success) {
        toast.success(data.message || "Member removed");
        if (memberId === authUser?._id) {
          // If current user left
          setGroups((prev) => prev.filter((g) => g._id !== groupId));
          if (selectedUser?._id === groupId) {
            setSelectedUser(null);
          }
        } else if (data.group) {
          const updated = { ...data.group, isGroup: true };
          setGroups((prev) =>
            prev.map((g) => (g._id === groupId ? updated : g))
          );
          if (selectedUser?._id === groupId) {
            setSelectedUser(updated);
          }
        }
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  // Delete group
  const deleteGroup = async (groupId) => {
    try {
      const { data } = await axios.delete(`/api/groups/${groupId}`);
      if (data.success) {
        toast.success(data.message || "Group deleted");
        setGroups((prev) => prev.filter((g) => g._id !== groupId));
        if (selectedUser?._id === groupId) {
          setSelectedUser(null);
        }
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  // Folder Actions
  const createFolder = async (name) => {
    try {
      const { data } = await axios.post("/api/folders", { name });
      if (data.success) {
        toast.success(data.message || "Folder created");
        setFolders((prev) => [...prev, data.folder]);
        return { success: true, folder: data.folder };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  const renameFolder = async (folderId, name) => {
    try {
      const { data } = await axios.put(`/api/folders/${folderId}`, { name });
      if (data.success) {
        toast.success(data.message || "Folder renamed");
        setFolders((prev) =>
          prev.map((f) => (f._id === folderId ? data.folder : f))
        );
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  const deleteFolder = async (folderId) => {
    try {
      const { data } = await axios.delete(`/api/folders/${folderId}`);
      if (data.success) {
        toast.success(data.message || "Folder deleted");
        setFolders((prev) => prev.filter((f) => f._id !== folderId));
        if (selectedFolder === folderId) {
          setSelectedFolder("all");
        }
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  const addChatToFolder = async (folderId, chatType, chatId) => {
    try {
      const { data } = await axios.post(`/api/folders/${folderId}/add-chat`, {
        chatType,
        chatId,
      });
      if (data.success) {
        toast.success("Chat added to folder");
        setFolders((prev) =>
          prev.map((f) => (f._id === folderId ? data.folder : f))
        );
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  const removeChatFromFolder = async (folderId, chatId) => {
    try {
      const { data } = await axios.post(
        `/api/folders/${folderId}/remove-chat`,
        { chatId }
      );
      if (data.success) {
        toast.success("Chat removed from folder");
        setFolders((prev) =>
          prev.map((f) => (f._id === folderId ? data.folder : f))
        );
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false };
    }
  };

  // AI Group Summary Trigger
  const summarizeGroup = async (groupId, groupName = "") => {
    try {
      setSummaryGroupName(groupName || selectedUser?.name || "Group");
      setIsSummaryLoading(true);
      setIsSummaryModalOpen(true);
      setSummaryData(null);

      const { data } = await axios.post(`/api/ai/group-summary/${groupId}`);

      if (data.success) {
        setSummaryData({
          summary: data.summary,
          keyTakeaways: data.keyTakeaways,
        });
      } else {
        toast.error(data.message || "Failed to generate summary");
        setSummaryData({
          summary: data.message || "Could not generate summary.",
          keyTakeaways: [],
        });
      }
    } catch (error) {
      toast.error(error.message || "AI summary generation failed");
      setSummaryData({
        summary: "Error generating summary. Please try again.",
        keyTakeaways: [],
      });
    } finally {
      setIsSummaryLoading(false);
    }
  };

  // Subscribe to realtime messages & group events
  const subscribeToMessages = () => {
    if (!socket) return;

    // 1-to-1 message listener
    socket.on("newMessage", (newMessage) => {
      if (
        selectedUser &&
        !selectedUser.isGroup &&
        newMessage.senderId === selectedUser._id
      ) {
        setIsAiTyping(false);
        newMessage.seen = true;
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        axios.put(`/api/messages/mark/${newMessage._id}`);
      } else if (!selectedUser?.isGroup) {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
            ? prevUnseenMessages[newMessage.senderId] + 1
            : 1,
        }));
      }
    });

    // Group message listener
    socket.on("newGroupMessage", (newGroupMsg) => {
      const isCurrentGroup =
        selectedUser &&
        selectedUser.isGroup &&
        selectedUser._id === newGroupMsg.groupId;

      if (isCurrentGroup) {
        setMessages((prevMessages) => {
          if (prevMessages.some((m) => m._id === newGroupMsg._id)) {
            return prevMessages;
          }
          return [...prevMessages, newGroupMsg];
        });
      } else {
        setGroupUnseenMessages((prev) => ({
          ...prev,
          [newGroupMsg.groupId]: (prev[newGroupMsg.groupId] || 0) + 1,
        }));
      }
    });

    // Realtime group creation / update / deletion listeners
    socket.on("newGroupCreated", (newGroup) => {
      setGroups((prev) => {
        if (prev.some((g) => g._id === newGroup._id)) return prev;
        return [{ ...newGroup, isGroup: true }, ...prev];
      });
    });

    socket.on("groupUpdated", (updatedGroup) => {
      setGroups((prev) =>
        prev.map((g) =>
          g._id === updatedGroup._id ? { ...updatedGroup, isGroup: true } : g
        )
      );
      if (selectedUser?._id === updatedGroup._id) {
        setSelectedUser({ ...updatedGroup, isGroup: true });
      }
    });

    socket.on("groupDeleted", ({ groupId }) => {
      setGroups((prev) => prev.filter((g) => g._id !== groupId));
      if (selectedUser?._id === groupId) {
        setSelectedUser(null);
        toast("This group was closed or deleted", { icon: "ℹ️" });
      }
    });
  };

  // Unsubscribe from socket listeners
  const unsubscribeFromMessages = () => {
    if (!socket) return;
    socket.off("newMessage");
    socket.off("newGroupMessage");
    socket.off("newGroupCreated");
    socket.off("groupUpdated");
    socket.off("groupDeleted");
  };

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser]);

  const value = {
    messages,
    users,
    groups,
    folders,
    selectedUser,
    selectedFolder,
    unseenMessages,
    groupUnseenMessages,
    isAiTyping,
    isUploadingFile,
    isSummaryModalOpen,
    isSummaryLoading,
    summaryData,
    summaryGroupName,
    setSelectedFolder,
    setIsSummaryModalOpen,
    getUsers,
    getGroups,
    getFolders,
    getMessages,
    getGroupMessages,
    sendMessage,
    sendGroupMessage,
    setSelectedUser,
    setUnseenMessages,
    setGroupUnseenMessages,
    createGroup,
    updateGroup,
    addGroupMembers,
    removeGroupMember,
    deleteGroup,
    createFolder,
    renameFolder,
    deleteFolder,
    addChatToFolder,
    removeChatFromFolder,
    summarizeGroup,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
