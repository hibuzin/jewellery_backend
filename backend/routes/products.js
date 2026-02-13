const express = require('express');
const Product = require('../models/product');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');
const Subcategory = require('../models/subcategory');
const Category = require('../models/category');
const streamifier = require('streamifier');

const router = express.Router();

router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, category, subcategory, price, originalPrice, gram, description, quantity } = req.body;

        if (!title || !category || !subcategory || !price || !originalPrice || !gram || !description || !quantity) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ message: 'Invalid Category ID' });
        }

        const subcategoryExists = await Subcategory.findById(subcategory);
        if (!subcategoryExists) {
            return res.status(400).json({ message: 'Invalid Subcategory ID' });
        }



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
            isAvailable: quantity > 0,
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


router.get('/:id/share', async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate('category', 'name')
            .populate('subcategory', 'name');

        if (!product) return res.status(404).json({ message: 'Product not found' });

        // Generate product link (change domain to your frontend website)
        const productLink = `https://jewellery-backend-icja.onrender.com/product/${product._id}`;

        const whatsappShareLink = `https://wa.me/?text=${encodeURIComponent(productLink)}`;

        res.json({
            success: true,
            productLink,
            whatsappShareLink
        });

    } catch (err) {
        console.error('SHARE PRODUCT LINK ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});




router.get('/:id/exactprice', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const originalPrice = product.price;
        const finalPrice = product.offerPrice || product.price;

        const discount =
            product.offerPrice
                ? Math.round(
                    ((originalPrice - finalPrice) / originalPrice) * 100
                )
                : 0;

        res.json({
            productId: product._id,
            title: product.title,
            originalPrice,
            finalPrice,
            discountPercent: discount
        });

    } catch (err) {
        console.error('PRICE ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



router.get('/category/:categoryId', async (req, res) => {
    try {
        const { categoryId } = req.params;

        const products = await Product.find({ category: categoryId })
            .populate('category', 'name')
            .populate('subcategory', 'name')
            .sort({ createdAt: -1 });

        if (!products || products.length === 0) {
            return res.status(404).json({ message: 'No products found for this category' });
        }

        res.json(products);
    } catch (err) {
        console.error('Error fetching products by category:', err);

        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Category ID' });
        }

        res.status(500).json({ message: 'Server error' });
    }
});



router.get('/subcategory/:subId', async (req, res) => {
    try {
        const { subId } = req.params;

        const products = await Product.find({ subcategory: subId });

        if (!products || products.length === 0) {
            return res.status(404).json({ message: 'No products found for this subcategory' });
        }

        res.status(200).json(products);
    } catch (err) {
        console.error('Error fetching by subcategory:', err);

        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Subcategory ID format' });
        }

        res.status(500).json({ message: 'Server error' });
    }
});

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

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category', 'name')
            .populate('subcategory', 'name');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (err) {
        console.error('GET PRODUCT ERROR:', err);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/:id/similar', async (req, res) => {
    try {
        const { id } = req.params;


        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }


        const similarProducts = await Product.find({
            _id: { $ne: product._id },
            category: product.category,
            subcategory: product.subcategory
        })

            .select('title price image category subcategory');

        res.json(similarProducts);
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
