const express = require('express');
const Stripe = require('stripe');
const auth = require('../middleware/auth');

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
                        unit_amount: amount, // in paisa (10000 = ₹100)
                    },
                    quantity: 1,
                },
            ],
            success_url: 'https://jewellery-backend-icja.onrender.com/success',
            cancel_url: 'https://jewellery-backend-icja.onrender.com/cancel',
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating checkout session' });
    }
});

module.exports = router;

