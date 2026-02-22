const express = require('express');
const router = express.Router();

const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const { verifyToken, requireRole } = require('../middleware/auth');
const { generateGenericExcelReport, generateGenericPDFReport } = require('../utils/reportUtils');

// Helper to determine format and send response
async function respondWithReport(res, data, columns, title, format) {
    try {
        if (format === 'excel') {
            const buffer = await generateGenericExcelReport(data, columns, title);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${title.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.xlsx`);
            res.send(buffer);
        } else {
            const buffer = await generateGenericPDFReport(data, columns, title);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${title.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.pdf`);
            res.send(buffer);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate report' });
    }
}

/**
 * GET /api/reports/sales
 * Admin only. Generates a sales report from orders.
 * Query params: format (pdf|excel)
 */
router.get('/sales', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const format = req.query.format === 'excel' ? 'excel' : 'pdf';
        const orders = await Order.find({ status: { $ne: 'cancelled' } }).populate('user_id', 'full_name email').sort({ created_at: -1 });

        const data = orders.map(order => ({
            id: order._id.toString(),
            date: new Date(order.created_at).toLocaleDateString(),
            customer: order.user_id ? order.user_id.full_name : 'Guest',
            items: order.items.reduce((sum, item) => sum + item.quantity, 0),
            total: order.total_amount,
            status: order.status
        }));

        const columns = [
            { header: 'Order ID', key: 'id', width: 120 },
            { header: 'Date', key: 'date', width: 80 },
            { header: 'Customer', key: 'customer', width: 150 },
            { header: 'Items', key: 'items', width: 60, align: 'center' },
            { header: 'Total ($)', key: 'total', width: 80, align: 'right', format: v => `$${Number(v).toFixed(2)}` },
            { header: 'Status', key: 'status', width: 80 }
        ];

        await respondWithReport(res, data, columns, 'Sales Report', format);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/reports/inventory
 * Admin only. Generates an inventory report from products.
 * Query params: format (pdf|excel)
 */
router.get('/inventory', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const format = req.query.format === 'excel' ? 'excel' : 'pdf';
        const products = await Product.find().sort({ name: 1 });

        const data = products.map(product => {
            const stockS = product.stock?.S || 0;
            const stockM = product.stock?.M || 0;
            const stockL = product.stock?.L || 0;
            const stockXL = product.stock?.XL || 0;
            const totalStock = stockS + stockM + stockL + stockXL;

            return {
                name: product.name,
                category: product.category,
                price: product.price,
                stockS, stockM, stockL, stockXL,
                total: totalStock
            };
        });

        const columns = [
            { header: 'Product Name', key: 'name', width: 220 },
            { header: 'Category', key: 'category', width: 100 },
            { header: 'Price ($)', key: 'price', width: 70, align: 'right', format: v => `$${Number(v).toFixed(2)}` },
            { header: 'Stock (S)', key: 'stockS', width: 60, align: 'center' },
            { header: 'Stock (M)', key: 'stockM', width: 60, align: 'center' },
            { header: 'Stock (L)', key: 'stockL', width: 60, align: 'center' },
            { header: 'Stock (XL)', key: 'stockXL', width: 60, align: 'center' },
            { header: 'Total', key: 'total', width: 60, align: 'center' }
        ];

        await respondWithReport(res, data, columns, 'Inventory Report', format);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/reports/customers
 * Admin only. Generates a customer report.
 * Query params: format (pdf|excel)
 */
router.get('/customers', verifyToken, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const format = req.query.format === 'excel' ? 'excel' : 'pdf';

        // Use aggregation to get users and their total order counts/spent
        const users = await User.aggregate([
            { $match: { role: 'customer' } },
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'user_id',
                    as: 'orders'
                }
            },
            {
                $project: {
                    full_name: 1,
                    email: 1,
                    created_at: 1,
                    orderCount: { $size: '$orders' },
                    totalSpent: { $sum: '$orders.total_amount' }
                }
            },
            { $sort: { created_at: -1 } }
        ]);

        const data = users.map(user => ({
            name: user.full_name,
            email: user.email,
            joined: new Date(user.created_at).toLocaleDateString(),
            orders: user.orderCount,
            spent: user.totalSpent
        }));

        const columns = [
            { header: 'Customer Name', key: 'name', width: 150 },
            { header: 'Email', key: 'email', width: 200 },
            { header: 'Joined Date', key: 'joined', width: 90 },
            { header: 'Total Orders', key: 'orders', width: 80, align: 'center' },
            { header: 'Total Spent', key: 'spent', width: 90, align: 'right', format: v => `$${Number(v).toFixed(2)}` }
        ];

        await respondWithReport(res, data, columns, 'Customer Report', format);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/reports/my-report
 * Customer only. Generates a personal order history report.
 * Query params: format (pdf|excel)
 */
router.get('/my-report', verifyToken, async (req, res) => {
    try {
        const format = req.query.format === 'excel' ? 'excel' : 'pdf';
        const orders = await Order.find({ user_id: req.user.userId }).sort({ created_at: -1 });
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const data = orders.map(order => ({
            id: order._id.toString(),
            date: new Date(order.created_at).toLocaleDateString(),
            items: order.items.map(i => `${i.product_name} (x${i.quantity})`).join(', '),
            total: order.total_amount,
            status: order.status
        }));

        const columns = [
            { header: 'Order ID', key: 'id', width: 120 },
            { header: 'Date', key: 'date', width: 80 },
            { header: 'Items', key: 'items', width: 250 },
            { header: 'Total ($)', key: 'total', width: 80, align: 'right', format: v => `$${Number(v).toFixed(2)}` },
            { header: 'Status', key: 'status', width: 80 }
        ];

        await respondWithReport(res, data, columns, `Personal Report - ${user.full_name}`, format);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
