const express = require("express");
const router = express.Router();
const Order = require('../models/order');


router.get("/total", async (req, res) => {
    try {
        const now = new Date();

      
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

       
        const dayOfWeek = now.getDay(); 
        const diffToMonday = (dayOfWeek + 6) % 7;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);

        // --- This Month ---
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [todayResult, weekResult, monthResult] = await Promise.all([
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfToday }, status: "completed" } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfWeek }, status: "completed" } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfMonth }, status: "completed" } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                today: {
                    total: todayResult[0]?.total || 0,
                    orders: todayResult[0]?.count || 0,
                    from: startOfToday,
                },
                week: {
                    total: weekResult[0]?.total || 0,
                    orders: weekResult[0]?.count || 0,
                    from: startOfWeek,
                },
                month: {
                    total: monthResult[0]?.total || 0,
                    orders: monthResult[0]?.count || 0,
                    from: startOfMonth,
                },
            },
        });
    } catch (error) {
        console.error("Sales total error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

module.exports = router;