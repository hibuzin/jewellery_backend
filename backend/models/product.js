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
        subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },
        gram: {
            type: Number,
            required: true
        },


        image: {type: String,required: true },

        isAvailable: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
