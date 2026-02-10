const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/cart');
const Order = require('../models/order');
const Product = require('../models/product');

// CHECKOUT ALL CART ITEMS
router.post('/', auth, async (req, res) => {
  try {
    const { address, paymentMethod } = req.body;

    // 1. Basic Validation
    if (!address || !paymentMethod) {
      return res.status(400).json({ message: 'Address and payment method required' });
    }

    // 2. Fetch Cart with Product details
    const cart = await Cart.findOne({ user: req.userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let totalAmount = 0;
    const orderItems = [];

    // 3. Process each item (Stock check and price calculation)
    for (const item of cart.items) {
      const product = item.product;

      // Check if product exists (in case it was deleted from DB)
      if (!product) {
        return res.status(404).json({ message: "One of the products in your cart no longer exists." });
      }

      // Check stock availability
      if (!product.isAvailable || product.quantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.quantity}`
        });
      }

      // 4. Update Product Inventory
      product.quantity -= item.quantity;
      if (product.quantity === 0) {
        product.isAvailable = false;
      }
      await product.save();

      // 5. Prepare Order Item
      const itemPrice = product.price; // Capture price at time of purchase
      totalAmount += itemPrice * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: itemPrice
      });
    }

    // 6. Create the Order
    const order = new Order({
      user: req.userId,
      items: orderItems,
      address,
      paymentMethod,
      totalAmount,
      status: 'pending' // Usually 'pending' until payment is confirmed
    });

    await order.save();

    // 7. Clear the User's Cart
    cart.items = [];
    await cart.save();

    // 8. Return populated order for the frontend
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