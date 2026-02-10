const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('../models/chat');
const Message = require('../models/message');

/**
 * USER SEND MESSAGE
 * POST /api/chat/send
 */
router.post('/send', auth, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message required' });
    }

    // find or create chat
    let chat = await Chat.findOne({ user: req.userId });
    if (!chat) {
      chat = await Chat.create({ user: req.userId });
    }

    // save message
    const newMessage = await Message.create({
      chat: chat._id,
      senderType: 'user',
      message
    });

    chat.lastMessage = message;
    await chat.save();

    res.json({
      message: 'Message sent',
      data: newMessage
    });

  } catch (err) {
    console.error('CHAT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



router.post('/admin/send', async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ message: 'User ID and message are required' });
    }

    // find or create chat for this user
    let chat = await Chat.findOne({ user: userId });
    if (!chat) {
      chat = await Chat.create({ user: userId });
    }

    // save message
    const newMessage = await Message.create({
      chat: chat._id,
      senderType: 'admin', // mark as admin
      message
    });

    chat.lastMessage = message;
    await chat.save();

    res.json({
      message: 'Admin message sent',
      data: newMessage
    });

  } catch (err) {
    console.error('ADMIN CHAT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * ADMIN / APP
 * GET /api/chat/admin/chats
 */
router.get('/admin/chats', async (req, res) => {
  try {
    const chats = await Chat.find()
      .populate('user', 'name email')
      .sort({ updatedAt: -1 });

    res.json({ chats });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


/**
 * ADMIN / APP
 * GET /api/chat/admin/:chatId/messages
 */
router.get('/admin/:chatId/messages', async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
