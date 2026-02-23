const express = require('express');
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const Cart = require('../models/cart');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', auth, async (req, res) => {
    try {
        const { amount } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'inr',
                        product_data: {
                            name: 'Jewellery Order',
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                userId: req.userId,
            },
            success_url: 'https://jewellery-backend-icja.onrender.com/success',
            cancel_url: 'https://jewellery-backend-icja.onrender.com/cancel',
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating checkout session' });
    }
});

router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;

        try {
            
            await Cart.findOneAndDelete({ user: userId });
            console.log(`Cart cleared for user: ${userId}`);
        } catch (err) {
            console.error('Error clearing cart:', err);
        }
    }

    res.json({ received: true });
});

module.exports = router;