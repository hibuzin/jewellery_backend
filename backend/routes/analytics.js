const express = require("express");
const router = express.Router();
const Order = require("../models/order"); // adjust if your file is Order.js or orders.js

/**
 * GET /api/sales/total
 * Returns total sales for today, this week, and this month
 */
router.get("/total", async (req, res) => {
    try {
        const now = new Date();

        // --- Today ---
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // --- This Week (Monday as start) ---
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const diffToMonday = (dayOfWeek + 6) % 7;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);

        // --- This Month ---
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const validStatuses = { status: "delivered" };

        const [todayResult, weekResult, monthResult, totalResult] = await Promise.all([
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfToday }, ...validStatuses } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfWeek }, ...validStatuses } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfMonth }, ...validStatuses } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                total: {
                    total: totalResult[0]?.total || 0,
                    orders: totalResult[0]?.count || 0,
                },
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