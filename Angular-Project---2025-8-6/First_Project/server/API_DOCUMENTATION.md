# API Documentation

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "role": "customer",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "country": "USA"
  }
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "customer"
  }
}
```

#### POST /api/auth/login
Login with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "customer"
  }
}
```

#### GET /api/auth/verify
Verify if the current token is valid.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "customer"
  }
}
```

---

## User Endpoints

### GET /api/users
Get all users (Admin only).

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "customer",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /api/users/me
Get current user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "role": "customer",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "country": "USA"
  },
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/users
Create a new user (Admin only).

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "full_name": "Jane Smith",
  "role": "customer"
}
```

### PUT /api/users/:id
Update user profile (Admin or self).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "full_name": "John Updated",
  "phone": "+9876543210"
}
```

### DELETE /api/users/:id
Delete a user (Admin only).

**Headers:**
```
Authorization: Bearer <admin-token>
```

---

## Image Upload

### POST /api/uploads/images
Upload product images with automatic compression.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `images`: Image files (max 10 files, 10MB each)

**Features:**
- Automatic image compression
- Resizing to max 1200x1200px
- Quality optimization (85% JPEG)
- Format validation (JPEG, PNG, WebP)
- Cloudinary CDN hosting

**Response:**
```json
{
  "urls": [
    "https://res.cloudinary.com/your-cloud/image/upload/v123/clothingstore/products/image1.jpg",
    "https://res.cloudinary.com/your-cloud/image/upload/v123/clothingstore/products/image2.jpg"
  ],
  "count": 2,
  "message": "Images uploaded and compressed successfully"
}
```

**Error Response:**
```json
{
  "error": "Invalid images detected",
  "details": [
    "Image size exceeds 10MB limit",
    "Format gif not allowed. Allowed: jpeg, jpg, png, webp"
  ]
}
```

---

## Product Endpoints

### GET /api/products
Get all products (Public).

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Cotton T-Shirt",
    "description": "Comfortable cotton t-shirt",
    "category": "Shirts",
    "price": 29.99,
    "image": ["https://cloudinary.com/..."],
    "stock": { "S": 10, "M": 15, "L": 8 }
  }
]
```

### GET /api/products/:id
Get single product by ID.

### POST /api/products
Create new product (requires authentication).

### PUT /api/products/:id
Update product (requires authentication).

### DELETE /api/products/:id
Delete product (requires authentication).

---

## Security Features

### Password Security
- Passwords are hashed using bcrypt with 10 salt rounds
- Never stored in plain text
- Not returned in API responses

### JWT Tokens
- Tokens expire after 7 days (configurable)
- Include userId and role in payload
- Must be sent in Authorization header as Bearer token

### Image Processing
- Automatic validation before upload
- File size limits (10MB per file)
- Format restrictions (JPEG, PNG, WebP only)
- Dimension validation (100px - 5000px)
- Automatic compression to reduce storage costs

### Role-Based Access Control
- **customer**: Basic access to products, create orders
- **admin**: Manage products, inventory, users, orders
- **superadmin**: Full system access

---

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

Error response format:
```json
{
  "error": "Descriptive error message"
}
```
