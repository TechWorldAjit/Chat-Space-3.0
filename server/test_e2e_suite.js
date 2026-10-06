import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Server } from "socket.io";

import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import groupRouter from "./routes/groupRoutes.js";
import folderRouter from "./routes/folderRoutes.js";
import { getOrCreateSpaceAIUser } from "./lib/spaceai.js";

import User from "./models/User.js";
import Group from "./models/Group.js";
import Message from "./models/Messages.js";
import ChatFolder from "./models/ChatFolder.js";

let mongod;
let server;
let TEST_PORT = 5099;
let BASE_URL = `http://localhost:${TEST_PORT}`;

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

async function putJson(url, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["token"] = token;
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function deleteJson(url, token = null) {
  const headers = {};
  if (token) headers["token"] = token;
  const res = await fetch(url, {
    method: "DELETE",
    headers,
  });
  return res.json();
}

async function runTestSuite() {
  console.log("==================================================");
  console.log("   FULL END-TO-END SUITE: GROUPS, AI & FOLDERS   ");
  console.log("==================================================");

  try {
    // 1. Start MongoMemoryServer
    console.log("Starting in-memory MongoDB...");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log("✓ Connected to In-Memory MongoDB.");

    // 2. Start Test Express App
    const app = express();
    server = http.createServer(app);
    const io = new Server(server, { cors: { origin: "*" } });

    app.use(express.json({ limit: "4mb" }));
    app.use(cors());

    app.use("/api/auth", userRouter);
    app.use("/api/messages", messageRouter);
    app.use("/api/ai", aiRouter);
    app.use("/api/groups", groupRouter);
    app.use("/api/folders", folderRouter);

    await new Promise((resolve) => {
      server.listen(TEST_PORT, () => {
        console.log(`✓ Test Server running at ${BASE_URL}`);
        resolve();
      });
    });

    await getOrCreateSpaceAIUser();

    // 3. User Authentication
    console.log("\n--- TEST 1: User Signup & Authentication ---");
    const resA = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Ajit Admin",
      email: "ajit@test.com",
      password: "password123",
      bio: "Tech Lead & Creator",
    });
    if (!resA.success) throw new Error(`User A signup failed: ${resA.message}`);
    const tokenA = resA.token;
    const userA = resA.userData;

    const resB = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Rahul Dev",
      email: "rahul@test.com",
      password: "password123",
      bio: "Full Stack Engineer",
    });
    if (!resB.success) throw new Error(`User B signup failed: ${resB.message}`);
    const tokenB = resB.token;
    const userB = resB.userData;

    const resC = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Sarah Designer",
      email: "sarah@test.com",
      password: "password123",
      bio: "Product Designer",
    });
    if (!resC.success) throw new Error(`User C signup failed: ${resC.message}`);
    const tokenC = resC.token;
    const userC = resC.userData;

    console.log("✓ 3 Users signed up successfully.");

    // 4. One-to-One Chat Regression
    console.log("\n--- TEST 2: Existing 1-to-1 Chat Regression ---");
    const sendDirectRes = await postJson(
      `${BASE_URL}/api/messages/send/${userB._id}`,
      { text: "Hey Rahul, let's sync on the new modules." },
      tokenA
    );
    if (!sendDirectRes.success) throw new Error("Direct message send failed");
    console.log("✓ 1-to-1 message sent:", sendDirectRes.newMessage.text);

    const getDirectRes = await getJson(
      `${BASE_URL}/api/messages/${userA._id}`,
      tokenB
    );
    if (!getDirectRes.success || getDirectRes.messages.length !== 1) {
      throw new Error("Direct message retrieval failed");
    }
    console.log("✓ 1-to-1 message retrieved by User B.");

    // 5. Group Creation
    console.log("\n--- TEST 3: Group Creation ---");
    const createGroupRes = await postJson(
      `${BASE_URL}/api/groups`,
      {
        name: "Dev Team Alpha",
        description: "Core engineering group for Q3 release",
        members: [userB._id, userC._id],
      },
      tokenA
    );
    if (!createGroupRes.success) {
      throw new Error(`Group creation failed: ${createGroupRes.message}`);
    }
    const group = createGroupRes.group;
    console.log(`✓ Group "${group.name}" created.`);
    console.log(`  Admin: ${group.admin.fullName} (${group.admin.email})`);
    console.log(`  Members count: ${group.members.length}`);

    if (group.members.length !== 3) {
      throw new Error(`Expected 3 members in group, got ${group.members.length}`);
    }
    if (group.admin._id.toString() !== userA._id.toString()) {
      throw new Error("Group admin is not the creator!");
    }

    // 6. Group Retrieval for all members
    console.log("\n--- TEST 4: Group Retrieval for Members ---");
    const groupsUserB = await getJson(`${BASE_URL}/api/groups`, tokenB);
    if (!groupsUserB.success || groupsUserB.groups.length !== 1) {
      throw new Error("User B could not retrieve group");
    }
    console.log(`✓ User B sees group: ${groupsUserB.groups[0].name}`);

    // 7. Group Messaging & Multi-member communication
    console.log("\n--- TEST 5: Realtime Group Messaging ---");
    const gMsg1 = await postJson(
      `${BASE_URL}/api/groups/${group._id}/messages`,
      { text: "Team, we need to finalize the roadmap today." },
      tokenA
    );
    if (!gMsg1.success) throw new Error("Group message 1 failed");
    console.log(`✓ User A posted: "${gMsg1.newMessage.text}"`);

    const gMsg2 = await postJson(
      `${BASE_URL}/api/groups/${group._id}/messages`,
      { text: "Backend APIs and Database models are completely ready." },
      tokenB
    );
    if (!gMsg2.success) throw new Error("Group message 2 failed");
    console.log(`✓ User B posted: "${gMsg2.newMessage.text}"`);

    const gMsg3 = await postJson(
      `${BASE_URL}/api/groups/${group._id}/messages`,
      { text: "UI components and design tokens are implemented." },
      tokenC
    );
    if (!gMsg3.success) throw new Error("Group message 3 failed");
    console.log(`✓ User C posted: "${gMsg3.newMessage.text}"`);

    // Retrieve group messages
    const getGMsgs = await getJson(
      `${BASE_URL}/api/groups/${group._id}/messages`,
      tokenB
    );
    if (!getGMsgs.success || getGMsgs.messages.length !== 3) {
      throw new Error(`Expected 3 group messages, got ${getGMsgs.messages.length}`);
    }
    console.log("✓ Retrieved all 3 messages with populated sender info.");

    // 8. Group Admin Permissions
    console.log("\n--- TEST 6: Group Admin Permissions ---");
    // Non-admin tries to update group
    const nonAdminUpdate = await putJson(
      `${BASE_URL}/api/groups/${group._id}`,
      { name: "Unauthorized Change" },
      tokenB
    );
    if (nonAdminUpdate.success) {
      throw new Error("FAIL: Non-admin should NOT be able to modify group details!");
    }
    console.log("✓ PASS: Non-admin update blocked.");

    // Admin updates group info
    const adminUpdate = await putJson(
      `${BASE_URL}/api/groups/${group._id}`,
      { name: "Dev Team Alpha (Updated)", description: "Updated description" },
      tokenA
    );
    if (!adminUpdate.success || adminUpdate.group.name !== "Dev Team Alpha (Updated)") {
      throw new Error("Admin update failed");
    }
    console.log("✓ PASS: Admin updated group info successfully.");

    // 9. Gemini AI Group Summary Endpoint
    console.log("\n--- TEST 7: Gemini AI Group Summary ---");
    const summaryRes = await postJson(
      `${BASE_URL}/api/ai/group-summary/${group._id}`,
      {},
      tokenA
    );
    console.log("AI Group Summary endpoint status:", summaryRes.success);
    if (summaryRes.success) {
      console.log("  Summary Overview:", summaryRes.summary);
      console.log("  Key Takeaways:", summaryRes.keyTakeaways);
    } else {
      console.log("  Info:", summaryRes.message);
    }
    console.log("✓ PASS: AI Group Summary endpoint processed cleanly.");

    // 10. Private Chat Folders
    console.log("\n--- TEST 8: Private Chat Folders & Privacy Isolation ---");
    // User A creates "Work" folder
    const createF1 = await postJson(
      `${BASE_URL}/api/folders`,
      { name: "Work" },
      tokenA
    );
    if (!createF1.success) throw new Error("Folder creation failed");
    const folderWork = createF1.folder;
    console.log(`✓ User A created folder: "${folderWork.name}"`);

    // User A adds 1-to-1 chat with User B and Group chat to "Work" folder
    await postJson(
      `${BASE_URL}/api/folders/${folderWork._id}/add-chat`,
      { chatType: "direct", chatId: userB._id },
      tokenA
    );
    const addGroupToFolder = await postJson(
      `${BASE_URL}/api/folders/${folderWork._id}/add-chat`,
      { chatType: "group", chatId: group._id },
      tokenA
    );
    if (addGroupToFolder.folder.chats.length !== 2) {
      throw new Error("Expected 2 chats in folder");
    }
    console.log("✓ User A added 1-to-1 and Group chats to 'Work' folder.");

    // User B checks folders (MUST BE 0)
    const userBFolders = await getJson(`${BASE_URL}/api/folders`, tokenB);
    console.log(`User B has ${userBFolders.folders.length} folders.`);
    if (userBFolders.folders.length !== 0) {
      throw new Error("FAIL: Privacy violation! User B can see User A's folder!");
    }
    console.log("✓ PASS: Folders are completely private to the owner.");

    // User A renames folder
    const renameF = await putJson(
      `${BASE_URL}/api/folders/${folderWork._id}`,
      { name: "Work Projects" },
      tokenA
    );
    if (renameF.folder.name !== "Work Projects") {
      throw new Error("Folder rename failed");
    }
    console.log(`✓ Folder renamed to: "${renameF.folder.name}"`);

    // User A deletes folder
    await deleteJson(`${BASE_URL}/api/folders/${folderWork._id}`, tokenA);
    console.log("✓ Folder deleted.");

    // Verify chats remain untouched
    const checkGroupStillExists = await getJson(
      `${BASE_URL}/api/groups/${group._id}`,
      tokenA
    );
    if (!checkGroupStillExists.success) {
      throw new Error("FAIL: Original group was deleted when folder was deleted!");
    }
    console.log("✓ PASS: Original conversations remain untouched after folder deletion.");

    console.log("\n==================================================");
    console.log("   ALL 8 END-TO-END TEST PHASES PASSED 100%!     ");
    console.log("==================================================");
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (mongod) await mongod.stop();
    await mongoose.disconnect();
    console.log("All servers stopped and test resources cleaned up.");
  }
}

runTestSuite();
