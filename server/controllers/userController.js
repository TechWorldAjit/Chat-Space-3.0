import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

// Signup a new user
export const signup = async (req, res) => {
  const { fullName, email, password, bio } = req.body;

  try {
    if (!fullName || !email || !password || !bio) {
      return res.json({ success: false, message: "Missing Details" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanFullName = fullName.trim();

    if (normalizedEmail === "spaceai@system.local" || cleanFullName.toLowerCase() === "spaceai") {
      return res.json({ success: false, message: "Cannot register as system user" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select("_id").lean();

    if (existingUser) {
      return res.json({ success: false, message: "Account already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullName: cleanFullName,
      email: normalizedEmail,
      password: hashedPassword,
      bio: bio.trim(),
    });

    const token = generateToken(newUser._id);

    return res.json({
      success: true,
      userData: {
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        bio: newUser.bio,
        isAI: newUser.isAI,
      },
      token,
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Controller to login a user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ success: false, message: "Please provide email and password" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail === "spaceai@system.local") {
      return res.json({ success: false, message: "System account cannot be logged into directly" });
    }

    const userData = await User.findOne({ email: normalizedEmail });

    if (!userData) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, userData.password);

    if (!isPasswordCorrect) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(userData._id);

    return res.json({
      success: true,
      userData: {
        _id: userData._id,
        fullName: userData.fullName,
        email: userData.email,
        profilePic: userData.profilePic,
        bio: userData.bio,
        isAI: userData.isAI,
      },
      token,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Controller to check if user is authenticated
export const checkAuth = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// Controller to update user profile details
export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName } = req.body;
    const userId = req.user._id;

    const updateFields = {};
    if (bio !== undefined) updateFields.bio = bio;
    if (fullName) updateFields.fullName = fullName;

    if (profilePic && profilePic.startsWith("data:image")) {
      const upload = await cloudinary.uploader.upload(profilePic, {
        folder: "profile_pics",
        transformation: [{ width: 256, height: 256, crop: "fill" }],
      });
      updateFields.profilePic = upload.secure_url;
    } else if (profilePic) {
      updateFields.profilePic = profilePic;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true }
    ).select("-password").lean();

    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Update profile error:", error.message);
    res.json({ success: false, message: error.message });
  }
};
