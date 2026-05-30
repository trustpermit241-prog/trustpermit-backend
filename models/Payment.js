const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    amount: Number,
    method: String,
    cardLast4: String,
    status: { type: String, default: 'Completed' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema, 'payments');
