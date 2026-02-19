const express = require('express');
const router = express.Router();
const Coupon = require('../models/coupon');

// Create multiple coupons manually
router.post('/create-multiple', async (req, res) => {
    try {
        const { count, percentage, expiryDate, minOrderAmount } = req.body;

        if (!count || !percentage || !expiryDate) {
            return res.status(400).json({ message: "count, percentage, and expiryDate are required" });
        }

        const coupons = [];

        for (let i = 0; i < Number(count); i++) {
            // Generate unique code
            const randomCode = "JEWEL" + Math.floor(1000 + Math.random() * 9000) + i;

            coupons.push({
                code: randomCode,
                discountType: "percentage",
                discountValue: percentage,
                expiryDate: new Date(expiryDate),
                minOrderAmount: minOrderAmount || 0,
                isActive: true
            });
        }

        const createdCoupons = await Coupon.insertMany(coupons);

        res.status(201).json({
            message: `${count} coupons created successfully`,
            coupons: createdCoupons
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
