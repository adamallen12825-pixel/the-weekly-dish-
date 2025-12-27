const express = require('express');
const authMiddleware = require('../middleware/auth');
const MealPlan = require('../models/MealPlan');
const User = require('../models/User');

const router = express.Router();

// Get current meal plan
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const mealPlan = await MealPlan.findOne({
      userId: req.userId,
      accepted: true
    }).sort('-createdAt');

    res.json(mealPlan || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate new meal plan
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Here you would call your GPT-5 API to generate the meal plan
    // For now, returning a placeholder
    const mealPlanData = req.body.mealPlan || {
      // Generated meal plan structure
      days: [],
      shoppingList: {}
    };

    const mealPlan = new MealPlan({
      userId: req.userId,
      weekStartDate: new Date(),
      ...mealPlanData
    });

    await mealPlan.save();
    res.json(mealPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept meal plan
router.put('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const mealPlan = await MealPlan.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    mealPlan.accepted = true;
    await mealPlan.save();

    res.json({ message: 'Meal plan accepted', mealPlan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Replace a meal
router.put('/:id/meals/:day/:mealType', authMiddleware, async (req, res) => {
  try {
    const mealPlan = await MealPlan.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    const { day, mealType } = req.params;
    const { newMeal } = req.body;

    // Find the day and update the meal
    const dayIndex = mealPlan.days.findIndex(d => d.day === day);
    if (dayIndex !== -1) {
      mealPlan.days[dayIndex].meals[mealType] = newMeal;
      mealPlan.accepted = false; // Require re-acceptance after changes
      await mealPlan.save();
    }

    res.json({ message: 'Meal replaced', mealPlan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get meal plan history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const mealPlans = await MealPlan.find({
      userId: req.userId
    }).sort('-createdAt').limit(10);

    res.json(mealPlans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;