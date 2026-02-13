const express = require('express');
const router = express.Router();
const WhatsAppChat = require('../models/whatsappchat');
const auth = require('../middleware/auth'); // your auth middleware

router.get('/whatsapp', auth, async (req, res) => {
    try {
       
        const phoneNumber = "918526854562";

        // Default chat message
        const message = "Hello, I want to chat about your jewellery.";

        // Save chat in DB (optional)
        const chat = new WhatsAppChat({
            user: req.userId,
            message
        });
        await chat.save();

        
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

        res.json({
            success: true,
            whatsappUrl,
            chatId: chat._id
        });

    } catch (err) {
        console.error('WHATSAPP CHAT ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
