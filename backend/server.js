require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const http = require('http');
const { Server } = require('socket.io');

app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors());


const server = http.createServer(app);


const io = new Server(server, {
    cors: {
        origin: 'https://jewellery-backend-icja.onrender.com',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});


app.set('io', io);

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});


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
const paymentRoutes = require('./routes/payment');
const couponRoutes = require('./routes/coupon');




app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/coupon', couponRoutes);



const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://arshath:tokyodel9600@cluster0.v87mhyy.mongodb.net/';

mongoose.connect(MONGO_URI)
    .then(() => console.log('mongoDB Connected'))
    .catch(err => console.error('mongoDB connection error:', err));

app.get('/', (req, res) => {
    res.send('API running');
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));