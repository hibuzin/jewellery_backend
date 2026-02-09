const express = require('express');
const Product = require('../models/product');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');
const streamifier = require('streamifier');

const router = express.Router();

// CREATE product
router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, category, subcategory, price, gram, description, quantity } = req.body;

        // validation
        if (!title || !category || !subcategory || !price || !gram || !description || !quantity) {
            return res.status(400).json({ message: 'All fields are required' });
        }



        // upload to Cloudinary
        const uploadToCloudinary = () =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'jewellery' },
                    (error, result) => (result ? resolve(result) : reject(error))
                );
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });

        const result = await uploadToCloudinary();

        const product = await Product.create({
            title,
            category,
            subcategory,
            price,
            gram,
            description,
            quantity,
            image: {
                public_id: result.public_id,
                url: result.secure_url
            }
        });

        res.status(201).json({
            message: 'Jewellery added successfully',
            product
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET all products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find()
            .populate('category', 'name')
            .populate('subcategory', 'name')
            .sort({ createdAt: -1 });

        res.json(products);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET single product
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category', 'name')
            .populate('subcategory', 'name');

        if (!product) return res.status(404).json({ message: 'Jewellery not found' });

        res.json(product);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET products by subcategory ID
router.get('/subcategory/:subId', async (req, res) => {
    try {
        const { subId } = req.params;

        // Find all products where the subcategory field matches the ID
        const products = await Product.find({ subcategory: subId });

        if (!products || products.length === 0) {
            return res.status(404).json({ message: 'No products found for this subcategory' });
        }

        res.status(200).json(products);
    } catch (err) {
        console.error('Error fetching by subcategory:', err);

        // Handle invalid ID format
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Subcategory ID format' });
        }

        res.status(500).json({ message: 'Server error' });
    }
});

// GET SIMILAR PRODUCTS
router.get('/:id/similar', async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const similarProducts = await Product.find({
            _id: { $ne: productId },
            $or: [
                { category: product.category },
                { subcategory: product.subcategory }
            ],
            isAvailable: true
        })
            .limit(6)
            .sort({ createdAt: -1 });

        res.json({
            message: 'Similar products loaded',
            products: similarProducts
        });

    } catch (err) {
        console.error('SIMILAR PRODUCT ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



router.put('/:id', auth, upload.single('image'), async (req, res) => {
    try {
        const data = { ...req.body };

        if (req.file) {
            const result = await cloudinary.uploader.upload(
                `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
                { folder: 'jewellery' }
            );
            data.image = {
                public_id: result.public_id,
                url: result.secure_url
            };
        }

        const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true });
        res.json(product);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Update failed' });
    }
});

// DELETE product
router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Not found' });

        await cloudinary.uploader.destroy(product.image.public_id);
        await product.deleteOne();

        res.json({ message: 'Jewellery deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Delete failed' });
    }
});

module.exports = router;
