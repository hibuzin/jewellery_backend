const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Wishlist = require('../models/wishlist');
const Product = require('../models/product');


console.log('wishlist route loaded'); 

router.post('/', auth, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) return res.status(400).json({ message: 'productId required' });

    

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    let wishlist = await Wishlist.findOne({ user: req.userId });

    if (!wishlist) {
      wishlist = new Wishlist({ user: req.userId, items: [] });
    }

    const exists = wishlist.items.some(item => item.product.toString() === productId);
    if (exists) return res.status(400).json({ message: 'Product already in wishlist' });

    wishlist.items.push({ product: productId });
    await wishlist.save();

    await wishlist.populate('items.product');

    res.json({ message: 'Product added to wishlist', wishlist });
  } catch (err) {
    console.error('WISHLIST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.userId }).populate('items.product');
    res.json({ wishlist: wishlist || { items: [] } });
  } catch (err) {
    console.error('WISHLIST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: req.userId });
    if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' });

    wishlist.items = wishlist.items.filter(item => item.product.toString() !== productId);

    await wishlist.save();
    await wishlist.populate('items.product');

    res.json({ message: 'Product removed from wishlist', wishlist });
  } catch (err) {
    console.error('WISHLIST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
