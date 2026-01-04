const express = require('express');
const router = express.Router();

const Review = require('../models/review');
const User = require('../models/user');
const { verifyToken } = require('../middleware/auth');

// List reviews for a product
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId })
            .sort({ createdAt: -1 })
            .select('rating comment userName createdAt updatedAt userId')
            .lean();

        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rating summary for a product: avg + count
router.get('/summary/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { Types } = require('mongoose');
        if (!Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ error: 'Invalid product id' });
        }

        const agg = await Review.aggregate([
            { $match: { productId: new Types.ObjectId(productId) } },
            {
                $group: {
                    _id: '$productId',
                    average: { $avg: '$rating' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const summary = agg[0] || { average: 0, count: 0 };
        res.json({ average: Number(summary.average || 0), count: Number(summary.count || 0) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk summary to avoid N calls from showroom (optional but useful)
router.get('/summary', async (req, res) => {
    try {
        const ids = String(req.query.ids || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        if (!ids.length) return res.json({});

        const { Types } = require('mongoose');
        const objectIds = ids
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        const agg = await Review.aggregate([
            { $match: { productId: { $in: objectIds } } },
            {
                $group: {
                    _id: '$productId',
                    average: { $avg: '$rating' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const out = {};
        for (const row of agg) {
            out[String(row._id)] = { average: Number(row.average || 0), count: Number(row.count || 0) };
        }

        for (const id of ids) {
            if (!out[id]) out[id] = { average: 0, count: 0 };
        }

        res.json(out);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create or update a review (same user+product => update)
router.post('/product/:productId', verifyToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const { rating, comment } = req.body || {};

        const safeRating = Number(rating);
        const safeComment = String(comment || '').trim();

        if (!Number.isFinite(safeRating) || safeRating < 1 || safeRating > 5) {
            return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
        }

        if (!safeComment) {
            return res.status(400).json({ error: 'Comment is required' });
        }

        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Authentication required' });

        const user = await User.findById(userId).select('full_name').lean();
        const userName = user?.full_name || 'Customer';

        const updated = await Review.findOneAndUpdate(
            { productId, userId },
            { $set: { rating: safeRating, comment: safeComment, userName } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


