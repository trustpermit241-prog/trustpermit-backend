const AuditTrail = require("../models/AuditTrail");

const ignoredPaths = ["/api/logs", "/api/audit"];
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const getResource = (requestPath) => {
  const parts = requestPath.split("?")[0].split("/").filter(Boolean);
  return parts[1] || parts[0] || "unknown";
};

const getAction = (method) => {
  if (method === "POST") return "created";
  if (method === "PUT" || method === "PATCH") return "updated";
  if (method === "DELETE") return "deleted";
  return "changed";
};

module.exports = (req, res, next) => {
  if (
    !req.path.startsWith("/api/") ||
    !writeMethods.has(req.method) ||
    ignoredPaths.some((path) => req.path.startsWith(path))
  ) {
    return next();
  }

  res.on("finish", () => {
    const resource = getResource(req.originalUrl);
    const action = getAction(req.method);
    const user = req.user || {};

    AuditTrail.create({
      action,
      resource,
      description: `${resource} ${action}`,
      userId: user._id || user.id,
      userName: user.fullName || "Unauthenticated request",
      userEmail: user.email || "",
      userRole: user.role || "",
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      success: res.statusCode < 400,
      ipAddress: req.ip,
      meta: {
        requestId: req.headers["x-request-id"] || "",
      },
    }).catch((error) => {
      console.error("Audit trail write error:", error.message);
    });
  });

  return next();
};