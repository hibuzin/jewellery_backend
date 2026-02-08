const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/order');
const Product = require('../models/product');

console.log('order route loaded');


router.post('/', auth, async (req, res) => {
    try {
        const { productId, quantity, address, paymentMethod } = req.body;

        // validation
        if (!productId || !address || !paymentMethod) {
            return res.status(400).json({ message: 'Required fields missing' });
        }

        const qty = quantity && quantity > 0 ? quantity : 1;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.quantity < qty) {
            return res.status(400).json({
                message: `Only ${product.quantity} items left in stock`
            });
        }

        // 🔽 REDUCE STOCK
        product.quantity -= qty;

        if (product.quantity === 0) {
            product.isAvailable = false;
        }

        await product.save();

        const totalAmount = product.price * qty;


        const order = await Order.create({
            user: req.userId,
            items: [
                {
                    product: product._id,
                    quantity: qty,
                    price: product.price
                }
            ],
            address,
            paymentMethod,
            totalAmount,
            status: 'pending'
        });

        await order.populate('items.product');

        res.status(201).json({
            message: 'Order placed successfully',
            order
        });

    } catch (err) {
        console.error('ORDER ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



// GET USER ORDERS
router.get('/', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.userId })
            .populate('items.product')
            .sort({ createdAt: -1 });

        res.json({ orders });
    } catch (err) {
        console.error('ORDER ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// GET SINGLE ORDER
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.userId
        }).populate('items.product');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json(order);
    } catch (err) {
        console.error('ORDER ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// UPDATE ORDER STATUS
router.put('/:orderId/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        const allowedStatus = [
            'pending',
            'confirmed',
            'shipped',
            'delivered',
            'cancelled'
        ];

        if (!status || !allowedStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }

        const order = await Order.findById(req.params.orderId).populate('items.product');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // 🔒 prevent double stock reduction
        if (order.status === 'confirmed') {
            return res.status(400).json({ message: 'Order already confirmed' });
        }

        // 🔽 REDUCE STOCK ONLY WHEN CONFIRMING
        if (status === 'confirmed') {
            for (const item of order.items) {
                const product = await Product.findById(item.product._id);

                if (product.quantity < item.quantity) {
                    return res.status(400).json({
                        message: `Insufficient stock for ${product.title}`
                    });
                }

                product.quantity -= item.quantity;

                if (product.quantity === 0) {
                    product.isAvailable = false;
                }

                await product.save();
            }
        }

        order.status = status;
        await order.save();

        res.json({
            message: 'Order status updated',
            order
        });

    } catch (err) {
        console.error('ORDER STATUS ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;


