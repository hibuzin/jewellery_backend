const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true // ensures no duplicate category names
  },
  image: {
    public_id: { type: String },
    url: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
