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

module.exports = router;
