const express = require('express');
const router = express.Router();

const Order = require('../models/order');
const { attachSseClient } = require('../utils/analyticsStream');

/**
 * Helper: Parse integer safely with fallback
 */
function toInt(value, fallback) {
    const n = Number(value);
    if(!Number.isFinite(n)) return fallback;
    return Math.floor(n);
}

/**
 * Helper: Get start of day in UTC to ensure consistent daily buckets
 */
function startOfDayUTC(d){
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Helper: Add days to a UTC date
 */
function addDaysUTC(d, days){
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

/**
 * GET /api/analytics/stream
 * SSE stream endpoint.
 * Clients connect here to receive real-time updates when orders change.
 */
router.get('/stream', (req, res) => {
    attachSseClient(req,res);
});

/**
 * GET /api/analytics/sales-trends
 * Fetch revenue and order count per day for the last N days.
 * Query params:
 *   - days: number (default 30, min 7, max 365)
 */
router.get('/sales-trends', async (req, res) => {
    try {
        // 1. Validate and parse 'days' parameter
        const days = Math.min(365, Math.max(7, toInt(req.query.days, 30)));

        // 2. Calculate date range (UTC)
        const now = new Date();
        const end = startOfDayUTC(now);
        const start = addDaysUTC(end, -(days-1));

        // 3. Aggregate revenue grouped by day from MongoDB
        const rows = await Order.aggregate([
            {
                $match: {
                    created_at: { $gte: start, $lte: addDaysUTC(end, 1) },
                    status: {$ne: 'cancelled'}
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$created_at'}
                    },
                    revenue: {$sum: '$total_amount'},
                    orders: {$sum: 1}
                }
            },
            {$sort: {_id: 1}}
        ]);

        // 4. Fill in missing days with zero values
        const byDate = new Map(rows.map((r) => [r._id, r]));
        const out = [];

        for(let i = 0; i < days; i++){
            const d = addDaysUTC(start, i);
            const key = d.toISOString().slice(0, 10);
            const found = byDate.get(key);

            out.push({
                date: key,
                revenue: Math.round(Number(found?.revenue || 0) * 100) / 100,
                orders: Number(found?.orders || 0)
            });
        }

        res.json(out);

    } catch (err) {
        console.error('Error fetching sales trends:', err);
        res.status(500).json({error: err.message || "Failed to load sales trends"});
    }

});

module.exports = router;