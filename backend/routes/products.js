const express = require('express');
const Product = require('../models/product');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');
const Subcategory = require('../models/subcategory');
const Category = require('../models/category');
const streamifier = require('streamifier');

const router = express.Router();

router.post('/', auth, upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'images' }]), async (req, res) => {
    try {
        const { title, category, subcategory, price, originalPrice, gram, description, quantity } = req.body;

        if (!title || !category || !subcategory || !price || !originalPrice || !gram || !description || !quantity) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!req.files || !req.files.mainImage) {
            return res.status(400).json({ message: 'Main image is required' });
        }


        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ message: 'Invalid Category ID' });
        }

        const subcategoryExists = await Subcategory.findById(subcategory);
        if (!subcategoryExists) {
            return res.status(400).json({ message: 'Invalid Subcategory ID' });
        }



        const uploadToCloudinary = (file) =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'jewellery' },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                streamifier.createReadStream(file.buffer).pipe(stream);
            });



        const mainImageResult = await uploadToCloudinary(
            req.files.mainImage[0]
        );


        let images = [];

        if (req.files.images && req.files.images.length > 0) {
            const uploadPromises = req.files.images.map(file =>
                uploadToCloudinary(file)
            );

            const results = await Promise.all(uploadPromises);

            images = results.map(result => ({
                public_id: result.public_id,
                url: result.secure_url
            }));
        }


        const product = await Product.create({
            title,
            category,
            subcategory,
            price,
            gram,
            description,
            quantity,
            isAvailable: quantity > 0,
            mainImage: {
                public_id: mainImageResult.public_id,
                url: mainImageResult.secure_url
            },
            images
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

        const frontendURL = "https://react-jewellery.onrender.com";

        const productLink = `${frontendURL}/product/${product._id}`;

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

            .select('title price mainImage category subcategory');
             

        const formattedProducts = similarProducts.map(p => ({
            _id: p._id,
            title: p.title,
            price: p.price,
            category: p.category,
            subcategory: p.subcategory,
            mainImage: p.mainImage?.url || null
        }));

        res.json(formattedProducts);
    } catch (err) {
        console.error('SIMILAR PRODUCT ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



router.put('/:id', auth, upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'images' }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            category,
            subcategory,
            price,
            originalPrice,
            gram,
            description,
            quantity
        } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // ===== Validate Category =====
        if (category) {
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(400).json({ message: 'Invalid Category ID' });
            }
            product.category = category;
        }

        // ===== Validate Subcategory =====
        if (subcategory) {
            const subcategoryExists = await Subcategory.findById(subcategory);
            if (!subcategoryExists) {
                return res.status(400).json({ message: 'Invalid Subcategory ID' });
            }
            product.subcategory = subcategory;
        }

        // ===== Update Fields =====
        if (title) product.title = title;
        if (price) product.price = price;
        if (originalPrice) product.originalPrice = originalPrice;
        if (gram) product.gram = gram;
        if (description) product.description = description;
        if (quantity) {
            product.quantity = quantity;
            product.isAvailable = quantity > 0;
        }


        const uploadToCloudinary = (file) =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'jewellery' },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                streamifier.createReadStream(file.buffer).pipe(stream);
            });


        if (req.files?.mainImage) {


            if (product.mainImage && product.mainImage.public_id) {
                await cloudinary.uploader.destroy(product.mainImage.public_id);
            }

            const mainImageResult = await uploadToCloudinary(
                req.files.mainImage[0]
            );

            product.mainImage = {
                public_id: mainImageResult.public_id,
                url: mainImageResult.secure_url
            };
        }



        if (req.files?.images) {
            const uploadPromises = req.files.images.map(file =>
                uploadToCloudinary(file)
            );

            const results = await Promise.all(uploadPromises);

            const newImages = results.map(result => ({
                public_id: result.public_id,
                url: result.secure_url
            }));

            product.images.push(...newImages);
        }

        await product.save();

        res.json({
            message: 'Product updated successfully',
            product
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});



module.exports = router;
