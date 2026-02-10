const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Cart = require('../models/cart');
const Product = require('../models/product');

const router = express.Router();

// 1️⃣ GET USER CART
router.get('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId })
      .populate('items.product');

    if (!cart) {
      return res.json({ items: [], totalAmount: 0 });
    }

    const totalAmount = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    res.json({
      items: cart.items,
      totalAmount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load cart' });
  }
});

// 2️⃣ ADD TO CART
router.post('/add', auth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product is in stock
    if (!product.isAvailable || product.quantity < quantity) {
      return res.status(400).json({ error: 'Product is out of stock or insufficient quantity' });
    }

    let cart = await Cart.findOne({ user: req.userId });

    if (!cart) {
      cart = new Cart({ user: req.userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex > -1) {
      // Check if adding more exceeds stock
      if (cart.items[itemIndex].quantity + quantity > product.quantity) {
        return res.status(400).json({ error: 'Cannot add more than available stock' });
      }
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();

    res.status(201).json({
      message: 'Product added to cart',
      cart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Add to cart failed' });
  }
});

// 3️⃣ UPDATE CART ITEM QUANTITY
router.put('/', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find(
      item => item.product.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    item.quantity = quantity;
    await cart.save();

    res.json({ message: 'Cart updated', cart });
  } catch (err) {
    res.status(500).json({ error: 'Update cart failed' });
  }
});

// 4️⃣ REMOVE ITEM FROM CART
router.delete('/remove/:productId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = cart.items.filter(
      item => item.product.toString() !== req.params.productId
    );

    await cart.save();

    res.json({ message: 'Item removed', cart });
  } catch (err) {
    res.status(500).json({ error: 'Remove item failed' });
  }
});

// 5️⃣ CLEAR CART
router.delete('/clear', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.json({ message: 'Cart already empty' });

    cart.items = [];
    await cart.save();

    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Clear cart failed' });
  }
});

module.exports = router;
