// Frontend inventory types for the inventory management feature.
// Keep these aligned with the backend payloads in server/routes/inventory.routes.js

export type Size = 'S' | 'M' | 'L' | 'XL';

export interface StockBySize {
	S: number;
	M: number;
	L: number;
	XL: number;
}

// Minimal Product fields returned when backend populates product_id.
export interface ProductRef {
	_id: string;
	name?: string;
	category?: string;
	price?: number;
}

// Inventory record (one per product)
export interface InventoryItem {
	_id: string;
	product_id: string | ProductRef;
	stock_by_size: StockBySize;
	low_stock_threshold_by_size?: StockBySize;
	supplier?: string;
	supplier_email?: string;
	created_at?: string;
	updated_at?: string;
	// Backwards-compatible storage field is `last_restoked` with alias `last_restocked`.
	last_restoked?: string;
	last_restocked?: string;
}

// Low stock result shape from GET /api/inventory/low-stock
export interface LowStockSizeInfo {
	size: Size;
	stock: number;
	threshold: number;
}

export interface LowStockItem {
	inventory_id: string;
	product: ProductRef;
	stock_by_size: StockBySize;
	low_stock_threshold_by_size: StockBySize;
	low: LowStockSizeInfo[];
}

export type InventoryAuditAction = 'RESTOCK' | 'ADJUST';

export interface InventoryAuditEntry {
	_id: string;
	inventory_id: string;
	product_id: string;
	action: InventoryAuditAction;
	delta_by_size: StockBySize;
	before_by_size: StockBySize;
	after_by_size: StockBySize;
	reason?: string;
	supplier?: string;
	performed_by?: { userId?: string; role?: string };
	created_at?: string;
}
