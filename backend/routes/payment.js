const express = require('express');
const Stripe = require('stripe');
const auth = require('../middleware/auth');

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-payment-intent', auth, async (req, res) => {
    try {
        const { amount } = req.body; 
        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'inr', 
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Payment failed' });
    }
});

module.exports = router;

