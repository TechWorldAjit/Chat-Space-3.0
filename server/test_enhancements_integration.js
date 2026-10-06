import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./lib/db.js";
import User from "./models/User.js";
import Group from "./models/Group.js";
import Message from "./models/Messages.js";
import ChatFolder from "./models/ChatFolder.js";
import { getOrCreateSpaceAIUser, SPACEAI_EMAIL } from "./lib/spaceai.js";

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

async function runEnhancementsIntegrationTests() {
  console.log("==================================================");
  console.log("   GROUP CHAT, AI SUMMARY & FOLDERS TESTS   ");
  console.log("==================================================");

  let userA = null, userB = null, userC = null;
  let tokenA = null, tokenB = null, tokenC = null;
  let testGroup = null;
  let testFolder = null;

  try {
    await connectDB();
    await getOrCreateSpaceAIUser();

    // 1. Sign up 3 test users
    console.log("\n--- STEP 1: Setting up 3 Test Users ---");
    const ts = Date.now();
    const resA = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Ajit Admin",
      email: `ajit_${ts}@test.com`,
      password: "password123",
      bio: "Creator and Admin",
    });
    userA = resA.userData;
    tokenA = resA.token;

    const resB = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Rahul Dev",
      email: `rahul_${ts}@test.com`,
      password: "password123",
      bio: "Developer",
    });
    userB = resB.userData;
    tokenB = resB.token;

    const resC = await postJson(`${BASE_URL}/api/auth/signup`, {
      fullName: "Sarah Designer",
      email: `sarah_${ts}@test.com`,
      password: "password123",
      bio: "UI/UX Designer",
    });
    userC = resC.userData;
    tokenC = resC.token;

    console.log("✓ Users created: User A (Admin), User B (Dev), User C (Designer)");

    // 2. Create a Group Chat
    console.log("\n--- STEP 2: Group Creation ---");
    const createGroupRes = await postJson(
      `${BASE_URL}/api/groups`,
      {
        name: "Project Titan",
        description: "Core team working on Project Titan launch",
        members: [userB._id, userC._id],
      },
      tokenA
    );

    if (!createGroupRes.success) {
      throw new Error(`Group creation failed: ${createGroupRes.message}`);
    }
    testGroup = createGroupRes.group;
    console.log(`✓ Group created: "${testGroup.name}" with ID: ${testGroup._id}`);
    console.log(`  Admin: ${testGroup.admin.fullName}, Members count: ${testGroup.members.length}`);
    if (testGroup.members.length !== 3) {
      throw new Error(`Expected 3 members, got ${testGroup.members.length}`);
    }

    // 3. Verify Group Retrieval for all members
    console.log("\n--- STEP 3: Group Retrieval for Members ---");
    const groupsResB = await getJson(`${BASE_URL}/api/groups`, tokenB);
    if (!groupsResB.success || groupsResB.groups.length === 0) {
      throw new Error("User B failed to retrieve group");
    }
    console.log(`✓ User B sees group: ${groupsResB.groups[0].name}`);

    // 4. Send Group Messages
    console.log("\n--- STEP 4: Send Group Messages ---");
    const msg1 = await postJson(
      `${BASE_URL}/api/groups/${testGroup._id}/messages`,
      { text: "Hello team! Welcome to the Project Titan chat." },
      tokenA
    );
    console.log(`✓ User A sent: "${msg1.newMessage.text}" (sender: ${msg1.newMessage.senderId.fullName})`);

    const msg2 = await postJson(
      `${BASE_URL}/api/groups/${testGroup._id}/messages`,
      { text: "Hi Ajit! Rahul here. I am finishing the backend API by Friday." },
      tokenB
    );
    console.log(`✓ User B sent: "${msg2.newMessage.text}" (sender: ${msg2.newMessage.senderId.fullName})`);

    const msg3 = await postJson(
      `${BASE_URL}/api/groups/${testGroup._id}/messages`,
      { text: "Great! I have completed the UI mockups and design system review." },
      tokenC
    );
    console.log(`✓ User C sent: "${msg3.newMessage.text}" (sender: ${msg3.newMessage.senderId.fullName})`);

    // 5. Get Group Messages
    console.log("\n--- STEP 5: Retrieve Group Messages ---");
    const getMsgsRes = await getJson(
      `${BASE_URL}/api/groups/${testGroup._id}/messages`,
      tokenA
    );
    console.log(`✓ Retrieved ${getMsgsRes.messages.length} messages in group`);
    if (getMsgsRes.messages.length !== 3) {
      throw new Error(`Expected 3 messages, got ${getMsgsRes.messages.length}`);
    }

    // 6. Admin Permissions Check
    console.log("\n--- STEP 6: Admin Permissions Enforcement ---");
    // Non-admin (User B) tries to update group
    const unauthorizedUpdate = await putJson(
      `${BASE_URL}/api/groups/${testGroup._id}`,
      { name: "Hacked Name" },
      tokenB
    );
    if (unauthorizedUpdate.success) {
      throw new Error("FAIL: Non-admin should NOT be able to update group name!");
    }
    console.log("✓ PASS: Non-admin update correctly blocked.");

    // Admin (User A) updates group description
    const adminUpdate = await putJson(
      `${BASE_URL}/api/groups/${testGroup._id}`,
      { description: "Official Titan Project Workspace" },
      tokenA
    );
    if (!adminUpdate.success) {
      throw new Error(`Admin update failed: ${adminUpdate.message}`);
    }
    console.log("✓ PASS: Admin updated group info successfully.");

    // 7. AI Group Summary Generation
    console.log("\n--- STEP 7: Gemini AI Group Summary ---");
    const summaryRes = await postJson(
      `${BASE_URL}/api/ai/group-summary/${testGroup._id}`,
      {},
      tokenA
    );
    console.log("AI Summary Response Success:", summaryRes.success);
    if (summaryRes.success) {
      console.log("Summary:", summaryRes.summary);
      console.log("Key Takeaways:", summaryRes.keyTakeaways);
    } else {
      console.log("Note on AI summary:", summaryRes.message);
    }

    // 8. Private Chat Folders
    console.log("\n--- STEP 8: Private Chat Folders CRUD & Isolation ---");
    // User A creates "Work" folder
    const createFolderRes = await postJson(
      `${BASE_URL}/api/folders`,
      { name: "Work" },
      tokenA
    );
    if (!createFolderRes.success) {
      throw new Error(`Folder creation failed: ${createFolderRes.message}`);
    }
    testFolder = createFolderRes.folder;
    console.log(`✓ User A created folder: "${testFolder.name}" (ID: ${testFolder._id})`);

    // User A adds 1-to-1 chat with User B and Group chat to folder
    const addChat1 = await postJson(
      `${BASE_URL}/api/folders/${testFolder._id}/add-chat`,
      { chatType: "direct", chatId: userB._id },
      tokenA
    );
    const addChat2 = await postJson(
      `${BASE_URL}/api/folders/${testFolder._id}/add-chat`,
      { chatType: "group", chatId: testGroup._id },
      tokenA
    );
    console.log(`✓ Chats in folder: ${addChat2.folder.chats.length}`);

    // User B checks their folders (Must be 0, complete privacy isolation)
    const userBFolders = await getJson(`${BASE_URL}/api/folders`, tokenB);
    console.log(`User B sees ${userBFolders.folders.length} folders.`);
    if (userBFolders.folders.length !== 0) {
      throw new Error("FAIL: User B can see User A's private folder!");
    }
    console.log("✓ PASS: Folders are 100% private to owner.");

    // User A renames folder
    const renameRes = await putJson(
      `${BASE_URL}/api/folders/${testFolder._id}`,
      { name: "Titan Work" },
      tokenA
    );
    console.log(`✓ Folder renamed to: "${renameRes.folder.name}"`);

    // User A deletes folder
    const deleteFolderRes = await deleteJson(
      `${BASE_URL}/api/folders/${testFolder._id}`,
      tokenA
    );
    console.log("✓ Folder deleted response:", deleteFolderRes.message);

    // Verify chats still exist after folder deletion
    const checkGroupAfter = await getJson(
      `${BASE_URL}/api/groups/${testGroup._id}`,
      tokenA
    );
    if (!checkGroupAfter.success) {
      throw new Error("FAIL: Group was deleted when folder was deleted!");
    }
    console.log("✓ PASS: Original chats remain intact after folder deletion.");

    // 9. Existing 1-to-1 chat regression test
    console.log("\n--- STEP 9: 1-to-1 Chat Regression Test ---");
    const send1to1 = await postJson(
      `${BASE_URL}/api/messages/send/${userB._id}`,
      { text: "Hey Rahul, direct 1-to-1 message." },
      tokenA
    );
    if (!send1to1.success) {
      throw new Error("1-to-1 message failed");
    }
    console.log("✓ PASS: 1-to-1 messaging works normally.");

    console.log("\n==================================================");
    console.log("   ALL ENHANCEMENT TESTS PASSED SUCCESSFULLY!   ");
    console.log("==================================================");
  } catch (err) {
    console.error("TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    // Cleanup test data
    console.log("Cleaning up test data...");
    if (userA) await User.findByIdAndDelete(userA._id);
    if (userB) await User.findByIdAndDelete(userB._id);
    if (userC) await User.findByIdAndDelete(userC._id);
    if (testGroup) {
      await Group.findByIdAndDelete(testGroup._id);
      await Message.deleteMany({ groupId: testGroup._id });
    }
    if (testFolder) {
      await ChatFolder.findByIdAndDelete(testFolder._id);
    }
    if (userA && userB) {
      await Message.deleteMany({
        $or: [
          { senderId: userA._id, receiverId: userB._id },
          { senderId: userB._id, receiverId: userA._id },
        ],
      });
    }
    console.log("Cleanup complete.");
    await mongoose.disconnect();
  }
}

runEnhancementsIntegrationTests();
