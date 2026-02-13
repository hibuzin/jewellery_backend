
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
   password: { type: String, required: true }, 

   role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },



  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],

  cart: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: {
        type: Number,
        default: 1
      }
    }
  ]

  

 
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if(!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});


module.exports = mongoose.model('User', userSchema);
