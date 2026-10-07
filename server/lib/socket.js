import { Server } from "socket.io";

export const userSocketMap = {};
export const activeCalls = new Map();
export const pendingCalls = new Map();

export let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      userSocketMap[userId] = socket.id;
      socket.userId = userId;
      socket.join(userId);
    }
    console.log("User Connected:", userId, "Socket ID:", socket.id);

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("callUser", ({ userToCall, signalData, callType = "voice", callerInfo }) => {
      const callerId = socket.userId || userId;
      if (!callerId) return;

      if (!userToCall || userToCall === callerId) {
        socket.emit("callError", { message: "Invalid recipient for call" });
        return;
      }

      const isRecipientOnline = Boolean(userSocketMap[userToCall]);
      if (!isRecipientOnline) {
        socket.emit("callUnavailable", {
          to: userToCall,
          reason: "User is currently offline",
        });
        return;
      }

      if (activeCalls.has(userToCall)) {
        socket.emit("callBusy", {
          to: userToCall,
          reason: "User is currently busy on another call",
        });
        return;
      }

      for (const [, pending] of pendingCalls.entries()) {
        if (pending.to === userToCall) {
          socket.emit("callBusy", {
            to: userToCall,
            reason: "User is currently receiving another call",
          });
          return;
        }
      }

      pendingCalls.set(callerId, {
        to: userToCall,
        callType,
        startedAt: Date.now(),
        socketId: socket.id,
      });

      console.log(`[Call] ${callerId} calling ${userToCall} (${callType})`);

      io.to(userToCall).emit("incomingCall", {
        from: callerId,
        callerInfo: callerInfo || { _id: callerId },
        signal: signalData,
        callType,
      });
    });

    socket.on("answerCall", ({ to, signal }) => {
      const recipientId = socket.userId || userId;
      if (!recipientId || !to) return;

      pendingCalls.delete(to);
      pendingCalls.delete(recipientId);

      const startedAt = Date.now();
      activeCalls.set(recipientId, { peerId: to, startedAt, socketId: socket.id });
      activeCalls.set(to, { peerId: recipientId, startedAt, socketId: userSocketMap[to] });

      console.log(`[Call] ${recipientId} answered call from ${to}`);

      io.to(to).emit("callAccepted", {
        signal,
        from: recipientId,
      });
    });

    socket.on("rejectCall", ({ to, reason = "Call declined" }) => {
      const recipientId = socket.userId || userId;
      if (to) {
        pendingCalls.delete(to);
      }
      if (recipientId) {
        pendingCalls.delete(recipientId);
      }

      console.log(`[Call] ${recipientId} rejected call from ${to}`);

      if (to) {
        io.to(to).emit("callRejected", {
          from: recipientId,
          reason,
        });
      }
    });

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

      if (to) {
        io.to(to).emit("callEnded", { from: myId });
      }
    });

    socket.on("iceCandidate", ({ to, candidate }) => {
      const myId = socket.userId || userId;
      if (!to || !candidate) return;

      io.to(to).emit("iceCandidate", {
        from: myId,
        candidate,
      });
    });

    socket.on("toggleMedia", ({ to, mediaType, enabled }) => {
      const myId = socket.userId || userId;
      if (!to) return;

      io.to(to).emit("mediaToggled", {
        from: myId,
        mediaType,
        enabled,
      });
    });

    socket.on("disconnect", () => {
      console.log("User Disconnected:", userId, "Socket ID:", socket.id);

      if (userId && activeCalls.has(userId)) {
        const call = activeCalls.get(userId);
        if (call?.socketId === socket.id || userSocketMap[userId] === socket.id) {
          activeCalls.delete(userId);
          if (call?.peerId) {
            activeCalls.delete(call.peerId);
            io.to(call.peerId).emit("callEnded", {
              from: userId,
              reason: "User disconnected",
            });
          }
        }
      }

      if (userId && pendingCalls.has(userId)) {
        const pending = pendingCalls.get(userId);
        if (pending?.socketId === socket.id || userSocketMap[userId] === socket.id) {
          pendingCalls.delete(userId);
          if (pending?.to) {
            io.to(pending.to).emit("callEnded", {
              from: userId,
              reason: "Caller disconnected",
            });
          }
        }
      }

      if (userId) {
        for (const [callerId, pending] of pendingCalls.entries()) {
          if (pending.to === userId && userSocketMap[userId] === socket.id) {
            pendingCalls.delete(callerId);
            io.to(callerId).emit("callEnded", {
              from: userId,
              reason: "User went offline",
            });
          }
        }
      }

      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
      }
    });
  });

  return io;
};
