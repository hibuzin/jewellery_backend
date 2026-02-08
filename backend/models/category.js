const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['gold', 'diamond', 'silver'], // only these 3 categories
    unique: true,
  },
  image: {
    public_id: { type: String, required: true },
    url: { type: String, required: true },
  },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
