import { useContext, useEffect, useState } from "react";
import assets from "../assets/assets";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

const RightSidebar = () => {
  const {
    selectedUser,
    messages,
    users,
    addGroupMembers,
    removeGroupMember,
    deleteGroup,
    summarizeGroup,
  } = useContext(ChatContext);

  const { logout, onlineUsers, authUser } = useContext(AuthContext);
  const [msgImages, setMsgImages] = useState([]);
  const [msgFiles, setMsgFiles] = useState([]);
  const [activeMediaTab, setActiveMediaTab] = useState("media");
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([]);
  const [memberSearchInput, setMemberSearchInput] = useState("");

  const isGroup = selectedUser?.isGroup;

  const isAdmin =
    isGroup &&
    (selectedUser.admin === authUser?._id ||
      selectedUser.admin?._id === authUser?._id);

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    setMsgImages(
      messages
        .filter((msg) => msg.image || (msg.fileUrl && msg.fileType === "image"))
        .map((msg) => msg.fileUrl || msg.image)
    );
    setMsgFiles(
      messages.filter((msg) => msg.fileUrl && msg.fileType !== "image")
    );
  }, [messages]);

  const handleAddMembersSubmit = async (e) => {
    e.preventDefault();
    if (selectedNewMemberIds.length === 0) {
      toast.error("Please select members to add");
      return;
    }

    const res = await addGroupMembers(selectedUser._id, selectedNewMemberIds);
    if (res.success) {
      setIsAddMemberModalOpen(false);
      setSelectedNewMemberIds([]);
    }
  };

  const toggleNewMemberSelection = (userId) => {
    setSelectedNewMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const existingMemberIds = (selectedUser?.members || []).map((m) =>
    m._id ? m._id.toString() : m.toString()
  );
  const availableUsersToAdd = users.filter(
    (u) => !existingMemberIds.includes(u._id.toString())
  );

  return (
    selectedUser && (
      <div
        className={`bg-[#8185B2]/10 text-white w-full relative overflow-y-scroll pb-24 border-l border-white/10 ${
          selectedUser ? "max-md:hidden" : ""
        }`}
      >
        <div className="pt-10 flex flex-col items-center gap-2 text-xs font-light px-5 text-center">
          {isGroup ? (
            selectedUser.groupPic ? (
              <img
                src={selectedUser.groupPic}
                alt={selectedUser.name}
                className="w-20 h-20 aspect-square rounded-full object-cover border-2 border-violet-500/40"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-violet-400/40">
                {selectedUser.name?.slice(0, 2).toUpperCase()}
              </div>
            )
          ) : (
            <img
              src={selectedUser?.profilePic || assets.avatar_icon}
              alt="profile"
              className="w-20 h-20 aspect-square rounded-full object-cover border-2 border-violet-500/30"
            />
          )}

          <h1 className="text-lg font-medium flex items-center justify-center gap-2 mt-1">
            {!isGroup &&
              (selectedUser.isAI ||
                selectedUser.email === "spaceai@system.local" ||
                selectedUser.fullName === "SpaceAI" ||
                onlineUsers.includes(selectedUser._id)) && (
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
              )}
            {isGroup ? selectedUser.name : selectedUser.fullName}
          </h1>

          <p className="text-gray-300 max-w-xs text-xs">
            {isGroup
              ? selectedUser.description || "No group description."
              : selectedUser.bio || "Hey there! I am using Quick Chat."}
          </p>

          {isGroup && (
            <button
              onClick={() =>
                summarizeGroup(selectedUser._id, selectedUser.name)
              }
              className="mt-2 w-full max-w-[220px] py-2 px-4 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md hover:opacity-90 transition-opacity cursor-pointer border border-violet-400/30"
            >
              <span>✨</span>
              <span>Gemini AI Summary</span>
            </button>
          )}
        </div>

        <hr className="border-[#ffffff30] my-4 mx-4" />

        {isGroup && (
          <div className="px-5 text-xs mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-gray-300">
                Members ({selectedUser.members?.length || 0})
              </p>
              {isAdmin && (
                <button
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="text-violet-400 hover:text-violet-300 text-[11px] font-medium cursor-pointer"
                >
                  + Add Member
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {(selectedUser.members || []).map((member) => {
                const memberId = member._id ? member._id.toString() : member.toString();
                const memberName = member.fullName || "User";
                const memberPic = member.profilePic || assets.avatar_icon;
                const isMemberAdmin =
                  selectedUser.admin === memberId ||
                  selectedUser.admin?._id === memberId;
                const isOnline = onlineUsers.includes(memberId) || member.isAI;

                return (
                  <div
                    key={memberId}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="relative">
                        <img
                          src={memberPic}
                          alt={memberName}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full ring-1 ring-[#282142]"></span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-gray-200 truncate font-medium">
                          {memberName}
                          {memberId === authUser?._id && " (You)"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isMemberAdmin && (
                        <span className="text-[10px] bg-violet-600/60 border border-violet-400/40 text-violet-200 px-1.5 py-0.5 rounded-full font-medium">
                          Admin
                        </span>
                      )}

                      {isAdmin && memberId !== authUser?._id && (
                        <button
                          onClick={() =>
                            removeGroupMember(selectedUser._id, memberId)
                          }
                          className="text-gray-400 hover:text-red-400 p-1 text-xs cursor-pointer"
                          title="Remove Member"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() =>
                  removeGroupMember(selectedUser._id, authUser._id)
                }
                className="w-full py-1.5 text-xs text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                🚪 Leave Group
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this group? All messages will be removed."
                      )
                    ) {
                      deleteGroup(selectedUser._id);
                    }
                  }}
                  className="w-full py-1.5 text-xs text-red-400 bg-red-950/40 border border-red-700/50 rounded-lg hover:bg-red-900/40 transition-colors cursor-pointer"
                >
                  🗑️ Delete Group
                </button>
              )}
            </div>

            <hr className="border-[#ffffff30] my-4" />
          </div>
        )}

        <div className="px-5 text-xs">
          <div className="flex items-center gap-2 mb-3 bg-black/20 p-1 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setActiveMediaTab("media")}
              className={`flex-1 py-1 text-center rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                activeMediaTab === "media"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Media ({msgImages.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveMediaTab("docs")}
              className={`flex-1 py-1 text-center rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                activeMediaTab === "docs"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Docs & Folders ({msgFiles.length})
            </button>
          </div>

          {activeMediaTab === "media" ? (
            msgImages.length > 0 ? (
              <div className="max-h-[160px] overflow-y-auto grid grid-cols-2 gap-2 opacity-90 pr-1">
                {msgImages.map((url, index) => (
                  <div
                    key={index}
                    onClick={() => window.open(url)}
                    className="cursor-pointer rounded overflow-hidden aspect-video bg-black/20"
                  >
                    <img
                      src={url}
                      alt="media"
                      className="w-full h-full object-cover rounded hover:scale-105 transition-transform"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic text-[11px]">
                No shared photos yet
              </p>
            )
          ) : (
            msgFiles.length > 0 ? (
              <div className="max-h-[180px] overflow-y-auto flex flex-col gap-2 pr-1">
                {msgFiles.map((fileMsg, index) => (
                  <div
                    key={fileMsg._id || index}
                    className="p-2 rounded-lg bg-[#282142]/80 border border-violet-500/20 flex items-center justify-between gap-2 hover:bg-violet-600/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">
                        {fileMsg.fileType === "folder" ? "📁" : "📄"}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-[11px] font-medium text-white truncate max-w-[130px]"
                          title={fileMsg.fileName}
                        >
                          {fileMsg.fileName || "File"}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {fileMsg.fileType === "folder"
                            ? "Folder Archive"
                            : (fileMsg.fileName?.split(".").pop() || "doc").toUpperCase()}{" "}
                          {fileMsg.fileSize ? `• ${formatFileSize(fileMsg.fileSize)}` : ""}
                        </p>
                      </div>
                    </div>

                    <a
                      href={fileMsg.fileUrl}
                      download={fileMsg.fileName || "download"}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 px-2 rounded bg-violet-600/40 hover:bg-violet-600 text-violet-200 hover:text-white text-[10px] font-medium transition-colors shrink-0"
                      title="Download"
                    >
                      ⬇️
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic text-[11px]">
                No shared documents or folders yet
              </p>
            )
          )}
        </div>

        <div className="px-5 mt-6">
          <button
            onClick={logout}
            className="w-full bg-gradient-to-r from-purple-400 to-violet-600 text-white border-none text-xs font-medium py-2 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
          >
            Logout
          </button>
        </div>

        {isAddMemberModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#282142] border border-gray-600 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-white flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700">
                <h2 className="font-semibold text-sm">Add Members to Group</h2>
                <button
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="text-gray-400 hover:text-white text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleAddMembersSubmit}
                className="p-5 flex flex-col gap-3 flex-1 overflow-hidden"
              >
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={memberSearchInput}
                  onChange={(e) => setMemberSearchInput(e.target.value)}
                  className="w-full p-2 bg-white/5 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none"
                />

                <div className="max-h-48 overflow-y-auto flex flex-col gap-1 border border-gray-700/60 rounded-lg p-2 bg-black/20 flex-1">
                  {availableUsersToAdd
                    .filter((u) =>
                      u.fullName
                        .toLowerCase()
                        .includes(memberSearchInput.toLowerCase())
                    )
                    .map((u) => {
                      const isSelected = selectedNewMemberIds.includes(u._id);
                      return (
                        <div
                          key={u._id}
                          onClick={() => toggleNewMemberSelection(u._id)}
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
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <span className="text-xs font-medium text-gray-200">
                              {u.fullName}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="accent-violet-500"
                          />
                        </div>
                      );
                    })}

                  {availableUsersToAdd.length === 0 && (
                    <p className="text-center text-gray-400 text-xs py-4">
                      All contacts are already in this group.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberModalOpen(false)}
                    className="flex-1 py-2 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedNewMemberIds.length === 0}
                    className="flex-1 py-2 text-xs rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 text-white font-medium cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    Add ({selectedNewMemberIds.length})
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  );
};

export default RightSidebar;
