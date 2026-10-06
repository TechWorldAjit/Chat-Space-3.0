# 💬 Chat Space

A full-stack, real-time chat application built with **React**, **Node.js**, **MongoDB**, and **Socket.IO** — featuring private messaging, group chats, file sharing, chat folders, and an integrated **SpaceAI** assistant powered by Google Gemini.

---

## ✨ Features

### 🔐 Authentication
- User registration & login with JWT-based authentication
- Secure password hashing with `bcryptjs`
- Protected routes on both frontend and backend
- Profile management with avatar upload

### 💬 Real-Time Messaging
- Instant private (1-to-1) messaging via **Socket.IO**
- Live "online/offline" user presence indicators
- Message seen/read receipts
- Support for sending **text**, **images**, **files**, and **folders (ZIP archives)**

### 📞 WebRTC Voice & Video Calling
- Direct 1-to-1 **Voice Calls** and **Video Calls** with WebRTC and Socket.IO signaling
- Encrypted Peer-to-Peer media streaming with Google public STUN servers
- Real-time in-call controls: Mute/Unmute Mic, Camera Toggle, Screen Sharing
- Picture-in-Picture (PiP) local video and full remote stream view
- Incoming call notification modal with ringing chime and Accept/Decline actions
- Realistic dual-tone audio synthesis via Web Audio API (no missing audio assets)
- Minimized floating call widget to keep browsing and chatting during calls
- Automatic busy detection, offline fallback, and disconnect cleanup

### 👥 Group Chats
- Create named groups with a description and group photo
- Add / remove members (admin-only controls)
- Group message broadcasting in real time
- Delete group functionality for admins

### 📁 Chat Folders
- Organise your conversations into custom-named folders
- Add or remove chats from folders
- Rename and delete folders

### 🤖 SpaceAI Assistant
- Built-in AI chatbot powered by **Google Gemini** (`@google/genai`)
- **AI image generation** directly from the chat interface
- **AI group summary** — get a smart recap of any group conversation
- SpaceAI is represented as a virtual user in the contact list

### ☁️ Media & File Storage
- Profile pictures and image messages uploaded to **Cloudinary**
- File attachments (PDFs, docs, etc.) handled via local `uploads/` directory
- Folder/ZIP file support with `jszip` on the client

### 📱 Responsive UI
- Built with **React 19** + **Tailwind CSS v4**
- Dark, space-themed background with a premium aesthetic
- Toast notifications via `react-hot-toast`
- Dynamic sidebar with search, contacts, and folder navigation

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 7, Tailwind CSS 4, React Router DOM 7 |
| **Backend** | Node.js, Express 5, Socket.IO 4 |
| **Database** | MongoDB Atlas (Mongoose 8) |
| **Auth** | JSON Web Tokens (JWT), bcryptjs |
| **AI** | Google Gemini via `@google/genai` |
| **Storage** | Cloudinary (images), local `uploads/` (files) |
| **Deployment** | Vercel (both client and server) |

---

## 📁 Project Structure

```
Chat-Space-main/
├── client/                         # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx          # Contact list, search, folders
│   │   │   ├── ChatContainer.jsx    # Main chat window & message composer
│   │   │   ├── RightSidebar.jsx     # User/group info panel
│   │   │   └── AISummaryModal.jsx   # AI group summary overlay
│   │   ├── pages/
│   │   │   ├── HomePage.jsx         # Main authenticated layout
│   │   │   ├── LoginPage.jsx        # Login & signup forms
│   │   │   └── ProfilePage.jsx      # Edit profile & avatar
│   │   ├── context/                 # React contexts (Auth, Chat)
│   │   ├── lib/
│   │   │   └── utils.js             # Shared helper functions
│   │   ├── assets/                  # Static assets (background SVG, etc.)
│   │   ├── App.jsx                  # Route definitions
│   │   └── main.jsx                 # React entry point
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── vercel.json
│
├── server/                         # Node.js / Express backend
│   ├── controllers/
│   │   ├── userController.js        # Auth: register, login, profile
│   │   ├── messageController.js     # Send & fetch 1-to-1 messages
│   │   ├── groupController.js       # Group CRUD & group messaging
│   │   ├── aiController.js          # Gemini chat, image gen, summary
│   │   └── folderController.js      # Chat folder management
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── messageRoutes.js
│   │   ├── groupRoutes.js
│   │   ├── aiRoutes.js
│   │   └── folderRoutes.js
│   ├── models/
│   │   ├── User.js                  # User schema
│   │   ├── Messages.js              # Message schema (text/image/file/group)
│   │   ├── Group.js                 # Group schema
│   │   └── ChatFolder.js            # Folder schema
│   ├── lib/
│   │   ├── db.js                    # MongoDB connection
│   │   ├── socket.js                # Socket.IO initialisation
│   │   ├── spaceai.js               # Gemini AI integration
│   │   ├── cloudinary.js            # Cloudinary client setup
│   │   ├── uploadHelper.js          # File upload utilities
│   │   └── utils.js                 # Shared backend utilities
│   ├── middleware/
│   │   └── auth.js                  # JWT route protection middleware
│   ├── uploads/                     # Local file upload storage
│   ├── server.js                    # Express app entry point
│   ├── .env.example                 # Environment variable template
│   └── vercel.json
│
├── ENV_SETUP_GUIDE.md               # Detailed guide for setting up .env files
└── README.md
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- **Node.js** v18+ and **npm**
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account
- A free [Cloudinary](https://cloudinary.com) account
- A free [Google AI Studio](https://aistudio.google.com/) API key

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Chat-Space.git
cd Chat-Space-main
```

