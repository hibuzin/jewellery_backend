const express = require('express');
const Stripe = require('stripe');
const auth = require('../middleware/auth');  
const Cart = require('../models/cart'); 

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', auth, async (req, res) => {
    try {
        const { amount, cartItems } = req.body;  // also receive cartItems

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
            // Pass userId so webhook can identify who paid
            metadata: {
                userId: req.user.id,
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


// Stripe Webhook - clears cart and creates order after payment
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET  // add this to your .env
        );
    } catch (err) {
        console.error('Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;

        try {
            // 1. Clear the user's cart
            await Cart.findOneAndDelete({ user: userId });

            // 2. Optionally create an order record
            await Order.create({
                user: userId,
                amount: session.amount_total,
                paymentId: session.payment_intent,
                status: 'paid',
            });

            console.log(`Cart cleared and order created for user: ${userId}`);
        } catch (err) {
            console.error('Error clearing cart/creating order:', err);
        }
    }

    res.json({ received: true });
});

module.exports = router;

