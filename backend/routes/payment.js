const express = require('express');
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const User = require('../models/user');

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

            await User.findByIdAndUpdate(userId, { cart: [] });
            console.log(`Cart cleared for user: ${userId}`);
        } catch (err) {
            console.error('Error clearing cart:', err);
        }
    }

    res.json({ received: true });
});


router.put('/update-payment/:userId', async (req, res) => {
    try {

        const { status } = req.body;
        const { userId } = req.params;

        const user = await User.findByIdAndUpdate(
            userId,
            { paymentStatus: status },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            success: true,
            message: "Payment status updated",
            user
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update payment status" });
    }
});


module.exports = router;