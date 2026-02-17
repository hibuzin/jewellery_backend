const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');
const Product = require('../models/product');


console.log('wishlist route loaded');

router.post('/', auth, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) return res.status(400).json({ message: 'productId required' });



    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ message: 'Product not found' });

    const user = await User.findById(req.userId);


    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ message: 'Product already in wishlist' });
    }

    user.wishlist.push(productId);
    await user.save();

    await user.populate('wishlist');

    res.json({
      message: 'Product added to wishlist',
      wishlist: user.wishlist
    });
  } catch (err) {
    console.error('WISHLIST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('wishlist');

    res.json({ wishlist: user.wishlist });
  } catch (err) {
    console.error('WISHLIST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.userId);

    user.wishlist = user.wishlist.filter(
      id => id.toString() !== productId
    );

    await user.save();
    await user.populate('wishlist');

    res.json({
      message: 'Product removed from wishlist',
      wishlist: user.wishlist
    });
  } catch (err) {
    console.error('WISHLIST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
