const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Address = require('../models/address');

router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, street, city, state, pincode, isDefault } = req.body;

    if (!name || !phone || !street || !city || !state || !pincode) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (isDefault) {
      await Address.updateMany(
        { user: req.userId },
        { isDefault: false }
      );
    }

    const address = await Address.create({
      user: req.userId,
      name,
      phone,
      street,
      city,
      state,
      pincode,
      isDefault: !!isDefault
    });

    res.status(201).json({
      message: 'Address added successfully',
      address
    });

  } catch (err) {
    console.error('ADDRESS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({ addresses });
  } catch (err) {
    console.error('ADDRESS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany(
        { user: req.userId },
        { isDefault: false }
      );
    }

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      req.body,
      { new: true }
    );

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({
      message: 'Address updated',
      address
    });

  } catch (err) {
    console.error('ADDRESS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({ message: 'Address deleted' });

  } catch (err) {
    console.error('ADDRESS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
