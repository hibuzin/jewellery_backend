const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const Subcategory = require('../models/subcategory');
const Category = require('../models/category');

console.log('subcategory.js loaded');

// CREATE subcategory
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, categoryId } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({ error: 'Name and categoryId required' });
    }

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image required' });
    }

    // Upload image to Cloudinary
    const uploadToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'jewellery/subcategories' },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await uploadToCloudinary();

    // Create subcategory in DB
    const subcategory = await Subcategory.create({
      name,
      category: categoryId,
      image: {
        public_id: result.public_id,
        url: result.secure_url,
      },
    });

    res.status(201).json({ message: 'Subcategory created', subcategory });

  } catch (err) {
    console.error('SUBCATEGORY ERROR:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all subcategories
router.get('/', async (req, res) => {
  try {
    const subcategories = await Subcategory.find().populate('category', 'name');
    res.json({ subcategories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single subcategory by ID
router.get('/:id', async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id).populate('category', 'name');
    if (!subcategory) return res.status(404).json({ error: 'Subcategory not found' });
    res.json({ subcategory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE subcategory
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id);
    if (!subcategory) return res.status(404).json({ error: 'Subcategory not found' });

    const { name, categoryId } = req.body;

    if (name) subcategory.name = name;

    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) return res.status(404).json({ error: 'Category not found' });
      subcategory.category = categoryId;
    }

    if (req.file) {
      const uploadToCloudinary = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'jewellery/subcategories' },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

      const result = await uploadToCloudinary();
      subcategory.image = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    await subcategory.save();
    res.json({ message: 'Subcategory updated successfully', subcategory });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE subcategory
router.delete('/:id', auth, async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id);
    if (!subcategory) return res.status(404).json({ error: 'Subcategory not found' });

    await subcategory.deleteOne();
    res.json({ message: 'Subcategory deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
