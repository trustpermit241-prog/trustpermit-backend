const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "trustpermit_secret_key";

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await User.findById(decoded.id || decoded._id).select(
        "-passwordHash -salt"
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found. Please login again.",
        });
      }

      req.user = {
        id: user._id,
        _id: user._id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
      };

      return next();
    } catch (jwtError) {
      const user = await User.findOne({ apiToken: token }).select(
        "-passwordHash -salt"
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
        });
      }

      req.user = {
        id: user._id,
        _id: user._id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
      };

      return next();
    }
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token. Please login again.",
    });
  }
};