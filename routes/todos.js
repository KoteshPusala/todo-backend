const express = require('express');
const Todo = require('../models/Todo');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all todos for authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const { category, priority, completed, search } = req.query;
    let query = { user: req.user._id };

    // Apply filters
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (completed !== undefined) query.completed = completed === 'true';
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const todos = await Todo.find(query).sort({ createdAt: -1 });
    console.log(`📋 Found ${todos.length} todos for user ${req.user._id}`);
    res.json(todos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new todo
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, dueDate, category, tags } = req.body;

    const todo = new Todo({
      title,
      description,
      priority,
      dueDate,
      category,
      tags,
      user: req.user._id
    });

    await todo.save();
    console.log('✅ Todo created in database:', todo._id);
    res.status(201).json(todo);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update todo
router.put('/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    Object.assign(todo, req.body);
    await todo.save();
    
    console.log('✅ Todo updated in database:', todo._id);
    res.json(todo);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete todo
router.delete('/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    await Todo.findByIdAndDelete(req.params.id);
    console.log('✅ Todo deleted from database:', req.params.id);
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get stats
router.get('/stats', auth, async (req, res) => {
  try {
    const total = await Todo.countDocuments({ user: req.user._id });
    const completed = await Todo.countDocuments({ 
      user: req.user._id, 
      completed: true 
    });
    const pending = total - completed;

    // Category distribution
    const categoryStats = await Todo.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Priority distribution
    const priorityStats = await Todo.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    console.log(`📊 Stats for user ${req.user._id}: ${total} total, ${completed} completed`);
    
    res.json({
      total,
      completed,
      pending,
      categoryStats,
      priorityStats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;