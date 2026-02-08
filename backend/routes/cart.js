const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/cart');
const Product = require('../models/product');

// GET user's cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.userId }).populate('products.product');
    if (!cart) cart = await Cart.create({ user: req.userId, products: [] });
    res.json({ cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ADD product to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId) return res.status(400).json({ message: 'Product ID is required' });

    const userId = req.userId; // from auth middleware
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(i => i.product.toString() === productId);
    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity || 1;
    } else {
      cart.items.push({ product: productId, quantity: quantity || 1 });
    }

    await cart.save();
    res.json({ message: 'Item added to cart', cart });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE product quantity in cart
router.put('/', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || quantity === undefined) return res.status(400).json({ message: 'Product ID and quantity required' });

    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const item = cart.products.find(p => p.product.toString() === productId);
    if (!item) return res.status(404).json({ message: 'Product not in cart' });

    if (quantity <= 0) {
      // Remove item if quantity <= 0
      cart.products = cart.products.filter(p => p.product.toString() !== productId);
    } else {
      item.quantity = quantity;
    }

    await cart.save();
    res.json({ message: 'Cart updated', cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// REMOVE product from cart
router.delete('/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    cart.products = cart.products.filter(p => p.product.toString() !== productId);
    await cart.save();
    res.json({ message: 'Product removed from cart', cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