### 2. Configure Environment Variables

> 📖 See [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md) for a detailed, step-by-step guide on obtaining every key.

**Create `server/.env`:**

```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_passphrase
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
GEMINI_API_KEY=your_gemini_api_key
```

**Create `client/.env`:**

```env
VITE_BACKEND_URL=http://localhost:5001
```

### 3. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 4. Run the Application

Open **two terminal windows**:

**Terminal 1 – Backend:**
```bash
cd server
npm run server
# Server starts at http://localhost:5001
```

**Terminal 2 – Frontend:**
```bash
cd client
npm run dev
# App opens at http://localhost:5173
```

---

## 🔌 API Reference

All API routes are prefixed with `/api`. Protected routes require a valid JWT Bearer token sent automatically by the frontend.

### Auth (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Create a new user account |
| `POST` | `/login` | Login and receive JWT |
| `PUT` | `/update-profile` | Update name, bio, or profile picture |
| `GET` | `/check` | Verify current auth session |
| `GET` | `/users` | Get all users (for contact list) |

### Messages (`/api/messages`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/:userId` | Fetch 1-to-1 message history |
| `POST` | `/send/:userId` | Send a message (text / image / file) |

### Groups (`/api/groups`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Create a new group |
| `GET` | `/` | Get all groups for current user |
| `GET` | `/:groupId` | Get a specific group's details |
| `GET` | `/:groupId/messages` | Fetch group message history |
| `POST` | `/:groupId/messages` | Send a message to a group |
| `PUT` | `/:groupId` | Update group name / description / photo |
| `POST` | `/:groupId/members` | Add members to a group |
| `DELETE` | `/:groupId/members/:memberId` | Remove a member from a group |
| `DELETE` | `/:groupId` | Delete a group (admin only) |

### AI — SpaceAI (`/api/ai`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat` | Send a message to the AI chatbot |
| `POST` | `/generate-image` | Generate an image from a text prompt |
| `POST` | `/group-summary/:groupId` | Get an AI summary of a group chat |

### Folders (`/api/folders`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all folders for current user |
| `POST` | `/` | Create a new folder |
| `PUT` | `/:folderId` | Rename a folder |
| `DELETE` | `/:folderId` | Delete a folder |
| `POST` | `/:folderId/add-chat` | Add a chat to a folder |
| `POST` | `/:folderId/remove-chat` | Remove a chat from a folder |

---

## 🌐 Deployment (Vercel)

Both the client and server are independently deployable to Vercel.

### Deploy the Backend

1. Push the `server/` directory (or the whole repo) to GitHub.
2. Create a new Vercel project pointing to the `server/` root.
3. Add all variables from `server/.env` to the Vercel **Environment Variables** panel.
4. Vercel will use `server/vercel.json` to route all requests through `server.js`.

### Deploy the Frontend

1. Create a separate Vercel project pointing to the `client/` root.
2. Add `VITE_BACKEND_URL` set to your deployed backend URL (e.g., `https://your-backend.vercel.app`).
3. Vercel will build with `npm run build` and use `client/vercel.json` to handle SPA routing and API rewrites.

---

## 🗄️ Database Schema

### User
| Field | Type | Notes |
|-------|------|-------|
| `email` | String | Unique, required |
| `fullName` | String | Required |
| `password` | String | Hashed, min length 6 |
| `profilePic` | String | Cloudinary URL |
| `bio` | String | Optional |
| `isAI` | Boolean | `true` for SpaceAI virtual user |

### Message
| Field | Type | Notes |
|-------|------|-------|
| `senderId` | ObjectId → User | Required |
| `receiverId` | ObjectId → User | Null for group messages |
| `groupId` | ObjectId → Group | Null for direct messages |
| `text` | String | Message body |
| `image` | String | Cloudinary image URL |
| `fileUrl` | String | Attached file URL |
| `fileName` | String | Original file name |
| `fileType` | String | MIME type |
| `fileSize` | Number | Bytes |
| `seen` | Boolean | Read receipt (DMs) |
| `seenBy` | [ObjectId] | Read receipts (groups) |

### Group
| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Required |
| `description` | String | Optional |
| `groupPic` | String | Cloudinary URL |
| `admin` | ObjectId → User | Group creator |
| `members` | [ObjectId → User] | All participants |

### ChatFolder
| Field | Type | Notes |
|-------|------|-------|
| `owner` | ObjectId → User | Folder owner |
| `name` | String | Folder label |
| `chats` | [ObjectId] | Referenced chat/group IDs |

---

## 🛠️ Available Scripts

### Server (`/server`)

| Command | Description |
|---------|-------------|
| `npm run server` | Start with `nodemon` (auto-reload on changes) |
| `npm start` | Start with plain `node` (production) |

### Client (`/client`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (hot reload) |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| MongoDB connection error | Verify `MONGO_URI` in `server/.env`; check Atlas network access allows `0.0.0.0/0` |
| `bad auth` on MongoDB | Ensure no `<>` brackets remain in the URI; avoid special characters in your DB password |
| Port already in use | The server auto-retries on the next port; or set a different `PORT` in `.env` |
| `.env` changes not taking effect | Stop the server (`Ctrl+C`) and restart with `npm run server` |
| Cloudinary upload failing | Double-check `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` |
| AI features not working | Ensure `GEMINI_API_KEY` is valid and not rate-limited on Google AI Studio |
| Client can't reach backend | Confirm `VITE_BACKEND_URL` in `client/.env` matches the running server address |

> For a detailed setup walkthrough, see [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md).

---

## 📄 License

This project is licensed under the terms in the [LICENSE](./LICENSE) file.
