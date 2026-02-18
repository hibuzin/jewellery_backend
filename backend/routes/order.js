const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Order = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');

router.post('/', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { address, paymentMethod } = req.body;
    if (!address || !paymentMethod) {
      return res.status(400).json({ message: 'Address and paymentMethod required' });
    }

    const user = await User.findById(req.userId).populate('cart.product');
    if (!user || user.cart.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const orderItems = user.cart.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.price
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // check stock first before reducing
    for (const item of user.cart) {
      const product = await Product.findById(item.product._id).session(session);
      if (!product) continue;

      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Only ${product.quantity} items available for "${product.title}". Please update your cart.`
        });
      }

      product.quantity -= item.quantity;
      if (product.quantity <= 0) product.isAvailable = false;
      await product.save({ session });
    }

    const [order] = await Order.create([{
      user: req.userId,
      items: orderItems,
      totalAmount,
      address,
      paymentMethod,
      status: 'pending'
    }], { session });

    user.orders.push(order._id); 
    user.cart = [];
    await user.save({ session });

    await session.commitTransaction();

    await order.populate('items.product');

    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    await session.abortTransaction();
    console.error('ORDER FROM CART ERROR:', err);
    res.status(500).json({ message: 'Server error' });
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
