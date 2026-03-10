const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Order = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');
const Coupon = require('../models/coupon');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOW_STOCK_LIMIT = 5;


function buildOrderFilter(userId, query) {
  const filter = { user: userId };

  const {
    status,
    startDate,
    endDate,
    minAmount,
    maxAmount
  } = query;

  // ✅ Status filter
  if (status) {
    const allowedStatus = [
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled'
    ];

    if (!allowedStatus.includes(status.toLowerCase())) {
      return { error: 'Invalid status value' };
    }

    filter.status = status.toLowerCase();
  }

  // ✅ Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};

    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }

    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  // ✅ Amount range filter
  if (minAmount || maxAmount) {
    filter.totalAmount = {};

    if (minAmount) {
      filter.totalAmount.$gte = Number(minAmount);
    }

    if (maxAmount) {
      filter.totalAmount.$lte = Number(maxAmount);
    }
  }

  return { filter };
}




function buildSortOption(query) {
  const { sortBy, order } = query;

  const allowedFields = ['createdAt', 'totalAmount', 'status'];

  if (!sortBy) {
    return { sort: { createdAt: -1 } };
  }

  if (!allowedFields.includes(sortBy)) {
    return { error: 'Invalid sort field' };
  }

  const sortOrder = order === 'asc' ? 1 : -1;

  return {
    sort: { [sortBy]: sortOrder }
  };
}


router.post('/buy-now', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity, address, paymentMethod, couponCode } = req.body;


    if (!productId || !quantity || !address || !paymentMethod) {
      return res.status(400).json({
        message: 'productId, quantity, address, and paymentMethod are required.'
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'quantity must be a positive integer.' });
    }

    const { name, phone, street, city, state, pincode } = address;

    if (!name || !phone || !street || !city || !state || !pincode) {
      return res.status(400).json({ message: 'All address fields (name, phone, street, city, state, pincode) are required.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // --- Find Product & Check Stock ---
    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (product.quantity < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Only ${product.quantity} items available for "${product.title}".`
      });
    }

    // --- Calculate Total ---
    let totalAmount = product.price * quantity;
    let discount = 0;

    // --- Apply Coupon (optional) ---
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

      if (!coupon || !coupon.isActive) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Invalid coupon.' });
      }

      if (new Date() > coupon.expiryDate) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Coupon expired.' });
      }

      if (totalAmount < coupon.minOrderAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon.`
        });
      }

      if (coupon.discountType === 'percentage') {
        discount = (totalAmount * coupon.discountValue) / 100;
      } else {
        discount = coupon.discountValue;
      }

      totalAmount -= discount;
    }

    // --- Deduct Stock ---
    product.quantity -= quantity;
    if (product.quantity <= 0) product.isAvailable = false;
    await product.save({ session });

    /// low stock check
    const io = req.app.get('io');

    if (product.quantity <= LOW_STOCK_LIMIT) {
      io.emit('lowStock', {
        productId: product._id,
        title: product.title,
        quantity: product.quantity,
        message: `Low stock alert: ${product.title} only ${product.quantity} left`
      });
    }


    const [order] = await Order.create([{
      user: req.userId,
      items: [{
        product: product._id,
        quantity,
        price: product.price
      }],
      totalAmount,
      address,
      paymentMethod,
      status: 'pending'
    }], { session });


    user.orders.push(order._id);
    await user.save({ session });

    await session.commitTransaction();

    await order.populate('items.product');

    return res.status(201).json({
      message: 'Order placed successfully.',
      ...(couponCode && discount > 0 && { discount: `₹${discount} discount applied` }),
      order
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('BUY NOW ERROR:', err);
    return res.status(500).json({ message: 'Server error.' });
  } finally {
    session.endSession();
  }
});


