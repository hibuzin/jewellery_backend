const express = require('express');
const Cart = require('../models/cart');
const Product = require('../models/product');
const auth = require('../middleware/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('cart.product');

    user.cart = user.cart.filter(item => item.product && item.product.quantity > 0);

    if (!user.cart.length) {
      return res.json({ items: [], totalAmount: 0 });
    }
    const totalAmount = user.cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    res.json({ items: user.cart, totalAmount });
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

    const user = await User.findById(req.userId);

    const index = user.cart.findIndex(i => i.product.toString() === productId);

    if (index > -1) {
      const newQuantity = user.cart[index].quantity + quantity;

      if (newQuantity > product.quantity) {
        user.cart[index].quantity = product.quantity; // silently cap at max stock
      } else {
        user.cart[index].quantity = newQuantity;
      }

    } else {
      if (quantity > product.quantity) {
        return res.status(400).json({
          message: `Cannot add more than available stock. Max: ${product.quantity}`
        });
      }
      user.cart.push({ product: productId, quantity });
    }
    await user.save();
    await user.populate('cart.product');

    res.status(201).json({ message: 'Added to cart', cart: user.cart });
  } catch (err) {
    console.error('CART ADD ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/update', auth, async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid quantity required' });
    }

    const user = await User.findById(req.userId);

    await user.save();

    res.json({ message: 'Cart updated successfully', cart: user.cart });

  } catch (err) {
    console.error('CART UPDATE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.delete('/remove/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.userId);

    user.cart = user.cart.filter(
      item => item.product.toString() !== productId
    );


    await user.save();
    await user.populate('cart.product');

    res.json({
      message: 'Item removed successfully',
      cart: user.cart
    });

  } catch (err) {
    console.error('CART REMOVE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.delete('/clear', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    user.cart = [];
    await user.save();


    res.json({ message: 'Cart cleared' });

  } catch (err) {
    console.error('CART CLEAR ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;