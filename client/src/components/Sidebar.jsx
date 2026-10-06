import { useContext, useEffect, useState, useRef } from "react";
import assets from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import toast from "react-hot-toast";

const Sidebar = () => {
  const {
    getUsers,
    getGroups,
    getFolders,
    users,
    groups,
    folders,
    selectedUser,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    groupUnseenMessages,
    setGroupUnseenMessages,
    selectedFolder,
    setSelectedFolder,
    createGroup,
    createFolder,
    renameFolder,
    deleteFolder,
    addChatToFolder,
    removeChatFromFolder,
  } = useContext(ChatContext);

  const { logout, onlineUsers } = useContext(AuthContext);

  const [input, setInput] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderNameInput, setFolderNameInput] = useState("");

  // Folder context menu state
  const [activeFolderMenu, setActiveFolderMenu] = useState(null);

  // Add-to-folder dropdown state
  const [chatForFolderMenu, setChatForFolderMenu] = useState(null);

  // Create Group Form State
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupPicPreview, setGroupPicPreview] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    getUsers();
    getGroups();
    getFolders();
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
      if (!e.target.closest(".folder-menu-container")) {
        setActiveFolderMenu(null);
      }
      if (!e.target.closest(".chat-folder-menu")) {
        setChatForFolderMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter users by search
  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(input.toLowerCase())
  );

  // Filter groups by search
  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(input.toLowerCase())
  );

  // Get active folder's chats
  const activeFolderObj = folders.find((f) => f._id === selectedFolder);

  // Filter chats by selected folder
  const displayedUsers =
    selectedFolder === "all"
      ? filteredUsers
      : filteredUsers.filter((user) =>
          activeFolderObj?.chats?.some(
            (c) => c.chatType === "direct" && c.chatId.toString() === user._id.toString()
          )
        );

  const displayedGroups =
    selectedFolder === "all"
      ? filteredGroups
      : filteredGroups.filter((group) =>
          activeFolderObj?.chats?.some(
            (c) => c.chatType === "group" && c.chatId.toString() === group._id.toString()
          )
        );

  // Handle group image select
  const handleGroupPicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setGroupPicPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Toggle member in group creation
  const toggleMemberSelection = (userId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle Submit Create Group
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (selectedMemberIds.length === 0) {
      toast.error("Please select at least one group member");
      return;
    }

    setIsCreatingGroup(true);
    const res = await createGroup({
      name: groupName.trim(),
      description: groupDesc.trim(),
      groupPic: groupPicPreview,
      members: selectedMemberIds,
    });
    setIsCreatingGroup(false);

    if (res.success) {
      setIsGroupModalOpen(false);
      setGroupName("");
      setGroupDesc("");
      setGroupPicPreview("");
      setSelectedMemberIds([]);
    }
  };

  // Handle Create or Rename Folder
  const handleFolderSubmit = async (e) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    if (editingFolder) {
      await renameFolder(editingFolder._id, folderNameInput.trim());
    } else {
      await createFolder(folderNameInput.trim());
    }

    setIsFolderModalOpen(false);
    setEditingFolder(null);
    setFolderNameInput("");
  };

  // Handle Chat Folder toggle
  const handleToggleChatInFolder = async (folder, chatType, chatId) => {
    const isInside = folder.chats?.some(
      (c) => c.chatType === chatType && c.chatId.toString() === chatId.toString()
    );

    if (isInside) {
      await removeChatFromFolder(folder._id, chatId);
    } else {
      await addChatToFolder(folder._id, chatType, chatId);
    }
  };

  return (
    <div
      className={`bg-[#8185B2]/10 h-full p-5 border-r border-white/10 overflow-y-scroll text-white flex flex-col ${
        selectedUser ? "max-md:hidden" : ""
      }`}
    >
      {/* Top Header */}
      <div className="pb-4">
        <div className="flex justify-between items-center">
          <img src={assets.logo} alt="logo" className="max-w-40" />

          <div className="relative py-2 flex items-center gap-3" ref={menuRef}>
            {/* Quick Create Group Button */}
            <button
              onClick={() => setIsGroupModalOpen(true)}
              title="Create Group"
              className="w-7 h-7 rounded-full bg-violet-600/40 hover:bg-violet-600/70 border border-violet-400/40 flex items-center justify-center text-xs transition-colors cursor-pointer text-violet-200"
            >
              👥+
            </button>

            {/* Menu icon dropdown */}
            <div className="relative group">
              <img
                onClick={() => setIsMenuOpen((prev) => !prev)}
                src={assets.menu_icon}
                alt="menu"
                className="max-h-5 cursor-pointer"
              />
              {isMenuOpen && (
                <div className="absolute top-full right-0 z-30 w-40 p-3 rounded-xl bg-[#282142] border border-gray-600 text-gray-100 shadow-xl flex flex-col gap-1">
                  <p
                    onClick={() => {
                      setIsGroupModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="cursor-pointer text-sm p-1.5 hover:bg-white/10 rounded flex items-center gap-2"
                  >
                    <span>👥</span> New Group
                  </p>
                  <p
                    onClick={() => {
                      setEditingFolder(null);
                      setFolderNameInput("");
                      setIsFolderModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="cursor-pointer text-sm p-1.5 hover:bg-white/10 rounded flex items-center gap-2"
                  >
                    <span>📁</span> New Folder
                  </p>
                  <hr className="my-1 border-t border-gray-600" />
                  <p
                    onClick={() => {
                      navigate("/profile");
                      setIsMenuOpen(false);
                    }}
                    className="cursor-pointer text-sm p-1.5 hover:bg-white/10 rounded flex items-center gap-2"
                  >
                    <span>⚙️</span> Edit Profile
                  </p>
                  <p
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="cursor-pointer text-sm p-1.5 hover:bg-white/10 rounded text-red-400 flex items-center gap-2"
                  >
                    <span>🚪</span> Logout
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-[#282142] rounded-full flex items-center gap-2 py-2.5 px-4 mt-4">
          <img src={assets.search_icon} alt="Search" className="w-3" />
          <input
            onChange={(e) => setInput(e.target.value)}
            value={input}
            type="text"
            className="bg-transparent border-none outline-none text-white text-xs placeholder-[#c8c8c8] flex-1"
            placeholder="Search users or groups..."
          />
          {input && (
            <button
              onClick={() => setInput("")}
              className="text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Chat Folders Filter Pills */}
        <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
          <button
            onClick={() => setSelectedFolder("all")}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-all cursor-pointer font-medium ${
              selectedFolder === "all"
                ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow"
                : "bg-white/5 hover:bg-white/10 text-gray-300 border border-gray-700"
            }`}
          >
            All Chats
          </button>

          {folders.map((folder) => (
            <div
              key={folder._id}
              className="relative folder-menu-container flex items-center"
            >
              <button
                onClick={() => setSelectedFolder(folder._id)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 font-medium ${
                  selectedFolder === folder._id
                    ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 border border-gray-700"
                }`}
              >
                <span>📁</span>
                <span>{folder.name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveFolderMenu((prev) =>
                      prev === folder._id ? null : folder._id
                    );
                  }}
                  className="text-gray-400 hover:text-white ml-0.5"
                  title="Folder options"
                >
                  ⋮
                </span>
              </button>

              {/* Folder Context Menu */}
              {activeFolderMenu === folder._id && (
                <div className="absolute top-full left-0 mt-1 z-40 w-32 p-2 rounded-xl bg-[#282142] border border-gray-600 shadow-xl text-xs flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setEditingFolder(folder);
                      setFolderNameInput(folder.name);
                      setIsFolderModalOpen(true);
                      setActiveFolderMenu(null);
                    }}
                    className="text-left p-1.5 hover:bg-white/10 rounded cursor-pointer text-gray-200"
                  >
                    ✏️ Rename
                  </button>
                  <button
                    onClick={() => {
                      deleteFolder(folder._id);
                      setActiveFolderMenu(null);
                    }}
                    className="text-left p-1.5 hover:bg-white/10 rounded text-red-400 cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Create Folder Plus Button */}
          <button
            onClick={() => {
              setEditingFolder(null);
              setFolderNameInput("");
              setIsFolderModalOpen(true);
            }}
            title="Create New Folder"
            className="px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-violet-300 border border-dashed border-violet-500/40 cursor-pointer transition-colors text-xs font-semibold"
          >
            + Folder
          </button>
        </div>
      </div>

      {/* Main Chats List (Groups + Direct Messages) */}
      <div className="flex flex-col gap-1 flex-1 overflow-y-auto pr-0.5">
        {/* GROUPS SECTION */}
        {displayedGroups.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-violet-300/80 uppercase">
              Groups ({displayedGroups.length})
            </div>
            {displayedGroups.map((group) => {
              const isSelected =
                selectedUser?.isGroup && selectedUser?._id === group._id;
              const unseenCount = groupUnseenMessages[group._id] || 0;

              return (
                <div
                  key={group._id}
                  onClick={() => {
                    const groupChat = { ...group, isGroup: true };
                    setSelectedUser(groupChat);
                    setGroupUnseenMessages((prev) => ({
                      ...prev,
                      [group._id]: 0,
                    }));
                  }}
                  className={`group relative flex items-center justify-between p-2 pl-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#282142] border border-violet-500/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative">
                      {group.groupPic ? (
                        <img
                          src={group.groupPic}
                          alt={group.name}
                          className="w-9 h-9 rounded-full object-cover border border-violet-500/30"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-sm font-semibold shadow-inner border border-violet-400/30">
                          {group.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 bg-violet-800 text-[9px] px-1 rounded-full border border-violet-500 text-violet-200">
                        👥
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <p className="font-medium text-sm text-gray-100 truncate">
                        {group.name}
                      </p>
                      <span className="text-[11px] text-violet-300 truncate">
                        {group.members?.length || 0} members
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {unseenCount > 0 && (
                      <span className="text-xs h-5 min-w-[20px] px-1.5 flex justify-center items-center rounded-full bg-violet-600 text-white font-bold animate-pulse">
                        {unseenCount}
                      </span>
                    )}

                    {/* Folder assignment button */}
                    <div className="relative chat-folder-menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatForFolderMenu((prev) =>
                            prev === `group_${group._id}`
                              ? null
                              : `group_${group._id}`
                          );
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white p-1 rounded transition-opacity"
                        title="Organize in Folder"
                      >
                        📁
                      </button>

                      {chatForFolderMenu === `group_${group._id}` && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 z-40 w-44 p-3 rounded-xl bg-[#282142] border border-gray-600 shadow-2xl text-xs flex flex-col gap-2"
                        >
                          <p className="font-semibold text-gray-300 border-b border-gray-700 pb-1">
                            Save to Folder:
                          </p>
                          {folders.length === 0 ? (
                            <p className="text-gray-400 italic">No folders yet.</p>
                          ) : (
                            folders.map((f) => {
                              const isAdded = f.chats?.some(
                                (c) =>
                                  c.chatType === "group" &&
                                  c.chatId.toString() === group._id.toString()
                              );
                              return (
                                <label
                                  key={f._id}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isAdded}
                                    onChange={() =>
                                      handleToggleChatInFolder(
                                        f,
                                        "group",
                                        group._id
                                      )
                                    }
                                    className="accent-violet-500"
                                  />
                                  <span className="truncate">{f.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* DIRECT MESSAGES SECTION */}
        <div className="flex flex-col gap-1">
          <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
            Direct Messages ({displayedUsers.length})
          </div>

          {displayedUsers.map((user, index) => {
            const isSelected =
              !selectedUser?.isGroup && selectedUser?._id === user._id;
            const isOnline =
              user.isAI ||
              user.email === "spaceai@system.local" ||
              user.fullName === "SpaceAI" ||
              onlineUsers.includes(user._id);

            return (
              <div
                key={index}
                onClick={() => {
                  const directUser = { ...user, isGroup: false };
                  setSelectedUser(directUser);
                  setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
                }}
                className={`group relative flex items-center justify-between p-2 pl-3 rounded-xl cursor-pointer transition-colors max-sm:text-sm ${
                  isSelected
                    ? "bg-[#282142] border border-violet-500/30"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="relative">
                    <img
                      src={user?.profilePic || assets.avatar_icon}
                      alt="profile"
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-[#282142]"></span>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <p className="font-medium text-sm text-gray-100 truncate">
                      {user.fullName}
                    </p>
                    {isOnline ? (
                      <span className="text-green-400 text-xs">Online</span>
                    ) : (
                      <span className="text-neutral-400 text-xs">Offline</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {unseenMessages[user._id] > 0 && (
                    <span className="text-xs h-5 min-w-[20px] px-1.5 flex justify-center items-center rounded-full bg-violet-500/70 text-white font-bold">
                      {unseenMessages[user._id]}
                    </span>
                  )}

                  {/* Folder assignment button */}
                  <div className="relative chat-folder-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatForFolderMenu((prev) =>
                          prev === `user_${user._id}`
                            ? null
                            : `user_${user._id}`
                        );
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white p-1 rounded transition-opacity"
                      title="Organize in Folder"
                    >
                      📁
                    </button>

                    {chatForFolderMenu === `user_${user._id}` && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 z-40 w-44 p-3 rounded-xl bg-[#282142] border border-gray-600 shadow-2xl text-xs flex flex-col gap-2"
                      >
                        <p className="font-semibold text-gray-300 border-b border-gray-700 pb-1">
                          Save to Folder:
                        </p>
                        {folders.length === 0 ? (
                          <p className="text-gray-400 italic">No folders yet.</p>
                        ) : (
                          folders.map((f) => {
                            const isAdded = f.chats?.some(
                              (c) =>
                                c.chatType === "direct" &&
                                c.chatId.toString() === user._id.toString()
                            );
                            return (
                              <label
                                key={f._id}
                                className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded"
                              >
                                <input
                                  type="checkbox"
                                  checked={isAdded}
                                  onChange={() =>
                                    handleToggleChatInFolder(
                                      f,
                                      "direct",
                                      user._id
                                    )
                                  }
                                  className="accent-violet-500"
                                />
                                <span className="truncate">{f.name}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {displayedUsers.length === 0 && displayedGroups.length === 0 && (
          <div className="py-10 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
            <span>🔍</span>
            <p>No conversations found</p>
            {selectedFolder !== "all" && (
              <button
                onClick={() => setSelectedFolder("all")}
                className="text-violet-400 underline hover:text-violet-300"
              >
                View all chats
              </button>
            )}
          </div>
        )}
      </div>

      {/* ================= MODAL: CREATE GROUP ================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#282142] border border-gray-600 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <span>👥</span> Create New Group
              </h2>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-gray-400 hover:text-white text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreateGroupSubmit}
              className="p-6 flex flex-col gap-4 overflow-y-auto flex-1"
            >
              {/* Group Avatar Upload */}
              <div className="flex items-center gap-4">
                <label
                  htmlFor="groupPic"
                  className="w-16 h-16 rounded-full bg-white/5 border border-dashed border-violet-400/50 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                >
                  {groupPicPreview ? (
                    <img
                      src={groupPicPreview}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-[10px] text-gray-400">
                      <span className="text-base block">📷</span>
                      Photo
                    </div>
                  )}
                  <input
                    id="groupPic"
                    type="file"
                    accept="image/*"
                    onChange={handleGroupPicChange}
                    className="hidden"
                  />
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    placeholder="Group Name *"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full p-2.5 bg-white/5 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Group Description */}
              <textarea
                rows={2}
                placeholder="Group Description (optional)..."
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                className="w-full p-2.5 bg-white/5 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-violet-500"
              />

              {/* Select Members Section */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-300">
                    Add Members ({selectedMemberIds.length} selected)
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={memberSearchInput}
                  onChange={(e) => setMemberSearchInput(e.target.value)}
                  className="w-full p-2 bg-white/5 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none"
                />

                <div className="max-h-44 overflow-y-auto flex flex-col gap-1 border border-gray-700/60 rounded-lg p-2 bg-black/20">
                  {users
                    .filter((u) =>
                      u.fullName
                        .toLowerCase()
                        .includes(memberSearchInput.toLowerCase())
                    )
                    .map((u) => {
                      const isSelected = selectedMemberIds.includes(u._id);
                      return (
                        <div
                          key={u._id}
                          onClick={() => toggleMemberSelection(u._id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-violet-600/30 border border-violet-500/40"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={u.profilePic || assets.avatar_icon}
                              alt={u.fullName}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-200">
                                {u.fullName}
                              </span>
                              {u.isAI && (
                                <span className="text-[10px] text-violet-400">
                                  AI Assistant
                                </span>
                              )}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="accent-violet-500"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreatingGroup}
                className="w-full py-3 mt-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {isCreatingGroup ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    Creating Group...
                  </>
                ) : (
                  "Create Group"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE / RENAME FOLDER ================= */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#282142] border border-gray-600 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-white flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <span>📁</span>
                {editingFolder ? "Rename Folder" : "New Chat Folder"}
              </h2>
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="text-gray-400 hover:text-white text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFolderSubmit} className="p-6 flex flex-col gap-4">
              <p className="text-xs text-gray-300">
                Folders are 100% private to you. Organize your direct and group
                conversations easily.
              </p>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Work, College, Friends"
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                className="w-full p-2.5 bg-white/5 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-violet-500"
              />

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="flex-1 py-2 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 text-white font-medium cursor-pointer hover:opacity-90"
                >
                  {editingFolder ? "Save Changes" : "Create Folder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
