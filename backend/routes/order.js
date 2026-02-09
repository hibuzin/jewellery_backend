const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/order');
const Product = require('../models/product');

console.log('order route loaded');


router.post('/', auth, async (req, res) => {
  try {
    const { address, paymentMethod } = req.body;

    if (!address || !paymentMethod) {
      return res.status(400).json({ message: 'Address & payment method required' });
    }

    // 1️⃣ Get cart
    const cart = await Cart.findOne({ user: req.userId })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let totalAmount = 0;
    const orderItems = [];

    // 2️⃣ Loop cart items
    for (const item of cart.items) {
      const product = item.product;

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // 3️⃣ Stock check
      if (product.quantity < item.quantity) {
        return res.status(400).json({
          message: `${product.name} has only ${product.quantity} items left`
        });
      }

      // 4️⃣ Reduce stock
      product.quantity -= item.quantity;
      if (product.quantity === 0) {
        product.isAvailable = false;
      }

      await product.save();

      // 5️⃣ Calculate total
      totalAmount += product.price * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price
      });
    }

    // 6️⃣ Create order
    const order = await Order.create({
      user: req.userId,
      items: orderItems,
      address,
      paymentMethod,
      totalAmount,
      status: 'placed'
    });

    await order.populate('items.product');

    // 7️⃣ Clear cart
    cart.items = [];
    await cart.save();

    res.status(201).json({
      message: 'Order placed successfully',
      order
    });

  } catch (err) {
    console.error('ORDER ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// GET USER ORDERS
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (err) {
    console.error('ORDER ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET SINGLE ORDER
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.userId
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error('ORDER ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE ORDER STATUS
router.put('/:orderId/status', auth, async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatus = [
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled',
      'return requested',
      'return accepted',
    ];

    if (!status || !allowedStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const order = await Order.findById(req.params.orderId);
    

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

     if (status === 'return accepted' && order.status !== 'return accepted') {
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);

        if (product) {
          product.quantity += item.quantity; // ✅ add back stock
          await product.save();
        }
      }
    }

    order.status = status;
    await order.save();

    res.json({
      message: 'Order status updated',
      order
    });

  } catch (err) {
    console.error('ORDER STATUS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:orderId/return', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.userId
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        message: 'Return allowed only after delivery'
      });
    }

    if (order.return?.isRequested) {
      return res.status(400).json({ message: 'Return already requested' });
    }

    order.return = {
      isRequested: true,
      reason,
      status: 'return requested',
      requestedAt: new Date()
    };

    await order.save();

    res.json({
      message: 'Return request submitted',
      order
    });

  } catch (err) {
    console.error('RETURN REQUEST ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;


