import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.headers.token;

    if (!token) {
      return res.json({ success: false, message: "Authentication token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password").lean();

    if (!user) return res.json({ success: false, message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    res.json({ success: false, message: error.message });
  }
};
