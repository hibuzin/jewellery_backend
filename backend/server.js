require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const categoryRoutes = require('./routes/category');
const subcategoryRoutes = require('./routes/subcategory');
const wishlistRoutes = require('./routes/wishlist');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const addressRoutes = require('./routes/address');
const chatRoutes = require('./routes/chat');
const checkoutRoutes = require('./routes/checkout');





app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/checkout', checkoutRoutes);

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://arshath:tokyodel9600@cluster0.v87mhyy.mongodb.net/';

mongoose.connect(MONGO_URI)
    .then(() => console.log('mongoDB Connected'))
    .catch(err => console.error('mongoDB connection error:', err));

app.get('/', (req, res) => {
    res.send('API running');
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));