const express = require('express');
const Payment = require('../models/Payment');

const router = express.Router();

// Create a new payment record
router.post('/', async (req, res) => {
  try {
    const { name, email, amount, method = 'unknown', cardLast4 = '' } = req.body;

    console.log('Payment request body:', req.body);

    if (!name || !email || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment fields',
        payload: req.body,
      });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount',
        payload: req.body,
      });
    }

    const payment = await Payment.create({
      name,
      email,
      amount: parsedAmount,
      method,
      cardLast4,
    });

    res.status(201).json({ success: true, message: 'Payment recorded', payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// List payments
router.get('/', async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single payment
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
