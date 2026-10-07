import { useContext, useEffect, useRef } from "react";
import { CallContext } from "../../context/CallContext";
import assets from "../assets/assets";

const CallModal = () => {
  const {
    callState,
    callType,
    activePartner,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isMinimized,
    remoteMediaState,
    durationSec,
    formatDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleMinimize,
  } = useContext(CallContext);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const miniVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((e) => {
        console.warn("Remote audio autoplay prevented:", e);
      });
    }
  }, [remoteStream, callState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => {
        console.warn("Local video play notice:", e);
      });
    }
  }, [localStream, callState, isMinimized]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((e) => {
        console.warn("Remote video play notice:", e);
      });
    }
    if (miniVideoRef.current && (remoteStream || localStream)) {
      miniVideoRef.current.srcObject = remoteStream || localStream;
      miniVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, localStream, callState, isMinimized, callType, remoteMediaState.isVideoOff]);

  if (callState === "idle") return null;

  const partnerName = activePartner?.fullName || "Chat Contact";
  const partnerPic = activePartner?.profilePic || assets.avatar_icon;

  if (callState === "incoming") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-sm rounded-3xl bg-[#1d1633]/90 border border-violet-500/40 p-6 flex flex-col items-center shadow-2xl text-white overflow-hidden">
          <div className="absolute -top-16 -left-16 w-36 h-36 bg-purple-600/30 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative my-4 flex items-center justify-center">
            <span className="absolute w-28 h-28 rounded-full bg-violet-500/20 animate-ping"></span>
            <span className="absolute w-24 h-24 rounded-full bg-violet-600/30 animate-pulse"></span>
            <img
              src={partnerPic}
              alt={partnerName}
              className="relative w-20 h-20 rounded-full object-cover border-2 border-violet-400 shadow-xl"
            />
            <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-violet-600 border border-white text-xs">
              {callType === "video" ? "📹" : "📞"}
            </div>
          </div>

          <h3 className="text-xl font-semibold text-white tracking-wide mt-2 text-center">
            {partnerName}
          </h3>
          <p className="text-sm text-violet-300 font-medium flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Incoming {callType === "video" ? "Video" : "Voice"} Call...
          </p>

          <div className="flex items-center justify-center gap-10 mt-8 w-full">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={rejectCall}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Decline"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-7 h-7 rotate-[135deg]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </button>
              <span className="text-xs text-gray-300">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={acceptCall}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Accept"
              >
                {callType === "video" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-7 h-7"
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
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-7 h-7"
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
                )}
              </button>
              <span className="text-xs text-gray-300">Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (callState === "calling") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="relative w-full max-w-sm rounded-3xl bg-[#1b1531]/95 border border-violet-500/40 p-8 flex flex-col items-center shadow-2xl text-white">
          <div className="relative my-4 flex items-center justify-center">
            <span className="absolute w-32 h-32 rounded-full bg-violet-500/20 animate-ping"></span>
            <span className="absolute w-28 h-28 rounded-full bg-purple-500/25 animate-pulse"></span>
            <img
              src={partnerPic}
              alt={partnerName}
              className="relative w-24 h-24 rounded-full object-cover border-2 border-violet-400 shadow-2xl"
            />
          </div>

          <h3 className="text-xl font-semibold text-white tracking-wide mt-3 text-center">
            {partnerName}
          </h3>
          <p className="text-sm text-violet-300 font-medium mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping"></span>
            Calling ({callType === "video" ? "Video" : "Voice"})...
          </p>
          <span className="text-xs text-gray-400 mt-1">Ringing...</span>

          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              title="Cancel Call"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 rotate-[135deg]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </button>
            <span className="text-xs text-gray-300">Cancel</span>
          </div>
        </div>
      </div>
    );
  }

  if (isMinimized && callState === "connected") {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#1e1738]/95 border border-violet-500/50 p-2.5 px-4 rounded-full shadow-2xl backdrop-blur-xl animate-fade-in text-white">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <button
          type="button"
          onClick={toggleMinimize}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90"
        >
          <div className="relative">
            <img
              src={partnerPic}
              alt={partnerName}
              className="w-9 h-9 rounded-full object-cover border border-violet-400"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black"></span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold truncate max-w-[100px]">
              {partnerName}
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">
              {formatDuration(durationSec)}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 ml-1 border-l border-white/10 pl-2">
          <button
            type="button"
            onClick={toggleMute}
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isMuted ? "bg-red-500/80 text-white" : "bg-white/10 hover:bg-white/20 text-gray-200"
            }`}
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={toggleMinimize}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 cursor-pointer"
            title="Expand Call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>

          <button
            type="button"
            onClick={endCall}
            className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white cursor-pointer ml-1"
            title="End Call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-4xl h-[85vh] max-h-[720px] rounded-3xl bg-[#140e26] border border-violet-500/40 flex flex-col shadow-2xl text-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent z-20">
          <div className="flex items-center gap-3">
            <img
              src={partnerPic}
              alt={partnerName}
              className="w-10 h-10 rounded-full object-cover border border-violet-400 shadow-md"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-sm sm:text-base text-white">
                {partnerName}
              </span>
              <div className="flex items-center gap-2 text-xs text-violet-300">
                <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {formatDuration(durationSec)}
                </span>
                <span>•</span>
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  🔒 Encrypted P2P
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMinimize}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 transition-colors cursor-pointer"
              title="Minimize to floating window"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-[#0c0818]">
          {callType === "video" ? (
            <>
              {remoteStream && !remoteMediaState.isVideoOff ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-center p-6">
                  <div className="relative">
                    <img
                      src={partnerPic}
                      alt={partnerName}
                      className="w-28 h-28 rounded-full object-cover border-4 border-violet-500/50 shadow-2xl"
                    />
                    {remoteMediaState.isMuted && (
                      <span className="absolute bottom-1 right-1 p-1.5 bg-red-600 rounded-full text-white text-xs border border-white" title="Muted">
                        🔇
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-medium text-white">{partnerName}</span>
                  <span className="text-xs text-gray-400 bg-white/10 px-3 py-1 rounded-full">
                    {remoteMediaState.isVideoOff ? "Partner turned off camera" : "Connecting video stream..."}
                  </span>
                </div>
              )}

              <div className="absolute bottom-20 right-4 sm:bottom-24 sm:right-6 w-28 h-36 sm:w-40 sm:h-52 rounded-2xl overflow-hidden shadow-2xl border-2 border-violet-400/60 bg-black/80 z-20">
                {localStream && !isVideoOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${!isScreenSharing ? "-scale-x-100" : ""}`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900/90 text-gray-400 p-2 text-center">
                    <span className="text-2xl mb-1">📷</span>
                    <span className="text-[11px]">Camera Off</span>
                  </div>
                )}
                {isMuted && (
                  <div className="absolute top-2 left-2 p-1 bg-red-600/90 rounded-full text-[10px] text-white">
                    🔇
                  </div>
                )}
                <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-white/90 bg-black/60 px-1.5 py-0.5 rounded">
                  You
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-6 p-6">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-44 h-44 rounded-full bg-violet-600/20 animate-ping"></span>
                <span className="absolute w-36 h-36 rounded-full bg-indigo-600/30 animate-pulse"></span>
                <img
                  src={partnerPic}
                  alt={partnerName}
                  className="relative w-28 h-28 rounded-full object-cover border-4 border-violet-400 shadow-2xl"
                />
                {remoteMediaState.isMuted && (
                  <span className="absolute bottom-2 right-2 p-1.5 bg-red-600 rounded-full text-white text-xs border border-white" title="Muted">
                    🔇
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold text-white">{partnerName}</h2>
                <p className="text-sm text-violet-300 font-mono mt-1">
                  {formatDuration(durationSec)}
                </p>
                {remoteMediaState.isMuted && (
                  <span className="mt-2 text-xs text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                    Partner has muted their microphone
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 sm:gap-4 bg-[#1e1738]/90 border border-violet-500/40 p-3 px-6 rounded-full shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isMuted
                ? "bg-red-600 text-white shadow-lg shadow-red-500/30"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {callType === "video" && (
            <button
              type="button"
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isVideoOff
                  ? "bg-red-600 text-white shadow-lg shadow-red-500/30"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {isVideoOff ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}

          {callType === "video" && (
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isScreenSharing
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={endCall}
            className="w-14 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="End Call"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 rotate-[135deg]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </button>
        </div>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>
    </div>
  );
};

export default CallModal;
