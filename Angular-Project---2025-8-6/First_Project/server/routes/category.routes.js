const express = require('express');
const router = express.Router();
const Category = require('../models/category');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get all active categories (Public)
router.get('/', async (req, res) => {
    try {
        const query = { isActive: true };
        // If admin is requesting (checked via a separate admin endpoint or ignored for simplicity here for public)
        // For now public endpoint returns all active
        const categories = await Category.find(query).sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all categories (including inactive)
router.get('/admin/all', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Create category
router.post('/', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const category = new Category(req.body);
        await category.save();
        res.json(category);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin: Update category
router.put('/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        res.json(category);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin: Delete category
router.delete('/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
