import type { Size, StockBySize } from './inventory.model';

export interface Product {
	_id: string;
	name: string;
	description?: string;
	category: string;
	sub_category?: string;
	price: number;
	discount?: number;

	image: string[];
	sizes: string[];
	colors: string[];

	// Backend uses a fixed S/M/L/XL stock object.
	stock: StockBySize;
}

export function isSize(value: string): value is Size {
	return value === 'S' || value === 'M' || value === 'L' || value === 'XL';
}

