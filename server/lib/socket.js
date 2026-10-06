import { Server } from "socket.io";

export const userSocketMap = {}; // { userId: socketId }
export const activeCalls = new Map(); // userId -> { peerId, callType, startedAt }
export const pendingCalls = new Map(); // callerId -> { to, callType, startedAt }

export let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      userSocketMap[userId] = socket.id;
      socket.userId = userId;
    }
    console.log("User Connected:", userId, "Socket ID:", socket.id);

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // ==========================================================
    // WEBRTC VOICE & VIDEO CALL SIGNALING
    // ==========================================================

    // 1. Caller initiates call
    socket.on("callUser", ({ userToCall, signalData, callType = "voice", callerInfo }) => {
      const callerId = socket.userId || userId;
      if (!callerId) return;

      if (!userToCall || userToCall === callerId) {
        socket.emit("callError", { message: "Invalid recipient for call" });
        return;
      }

      // Check if recipient is online
      const recipientSocketId = userSocketMap[userToCall];
      if (!recipientSocketId) {
        socket.emit("callUnavailable", {
          to: userToCall,
          reason: "User is currently offline",
        });
        return;
      }

      // Check if recipient is currently in a call
      if (activeCalls.has(userToCall)) {
        socket.emit("callBusy", {
          to: userToCall,
          reason: "User is currently busy on another call",
        });
        return;
      }

      // Check if recipient is already receiving another call
      for (const [, pending] of pendingCalls.entries()) {
        if (pending.to === userToCall) {
          socket.emit("callBusy", {
            to: userToCall,
            reason: "User is currently receiving another call",
          });
          return;
        }
      }

      // Record pending call
      pendingCalls.set(callerId, {
        to: userToCall,
        callType,
        startedAt: Date.now(),
      });

      console.log(`[Call] ${callerId} calling ${userToCall} (${callType})`);

      // Forward incomingCall to recipient
      io.to(recipientSocketId).emit("incomingCall", {
        from: callerId,
        callerInfo: callerInfo || { _id: callerId },
        signal: signalData,
        callType,
      });
    });

    // 2. Recipient answers call
    socket.on("answerCall", ({ to, signal }) => {
      const recipientId = socket.userId || userId;
      if (!recipientId || !to) return;

      // Clear pending call
      pendingCalls.delete(to);
      pendingCalls.delete(recipientId);

      // Register active call for both users
      const startedAt = Date.now();
      activeCalls.set(recipientId, { peerId: to, startedAt });
      activeCalls.set(to, { peerId: recipientId, startedAt });

      console.log(`[Call] ${recipientId} answered call from ${to}`);

      const callerSocketId = userSocketMap[to];
      if (callerSocketId) {
        io.to(callerSocketId).emit("callAccepted", {
          signal,
          from: recipientId,
        });
      }
    });

    // 3. Recipient rejects call
    socket.on("rejectCall", ({ to, reason = "Call declined" }) => {
      const recipientId = socket.userId || userId;
      if (to) {
        pendingCalls.delete(to);
      }
      if (recipientId) {
        pendingCalls.delete(recipientId);
      }

      console.log(`[Call] ${recipientId} rejected call from ${to}`);

      const callerSocketId = userSocketMap[to];
      if (callerSocketId) {
        io.to(callerSocketId).emit("callRejected", {
          from: recipientId,
          reason,
        });
      }
    });

    // 4. Either party ends call
    socket.on("endCall", ({ to }) => {
      const myId = socket.userId || userId;
      if (myId) {
        activeCalls.delete(myId);
        pendingCalls.delete(myId);
      }
      if (to) {
        activeCalls.delete(to);
        pendingCalls.delete(to);
      }

      console.log(`[Call] Call ended between ${myId} and ${to}`);

      const otherSocketId = userSocketMap[to];
      if (otherSocketId) {
        io.to(otherSocketId).emit("callEnded", { from: myId });
      }
    });

    // 5. ICE Candidate relay
    socket.on("iceCandidate", ({ to, candidate }) => {
      const myId = socket.userId || userId;
      if (!to || !candidate) return;

      const otherSocketId = userSocketMap[to];
      if (otherSocketId) {
        io.to(otherSocketId).emit("iceCandidate", {
          from: myId,
          candidate,
        });
      }
    });

    // 6. Media toggle sync (audio/video mute/camera state)
    socket.on("toggleMedia", ({ to, mediaType, enabled }) => {
      const myId = socket.userId || userId;
      if (!to) return;

      const otherSocketId = userSocketMap[to];
      if (otherSocketId) {
        io.to(otherSocketId).emit("mediaToggled", {
          from: myId,
          mediaType,
          enabled,
        });
      }
    });

    // ==========================================================
    // DISCONNECT CLEANUP
    // ==========================================================
    socket.on("disconnect", () => {
      console.log("User Disconnected:", userId);

      // Clean up active calls
      if (userId && activeCalls.has(userId)) {
        const call = activeCalls.get(userId);
        activeCalls.delete(userId);
        if (call?.peerId) {
          activeCalls.delete(call.peerId);
          const peerSocketId = userSocketMap[call.peerId];
          if (peerSocketId) {
            io.to(peerSocketId).emit("callEnded", {
              from: userId,
              reason: "User disconnected",
            });
          }
        }
      }

      // Clean up pending calls initiated by this user
      if (userId && pendingCalls.has(userId)) {
        const pending = pendingCalls.get(userId);
        pendingCalls.delete(userId);
        if (pending?.to) {
          const recipientSocket = userSocketMap[pending.to];
          if (recipientSocket) {
            io.to(recipientSocket).emit("callEnded", {
              from: userId,
              reason: "Caller disconnected",
            });
          }
        }
      }

      // Clean up pending calls received by this user
      if (userId) {
        for (const [callerId, pending] of pendingCalls.entries()) {
          if (pending.to === userId) {
            pendingCalls.delete(callerId);
            const callerSocket = userSocketMap[callerId];
            if (callerSocket) {
              io.to(callerSocket).emit("callEnded", {
                from: userId,
                reason: "User went offline",
              });
            }
          }
        }
      }

      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
  });

  return io;
};
