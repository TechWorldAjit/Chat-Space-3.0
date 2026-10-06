import { useContext, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import { CallContext } from "../../context/CallContext";
import AISummaryModal from "./AISummaryModal";
import toast from "react-hot-toast";

const ChatContainer = () => {
  const {
    messages,
    selectedUser,
    setSelectedUser,
    sendMessage,
    getMessages,
    getGroupMessages,
    isAiTyping,
    isUploadingFile,
    summarizeGroup,
    isSummaryModalOpen,
    isSummaryLoading,
    summaryData,
    summaryGroupName,
    setIsSummaryModalOpen,
  } = useContext(ChatContext);

  const { authUser, onlineUsers } = useContext(AuthContext);
  const { startCall, callState } = useContext(CallContext);

  const scrollEnd = useRef();
  const docInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const [input, setInput] = useState("");
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState(null);

  const isGroup = selectedUser?.isGroup;

  const isSelectedUserAI =
    !isGroup &&
    (selectedUser?.isAI ||
      selectedUser?.email === "spaceai@system.local" ||
      selectedUser?.fullName === "SpaceAI");

  // Helper to format **bold** text inside chat messages
  const renderFormattedText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return (
          <strong key={i} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Format file size nicely
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file extension
  const getFileExt = (name = "") => {
    return name.includes(".") ? name.split(".").pop().toLowerCase() : "file";
  };

  // Direct file download handler with fallback
  const handleDownload = async (fileUrl, fileName) => {
    if (!fileUrl) return;
    const toastId = toast.loading(`Downloading ${fileName || "file"}...`);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.dismiss(toastId);
      toast.success(`Downloaded ${fileName || "file"}`);
    } catch {
      toast.dismiss(toastId);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.target = "_blank";
      link.download = fileName || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Render colored file type badge matching WhatsApp (PDF in red, Excel in green, etc.)
  const renderFileBadge = (fileName = "", fileType = "") => {
    const ext = getFileExt(fileName).toUpperCase();
    if (fileType === "folder" || ext === "ZIP" || ext === "RAR" || ext === "TAR" || ext === "7Z") {
      return (
        <div className="w-10 h-11 rounded-lg bg-slate-600/90 flex flex-col items-center justify-center text-white shrink-0 shadow-sm border border-slate-400/20 font-bold">
          <span className="text-[10px] leading-none uppercase tracking-wider">{fileType === "folder" ? "DIR" : "ZIP"}</span>
        </div>
      );
    }
    if (ext === "PDF") {
      return (
        <div className="w-10 h-11 rounded-lg bg-red-600 flex flex-col items-center justify-center text-white shrink-0 shadow-sm border border-red-400/20 font-bold">
          <span className="text-[10px] leading-none uppercase tracking-wider">PDF</span>
        </div>
      );
    }
    if (["XLS", "XLSX", "CSV"].includes(ext)) {
      return (
        <div className="w-10 h-11 rounded-lg bg-emerald-600 flex flex-col items-center justify-center text-white shrink-0 shadow-sm border border-emerald-400/20 font-bold">
          <span className="text-xs leading-none">X</span>
        </div>
      );
    }
    if (["DOC", "DOCX"].includes(ext)) {
      return (
        <div className="w-10 h-11 rounded-lg bg-blue-600 flex flex-col items-center justify-center text-white shrink-0 shadow-sm border border-blue-400/20 font-bold">
          <span className="text-[10px] leading-none uppercase tracking-wider">DOC</span>
        </div>
      );
    }
    if (["PPT", "PPTX"].includes(ext)) {
      return (
        <div className="w-10 h-11 rounded-lg bg-amber-600 flex flex-col items-center justify-center text-white shrink-0 shadow-sm border border-amber-400/20 font-bold">
          <span className="text-[10px] leading-none uppercase tracking-wider">PPT</span>
        </div>
      );
    }
    return (
      <div className="w-10 h-11 rounded-lg bg-violet-600 flex flex-col items-center justify-center text-white shrink-0 shadow-sm border border-violet-400/20 font-bold">
        <span className="text-[9px] leading-none uppercase truncate max-w-[34px] px-0.5">{ext.slice(0, 4)}</span>
      </div>
    );
  };

  // Icon badge for different file types
  const getFileIconBadge = (name = "") => {
    const ext = getFileExt(name);
    if (ext === "pdf") return "📕";
    if (["doc", "docx"].includes(ext)) return "📘";
    if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
    if (["ppt", "pptx"].includes(ext)) return "📙";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
    if (["txt", "md"].includes(ext)) return "📝";
    if (["mp3", "wav", "ogg"].includes(ext)) return "🎵";
    if (["mp4", "mkv", "mov", "webm"].includes(ext)) return "🎬";
    return "📄";
  };

  // Handle selecting an image
  const handleImageSelected = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image file exceeds 25MB limit");
      return;
    }

    setStagedAttachment({
      type: "image",
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      fileType: "image",
    });
    e.target.value = "";
  };

  // Handle selecting a document/file
  const handleDocSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 35 * 1024 * 1024) {
      toast.error("File exceeds 35MB limit");
      return;
    }

    const ext = getFileExt(file.name);
    setStagedAttachment({
      type: "document",
      file,
      name: file.name,
      size: file.size,
      ext,
      fileType: ext === "pdf" ? "pdf" : "document",
    });
    e.target.value = "";
  };

  // Handle selecting an entire folder
  const handleFolderSelected = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const firstPath = files[0].webkitRelativePath || files[0].name;
    const folderName = firstPath.split("/")[0] || "Folder";

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 40 * 1024 * 1024) {
      toast.error("Total folder size exceeds 40MB limit");
      e.target.value = "";
      return;
    }

    const toastId = toast.loading(
      `Compressing folder "${folderName}" (${files.length} files)...`
    );

    try {
      const zip = new JSZip();
      for (const f of files) {
        const relativePath = f.webkitRelativePath || f.name;
        zip.file(relativePath, f);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      toast.dismiss(toastId);
      toast.success(`Folder "${folderName}" compressed and ready to send!`);

      setStagedAttachment({
        type: "folder",
        blob: zipBlob,
        name: `${folderName}.zip`,
        folderName,
        size: zipBlob.size,
        fileCount: files.length,
        fileType: "folder",
      });
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to compress folder: " + err.message);
    }
    e.target.value = "";
  };

  // Handle sending a message (text, document, image, or folder)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (isUploadingFile) return;

    if (stagedAttachment) {
      const reader = new FileReader();
      const payloadFile = stagedAttachment.file || stagedAttachment.blob;
      const currentStaged = stagedAttachment;
      setStagedAttachment(null);
      setIsAttachMenuOpen(false);

      reader.readAsDataURL(payloadFile);
      reader.onloadend = async () => {
        const base64Data = reader.result;

        const payload = {
          text: input.trim(),
          fileName: currentStaged.name,
          fileType: currentStaged.fileType || currentStaged.type,
          fileSize: currentStaged.size,
          folderFileCount: currentStaged.fileCount || 0,
        };

        if (currentStaged.type === "image") {
          payload.image = base64Data;
          payload.fileData = base64Data;
        } else {
          payload.fileData = base64Data;
        }

        setInput("");
        await sendMessage(payload);
      };
      return;
    }

    if (input.trim() === "") return;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  useEffect(() => {
    if (selectedUser) {
      if (selectedUser.isGroup) {
        getGroupMessages(selectedUser._id);
      } else {
        getMessages(selectedUser._id);
      }
    }
  }, [selectedUser]);

  useEffect(() => {
    if (scrollEnd.current && (messages || isAiTyping)) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAiTyping]);

  return selectedUser ? (
    <div className="h-full overflow-hidden flex flex-col relative backdrop-blur-lg">
      {/* --------- header --------- */}
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500/60 justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          {isGroup ? (
            selectedUser.groupPic ? (
              <img
                src={selectedUser.groupPic}
                alt={selectedUser.name}
                className="w-9 h-9 rounded-full object-cover border border-violet-500/30"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-sm font-semibold text-white shadow">
                {selectedUser.name?.slice(0, 2).toUpperCase()}
              </div>
            )
          ) : (
            <img
              src={selectedUser.profilePic || assets.avatar_icon}
              alt="profile"
              className="w-9 h-9 rounded-full object-cover"
            />
          )}

          {/* Name & Subtitle */}
          <div className="flex flex-col min-w-0">
            <p className="text-base font-medium text-white flex items-center gap-2 truncate">
              {isGroup ? selectedUser.name : selectedUser.fullName}
              {!isGroup &&
                (isSelectedUserAI || onlineUsers.includes(selectedUser._id)) && (
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                )}
            </p>
            <span className="text-xs text-gray-400 truncate">
              {isGroup
                ? `${selectedUser.members?.length || 0} members`
                : isSelectedUserAI
                ? "SpaceAI Assistant"
                : onlineUsers.includes(selectedUser._id)
                ? "Online"
                : "Offline"}
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Direct 1-to-1 Voice & Video Call Buttons */}
          {!isGroup && !isSelectedUserAI && (
            <>
              <button
                type="button"
                onClick={() => startCall({ recipient: selectedUser, callType: "voice" })}
                disabled={callState !== "idle"}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-violet-600/30 text-violet-300 hover:text-white border border-white/10 hover:border-violet-400/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Start Voice Call"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => startCall({ recipient: selectedUser, callType: "video" })}
                disabled={callState !== "idle"}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-white/10 hover:border-emerald-400/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Start Video Call"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </>
          )}

          {/* AI Summary Button (Group Chat) */}
          {isGroup && (
            <button
              onClick={() => summarizeGroup(selectedUser._id, selectedUser.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600/50 to-violet-600/50 hover:from-purple-600/80 hover:to-violet-600/80 border border-violet-400/40 text-violet-100 text-xs font-medium transition-all shadow-sm cursor-pointer"
              title="Generate AI Summary"
            >
              <span>✨</span>
              <span className="max-sm:hidden">AI Summary</span>
            </button>
          )}

          <img
            onClick={() => setSelectedUser(null)}
            src={assets.arrow_icon}
            alt="arrow"
            className="md:hidden max-w-7 cursor-pointer"
          />
          <img
            src={assets.help_icon}
            alt="icon"
            className="max-md:hidden max-w-5 opacity-75 hover:opacity-100 cursor-pointer"
          />
        </div>
      </div>

      {/* --------- chat area --------- */}
      <div className="flex-1 overflow-y-scroll p-4 pb-4 flex flex-col gap-3">
        {messages.map((msg, index) => {
          const isMyMessage =
            msg.senderId === authUser?._id ||
            msg.senderId?._id === authUser?._id;

          const senderName = msg.senderId?.fullName || "Member";
          const senderPic =
            msg.senderId?.profilePic ||
            (isMyMessage ? authUser?.profilePic : null) ||
            assets.avatar_icon;

          return (
            <div
              key={msg._id || index}
              className={`flex items-end gap-2 justify-end ${
                !isMyMessage && "flex-row-reverse"
              }`}
            >
              <div className="flex flex-col max-w-[280px] md:max-w-[420px]">
                {/* Sender Name for incoming group messages */}
                {isGroup && !isMyMessage && (
                  <span className="text-[11px] font-semibold text-violet-300 mb-1 ml-1">
                    {senderName}
                  </span>
                )}

                {/* WhatsApp-style Document or Folder Card matching reference */}
                {(msg.fileType === "folder" ||
                  msg.fileType === "document" ||
                  msg.fileType === "pdf" ||
                  (msg.fileUrl && !msg.image && msg.fileType !== "image")) ? (
                  <div
                    onClick={() => handleDownload(msg.fileUrl, msg.fileName)}
                    className={`group flex flex-col rounded-2xl border text-white min-w-[260px] max-w-[340px] md:max-w-[380px] cursor-pointer transition-all hover:brightness-110 shadow-lg ${
                      isMyMessage
                        ? "bg-[#0b5345] border-emerald-500/40 rounded-br-none"
                        : "bg-[#1f2c34] border-gray-600/40 rounded-bl-none"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderFileBadge(msg.fileName, msg.fileType)}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs md:text-sm font-medium text-white truncate"
                            title={msg.fileName}
                          >
                            {msg.fileName || (msg.fileType === "folder" ? "Folder.zip" : "Document")}
                          </p>
                          <p className="text-[11px] text-gray-300 font-light mt-0.5">
                            {msg.fileType === "folder"
                              ? `ZIP • ${msg.folderFileCount ? `${msg.folderFileCount} files • ` : ""}${formatFileSize(msg.fileSize)}`
                              : `${getFileExt(msg.fileName).toUpperCase()} • ${formatFileSize(msg.fileSize)}`}
                          </p>
                        </div>
                      </div>

                      {/* Download Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(msg.fileUrl, msg.fileName);
                        }}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 shrink-0 cursor-pointer shadow-sm"
                        title="Download"
                      >
                        <svg
                          className="w-4 h-4 text-gray-200 group-hover:text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </div>

                    {msg.text && (
                      <div className="px-3 pb-2 pt-1 border-t border-white/10 text-xs text-gray-100 whitespace-pre-wrap break-words">
                        {renderFormattedText(msg.text)}
                      </div>
                    )}
                  </div>
                ) : (msg.image || (msg.fileUrl && msg.fileType === "image")) ? (
                  /* Image Attachment Bubble */
                  <div className="flex flex-col gap-1 max-w-[240px]">
                    <img
                      src={msg.fileUrl || msg.image}
                      alt="attachment"
                      onClick={() => window.open(msg.fileUrl || msg.image)}
                      className="max-w-[230px] border border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-95 shadow-md"
                    />
                    {msg.text && (
                      <p
                        className={`p-2 text-xs font-light rounded-lg text-white ${
                          isMyMessage
                            ? "bg-purple-900/60 border border-purple-500/20"
                            : "bg-[#282142]/80 border border-violet-500/20"
                        }`}
                      >
                        {renderFormattedText(msg.text)}
                      </p>
                    )}
                  </div>
                ) : msg.text ? (
                  /* Text Only Bubble */
                  <p
                    className={`p-2.5 md:text-sm font-light rounded-2xl whitespace-pre-wrap break-words text-white ${
                      isMyMessage
                        ? "bg-gradient-to-r from-purple-500/60 to-violet-600/70 rounded-br-none"
                        : "bg-[#282142]/80 border border-violet-500/20 rounded-bl-none"
                    }`}
                  >
                    {renderFormattedText(msg.text)}
                  </p>
                ) : null}
              </div>

              {/* Avatar and Time */}
              <div className="text-center text-xs flex flex-col items-center">
                <img
                  src={senderPic}
                  alt={senderName}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {formatMessageTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}

        {/* SpaceAI Typing indicator */}
        {isAiTyping && isSelectedUserAI && (
          <div className="flex items-end gap-2 justify-end flex-row-reverse my-2">
            <div className="p-3 rounded-2xl rounded-bl-none bg-violet-500/20 text-violet-200 flex items-center gap-2 border border-violet-500/30">
              <span className="text-xs text-violet-300">SpaceAI is typing...</span>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0.4s]"></span>
              </span>
            </div>
            <div className="text-center text-xs">
              <img
                src={selectedUser?.profilePic || assets.avatar_icon}
                alt="profile"
                className="w-6 h-6 rounded-full"
              />
              <p className="text-[10px] text-gray-400">AI</p>
            </div>
          </div>
        )}

        <div ref={scrollEnd}></div>
      </div>

      {/* --------- bottom input area --------- */}
      <div className="p-3 bg-black/10 border-t border-stone-600/30 relative">
        {/* Click outside backdrop to close attachment menu */}
        {isAttachMenuOpen && (
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsAttachMenuOpen(false)}
          />
        )}

        {/* WhatsApp-style Attachment Popup Menu */}
        {isAttachMenuOpen && (
          <div
            className={`absolute ${
              stagedAttachment ? "bottom-24" : "bottom-18"
            } left-4 bg-[#1e1738]/95 border border-violet-500/40 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-30 min-w-[200px] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150`}
          >
            {/* Document option */}
            <button
              type="button"
              onClick={() => {
                setIsAttachMenuOpen(false);
                docInputRef.current?.click();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-200 hover:bg-violet-600/30 transition-colors cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm shadow">
                📄
              </span>
              <div>
                <p className="font-semibold text-white">Document</p>
                <p className="text-[10px] text-gray-400">PDF, Word, TXT, Excel</p>
              </div>
            </button>

            {/* Photos & Media option */}
            <button
              type="button"
              onClick={() => {
                setIsAttachMenuOpen(false);
                imageInputRef.current?.click();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-200 hover:bg-violet-600/30 transition-colors cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm shadow">
                🖼️
              </span>
              <div>
                <p className="font-semibold text-white">Photos & Media</p>
                <p className="text-[10px] text-gray-400">Images and pictures</p>
              </div>
            </button>

            {/* Folder option */}
            <button
              type="button"
              onClick={() => {
                setIsAttachMenuOpen(false);
                folderInputRef.current?.click();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-200 hover:bg-violet-600/30 transition-colors cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm shadow">
                📁
              </span>
              <div>
                <p className="font-semibold text-white">Folder</p>
                <p className="text-[10px] text-gray-400">Send an entire folder</p>
              </div>
            </button>
          </div>
        )}

        {/* Uploading Status Banner */}
        {isUploadingFile && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-violet-600/30 border border-violet-400/40 flex items-center gap-2 text-xs text-violet-200 animate-pulse">
            <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-transparent rounded-full animate-spin"></div>
            <span>Uploading file / folder to chat... Please wait...</span>
          </div>
        )}

        {/* Staged Attachment Preview Bar */}
        {stagedAttachment && (
          <div className="mb-2 p-2 rounded-xl bg-[#282142] border border-violet-500/40 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              {stagedAttachment.type === "image" ? (
                <img
                  src={stagedAttachment.previewUrl}
                  alt="preview"
                  className="w-10 h-10 object-cover rounded-lg border border-white/20"
                />
              ) : stagedAttachment.type === "folder" ? (
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xl border border-amber-500/30 shrink-0">
                  📁
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center text-xl border border-violet-500/30 shrink-0">
                  {getFileIconBadge(stagedAttachment.name)}
                </div>
              )}
              <div className="min-w-0 flex flex-col">
                <p className="text-xs font-semibold text-white truncate max-w-[200px] md:max-w-md">
                  {stagedAttachment.name}
                </p>
                <p className="text-[10px] text-gray-400">
                  {stagedAttachment.type === "folder"
                    ? `Folder • ${stagedAttachment.fileCount} files • `
                    : ""}
                  {formatFileSize(stagedAttachment.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStagedAttachment(null)}
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 flex items-center justify-center text-xs cursor-pointer transition-colors"
              title="Remove attachment"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hidden inputs for attachments */}
        <input
          ref={imageInputRef}
          onChange={handleImageSelected}
          type="file"
          accept="image/png, image/jpeg, image/webp, image/gif"
          hidden
        />
        <input
          ref={docInputRef}
          onChange={handleDocSelected}
          type="file"
          accept="*/*"
          hidden
        />
        <input
          ref={folderInputRef}
          onChange={handleFolderSelected}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          hidden
        />

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-gray-100/10 px-3 md:px-4 rounded-full border border-gray-600/40">
            {/* WhatsApp-style Attachment (Paperclip) button */}
            <button
              type="button"
              onClick={() => setIsAttachMenuOpen((prev) => !prev)}
              className="mr-2 text-gray-300 hover:text-white transition-colors cursor-pointer text-base hover:scale-110 active:scale-95"
              title="Attach File or Folder"
            >
              📎
            </button>

            <input
              onChange={(e) => setInput(e.target.value)}
              value={input}
              onKeyDown={(e) =>
                e.key === "Enter" ? handleSendMessage(e) : null
              }
              type="text"
              placeholder={
                stagedAttachment
                  ? "Add a caption..."
                  : isGroup
                  ? `Message ${selectedUser.name}...`
                  : "Send a message..."
              }
              className="flex-1 text-sm py-3 border-none rounded-lg outline-none text-white placeholder-gray-400"
            />

            {/* Quick Gallery button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity mr-1"
              title="Send Image"
            >
              <img
                src={assets.gallery_icon}
                alt="gallery"
                className="w-5"
              />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSendMessage}
            disabled={isUploadingFile || (!input.trim() && !stagedAttachment)}
            className="cursor-pointer hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100"
            title="Send"
          >
            <img
              src={assets.send_button}
              alt="send"
              className="w-8"
            />
          </button>
        </div>
      </div>

      {/* AI Summary Modal */}
      <AISummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summaryData={summaryData}
        isLoading={isSummaryLoading}
        groupName={summaryGroupName}
      />
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-2 text-gray-400 bg-white/5 max-md:hidden h-full">
      <img src={assets.logo_icon} alt="logo" className="max-w-16 opacity-80" />
      <p className="text-lg font-medium text-white">Chat anytime, anywhere</p>
      <p className="text-xs text-gray-400">
        Select a conversation or group from the sidebar to begin chatting.
      </p>
    </div>
  );
};

export default ChatContainer;
