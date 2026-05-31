const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    const secret = process.env.JWT_SECRET || "trustpermit_secret_key";

    try {
      const decoded = jwt.verify(token, secret);

      req.user = {
        id: decoded.id || decoded._id,
        _id: decoded._id || decoded.id,
        role: decoded.role,
        email: decoded.email,
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
    console.error("Auth middleware error:", err.message);

    return res.status(401).json({
      success: false,
      message: "Invalid token. Please login again.",
    });
  }
};