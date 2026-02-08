const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const Category = require('../models/category');

const allowedCategories = ['gold', 'diamond', 'Silver'];

console.log('category.js loaded');

// CREATE category
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !allowedCategories.includes(name)) {
      return res.status(400).json({ error: 'Invalid category name. Must be gold, diamond, or silver.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Upload image to Cloudinary
    const uploadToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'jewellery/categories' },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await uploadToCloudinary();

    // Create category in DB
    const category = await Category.create({
      name,
      image: {
        public_id: result.public_id,
        url: result.secure_url
      }
    });

    res.status(201).json({ message: 'Category created successfully', category });

  } catch (err) {
    console.error('CATEGORY ERROR:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE category
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const { name } = req.body;
    if (name && !allowedCategories.includes(name)) {
      return res.status(400).json({ error: 'Invalid category name. Must be Gold, Diamond, or Silver.' });
    }

    if (name) category.name = name;

    if (req.file) {
      const uploadToCloudinary = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'jewellery/categories' },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

      const result = await uploadToCloudinary();
      category.image = {
        public_id: result.public_id,
        url: result.secure_url
      };
    }

    await category.save();
    res.json({ message: 'Category updated successfully', category });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE category
router.delete('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    await category.deleteOne();
    res.json({ message: 'Category deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
