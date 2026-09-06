const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Application = require("../models/Application");
const Inspection = require("../models/Inspection");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Chat = require("../models/Chat");
const UploadedDocument = require("../models/UploadedDocument");
const Notification = require("../models/Notification");

router.use(authMiddleware);

const asDate = (...values) => {
  const value = values.find(Boolean);
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
};

const addNotification = async (items, item) => {
  const existing = await Notification.findOne({
    audienceRole: item.audienceRole,
    recipientId: item.recipientId || null,
    sourceKey: item.sourceKey,
  });
  if (!existing) {
    items.push(item);
    await Notification.create(item);
  }
};

const syncCitizenNotifications = async (user, items) => {
  const [applications, inspections, payments] = await Promise.all([
    Application.find({ $or: [{ userId: user._id }, { citizenId: user._id }] }).lean(),
    Inspection.find({ citizenId: user._id }).lean(),
    Payment.find({ $or: [{ userId: user._id }, { email: user.email }] }).lean(),
  ]);

  for (const payment of payments) {
    const status = String(payment.status || payment.paymentStatus || payment.result || "").toLowerCase();
    const rejected = ["rejected", "declined", "failed", "cancelled", "denied"].includes(status);
    const approved = ["approved", "paid", "success", "completed"].includes(status) || payment.permitReleased;
    if (!approved && !rejected) continue;
    await addNotification(items, {
      recipientId: user._id, audienceRole: "citizen", sourceKey: `payment-${payment._id}`,
      type: "payment", title: rejected ? "Payment Update" : "Payment Approved",
      message: rejected ? "Your payment was rejected or failed. Please review and try again." : "Your payment was approved and your permit has been released.",
      icon: rejected ? "warning" : "payment", link: "/account",
      occurredAt: asDate(payment.permitReleasedAt, payment.updatedAt, payment.createdAt),
    });
  }

  for (const inspection of inspections) {
    const rejected = ["rejected", "denied", "failed"].includes(String(inspection.status || "").toLowerCase());
    await addNotification(items, {
      recipientId: user._id, audienceRole: "citizen", sourceKey: `inspection-${inspection._id}`,
      type: "inspection", title: "Inspection Update",
      message: `${rejected ? "Inspection was rejected" : "Inspection scheduled"}${inspection.date ? ` for ${new Date(inspection.date).toLocaleDateString()}` : ""}${inspection.type ? ` (${inspection.type})` : ""}.`,
      icon: rejected ? "warning" : "inspection", link: "/account",
      occurredAt: asDate(inspection.updatedAt, inspection.createdAt, inspection.date),
    });
  }

  for (const application of applications) {
    await addNotification(items, {
      recipientId: user._id, audienceRole: "citizen", sourceKey: `application-${application._id}`,
      type: "application", title: "Application Update",
      message: `${application.applicationType || "Application"} ${application.status || "Pending"} for Permit #${application.permitId || application._id}`,
      icon: "application", link: "/account",
      occurredAt: asDate(application.updatedAt, application.createdAt),
    });
  }
};

const syncStaffNotifications = async (role, items) => {
  const [applications, inspections, payments, users, chats, documents] = await Promise.all([
    Application.find().lean(), Inspection.find().lean(), Payment.find().lean(),
    User.find({ role: "citizen" }).lean(), Chat.find().lean(), UploadedDocument.find().lean(),
  ]);
  const audience = { audienceRole: role, recipientId: null };
  const add = (sourceKey, data) => addNotification(items, { ...audience, sourceKey, ...data });
  for (const payment of payments) await add(`payment-${payment._id}`, { type: "payment", title: "New Payment Received", message: `${payment.name || "User"} paid PHP ${Number(payment.amount || 0).toLocaleString()}.`, icon: "payment", link: "/staff/payments", occurredAt: asDate(payment.createdAt, payment.updatedAt) });
  for (const inspection of inspections) await add(`inspection-${inspection._id}`, { type: "inspection", title: "Inspection Update", message: `${inspection.status || "Pending"} inspection.`, icon: "inspection", link: "/staff/inspection", occurredAt: asDate(inspection.updatedAt, inspection.createdAt) });
  for (const user of users) await add(`user-${user._id}`, { type: "user", title: "New Account Created", message: `${user.fullName || user.email || "New user"} created an account.`, icon: "user", link: "/staff/users", occurredAt: asDate(user.createdAt) });
  for (const application of applications) await add(`application-${application._id}`, { type: "application", title: "New Application", message: `${application.applicationType || "Application"} was submitted.`, icon: "application", link: "/staff/review", occurredAt: asDate(application.createdAt) });
  for (const chat of chats) await add(`message-${chat._id}`, { type: "message", title: "New Message", message: `${chat.userName || "User"}: ${chat.lastMessage || "Sent a message"}`, icon: "message", link: "/staff/messages", occurredAt: asDate(chat.updatedAt, chat.createdAt) });
  for (const document of documents) await add(`document-${document._id}`, { type: "document", title: "Uploaded Document", message: `${document.documentName || document.originalName || "A document"} was uploaded.`, icon: "document", link: "/staff/review", occurredAt: asDate(document.createdAt) });
};

router.get("/", async (req, res) => {
  try {
    const items = [];
    if (req.user.role === "citizen") await syncCitizenNotifications(req.user, items);
    else await syncStaffNotifications(req.user.role, items);
    const filter = req.user.role === "citizen"
      ? { audienceRole: "citizen", recipientId: req.user._id }
      : { audienceRole: req.user.role, recipientId: null };
    const notifications = await Notification.find({ ...filter, deletedAt: null }).sort({ occurredAt: -1 }).limit(50).lean();
    res.json({
      success: true,
      notifications: notifications.map((notification) => ({
        ...notification,
        id: String(notification._id),
      })),
    });
  } catch (error) {
    console.error("NOTIFICATIONS GET ERROR:", error);
    res.status(500).json({ success: false, message: "Unable to load notifications." });
  }
});

router.delete("/", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
    const filter = req.user.role === "citizen"
      ? { audienceRole: "citizen", recipientId: req.user._id }
      : { audienceRole: req.user.role, recipientId: null };
    const query = ids.length ? { ...filter, _id: { $in: ids } } : filter;
    const result = await Notification.updateMany(query, { $set: { deletedAt: new Date() } });
    res.json({ success: true, deletedCount: result.modifiedCount });
  } catch (error) {
    console.error("NOTIFICATIONS DELETE ERROR:", error);
    res.status(500).json({ success: false, message: "Unable to delete notifications." });
  }
});

module.exports = router;