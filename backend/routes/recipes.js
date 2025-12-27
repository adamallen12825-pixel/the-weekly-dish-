const express = require('express');
const authMiddleware = require('../middleware/auth');
const Recipe = require('../models/Recipe');

const router = express.Router();

// Get all user recipes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.userId }).sort('-createdAt');
    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get favorite recipes
router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const recipes = await Recipe.find({ 
      userId: req.userId,
      isFavorite: true 
    }).sort('-createdAt');
    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single recipe
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const recipe = await Recipe.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json(recipe);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save recipe
router.post('/', authMiddleware, async (req, res) => {
  try {
    const recipe = new Recipe({
      userId: req.userId,
      ...req.body
    });
    await recipe.save();
    res.status(201).json(recipe);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle favorite
router.put('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const recipe = await Recipe.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    recipe.isFavorite = !recipe.isFavorite;
    await recipe.save();
    
    res.json({ 
      message: recipe.isFavorite ? 'Added to favorites' : 'Removed from favorites',
      recipe 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete recipe
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;