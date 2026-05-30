const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No token" });

  // First try to verify as a JWT
  try {
const secret = process.env.JWT_SECRET || "trustpermit_secret_key";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (err) {
    // Not a JWT, fall through to API token lookup
  }

  try {
    // Fallback: support apiToken string authentication (legacy tokens)
    const user = await User.findOne({ apiToken: token }).select("-passwordHash -salt");
    if (!user) return res.status(401).json({ msg: "Invalid token" });

    req.user = {
      id: user._id,
      _id: user._id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    };

    return next();
  } catch (err) {
    console.error("Auth middleware token error:", err.message);
    return res.status(401).json({ msg: "Invalid token" });
  }
};
