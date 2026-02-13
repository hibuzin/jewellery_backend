const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/cart');
const Order = require('../models/order');
const Product = require('../models/product');

router.post('/', auth, async (req, res) => {
  try {
    const { address, paymentMethod } = req.body;

    if (!address || !paymentMethod) {
      return res.status(400).json({ message: 'Address and payment method required' });
    }

    const cart = await Cart.findOne({ user: req.userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product) {
        return res.status(404).json({ message: "One of the products in your cart no longer exists." });
      }

      if (!product.isAvailable || product.quantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.quantity}`
        });
      }

      product.quantity -= item.quantity;
      if (product.quantity === 0) {
        product.isAvailable = false;
      }
      await product.save();

     
      const itemPrice = product.price; 
      totalAmount += itemPrice * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: itemPrice
      });
    }

  
    const order = new Order({
      user: req.userId,
      items: orderItems,
      address,
      paymentMethod,
      totalAmount,
      status: 'pending' 
    });

    await order.save();

    cart.items = [];
    await cart.save();

    const populatedOrder = await Order.findById(order._id).populate('items.product');

    res.status(201).json({
      message: 'Checkout successful',
      order: populatedOrder
    });

  } catch (err) {
    console.error('CHECKOUT ERROR:', err);
    res.status(500).json({ message: 'Server error during checkout' });
  }
});

module.exports = router;