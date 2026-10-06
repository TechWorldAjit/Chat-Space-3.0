# 🔐 Environment Variables (`.env`) Setup Guide

This guide gives you exact, step-by-step instructions on how to create and configure all `.env` files required to run **Quick Chat**.

---

## 📁 Overview of Required Files

You need to create **two separate `.env` files**:

| File Location | Purpose |
| :--- | :--- |
| `server/.env` | Stores backend settings, database passwords, and API keys. |
| `client/.env` | Tells the frontend website where the backend server is running. |

> ⚠️ **Important:** The file must be named exactly `.env` (with a dot at the beginning and no `.txt` extension).

---

## Part 1: Client Environment (`client/.env`)

### How to Create It:
1. In VS Code's file explorer on the left, right-click the **`client`** folder.
2. Select **New File**.
3. Name the file: `.env`
4. Paste the following line:

```env
VITE_BACKEND_URL=http://localhost:5001
```

### Explanation:
- **`VITE_BACKEND_URL`**: The web address where your backend server is running locally. By default, this is `http://localhost:5001`.

---

## Part 2: Server Environment (`server/.env`)

### How to Create It:
1. In VS Code's file explorer on the left, right-click the **`server`** folder.
2. Select **New File**.
3. Name the file: `.env`
4. Paste the following template into the file:

```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_passphrase
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
GEMINI_API_KEY=your_gemini_api_key
```

Now, follow the sections below to replace each placeholder with your actual keys.

---

## 🔑 How to Get Each Key for `server/.env`

---

### 1. `PORT`
- **Default Value:** `5001`
- **What it is:** The network port number where the backend server runs.
- **Example:**
  ```env
  PORT=5001
  ```

---

### 2. `JWT_SECRET`
- **Where to get it:** No website needed! You create this yourself.
- **What it is:** A secret password used by the backend to securely sign user login session tokens.
- **How to set it:** Type any random string of characters or words.
- **Example:**
  ```env
  JWT_SECRET=mySuperSecretChatKey2026!
  ```

---

### 3. `MONGO_URI` (MongoDB Database Connection)
- **Website:** [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
- **What it is:** The connection string that connects the backend to your free cloud database.

#### Step-by-Step Instructions:
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. When creating a database deployment, select the **M0 Free** cluster tier.
3. Choose your nearest region and click **Create Deployment**.
4. **Create a Database User:**
   - Enter a **Username** (e.g., `chatadmin`).
   - Enter a **Password** (e.g., `ChatPass12345`).
   - Click **Create Database User**. *(Keep note of this password!)*
5. **Configure Network Access:**
   - Choose **Allow Access from Anywhere** (`0.0.0.0/0`).
   - Click **Finish and Close**.
6. **Copy Connection String:**
   - In your database dashboard, click the **Connect** button.
   - Select **Drivers** (Node.js).
   - Copy the connection string. It will look like:
     ```text
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
     ```
7. **Paste into `server/.env`:**
   - Replace `<password>` with your database user's actual password.
   - Replace `<username>` with your database username if needed.
   - Example:
     ```env
     MONGO_URI=mongodb+srv://chatadmin:ChatPass12345@cluster0.abcde.mongodb.net/quickchat?retryWrites=true&w=majority
     ```

---

### 4. `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Website:** [https://cloudinary.com/users/register_free](https://cloudinary.com/users/register_free)
- **What it is:** Free cloud storage service used to store profile pictures, chat image attachments, and AI-generated photos.

#### Step-by-Step Instructions:
1. Go to [Cloudinary](https://cloudinary.com/users/register_free) and sign up for a free account.
2. Once signed in, go to the **Dashboard** (or **Programmable Media** home page).
3. Under **Product Environment Credentials**, locate:
   - **Cloud Name**
   - **API Key**
   - **API Secret** (click the eye icon or copy button to reveal)
4. Copy each item into `server/.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=dxy123abc
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=abcde_12345-UVWXYZ
   ```

---

### 5. `GEMINI_API_KEY` (SpaceAI Chatbot & Image Generation)
- **Website:** [https://aistudio.google.com/](https://aistudio.google.com/)
- **What it is:** The free API key from Google AI Studio that powers the built-in **SpaceAI** chatbot and image generator.

#### Step-by-Step Instructions:
1. Go to [Google AI Studio](https://aistudio.google.com/) and sign in with your Google account.
2. In the left navigation menu, click **Get API key**.
3. Click the blue button **Create API key**.
4. Choose any project name and click **Create API key in existing project** (or new project).
5. Copy the generated API key.
6. Paste it into `server/.env`:
   ```env
   GEMINI_API_KEY=AIzaSyA1234567890ExampleKey
   ```

---

## 📋 Full `server/.env` Example

Your completed `server/.env` file should look similar to this:

```env
PORT=5001
MONGO_URI=mongodb+srv://chatadmin:ChatPass12345@cluster0.abcde.mongodb.net/quickchat?retryWrites=true&w=majority
JWT_SECRET=mySuperSecretChatKey2026!
CLOUDINARY_CLOUD_NAME=dxy123abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcde_12345-UVWXYZ
GEMINI_API_KEY=AIzaSyA1234567890ExampleKey
```

---

## 🛠️ Common Troubleshooting Tips

1. **File named `.env.txt` by accident:**
   - In Windows/Mac file managers, the file might get saved as `.env.txt`. Make sure it is named exactly `.env` inside VS Code.
2. **MongoDB Connection Failed (`bad auth`):**
   - Check if you left `<` and `>` in your `MONGO_URI`. For example, write `:ChatPass12345@`, not `:<ChatPass12345>@`.
   - If your password has special characters like `@` or `#`, MongoDB might fail. Use letters and numbers for your database password.
3. **Changes in `.env` are not taking effect:**
   - Whenever you edit or add a variable to a `.env` file, **stop your backend server** (`Ctrl + C`) and restart it (`npm run server`).
4. **Never upload your `.env` file:**
   - The `.env` file contains your private credentials and is already included in `.gitignore` so Git will not publish it online.
