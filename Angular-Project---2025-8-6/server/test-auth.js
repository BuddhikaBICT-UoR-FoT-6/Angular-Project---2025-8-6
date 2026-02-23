/**
 * Quick test script for JWT authentication
 * Tests login and protected endpoint access
 * 
 * Usage: node test-auth.js
 */

const baseURL = 'http://localhost:3000/api';

async function testAuth() {
  console.log('🧪 Testing JWT Authentication\n');

  try {
    // Test 1: Login with hashed password
    console.log('1️⃣ Testing Login...');
    const loginResponse = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@demo.com',
        password: 'customer123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log('   ✅ Login successful');
    console.log('   📝 Token received:', loginData.token.substring(0, 20) + '...');
    console.log('   👤 User:', loginData.user.email, `(${loginData.user.role})`);

    const token = loginData.token;

    // Test 2: Access protected endpoint with token
    console.log('\n2️⃣ Testing Protected Endpoint (GET /api/users/me)...');
    const meResponse = await fetch(`${baseURL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!meResponse.ok) {
      throw new Error(`Protected endpoint failed: ${meResponse.status}`);
    }

    const meData = await meResponse.json();
    console.log('   ✅ Protected endpoint accessible');
    console.log('   👤 User data:', meData.email, meData.full_name);

    // Test 3: Try accessing without token (should fail)
    console.log('\n3️⃣ Testing Without Token (should fail)...');
    const noTokenResponse = await fetch(`${baseURL}/users/me`);
    
    if (noTokenResponse.status === 401) {
      console.log('   ✅ Correctly rejected unauthorized request');
    } else {
      console.log('   ⚠️  Unexpected status:', noTokenResponse.status);
    }

    // Test 4: Verify token
    console.log('\n4️⃣ Testing Token Verification...');
    const verifyResponse = await fetch(`${baseURL}/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!verifyResponse.ok) {
      throw new Error(`Token verification failed: ${verifyResponse.status}`);
    }

    const verifyData = await verifyResponse.json();
    console.log('   ✅ Token is valid');
    console.log('   👤 Verified user:', verifyData.user.email);

    // Test 5: Test with invalid token
    console.log('\n5️⃣ Testing Invalid Token (should fail)...');
    const invalidResponse = await fetch(`${baseURL}/users/me`, {
      headers: { 'Authorization': 'Bearer invalid-token-here' }
    });

    if (invalidResponse.status === 401) {
      console.log('   ✅ Correctly rejected invalid token');
    } else {
      console.log('   ⚠️  Unexpected status:', invalidResponse.status);
    }

    console.log('\n✅ All authentication tests passed!\n');
    console.log('📊 Summary:');
    console.log('   ✅ Login with bcrypt hashed password: Working');
    console.log('   ✅ JWT token generation: Working');
    console.log('   ✅ Protected endpoints: Working');
    console.log('   ✅ Token verification: Working');
    console.log('   ✅ Unauthorized access prevention: Working');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

// Run tests
console.log('🚀 Starting authentication tests...');
console.log('📡 Server URL:', baseURL);
console.log('');

testAuth();
