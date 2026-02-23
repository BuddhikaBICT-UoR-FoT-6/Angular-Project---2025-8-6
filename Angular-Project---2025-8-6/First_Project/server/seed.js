require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/user');
const Category = require('./models/category');
const Collection = require('./models/collection');
const Product = require('./models/product');
const Supplier = require('./models/supplier');
const Order = require('./models/order');
const Review = require('./models/review');

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("Missing MONGO_URI in .env");
  process.exit(1);
}

const runSeed = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB...");

    // 1. Clear existing data
    console.log("Clearing old data...");
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Collection.deleteMany({}),
      Product.deleteMany({}),
      Supplier.deleteMany({}),
      Order.deleteMany({}),
      Review.deleteMany({})
    ]);

    // 2. Create Users
    console.log("Creating Users... (Password is Password@123)");
    const passwordHash = await bcrypt.hash("Password@123", 10);

    const usersData = [
      { full_name: "Super Admin", email: "superadmin@example.com", password: passwordHash, role: "superadmin", phone: "1234567890", status: "active" },
      { full_name: "Store Admin", email: "admin@example.com", password: passwordHash, role: "admin", phone: "1234567891", status: "active" },
      { full_name: "John Doe", email: "john@example.com", password: passwordHash, role: "customer", phone: "1234567892", status: "active" },
      { full_name: "Jane Smith", email: "jane@example.com", password: passwordHash, role: "customer", phone: "1234567893", status: "active" },
      { full_name: "Alice Johnson", email: "alice@example.com", password: passwordHash, role: "customer", phone: "1234567894", status: "active" },
      { full_name: "Bob Brown", email: "bob@example.com", password: passwordHash, role: "customer", phone: "1234567895", status: "active" },
      { full_name: "Fast Fabrics Supplier", email: "supplier@example.com", password: passwordHash, role: "supplier", phone: "1234567896", status: "active" }
    ];

    const createdUsers = await User.insertMany(usersData);
    const customers = createdUsers.filter(u => u.role === 'customer');

    // 3. Create Suppliers
    console.log("Creating Suppliers...");
    const suppliersData = [
      { name: "Fast Fabrics", email: "supplier@example.com", phone: "+1 800 555 1234", contact_person: "Tom Jenkins", address: "123 Textile Way, NY" },
      { name: "Global Threads Pvt Ltd", email: "contact@globalthreads.com", phone: "+1 800 555 9876", contact_person: "Sarah Connor", address: "456 Manufacturer Blvd, CA" }
    ];
    await Supplier.insertMany(suppliersData);

    // 4. Create Categories
    console.log("Creating Categories...");
    const categoriesData = [
      { name: "Men's Apparel", description: "Clothing for men", image: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&q=80", isActive: true },
      { name: "Women's Apparel", description: "Clothing for women", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80", isActive: true },
      { name: "Footwear", description: "Shoes, sneakers, and boots", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80", isActive: true },
      { name: "Accessories", description: "Bags, belts, and hats", image: "https://images.unsplash.com/photo-1523206489230-c012c64b2b48?w=800&q=80", isActive: true }
    ];
    const createdCategories = await Category.insertMany(categoriesData);

    // 5. Create Products
    console.log("Creating Products...");
    const productsData = [
      // Men's
      {
        name: "Classic White T-Shirt",
        description: "A premium 100% cotton classic white t-shirt perfectly fitted for everyday wear.",
        category: "Men's Apparel",
        price: 24.99,
        image: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80", "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&q=80"],
        sizes: ["S", "M", "L", "XL"],
        stock: { S: 50, M: 120, L: 80, XL: 20 }
      },
      {
        name: "Vintage Denim Jacket",
        description: "Classic blue vintage denim jacket with a rugged look.",
        category: "Men's Apparel",
        price: 89.99,
        discount: 10,
        image: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80"],
        sizes: ["M", "L", "XL"],
        stock: { S: 0, M: 15, L: 30, XL: 10 }
      },
      // Women's
      {
        name: "Floral Summer Dress",
        description: "Lightweight and breathable floral dress perfect for summer days.",
        category: "Women's Apparel",
        price: 49.99,
        image: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80"],
        sizes: ["S", "M", "L"],
        stock: { S: 45, M: 60, L: 30, XL: 0 }
      },
      {
        name: "Casual High-Waisted Jeans",
        description: "Comfortable and stylish high-waisted denim jeans.",
        category: "Women's Apparel",
        price: 59.99,
        image: ["https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80"],
        sizes: ["S", "M", "L", "XL"],
        stock: { S: 10, M: 100, L: 80, XL: 5 }
      },
      // Footwear
      {
        name: "Urban Running Sneakers",
        description: "Performance running shoes wrapped in a sleek urban design.",
        category: "Footwear",
        price: 120.00,
        image: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80", "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=80"],
        sizes: ["M", "L", "XL"], // Using abstract sizes for simplicity
        stock: { S: 5, M: 40, L: 50, XL: 25 }
      },
      // Accessories
      {
        name: "Leather Crossbody Bag",
        description: "Genuine leather crossbody bag with multiple compartments.",
        category: "Accessories",
        price: 75.00,
        discount: 15,
        image: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80"],
        sizes: ["M"],
        stock: { S: 0, M: 200, L: 0, XL: 0 }
      },
      {
        name: "Classic Wayfarer Sunglasses",
        description: "UV400 protection with timeless style.",
        category: "Accessories",
        price: 29.99,
        image: ["https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80"],
        sizes: ["M"],
        stock: { S: 0, M: 85, L: 0, XL: 0 }
      },
      {
        name: "Knitted Winter Beanie",
        description: "Warm and cozy knitted beanie for cold weather.",
        category: "Accessories",
        price: 15.99,
        image: ["https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&q=80"],
        sizes: ["M"],
        stock: { S: 0, M: 150, L: 0, XL: 0 }
      }
    ];

    const createdProducts = await Product.insertMany(productsData);

    // 6. Create Collections
    console.log("Creating Collections...");
    const collectionsData = [
      {
        name: "Summer 2026",
        slug: "summer-2026",
        type: "seasonal",
        description: "Our hottest styles for the season.",
        image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
        products: [createdProducts[0]._id, createdProducts[2]._id, createdProducts[6]._id]
      },
      {
        name: "Urban Essentials",
        slug: "urban-essentials",
        type: "curated",
        description: "Must-have pieces for the modern city dweller.",
        image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=800&q=80",
        products: [createdProducts[1]._id, createdProducts[3]._id, createdProducts[4]._id, createdProducts[5]._id]
      }
    ];
    await Collection.insertMany(collectionsData);

    // 7. Create Orders
    console.log("Creating Orders for Analytics...");
    const ordersData = [];
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const paymentMethods = ['credit_card', 'paypal', 'cash_on_delivery'];

    // Generate 45 random orders spread over the last 30 days
    for (let i = 0; i < 45; i++) {
      const randomCustomer = customers[Math.floor(Math.random() * customers.length)];

      // Select 1 to 3 random products
      const numItems = Math.floor(Math.random() * 3) + 1;
      const orderItems = [];
      let total_amount = 0;

      for (let j = 0; j < numItems; j++) {
        const product = createdProducts[Math.floor(Math.random() * createdProducts.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const price = product.price - (product.discount || 0);

        // Find an available size
        const availableSizes = Object.keys(product.stock).filter(size => product.stock[size] > 0);
        const size = availableSizes.length > 0 ? availableSizes[0] : "M";

        orderItems.push({
          product_id: product._id,
          name: product.name,
          size: size,
          quantity: qty,
          price: price
        });
        total_amount += (price * qty);
      }

      // Random date within the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - daysAgo);

      // Random status (weighted somewhat towards success)
      const statusRoll = Math.random();
      let status = 'delivered';
      if (statusRoll < 0.1) status = 'cancelled';
      else if (statusRoll < 0.2) status = 'pending';
      else if (statusRoll < 0.5) status = 'shipped';
      else if (statusRoll < 0.7) status = 'processing';

      ordersData.push({
        user_id: randomCustomer._id,
        items: orderItems,
        total_amount: total_amount + 10, // Add simple flat $10 shipping
        status: status,
        refund_status: status === 'cancelled' ? 'completed' : 'none',
        shipping_address: {
          fullName: randomCustomer.full_name,
          phone: "123-456-7890",
          street: "123 Random St",
          city: "Metropolis",
          country: "USA",
          postalCode: "10001"
        },
        payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        created_at: orderDate,
        updated_at: orderDate
      });
    }

    await Order.insertMany(ordersData);

    // 8. Create Reviews
    console.log("Creating Reviews...");
    const reviewsData = [];
    customers.forEach(customer => {
      // Each customer reviews 2 random things
      for (let i = 0; i < 2; i++) {
        const product = createdProducts[Math.floor(Math.random() * createdProducts.length)];
        // Random rating logic (mostly good)
        const rating = Math.random() > 0.2 ? 5 : 4;
        const comments = [
          "Absolutely love the quality!", "Fits perfectly, totally recommend.", "Good material but delivery took a while.",
          "Stunning color and feels premium.", "My favorite purchase this year!"
        ];

        reviewsData.push({
          productId: product._id,
          userId: customer._id,
          userName: customer.full_name,
          rating: rating,
          comment: comments[Math.floor(Math.random() * comments.length)],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    // Ignore duplicate entries based on unique index via try-catch or safe iteration
    for (const r of reviewsData) {
      try {
        await new Review(r).save();
      } catch (e) {
        // Skip duplicates
      }
    }

    console.log("✅ Database Seeding Completed Successfully! The dashboard should look beautiful now.");
    process.exit(0);

  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exit(1);
  }
};

runSeed();
