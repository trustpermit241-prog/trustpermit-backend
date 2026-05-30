const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");

// GET ALL CHATS FOR STAFF
router.get("/", async (req, res) => {
  try {
    const chats = await Chat.find().sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET CHAT BY ROOM ID
router.get("/:roomId", async (req, res) => {
  try {
    const chat = await Chat.findOne({ roomId: req.params.roomId });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE OR RESTORE CHAT
router.post("/start", async (req, res) => {
  try {
    const { userId, userName, roomId } = req.body;

    let chat = await Chat.findOne({ roomId });

    if (!chat) {
      chat = await Chat.create({
        userId,
        userName,
        roomId,
        status: "waiting",
        lastMessage: "User requested staff assistance",
        messages: [
          {
            sender: "system",
            text: "User requested staff assistance",
          },
        ],
      });
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// APPROVE CHAT
router.patch("/:roomId/approve", async (req, res) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { roomId: req.params.roomId },
      { status: "approved" },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// SAVE MESSAGE
router.post("/:roomId/messages", async (req, res) => {
  try {
    const { sender, text, time } = req.body;

    const chat = await Chat.findOne({ roomId: req.params.roomId });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const newMessage = {
      sender,
      text,
      time,
    };

    chat.messages.push(newMessage);
    chat.lastMessage = text;
    await chat.save();

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CLOSE CHAT
router.patch("/:roomId/close", async (req, res) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { roomId: req.params.roomId },
      { status: "closed" },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;