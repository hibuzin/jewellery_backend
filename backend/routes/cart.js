const express = require('express');
const Cart = require('../models/cart');
const Product = require('../models/product');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.json({ items: [], totalAmount: 0 });
    }

    const totalAmount = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    res.json({ items: cart.items, totalAmount });
  } catch (err) {
    console.error('CART GET ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/add', auth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (!product.isAvailable || product.quantity === 0) {
      return res.status(400).json({ message: 'Product out of stock' });
    }

    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) cart = new Cart({ user: req.userId, items: [] });

    const index = cart.items.findIndex(i => i.product.toString() === productId);

    if (index > -1) {
      const newQuantity = cart.items[index].quantity + quantity;

      // Prevent adding more than stock
      if (newQuantity > product.quantity) {
        return res.status(400).json({
          message: `Cannot add more than available stock. Max: ${product.quantity}`
        });
      }

      cart.items[index].quantity = newQuantity;
    } else {
      // Prevent adding more than stock
      if (quantity > product.quantity) {
        return res.status(400).json({
          message: `Cannot add more than available stock. Max: ${product.quantity}`
        });
      }
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    await cart.populate('items.product');

    res.status(201).json({ message: 'Added to cart', cart });
  } catch (err) {
    console.error('CART ADD ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/remove/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.userId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Check if product exists in cart
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Product not in cart' });
    }

    // Remove item
    cart.items.splice(itemIndex, 1);

    await cart.save();

    await cart.populate('items.product');

    res.json({
      message: 'Item removed successfully',
      cart
    });

  } catch (err) {
    console.error('CART REMOVE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.delete('/clear', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.json({ message: 'Cart already empty' });

    cart.items = [];
    await cart.save();
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    console.error('CART CLEAR ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
