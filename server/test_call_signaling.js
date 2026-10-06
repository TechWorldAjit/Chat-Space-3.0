import http from "http";
import express from "express";
import { Server } from "socket.io";
import { io as ClientIO } from "socket.io-client";
import { initSocket, activeCalls, pendingCalls } from "./lib/socket.js";

const TEST_PORT = 5098;
const app = express();
const server = http.createServer(app);
initSocket(server);

const connectClient = (userId) => {
  return new Promise((resolve) => {
    const socket = ClientIO(`http://localhost:${TEST_PORT}`, {
      query: { userId },
      transports: ["websocket"],
      forceNew: true,
    });
    socket.on("connect", () => resolve(socket));
  });
};

async function runCallTests() {
  console.log("==================================================");
  console.log("   TEST SUITE: WEBRTC VOICE & VIDEO SIGNALING    ");
  console.log("==================================================");

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test socket server running on port ${TEST_PORT}`);

  try {
    const userAId = "user_alpha_111";
    const userBId = "user_beta_222";
    const userCId = "user_gamma_333";

    const clientA = await connectClient(userAId);
    const clientB = await connectClient(userBId);
    const clientC = await connectClient(userCId);
    console.log("✓ Connected 3 test socket clients (User A, User B, User C)");

    // Test 1: Call unavailable when calling an offline user
    console.log("\n--- TEST 1: Calling offline user ---");
    const offlineTestPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for callUnavailable")), 3000);
      clientA.once("callUnavailable", (data) => {
        clearTimeout(timer);
        if (data.to === "non_existent_user") {
          console.log("✓ PASS: Correctly received callUnavailable for offline recipient");
          resolve();
        } else {
          reject(new Error("Unexpected recipient in callUnavailable"));
        }
      });
    });

    clientA.emit("callUser", {
      userToCall: "non_existent_user",
      signalData: { type: "offer", sdp: "dummy_sdp_offer" },
      callType: "voice",
      callerInfo: { _id: userAId, fullName: "User Alpha" },
    });
    await offlineTestPromise;

    // Test 2: Voice Call Offer and Incoming Call Reception
    console.log("\n--- TEST 2: Voice Call Offer & Incoming Call Reception ---");
    const incomingCallPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for incomingCall")), 3000);
      clientB.once("incomingCall", (data) => {
        clearTimeout(timer);
        if (data.from === userAId && data.callType === "voice" && data.signal?.sdp === "voice_offer_sdp") {
          console.log("✓ PASS: User B received incoming voice call with valid callerInfo & offer");
          resolve(data);
        } else {
          reject(new Error("Malformed incomingCall data"));
        }
      });
    });

    clientA.emit("callUser", {
      userToCall: userBId,
      signalData: { type: "offer", sdp: "voice_offer_sdp" },
      callType: "voice",
      callerInfo: { _id: userAId, fullName: "User Alpha", profilePic: "https://example.com/a.jpg" },
    });
    await incomingCallPromise;

    // Test 3: User C tries to call User B while User B is receiving call (Busy check)
    console.log("\n--- TEST 3: User Busy Check ---");
    const busyCheckPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for callBusy")), 3000);
      clientC.once("callBusy", (data) => {
        clearTimeout(timer);
        if (data.to === userBId) {
          console.log("✓ PASS: User C received callBusy notification");
          resolve();
        } else {
          reject(new Error("Unexpected callBusy response"));
        }
      });
    });

    clientC.emit("callUser", {
      userToCall: userBId,
      signalData: { type: "offer", sdp: "dummy_offer" },
      callType: "video",
      callerInfo: { _id: userCId, fullName: "User Gamma" },
    });
    await busyCheckPromise;

    // Test 4: Answer Call & Establish Call Accepted
    console.log("\n--- TEST 4: Answering Call ---");
    const answerPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for callAccepted")), 3000);
      clientA.once("callAccepted", (data) => {
        clearTimeout(timer);
        if (data.from === userBId && data.signal?.sdp === "voice_answer_sdp") {
          console.log("✓ PASS: User A received callAccepted from User B");
          resolve();
        } else {
          reject(new Error("Malformed callAccepted data"));
        }
      });
    });

    clientB.emit("answerCall", {
      to: userAId,
      signal: { type: "answer", sdp: "voice_answer_sdp" },
    });
    await answerPromise;

    if (activeCalls.has(userAId) && activeCalls.has(userBId)) {
      console.log("✓ PASS: Active call registered for both peers in server state");
    } else {
      throw new Error("Active calls not registered in server state");
    }

    // Test 5: ICE Candidate Exchange
    console.log("\n--- TEST 5: ICE Candidate Exchange ---");
    const icePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for iceCandidate")), 3000);
      clientB.once("iceCandidate", (data) => {
        clearTimeout(timer);
        if (data.from === userAId && data.candidate?.candidate === "candidate_alpha_ice") {
          console.log("✓ PASS: ICE candidate relayed accurately to User B");
          resolve();
        } else {
          reject(new Error("Malformed ICE candidate payload"));
        }
      });
    });

    clientA.emit("iceCandidate", {
      to: userBId,
      candidate: { candidate: "candidate_alpha_ice", sdpMid: "0" },
    });
    await icePromise;

    // Test 6: Media State Toggle (Mute / Camera)
    console.log("\n--- TEST 6: Media State Toggle Sync ---");
    const mediaTogglePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for mediaToggled")), 3000);
      clientA.once("mediaToggled", (data) => {
        clearTimeout(timer);
        if (data.from === userBId && data.mediaType === "audio" && data.enabled === false) {
          console.log("✓ PASS: User B muted audio and notification received by User A");
          resolve();
        } else {
          reject(new Error("Malformed mediaToggled event"));
        }
      });
    });

    clientB.emit("toggleMedia", {
      to: userAId,
      mediaType: "audio",
      enabled: false,
    });
    await mediaTogglePromise;

    // Test 7: Ending Call Cleanly
    console.log("\n--- TEST 7: Ending Call Cleanly ---");
    const endCallPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for callEnded")), 3000);
      clientB.once("callEnded", (data) => {
        clearTimeout(timer);
        if (data.from === userAId) {
          console.log("✓ PASS: User B received callEnded from User A");
          resolve();
        } else {
          reject(new Error("Malformed callEnded event"));
        }
      });
    });

    clientA.emit("endCall", { to: userBId });
    await endCallPromise;

    if (!activeCalls.has(userAId) && !activeCalls.has(userBId)) {
      console.log("✓ PASS: Server activeCalls state completely cleaned up");
    } else {
      throw new Error("Active calls state was not cleaned up after endCall");
    }

    // Test 8: Video Call & Rejection Flow
    console.log("\n--- TEST 8: Video Call & Rejection Flow ---");
    const callRejectedPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for callRejected")), 3000);
      clientA.once("callRejected", (data) => {
        clearTimeout(timer);
        if (data.from === userBId && data.reason === "Busy in meeting") {
          console.log("✓ PASS: User A received callRejected with custom reason");
          resolve();
        } else {
          reject(new Error("Malformed callRejected event"));
        }
      });
    });

    clientB.once("incomingCall", (data) => {
      if (data.callType === "video") {
        clientB.emit("rejectCall", { to: userAId, reason: "Busy in meeting" });
      }
    });

    clientA.emit("callUser", {
      userToCall: userBId,
      signalData: { type: "offer", sdp: "video_offer_sdp" },
      callType: "video",
      callerInfo: { _id: userAId, fullName: "User Alpha" },
    });
    await callRejectedPromise;

    // Test 9: Peer Disconnection during Active Call
    console.log("\n--- TEST 9: Peer Disconnection Clean Handling ---");
    // Connect A and C in a call
    clientA.emit("callUser", {
      userToCall: userCId,
      signalData: { type: "offer", sdp: "offer_ac" },
      callType: "voice",
    });

    await new Promise((res) => {
      clientC.once("incomingCall", () => {
        clientC.emit("answerCall", { to: userAId, signal: { type: "answer", sdp: "ans_ac" } });
      });
      clientA.once("callAccepted", () => {
        res();
      });
    });

    const disconnectCallEndedPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for callEnded on disconnect")), 3000);
      clientA.once("callEnded", (data) => {
        clearTimeout(timer);
        if (data.from === userCId && data.reason === "User disconnected") {
          console.log("✓ PASS: User A received callEnded when User C disconnected abruptly");
          resolve();
        } else {
          reject(new Error("Malformed callEnded on disconnect"));
        }
      });
    });

    clientC.disconnect();
    await disconnectCallEndedPromise;

    console.log("\n==================================================");
    console.log("   ALL 9 CALL SIGNALING TESTS PASSED 100%!       ");
    console.log("==================================================");

    clientA.disconnect();
    clientB.disconnect();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    server.close();
    process.exit(1);
  }
}

runCallTests();
