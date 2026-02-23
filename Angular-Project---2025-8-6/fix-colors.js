const fs = require('fs');

const files = [
    'src/app/admin/inventory/inventory.css',
    'src/app/admin/products/products.css',
    'src/app/admin/reports/reports.css',
    'src/app/admin/analytics/analytics.css',
    'src/app/admin/user-management/user-management.css',
    'src/app/admin/suppliers/suppliers.css',
    'src/app/admin/inventory-history/inventory-history.css',
    'src/app/admin/admin-management/admin-management.css',
    'src/app/admin/financials/financials.css',
    'src/app/admin/restock-requests/restock-requests.css',
    'src/app/admin/admin-collections/admin-collections.css',
    'src/app/admin/admin-categories/admin-categories.css',
    'src/app/superadmin/dashboard/superadmin-dashboard.css'
];

const colorMap = {
    '#1f2937': 'var(--text)',
    '#1a1a1a': 'var(--text)',
    '#374151': 'var(--text)',
    '#111827': 'var(--text)',
    '#333': 'var(--text)',
    '#222': 'var(--text)',
    '#495057': 'var(--text)',
    '#6b7280': 'var(--muted)',
    '#9ca3af': 'var(--muted)',
    '#666': 'var(--muted)',
    '#4b5563': 'var(--muted)',
    '#888': 'var(--muted)',
    '#e5e7eb': 'var(--border)',
    '#d1d5db': 'var(--border)',
    '#e9ecef': 'var(--border)',
    '#f3f4f6': 'var(--surface-2)',
    '#f9fafb': 'var(--surface-2)',
    '#fafafa': 'var(--surface-2)',
    '#f8f9fa': 'var(--surface-2)',
    '#f5f5f5': 'var(--surface-2)',
    '#eee': 'var(--border)',
    '#ddd': 'var(--border)',
    '#e0e0e0': 'var(--border)'
};

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');

        // Fix specific variables
        for (const [hex, variable] of Object.entries(colorMap)) {
            const regex = new RegExp(hex + '(?![a-fA-F0-9])', 'gi');
            content = content.replace(regex, variable);
        }

        // Fix hardcoded white backgrounds
        content = content.replace(/background(-color)?\s*:\s*(#fff|#ffffff|white)\b/gi, 'background: var(--surface)');
        // Fix hardcoded white border colors if any, usually used to match backgrounds
        content = content.replace(/border(-color)?\s*:\s*(#fff|#ffffff|white)\b/gi, 'border-color: var(--border)');

        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
