const express = require('express');
const authMiddleware = require('../middleware/auth');
const PantryItem = require('../models/Pantry');

const router = express.Router();

// Get all pantry items
router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await PantryItem.find({ userId: req.userId });
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add pantry item
router.post('/', authMiddleware, async (req, res) => {
  try {
    const item = new PantryItem({
      userId: req.userId,
      ...req.body
    });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add multiple pantry items (from camera scan)
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    const pantryItems = items.map(item => ({
      userId: req.userId,
      ...item
    }));
    
    const savedItems = await PantryItem.insertMany(pantryItems);
    res.status(201).json(savedItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update pantry item
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await PantryItem.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete pantry item
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await PantryItem.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear all pantry items
router.delete('/', authMiddleware, async (req, res) => {
  try {
    await PantryItem.deleteMany({ userId: req.userId });
    res.json({ message: 'Pantry cleared' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;