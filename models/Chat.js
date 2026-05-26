const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "staff", "system"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    time: String,
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      default: "User",
    },
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["waiting", "approved", "closed"],
      default: "waiting",
    },
    lastMessage: {
      type: String,
      default: "",
    },
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);