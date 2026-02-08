// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
   password: { type: String, required: true }, 


  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],

 
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
