const express = require('express');
const router = express.Router();
const Collection = require('../models/collection');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get collection by slug (Public)
router.get('/slug/:slug', async (req, res) => {
    try {
        const collection = await Collection.findOne({
            slug: req.params.slug,
            isActive: true
        }).populate('products');

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        res.json(collection);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get active collections by type (Public)
router.get('/type/:type', async (req, res) => {
    try {
        const collections = await Collection.find({
            type: req.params.type,
            isActive: true,
            $or: [
                { startDate: { $exists: false } },
                { startDate: { $lte: new Date() } }
            ],
            $and: [
                { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: new Date() } }] }
            ]
        }).populate('products');
        res.json(collections);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all collections
router.get('/admin/all', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const collections = await Collection.find().sort({ createdAt: -1 });
        res.json(collections);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Create collection
router.post('/', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const collection = new Collection(req.body);
        await collection.save();
        res.json(collection);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin: Update collection
router.put('/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const collection = await Collection.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        res.json(collection);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin: Delete collection
router.delete('/:id', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        await Collection.findByIdAndDelete(req.params.id);
        res.json({ message: 'Collection deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
