import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import { callSounds } from "../src/lib/callSounds";
import toast from "react-hot-toast";

export const CallContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
};

/**
 * Creates a synthetic media stream for testing or headless environments
 * where no physical webcam or microphone is attached.
 */
function createFallbackStream(isVideo = false) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioTrack = null;
  if (AudioCtx) {
    try {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001; // silent
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      audioTrack = dst.stream.getAudioTracks()[0];
    } catch {
      // Ignore
    }
  }

  let videoTrack = null;
  if (isVideo) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#1e1b4b";
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = "#818cf8";
      ctx.font = "24px Outfit, sans-serif";
      ctx.fillText("Chat Space Virtual Camera", 170, 240);
      videoTrack = canvas.captureStream(15).getVideoTracks()[0];
    } catch {
      // Ignore
    }
  }

  const tracks = [];
  if (audioTrack) tracks.push(audioTrack);
  if (videoTrack) tracks.push(videoTrack);
  return new MediaStream(tracks);
}

export const CallProvider = ({ children }) => {
  const { socket, authUser } = useContext(AuthContext);

  // Call States: 'idle' | 'calling' (outgoing) | 'incoming' | 'connected'
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("voice"); // 'voice' | 'video'

  // Participant info
  const [activePartner, setActivePartner] = useState(null); // { _id, fullName, profilePic }
  const [incomingCallData, setIncomingCallData] = useState(null); // { from, callerInfo, signal, callType }

  // Media Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // In-call toggles & UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [remoteMediaState, setRemoteMediaState] = useState({ isMuted: false, isVideoOff: false });

  // Call timer
  const [durationSec, setDurationSec] = useState(0);

  // Internal WebRTC refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidateQueue = useRef([]);
  const timerIntervalRef = useRef(null);
  const activePartnerRef = useRef(null);
  const screenTrackRef = useRef(null);
  const callStateRef = useRef(callState);

  activePartnerRef.current = activePartner;
  callStateRef.current = callState;

  // Format seconds to mm:ss
  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Start duration timer
  const startTimer = () => {
    stopTimer();
    setDurationSec(0);
    timerIntervalRef.current = setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Clean up all local media tracks
  const stopLocalTracks = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      localStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.stop();
      } catch {
        // Ignore
      }
      screenTrackRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
  };

  // Close peer connection
  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.close();
      } catch {
        // Ignore
      }
      peerConnectionRef.current = null;
    }
  };

  // Reset all call states
  const resetCallState = () => {
    callSounds.stopAllSounds();
    stopTimer();
    stopLocalTracks();
    closePeerConnection();
    iceCandidateQueue.current = [];
    remoteStreamRef.current = null;

    setCallState("idle");
    setActivePartner(null);
    setIncomingCallData(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsMinimized(false);
    setRemoteMediaState({ isMuted: false, isVideoOff: false });
    setDurationSec(0);
  };

  // Request user media safely
  const getUserMediaStream = async (wantVideo) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("MediaDevices API unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      return stream;
    } catch (mediaErr) {
      console.warn("Could not capture native camera/microphone:", mediaErr.message);
      toast("Using virtual media device", { icon: "🎙️" });
      return createFallbackStream(wantVideo);
    }
  };

  // Initialize RTCPeerConnection
  const setupPeerConnection = (partnerId) => {
    closePeerConnection();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && partnerId) {
        socket.emit("iceCandidate", {
          to: partnerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("[WebRTC] ontrack received:", event.track.kind);
      let stream = event.streams && event.streams[0];
      if (!stream) {
        stream = remoteStreamRef.current || new MediaStream();
        stream.addTrack(event.track);
      }
      remoteStreamRef.current = stream;
      // Always create a new MediaStream instance so React state reference changes and triggers UI re-render
      setRemoteStream(new MediaStream(stream.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      console.log("WebRTC Connection State:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallState("connected");
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // ==========================================================
  // 1. INITIATE CALL (OUTGOING)
  // ==========================================================
  const startCall = async ({ recipient, callType: requestedType = "voice" }) => {
    if (!socket || !socket.connected) {
      toast.error("You are not connected to the chat network");
      return;
    }

    if (!recipient || !recipient._id) {
      toast.error("Please select a recipient");
      return;
    }

    if (recipient.isAI || recipient.email === "spaceai@system.local" || recipient.fullName === "SpaceAI") {
      toast.error("Voice and video calls are not supported with SpaceAI");
      return;
    }

    if (recipient.isGroup) {
      toast.error("Direct voice & video calls are currently 1-to-1");
      return;
    }

    if (callState !== "idle") {
      toast.error("You are already in a call or connecting");
      return;
    }

    const wantVideo = requestedType === "video";
    setCallType(requestedType);
    setActivePartner(recipient);
    setCallState("calling");
    setIsVideoOff(!wantVideo);

    callSounds.playCallingTone();

    try {
      const stream = await getUserMediaStream(wantVideo);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPeerConnection(recipient._id);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("callUser", {
        userToCall: recipient._id,
        signalData: { type: offer.type, sdp: offer.sdp },
        callType: requestedType,
        callerInfo: {
          _id: authUser._id,
          fullName: authUser.fullName,
          profilePic: authUser.profilePic,
        },
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      toast.error("Could not initialize call: " + err.message);
      resetCallState();
    }
  };

  // ==========================================================
  // 2. ACCEPT INCOMING CALL
  // ==========================================================
  const acceptCall = async () => {
    if (!incomingCallData || !incomingCallData.signal) {
      toast.error("No incoming call data available");
      resetCallState();
      return;
    }

    callSounds.stopAllSounds();
    const { from, callerInfo, signal, callType: incomingType } = incomingCallData;
    const wantVideo = incomingType === "video";

    setCallType(incomingType);
    setActivePartner(callerInfo || { _id: from, fullName: "Caller" });
    setCallState("connected");
    setIsVideoOff(!wantVideo);

    try {
      const stream = await getUserMediaStream(wantVideo);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPeerConnection(from);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(signal));

      // Process queued ICE candidates
      while (iceCandidateQueue.current.length > 0) {
        const candidate = iceCandidateQueue.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            console.warn("Could not add queued candidate:", e);
          }
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answerCall", {
        to: from,
        signal: { type: answer.type, sdp: answer.sdp },
      });

      callSounds.playConnectTone();
      startTimer();
      toast.success("Call connected");
    } catch (err) {
      console.error("Failed to answer call:", err);
      toast.error("Could not connect call: " + err.message);
      resetCallState();
    }
  };

  // ==========================================================
  // 3. REJECT INCOMING CALL
  // ==========================================================
  const rejectCall = () => {
    callSounds.stopAllSounds();
    callSounds.playEndTone();

    if (incomingCallData?.from && socket) {
      socket.emit("rejectCall", {
        to: incomingCallData.from,
        reason: "Call declined",
      });
    }

    resetCallState();
    toast("Call declined", { icon: "📵" });
  };

  // ==========================================================
  // 4. END ACTIVE / OUTGOING CALL
  // ==========================================================
  const endCall = () => {
    const partnerId = activePartner?._id || incomingCallData?.from;
    if (partnerId && socket) {
      socket.emit("endCall", { to: partnerId });
    }

    callSounds.playEndTone();
    resetCallState();
    toast("Call ended", { icon: "📞" });
  };

  // ==========================================================
  // 5. IN-CALL CONTROLS: MUTE, VIDEO, SCREEN SHARE, MINIMIZE
  // ==========================================================
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextMuted = !isMuted;
        audioTracks.forEach((track) => {
          track.enabled = !nextMuted;
        });
        setIsMuted(nextMuted);

        if (activePartnerRef.current?._id && socket) {
          socket.emit("toggleMedia", {
            to: activePartnerRef.current._id,
            mediaType: "audio",
            enabled: !nextMuted,
          });
        }
      }
    }
  };

  const toggleVideo = async () => {
    if (callType !== "video") return;

    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextVideoOff = !isVideoOff;
        videoTracks.forEach((track) => {
          track.enabled = !nextVideoOff;
        });
        setIsVideoOff(nextVideoOff);

        if (activePartnerRef.current?._id && socket) {
          socket.emit("toggleMedia", {
            to: activePartnerRef.current._id,
            mediaType: "video",
            enabled: !nextVideoOff,
          });
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (callType !== "video" || !peerConnectionRef.current) return;

    if (isScreenSharing) {
      // Revert screen share back to camera video track
      try {
        if (screenTrackRef.current) {
          screenTrackRef.current.stop();
          screenTrackRef.current = null;
        }

        const cameraStream = await getUserMediaStream(true);
        const cameraTrack = cameraStream.getVideoTracks()[0];
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");

        if (videoSender && cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
        }

        // Replace track in localStream
        if (localStreamRef.current) {
          const oldVideo = localStreamRef.current.getVideoTracks()[0];
          if (oldVideo) {
            localStreamRef.current.removeTrack(oldVideo);
            oldVideo.stop();
          }
          if (cameraTrack) localStreamRef.current.addTrack(cameraTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        setIsScreenSharing(false);
        toast("Screen sharing stopped", { icon: "🖥️" });
      } catch (err) {
        console.error("Revert screen share failed:", err);
      }
    } else {
      // Start Screen Sharing
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          toast.error("Screen sharing is not supported by your browser");
          return;
        }

        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false,
        });

        const screenTrack = displayStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          toggleScreenShare(); // auto revert when user stops sharing via browser bar
        };

        if (localStreamRef.current) {
          const oldVideo = localStreamRef.current.getVideoTracks()[0];
          if (oldVideo) localStreamRef.current.removeTrack(oldVideo);
          localStreamRef.current.addTrack(screenTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        setIsScreenSharing(true);
        toast.success("Sharing your screen");
      } catch (err) {
        if (err.name !== "NotAllowedError") {
          toast.error("Could not share screen: " + err.message);
        }
      }
    }
  };

  const toggleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  // ==========================================================
  // 6. SOCKET EVENT LISTENERS
  // ==========================================================
  useEffect(() => {
    if (!socket) return;

    // Incoming Call listener
    const handleIncomingCall = (data) => {
      console.log("Incoming call event received:", data);
      // If already in another call, reject automatically
      if (callStateRef.current !== "idle") {
        socket.emit("rejectCall", {
          to: data.from,
          reason: "User is on another call",
        });
        return;
      }

      setIncomingCallData(data);
      setCallType(data.callType || "voice");
      setActivePartner(data.callerInfo || { _id: data.from, fullName: "Caller" });
      setCallState("incoming");

      callSounds.playRingtone();
    };

    // Call Accepted (Caller receives answer)
    const handleCallAccepted = async ({ signal, from }) => {
      console.log("Call accepted by recipient:", from);
      callSounds.stopAllSounds();

      if (peerConnectionRef.current && signal) {
        try {
          if (peerConnectionRef.current.signalingState === "have-local-offer") {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(signal)
            );
          }

          // Flush any queued ICE candidates
          while (iceCandidateQueue.current.length > 0) {
            const candidate = iceCandidateQueue.current.shift();
            try {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            } catch {
              try {
                await peerConnectionRef.current.addIceCandidate(candidate);
              } catch (err2) {
                console.warn("Could not add queued candidate:", err2);
              }
            }
          }

          callSounds.playConnectTone();
          setCallState("connected");
          startTimer();
          toast.success("Call connected");
        } catch (err) {
          console.error("Failed to set remote description:", err);
          toast.error("Call connection failed");
          resetCallState();
        }
      } else {
        callSounds.playConnectTone();
        setCallState("connected");
        startTimer();
      }
    };

    // Call Rejected
    const handleCallRejected = ({ reason }) => {
      toast(reason || "Call was declined", { icon: "📵" });
      callSounds.playEndTone();
      resetCallState();
    };

    // Call Ended
    const handleCallEnded = ({ reason }) => {
      toast(reason || "Call ended", { icon: "📞" });
      callSounds.playEndTone();
      resetCallState();
    };

    // Recipient Busy
    const handleCallBusy = ({ reason }) => {
      toast(reason || "User is currently busy on another call", { icon: "⏳" });
      callSounds.playEndTone();
      resetCallState();
    };

    // Recipient Offline / Unavailable
    const handleCallUnavailable = ({ reason }) => {
      toast(reason || "User is currently offline", { icon: "⚠️" });
      callSounds.playEndTone();
      resetCallState();
    };

    // ICE Candidate received
    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            console.warn("Error adding ICE candidate:", err);
          }
        }
      } else {
        iceCandidateQueue.current.push(candidate);
      }
    };

    // Remote peer toggled mic or video
    const handleMediaToggled = ({ mediaType, enabled }) => {
      setRemoteMediaState((prev) => {
        if (mediaType === "audio") {
          return { ...prev, isMuted: !enabled };
        }
        if (mediaType === "video") {
          return { ...prev, isVideoOff: !enabled };
        }
        return prev;
      });
    };

    socket.on("incomingCall", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("callRejected", handleCallRejected);
    socket.on("callEnded", handleCallEnded);
    socket.on("callBusy", handleCallBusy);
    socket.on("callUnavailable", handleCallUnavailable);
    socket.on("iceCandidate", handleIceCandidate);
    socket.on("mediaToggled", handleMediaToggled);

    return () => {
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("callRejected", handleCallRejected);
      socket.off("callEnded", handleCallEnded);
      socket.off("callBusy", handleCallBusy);
      socket.off("callUnavailable", handleCallUnavailable);
      socket.off("iceCandidate", handleIceCandidate);
      socket.off("mediaToggled", handleMediaToggled);
    };
  }, [socket]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      resetCallState();
    };
  }, []);

  const value = {
    callState,
    callType,
    activePartner,
    incomingCallData,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isMinimized,
    remoteMediaState,
    durationSec,
    formatDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleMinimize,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
