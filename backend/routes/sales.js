const express = require("express");
const router = express.Router();
const Order = require("../models/order");
const mongoose = require("mongoose");

router.get("/hot-products", async (req, res) => {
    try {
        const { period } = req.query;
        // period = today | week | month | year

        const now = new Date();
        let startDate;

        if (period === "today") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        else if (period === "week") {
            const dayOfWeek = now.getDay();
            const diffToMonday = (dayOfWeek + 6) % 7;
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
        }
        else if (period === "month") {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        else if (period === "year") {
            startDate = new Date(now.getFullYear(), 0, 1);
        }

        const matchStage = {
            status: "delivered"
        };

        if (startDate) {
            matchStage.createdAt = { $gte: startDate };
        }

        const hotProducts = await Order.aggregate([
            { $match: matchStage },

            { $unwind: "$items" },

            {
                $group: {
                    _id: "$items.product",
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                }
            },

            { $sort: { totalQuantity: -1 } },

            { $limit: 10 },

            // Join product details
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },

            {
                $project: {
                    _id: 0,
                    productId: "$product._id",
                    name: "$product.title",        
                    image: "$product.mainImage.url",
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        res.json({
            success: true,
            period: period || "all",
            data: hotProducts
        });

    } catch (error) {
        console.error("Hot products error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;