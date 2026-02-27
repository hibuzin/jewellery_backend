const express = require("express");
const router = express.Router();
const Order = require("../models/order");
const mongoose = require("mongoose");

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
                year: {
                    total: yearResult[0]?.total || 0,
                    orders: yearResult[0]?.count || 0
                },
            },
        });

    } catch (error) {
        console.error("Sales total error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});



router.get("/category-breakdown", async (req, res) => {
    try {

        const { type, id } = req.query;

        // If id provided, validate it
        if (id && !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid id" });
        }

        const pipeline = [
            { $match: { status: "delivered" } },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.product",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
        ];

        // Filter by category or subcategory id if provided
        if (id) {
            const objectId = new mongoose.Types.ObjectId(id);
            if (type === "subcategory") {
                pipeline.push({ $match: { "product.subcategory": objectId } });
            } else {
                pipeline.push({ $match: { "product.category": objectId } });
            }
        }

        pipeline.push(
            {
                $lookup: {
                    from: "categories",
                    localField: "product.category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $lookup: {
                    from: "subcategories",
                    localField: "product.subcategory",
                    foreignField: "_id",
                    as: "subcategory"
                }
            },
            {
                $unwind: {
                    path: "$subcategory",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: {
                        categoryId: "$category._id",
                        subcategoryId: "$subcategory._id"
                    },
                    categoryName: { $first: "$category.name" },
                    subcategoryName: { $first: "$subcategory.name" },
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: {
                        $sum: { $multiply: ["$items.quantity", "$items.price"] }
                    },
                    totalOrders: { $addToSet: "$_id" }
                }
            },
            {
                $project: {
                    _id: 0,
                    categoryId: "$_id.categoryId",
                    categoryName: 1,
                    subcategoryId: "$_id.subcategoryId",
                    subcategoryName: 1,
                    totalQuantity: 1,
                    totalRevenue: 1,
                    totalOrders: { $size: "$totalOrders" },
                    // ADD THIS
                    type: {
                        $cond: {
                            if: { $ifNull: ["$_id.subcategoryId", false] },
                            then: "subcategory",
                            else: "category"
                        }
                    }
                }
            },
            { $sort: { totalRevenue: -1 } }
        );

        const breakdown = await Order.aggregate(pipeline);

        // CHANGE THIS
        res.json({
            success: true,
            filterType: type || "all",  // renamed from "type" to "filterType"
            filterId: id || null,        // added filterId
            data: breakdown
        });

    } catch (error) {
        console.error("Category breakdown error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;