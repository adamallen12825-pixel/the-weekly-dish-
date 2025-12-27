const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  name: String,
  ingredients: [String],
  estimatedCost: Number,
  cookingTime: Number,
  difficulty: String
});

const mealPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  days: [{
    day: String,
    meals: {
      breakfast: mealSchema,
      lunch: mealSchema,
      dinner: mealSchema
    }
  }],
  shoppingList: {
    sections: [{
      category: String,
      items: [{
        name: String,
        quantity: Number,
        unit: String,
        estimatedPrice: Number
      }]
    }],
    totalCost: Number,
    moneySavingTips: [String]
  },
  accepted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MealPlan', mealPlanSchema);