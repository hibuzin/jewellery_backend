const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        items: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
                quantity: { type: Number, required: true },
                price: { type: Number, required: true }
            }
        ],

        address: {
            name: String,
            phone: String,
            street: String,
            city: String,
            state: String,
            pincode: String
        },

        paymentMethod: {
            type: String,
            enum: ['cod', 'online'],
            required: true
        },

    totalAmount: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return requested', 'return accepted', 'returned'],
            default: 'placed'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
