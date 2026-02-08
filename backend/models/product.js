const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true
        },



        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: true
        },
        subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' },
        gram: {
            type: Number,
            required: true
        },


        image: {
            public_id: { type: String },
            url: { type: String },
        },

        isAvailable: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
