const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Order = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');
const Coupon = require('../models/coupon');


router.post('/buy-now', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity, address, paymentMethod, couponCode } = req.body;


    if (!productId || !quantity || !address || !paymentMethod) {
      return res.status(400).json({
        message: 'productId, quantity, address, and paymentMethod are required.'
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'quantity must be a positive integer.' });
    }

    const { name, phone, street, city, state, pincode } = address;

    if (!name || !phone || !street || !city || !state || !pincode) {
      return res.status(400).json({ message: 'All address fields (name, phone, street, city, state, pincode) are required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // --- Find Product & Check Stock ---
    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (product.quantity < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Only ${product.quantity} items available for "${product.title}".`
      });
    }

    // --- Calculate Total ---
    let totalAmount = product.price * quantity;
    let discount = 0;

    // --- Apply Coupon (optional) ---
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

      if (!coupon || !coupon.isActive) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Invalid coupon.' });
      }

      if (new Date() > coupon.expiryDate) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Coupon expired.' });
      }

      if (totalAmount < coupon.minOrderAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon.`
        });
      }

      if (coupon.discountType === 'percentage') {
        discount = (totalAmount * coupon.discountValue) / 100;
      } else {
        discount = coupon.discountValue;
      }

      totalAmount -= discount;
    }

    // --- Deduct Stock ---
    product.quantity -= quantity;
    if (product.quantity <= 0) product.isAvailable = false;
    await product.save({ session });

    // --- Create Order ---
    const [order] = await Order.create([{
      user: req.userId,
      items: [{
        product: product._id,
        quantity,
        price: product.price
      }],
      totalAmount,
      address,
      paymentMethod,
      status: 'pending'
    }], { session });

    // --- Save Order Inside User ---
    user.orders.push(order._id);
    await user.save({ session });

    await session.commitTransaction();

    await order.populate('items.product');

    return res.status(201).json({
      message: 'Order placed successfully.',
      ...(couponCode && discount > 0 && { discount: `₹${discount} discount applied` }),
      order
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('BUY NOW ERROR:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    session.endSession();
  }
});


router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    console.error('ORDER GET ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .populate('items.product')
      .sort({ createdAt: -1 });


    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.get('/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.userId
    }).populate('items.product');


    if (!order) return res.status(404).json({ error: 'Order not found' });


    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});


router.put('/:orderId/status', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;

    const allowedStatus = [
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled',
      'return requested',
      'return accepted'
    ];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findById(req.params.orderId).session(session);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (status === 'return accepted' && order.status !== 'return accepted') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } },
          { session }
        );
      }
    }

    order.status = status;
    await order.save({ session });

    await session.commitTransaction();

    res.json({ message: 'Order status updated', order });

  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Status update failed' });
  } finally {
    session.endSession();
  }
});


router.post('/:orderId/return', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.userId
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'Return allowed only after delivery' });
    }

    if (order.return?.isRequested) {
      return res.status(400).json({ message: 'Return already requested' });
    }

    order.return = {
      isRequested: true,
      reason,
      status: 'return requested',
      requestedAt: new Date()
    };

    await order.save();

    res.json({
      message: 'Return request submitted',
      order
    });

  } catch (err) {
    console.error('RETURN REQUEST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
