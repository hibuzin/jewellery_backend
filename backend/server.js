require('dotenv').config();
const express = require('express');
const app = express();



app.use('/api/auth', require('./routes/auth'));


const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://arshath:tokyodel9600@cluster0.v87mhyy.mongodb.net/';

mongoose.connect(MONGO_URI)
    .then(() => console.log('mongoDB Connected'))
    .catch(err => console.error('mongoDB connection error:', err));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));