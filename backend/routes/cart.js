const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/cart');
const Product = require('../models/product');

// GET user's cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.userId }).populate('items.product');
    if (!cart) cart = await Cart.create({ user: req.userId, products: [] });
    res.json({ cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



router.post('/add', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const qty = quantity && quantity > 0 ? quantity : 1;

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // ✅ FETCH PRODUCT
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      i => i.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += qty;
    } else {
      cart.items.push({
        product: product._id,   // ✅ FIX
        quantity: qty,
        price: product.price    // ✅ FIX (THIS IS WHY PRICE WAS MISSING)
      });
    }

    await cart.save();

    res.json({
      message: 'Item added to cart',
      cart
    });

  } catch (err) {
    console.error('CART ERROR:', err);
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
router.delete('/clear', auth, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.userId },
      { $set: { items: [] } }
    );

    res.json({
      message: 'Cart cleared',
    });

  } catch (err) {
    console.error('CART ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