router.get('/receipt/:orderId', auth, async (req, res) => {
  try {

    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('user', 'name email')
      .populate('items.product', 'title');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const fileName = `receipt-${order._id}.pdf`;

    const receiptDir = path.join(__dirname, '../receipts');

    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }

    const filePath = path.join(receiptDir, fileName);

    const doc = new PDFDocument({ margin: 40 });

    const fileStream = fs.createWriteStream(filePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(fileStream);
    doc.pipe(res);

    // Title
    doc.fontSize(22).text('Order Receipt', { align: 'center' });
    doc.moveDown();

    // Customer
    doc.fontSize(12);
    doc.text(`Order ID: ${order._id}`);
    doc.text(`Customer: ${order.user?.name}`);
    doc.text(`Email: ${order.user?.email}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.text(`Order Status: ${order.status}`);
    doc.text(`Date: ${new Date(order.createdAt).toDateString()}`);

    doc.moveDown();

    // Address
    doc.fontSize(14).text('Shipping Address');
    doc.fontSize(12);
    doc.text(order.address.name);
    doc.text(order.address.phone);
    doc.text(order.address.street);
    doc.text(`${order.address.city}, ${order.address.state}`);
    doc.text(`Pincode: ${order.address.pincode}`);

    doc.moveDown();

    // Items
    doc.fontSize(14).text('Items');
    doc.moveDown(0.5);

    order.items.forEach((item, index) => {

      doc.fontSize(12).text(
        `${index + 1}. ${item.product?.title}`
      );

      doc.text(
        `Quantity: ${item.quantity}   Price: ₹${item.price}`
      );

      doc.moveDown(0.5);

    });

    doc.moveDown();

    doc.fontSize(16).text(`Total Amount: ₹${order.totalAmount}`);

    doc.end();

    fileStream.on('finish', () => {
      console.log('Receipt saved:', filePath);
    });

  } catch (error) {

    console.error('Receipt Error:', error);

    res.status(500).json({
      message: 'Failed to generate receipt'
    });

  }
});



router.get('/export', auth, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    let filter = {};


    if (status) {
      filter.status = status;
    }


    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
      OrderID: order._id,
      CustomerName: order.user?.name,
      CustomerEmail: order.user?.email,
      TotalAmount: order.totalAmount,
      Status: order.status,
      PaymentMethod: order.paymentMethod,
      CreatedAt: order.createdAt
    }));

    res.status(200).json({
      count: formattedOrders.length,
      orders: formattedOrders
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export orders' });
  }
});


router.get('/export/pdf/save', auth, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    let filter = {};

    if (status) filter.status = status;

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    if (!orders.length) {
      return res.status(404).json({ message: 'No orders found' });
    }

    const fileName = `orders-${Date.now()}.pdf`;

    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, fileName);

    // ❌ REMOVED headers from here

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const fileStream = fs.createWriteStream(filePath);

    doc.pipe(fileStream); // only file, NOT res

    doc.fontSize(20).text('Order Report', { align: 'center' });
    doc.moveDown();

    orders.forEach((order, index) => {
      doc
        .fontSize(12)
        .text(`Order #${index + 1}`)
        .text(`Order ID: ${order._id}`)
        .text(`Customer: ${order.user?.name || 'N/A'}`)
        .text(`Email: ${order.user?.email || 'N/A'}`)
        .text(`Total Amount: ₹${order.totalAmount}`)
        .text(`Status: ${order.status}`)
        .text(`Payment: ${order.paymentMethod}`)
        .text(`Date: ${new Date(order.createdAt).toDateString()}`)
        .moveDown();
    });

    doc.end();

    fileStream.on('finish', () => {
      console.log(`✅ PDF saved locally: ${filePath}`);

      // ✅ Set headers ONLY here, after file is fully written
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // ✅ Read saved file and send to browser
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);

      readStream.on('error', (err) => {
        console.error('❌ Read stream error:', err);
        res.status(500).json({ message: 'Failed to send PDF to browser' });
      });
    });

    fileStream.on('error', (err) => {
      console.error('❌ File save error:', err);
      res.status(500).json({ message: 'Failed to save PDF' });
    });

  } catch (error) {
    console.error('PDF Export Error:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});


router.get('/', auth, async (req, res) => {
  try {
    const { filter, error: filterError } =
      buildOrderFilter(req.userId, req.query);
    if (filterError) return res.status(400).json({ message: filterError });

    const { sort, error: sortError } =
      buildSortOption(req.query);
    if (sortError) return res.status(400).json({ message: sortError });


    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate('items.product')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    res.json({
      totalOrders: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      orders
    });

  } catch (err) {
    console.error('ORDER GET ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/my-orders', auth, async (req, res) => {
  try {
    const { filter, error: filterError } = buildOrderFilter(req.userId, req.query);
    if (filterError) return res.status(400).json({ message: filterError });

    const { sort, error: sortError } = buildSortOption(req.query);
    if (sortError) return res.status(400).json({ message: sortError });

    const orders = await Order.find(filter)
      .populate('items.product')
      .sort(sort);

    res.json({ total: orders.length, orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.get('/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.userId
    }).populate('items.product');


    if (!order) return res.status(404).json({ error: 'Order not found' });


    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});


router.put('/:orderId/status', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;

    const allowedStatus = [
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled',
      'return requested',
      'return accepted'
    ];



    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findById(req.params.orderId).session(session);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (status === 'return accepted' && order.status !== 'return accepted') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } },
          { session }
        );
      }
    }

    order.status = status;
    await order.save({ session });

    await session.commitTransaction();

    res.json({ message: 'Order status updated', order });

  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Status update failed' });
  } finally {
    session.endSession();
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
      return res.status(400).json({ message: 'Return allowed only after delivery' });
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
