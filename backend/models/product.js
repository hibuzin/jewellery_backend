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

        originalPrice: {
            type: Number

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

        description: {
            type: String,
            required: true,
            trim: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        },

        mainImage: {
            public_id: String,
            url: String
        },

        images: [
            {
                public_id: { type: String },
                url: { type: String },
            }
        ],

        isAvailable: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
