const express = require('express');
const router = express.Router();
const Coupon = require('../models/coupon');

// Create coupon
router.post('/create', async (req, res) => {
    try {
        const { code, discountType, discountValue, expiryDate, minOrderAmount } = req.body;

        const coupon = new Coupon({
            code,
            discountType,
            discountValue,
            expiryDate,
            minOrderAmount
        });

        await coupon.save();
        res.json({ message: "Coupon created successfully", coupon });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
