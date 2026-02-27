const express = require("express");
const router = express.Router();
const Order = require("../models/order");

router.get("/total", async (req, res) => {
    try {
        const now = new Date();

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const validMatch = {
            status: "delivered"
        };

        const [
            todayResult,
            weekResult,
            monthResult,
            yearResult,
            totalResult
        ] = await Promise.all([

            // Today
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfToday }, ...validMatch } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),

            // Week
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfWeek }, ...validMatch } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),

            // Month
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfMonth }, ...validMatch } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),

            Order.aggregate([
                { $match: { createdAt: { $gte: startOfYear }, ...validMatch } },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
            ]),
           
            // Total (All time)
            Order.aggregate([
                { $match: validMatch },
                { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ])
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
                },
                week: {
                    total: weekResult[0]?.total || 0,
                    orders: weekResult[0]?.count || 0,
                },
                month: {
                    total: monthResult[0]?.total || 0,
                    orders: monthResult[0]?.count || 0,
                },
                 year:  { 
                    total: yearResult[0]?.total  || 0,
                     orders: yearResult[0]?.count  || 0 },
            },
        });

    } catch (error) {
        console.error("Sales total error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;