/*
  Seed script for MongoDB Atlas.
  - Inserts sample Users, Products, Inventory, Orders, Financials.
  - Safe to re-run: it checks if collections already have data.

  Run:
    cd server
    node seed.js
*/

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/user');
const Product = require('./models/product');
const Inventory = require('./models/inventory');
const Order = require('./models/order');
const Financial = require('./models/financial');

async function main() {
  // --- Connect to MongoDB using the same env var as server.js ---
  if (!process.env.MONGO_URI) {
    throw new Error('Missing MONGO_URI in server/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  // --- Optional: wipe and reseed (use carefully!) ---
  // Set SEED_RESET=true in server/.env to clear existing collections before seeding.
  const seedReset = String(process.env.SEED_RESET || '').toLowerCase() === 'true';
  if (seedReset) {
    console.log('SEED_RESET=true → clearing collections before seeding...');
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      Inventory.deleteMany({}),
      Financial.deleteMany({})
    ]);
  }

  // --- Exit early if DB already has seeded data (prevents duplicates) ---
  // Note: we only skip when products/orders already exist.
  const [productCount, orderCount] = await Promise.all([
    Product.countDocuments(),
    Order.countDocuments()
  ]);

  if (!seedReset && (productCount > 0 || orderCount > 0)) {
    console.log('Seed skipped: products/orders already exist.');
    console.log(`Counts: products=${productCount}, orders=${orderCount}`);
    return;
  }

  // --- Create Users ---
  const [superadmin, admin, customer] = await User.insertMany([
    {
      role: 'superadmin',
      full_name: 'Super Admin',
      email: 'superadmin@demo.com',
      password: '123456',
      phone: '+1-555-0100',
      address: { street: '1 Admin Way', city: 'Metropolis', country: 'US' }
    },
    {
      role: 'admin',
      full_name: 'Store Admin',
      email: 'admin@demo.com',
      password: '123456',
      phone: '+1-555-0101',
      address: { street: '2 Admin Way', city: 'Metropolis', country: 'US' }
    },
    {
      role: 'customer',
      full_name: 'Demo Customer',
      email: 'customer@demo.com',
      password: '123456',
      phone: '+1-555-0102',
      address: { street: '10 Market St', city: 'Metropolis', country: 'US' }
    }
  ]);

  // --- Create Products ---
  const products = await Product.insertMany([
    {
      name: 'Classic Purple Tee',
      description: 'Soft cotton tee in a rich purple tone.',
      category: 'Shirts',
      sub_category: 'T-Shirts',
      price: 25,
      discount: 0,
      image: ['https://picsum.photos/seed/purpletee/800/800'],
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Purple'],
      stock: { S: 8, M: 10, L: 6, XL: 4 }
    },
    {
      name: 'Everyday Black Jeans',
      description: 'Comfort stretch jeans for daily wear.',
      category: 'Pants',
      sub_category: 'Jeans',
      price: 55,
      discount: 10,
      image: ['https://picsum.photos/seed/blackjeans/800/800'],
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Black'],
      stock: { S: 5, M: 7, L: 7, XL: 3 }
    },
    {
      name: 'Summer Dress',
      description: 'Lightweight dress perfect for warm days.',
      category: 'Dresses',
      sub_category: 'Casual',
      price: 65,
      discount: 0,
      image: ['https://picsum.photos/seed/summerdress/800/800'],
      sizes: ['S', 'M', 'L'],
      colors: ['Floral'],
      stock: { S: 4, M: 6, L: 2, XL: 0 }
    },
    {
      name: 'Leather Belt',
      description: 'Genuine leather belt with metal buckle.',
      category: 'Accessories',
      sub_category: 'Belts',
      price: 30,
      discount: 0,
      image: ['https://picsum.photos/seed/leatherbelt/800/800'],
      sizes: ['M', 'L', 'XL'],
      colors: ['Brown'],
      stock: { S: 0, M: 12, L: 12, XL: 8 }
    }
  ]);

  // --- Create Inventory rows (links to Product) ---
  await Inventory.insertMany(
    products.map((p) => ({
      product_id: p._id,
      stock_by_size: {
        S: p.stock?.S ?? 0,
        M: p.stock?.M ?? 0,
        L: p.stock?.L ?? 0,
        XL: p.stock?.XL ?? 0
      },
      supplier: 'Demo Supplier',
      supplier_email: ''
    }))
  );

  // --- Create a sample Order for the customer ---
  const order = await Order.create({
    user_id: customer._id,
    items: [
      {
        product_id: products[0]._id,
        name: products[0].name,
        size: 'M',
        color: 'Purple',
        quantity: 2,
        price: products[0].price
      },
      {
        product_id: products[3]._id,
        name: products[3].name,
        size: 'L',
        color: 'Brown',
        quantity: 1,
        price: products[3].price
      }
    ],
    total_amount: products[0].price * 2 + products[3].price,
    status: 'pending',
    shipping_address: customer.address,
    payment_method: 'cash_on_delivery'
  });

  // --- Create Financial record for the order ---
  await Financial.create({
    order_id: order._id,
    user_id: customer._id,
    amount: order.total_amount,
    Payment_status: 'paid',
    notes: 'Seed transaction'
  });

  console.log('✅ Seed complete');
  console.log(`Users: 3, Products: ${products.length}, Orders: 1, Inventory: ${products.length}, Financials: 1`);
  console.log('Demo logins:');
  console.log('  superadmin@demo.com / 123456');
  console.log('  admin@demo.com / 123456');
  console.log('  customer@demo.com / 123456');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
