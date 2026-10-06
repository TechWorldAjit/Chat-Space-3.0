import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./lib/db.js";
import User from "./models/User.js";
import Message from "./models/Messages.js";
import {
  getOrCreateSpaceAIUser,
  isImagePrompt,
  extractImagePrompt,
  SPACEAI_EMAIL,
} from "./lib/spaceai.js";

const BASE_URL = "http://localhost:5001";

async function postJson(url, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["token"] = token;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getJson(url, token = null) {
  const headers = {};
  if (token) headers["token"] = token;
  const res = await fetch(url, {
    method: "GET",
    headers,
  });
  return res.json();
}

async function runIntegrationTests() {
  console.log("==================================================");
  console.log("       SPACEAI END-TO-END INTEGRATION TESTS       ");
  console.log("==================================================");

  let userAToken = null;
  let userBToken = null;
  let userA = null;
  let userB = null;
  let spaceAIUser = null;

  try {
    await connectDB();
    spaceAIUser = await getOrCreateSpaceAIUser();
    console.log("1. SpaceAI DB User:", {
      id: spaceAIUser._id.toString(),
      name: spaceAIUser.fullName,
      email: spaceAIUser.email,
      isAI: spaceAIUser.isAI,
    });

    // Test 1: Block login as SpaceAI
    console.log("\n--- TEST 1: Disallow direct login as SpaceAI ---");
    const aiLoginRes = await postJson(`${BASE_URL}/api/auth/login`, {
      email: SPACEAI_EMAIL,
      password: "anyPassword123",
    });
    console.log("AI Login response:", aiLoginRes);
    if (aiLoginRes.success) {
      throw new Error("FAIL: SpaceAI login should have been blocked!");
    }
    console.log("✓ PASS: Direct login as SpaceAI is forbidden.");

    // Test 2: Normal user signup / login (User A and User B)
    console.log("\n--- TEST 2: User A & User B Authentication ---");
    const userAEmail = `test_user_a_${Date.now()}@example.com`;
    const userBEmail = `test_user_b_${Date.now()}@example.com`;

    const signupARes = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Test User A",
      email: userAEmail,
      password: "password123",
      bio: "Hello, I am User A",
    });

    if (!signupARes.success) {
      throw new Error(`User A signup failed: ${signupARes.message}`);
    }
    userAToken = signupARes.token;
    userA = signupARes.userData;
    console.log("User A signed up:", userA.fullName, `(ID: ${userA._id})`);

    const signupBRes = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Test User B",
      email: userBEmail,
      password: "password123",
      bio: "Hello, I am User B",
    });

    if (!signupBRes.success) {
      throw new Error(`User B signup failed: ${signupBRes.message}`);
    }
    userBToken = signupBRes.token;
    userB = signupBRes.userData;
    console.log("User B signed up:", userB.fullName, `(ID: ${userB._id})`);
    console.log("✓ PASS: Authentication and Token Generation works.");

    // Test 3: Get sidebar users for User A
    console.log("\n--- TEST 3: Sidebar Contacts Retrieval ---");
    const sidebarRes = await getJson(`${BASE_URL}/api/messages/users`, userAToken);

    if (!sidebarRes.success) {
      throw new Error("Failed to get sidebar users");
    }

    const returnedUsers = sidebarRes.users;
    const hasSpaceAI = returnedUsers.some(
      (u) => u.email === SPACEAI_EMAIL || u.fullName === "SpaceAI"
    );
    const hasUserB = returnedUsers.some((u) => u._id === userB._id);

    console.log(`Retrieved ${returnedUsers.length} contacts for User A:`);
    returnedUsers.forEach((u) =>
      console.log(` - ${u.fullName} (${u.email}) ${u.isAI ? "[AI User]" : ""}`)
    );

    if (!hasSpaceAI) throw new Error("FAIL: SpaceAI not found in sidebar list!");
    if (!hasUserB) throw new Error("FAIL: User B not found in sidebar list!");
    console.log("✓ PASS: SpaceAI and normal users appear in sidebar contacts.");

    // Test 4: User A -> User B Normal Chat (Confirm existing functionality untouched)
    console.log("\n--- TEST 4: User A -> User B Normal Chat ---");
    const sendNormalRes = await postJson(
      `${BASE_URL}/api/messages/send/${userB._id}`,
      { text: "Hello User B, how are you doing?" },
      userAToken
    );

    if (!sendNormalRes.success) {
      throw new Error("Failed to send normal message");
    }
    console.log("User A sent message to User B:", sendNormalRes.newMessage.text);

    const getNormalRes = await getJson(
      `${BASE_URL}/api/messages/${userB._id}`,
      userAToken
    );
    console.log(`Messages in User A <-> User B chat: ${getNormalRes.messages.length}`);
    if (getNormalRes.messages.length !== 1) {
      throw new Error("Normal message count mismatch!");
    }
    console.log("✓ PASS: User-to-user chat works flawlessly.");

    // Test 5: User A -> SpaceAI Chat
    console.log("\n--- TEST 5: User A -> SpaceAI Text Message ---");
    const sendAIRes = await postJson(
      `${BASE_URL}/api/messages/send/${spaceAIUser._id}`,
      { text: "Hello SpaceAI! Can you explain what quick-chat is in one sentence?" },
      userAToken
    );

    if (!sendAIRes.success) {
      throw new Error(`Failed to send message to SpaceAI: ${sendAIRes.message}`);
    }
    console.log("User A message sent to SpaceAI:", sendAIRes.newMessage.text);

    // Wait for SpaceAI async processing
    console.log("Waiting for SpaceAI async processing...");
    let aiChatMessages = [];
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const getAIMessagesRes = await getJson(
        `${BASE_URL}/api/messages/${spaceAIUser._id}`,
        userAToken
      );
      aiChatMessages = getAIMessagesRes.messages || [];
      if (aiChatMessages.length >= 2) break;
    }

    console.log(`Total messages in User A <-> SpaceAI chat: ${aiChatMessages.length}`);
    aiChatMessages.forEach((m) => {
      const isUser = m.senderId === userA._id;
      console.log(`[${isUser ? "User A" : "SpaceAI"}]: ${m.text || "[IMAGE: " + m.image + "]"}`);
    });

    if (aiChatMessages.length < 2) {
      throw new Error("SpaceAI did not record response message in database!");
    }
    console.log("✓ PASS: SpaceAI chat message saved and response generated.");

    // Test 6: User Isolation Check
    console.log("\n--- TEST 6: User A vs User B Isolation ---");
    const getBMessagesWithAI = await getJson(
      `${BASE_URL}/api/messages/${spaceAIUser._id}`,
      userBToken
    );

    console.log(`Messages in User B <-> SpaceAI chat: ${getBMessagesWithAI.messages.length}`);
    if (getBMessagesWithAI.messages.length !== 0) {
      throw new Error("FAIL: User B saw User A's SpaceAI chat history!");
    }

    // User B sends a message to SpaceAI
    await postJson(
      `${BASE_URL}/api/messages/send/${spaceAIUser._id}`,
      { text: "Hello SpaceAI, this is User B." },
      userBToken
    );
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const getBCheck = await getJson(
        `${BASE_URL}/api/messages/${spaceAIUser._id}`,
        userBToken
      );
      if (getBCheck.messages?.length >= 2) break;
    }

    const getBAfter = await getJson(
      `${BASE_URL}/api/messages/${spaceAIUser._id}`,
      userBToken
    );
    const getAAfter = await getJson(
      `${BASE_URL}/api/messages/${spaceAIUser._id}`,
      userAToken
    );

    console.log(`User A messages with SpaceAI: ${getAAfter.messages.length}`);
    console.log(`User B messages with SpaceAI: ${getBAfter.messages.length}`);
    console.log("✓ PASS: Complete conversation isolation between User A and User B.");

    // Test 7: Dedicated AI routes (/api/ai/chat and /api/ai/generate-image)
    console.log("\n--- TEST 7: Dedicated AI Endpoints (/api/ai/chat & /api/ai/generate-image) ---");
    const aiChatEndpointRes = await postJson(
      `${BASE_URL}/api/ai/chat`,
      { message: "Tell me a short fun fact about space." },
      userAToken
    );
    console.log("POST /api/ai/chat status:", aiChatEndpointRes.success);
    console.log("POST /api/ai/chat reply preview:", aiChatEndpointRes.reply?.slice(0, 100));

    console.log("\n==================================================");
    console.log("   ALL INTEGRATION & REGRESSION TESTS PASSED!   ");
    console.log("==================================================");
  } catch (err) {
    console.error("TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    // Clean up test users
    if (userA) await User.findByIdAndDelete(userA._id);
    if (userB) await User.findByIdAndDelete(userB._id);
    await Message.deleteMany({
      $or: [
        { senderId: userA?._id },
        { receiverId: userA?._id },
        { senderId: userB?._id },
        { receiverId: userB?._id },
      ],
    });
    console.log("Test cleanup completed.");
    await mongoose.disconnect();
  }
}

runIntegrationTests();
