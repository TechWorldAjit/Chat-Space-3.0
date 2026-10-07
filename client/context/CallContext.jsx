import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import { callSounds } from "../src/lib/callSounds";
import toast from "react-hot-toast";

export const CallContext = createContext();

const getIceServers = () => {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL || import.meta.env.TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME || import.meta.env.TURN_USERNAME;
  const turnPassword =
    import.meta.env.VITE_TURN_PASSWORD ||
    import.meta.env.TURN_PASSWORD ||
    import.meta.env.VITE_TURN_CREDENTIAL ||
    import.meta.env.TURN_CREDENTIAL;

  if (turnUrl) {
    const turnConfig = { urls: turnUrl };
    if (turnUsername) turnConfig.username = turnUsername;
    if (turnPassword) turnConfig.credential = turnPassword;
    servers.push(turnConfig);
  }

  return { iceServers: servers };
};

export const CallProvider = ({ children }) => {
  const { socket, authUser } = useContext(AuthContext);

  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("voice");

  const [activePartner, setActivePartner] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [remoteMediaState, setRemoteMediaState] = useState({ isMuted: false, isVideoOff: false });

  const [durationSec, setDurationSec] = useState(0);

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

  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(mins)}:${pad(secs)}`;
  };

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

  const stopLocalTracks = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          void e;
        }
      });
      localStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.stop();
      } catch (e) {
        void e;
      }
      screenTrackRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
  };

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.onsignalingstatechange = null;
        peerConnectionRef.current.onicegatheringstatechange = null;
        peerConnectionRef.current.close();
      } catch (e) {
        void e;
      }
      peerConnectionRef.current = null;
    }
  };

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

  const getUserMediaStream = async (wantVideo) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera and microphone access is not supported by your browser");
    }

    try {
      const constraints = {
        audio: true,
        video: wantVideo
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
          : false,
      };
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (mediaErr) {
      if (mediaErr.name === "NotAllowedError" || mediaErr.name === "PermissionDeniedError") {
        if (wantVideo) {
          throw new Error("Camera and microphone permission is required for a video call");
        }
        throw new Error("Microphone permission is required for a voice call");
      }
      if (mediaErr.name === "NotFoundError" || mediaErr.name === "DevicesNotFoundError") {
        if (wantVideo) {
          throw new Error("No camera or microphone was detected");
        }
        throw new Error("No microphone was detected");
      }
      if (mediaErr.name === "NotReadableError" || mediaErr.name === "TrackStartError") {
        throw new Error("Camera or microphone is already in use by another application");
      }
      throw new Error(mediaErr.message || "Failed to access camera or microphone");
    }
  };

  const flushQueuedIceCandidates = async (pc) => {
    while (iceCandidateQueue.current.length > 0) {
      const candidate = iceCandidateQueue.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("Could not add queued candidate:", err);
        }
      }
    }
  };

  const setupPeerConnection = (partnerId) => {
    closePeerConnection();
    const config = getIceServers();
    const pc = new RTCPeerConnection(config);

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
      setRemoteStream(new MediaStream(stream.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] connectionState:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (pc.connectionState === "failed") {
        console.warn("[WebRTC] connection failed");
        toast.error("Call connection failed");
        endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] iceConnectionState:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.warn("[WebRTC] ICE connection failed");
        toast.error("Call connection lost");
        endCall();
      }
    };

    pc.onsignalingstatechange = () => {
      console.log("[WebRTC] signalingState:", pc.signalingState);
    };

    pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] iceGatheringState:", pc.iceGatheringState);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

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
      toast.error(err.message || "Could not initialize call");
      resetCallState();
    }
  };

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
      await flushQueuedIceCandidates(pc);

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
      toast.error(err.message || "Could not connect call");
      resetCallState();
    }
  };

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

  const endCall = () => {
    const partnerId = activePartner?._id || incomingCallData?.from;
    if (partnerId && socket) {
      socket.emit("endCall", { to: partnerId });
    }

    callSounds.playEndTone();
    resetCallState();
    toast("Call ended", { icon: "📞" });
  };

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
          toggleScreenShare();
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

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      console.log("Incoming call event received:", data);
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

          await flushQueuedIceCandidates(peerConnectionRef.current);

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

    const handleCallRejected = ({ reason }) => {
      toast(reason || "Call was declined", { icon: "📵" });
      callSounds.playEndTone();
      resetCallState();
    };

    const handleCallEnded = ({ reason }) => {
      toast(reason || "Call ended", { icon: "📞" });
      callSounds.playEndTone();
      resetCallState();
    };

    const handleCallBusy = ({ reason }) => {
      toast(reason || "User is currently busy on another call", { icon: "⏳" });
      callSounds.playEndTone();
      resetCallState();
    };

    const handleCallUnavailable = ({ reason }) => {
      toast(reason || "User is currently offline", { icon: "⚠️" });
      callSounds.playEndTone();
      resetCallState();
    };

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
