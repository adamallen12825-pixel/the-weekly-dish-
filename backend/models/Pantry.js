const mongoose = require('mongoose');

const pantryItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: Number,
  unit: String,
  expirationDate: Date,
  addedDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PantryItem', pantryItemSchema);