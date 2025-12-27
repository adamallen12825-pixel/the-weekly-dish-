const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  profile: {
    adults: { type: Number, default: 1 },
    kids: { type: Number, default: 0 },
    kidAges: [Number],
    budget: { type: Number, default: 100 },
    skillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    mealDifficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    dietType: { type: String, default: 'Standard' },
    customDiet: String,
    cuisines: [String],
    dietaryRestrictions: [String],
    goals: [String],
    mealPrepStyle: { type: String, default: 'Cook Every Meal' },
    cookingTools: [String]
  },
  subscription: {
    status: { type: String, enum: ['trial', 'active', 'canceled', 'expired'], default: 'trial' },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodEnd: Date,
    trialEnd: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);