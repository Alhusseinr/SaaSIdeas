// Test the Railway Ideas Service locally
const fetch = require('node-fetch');
const dotenv = require('dotenv');

dotenv.config();

const BASE_URL = 'http://localhost:3000';

async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check passed:', data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testIdeasGeneration() {
  console.log('🔍 Testing ideas generation...');
  try {
    const response = await fetch(`${BASE_URL}/generate-ideas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: `test_${Date.now()}`,
        platform: 'all',
        days: 7,
        limit: 100, // Small limit for testing
        similarity_threshold: 0.5, // Lower threshold for more clusters
        min_cluster_size: 2,
        enable_automation_boost: true,
        enable_validation: false, // Skip validation for faster testing
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Ideas generation test passed:');
      console.log(`   - Ideas generated: ${data.ideas_generated}`);
      console.log(`   - Clusters processed: ${data.clusters_processed}`);
      console.log(`   - Posts processed: ${data.posts_processed}`);
      console.log(`   - Duration: ${data.duration_readable}`);
      console.log(`   - Run ID: ${data.run_id}`);
      return true;
    } else {
      console.error('❌ Ideas generation test failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Ideas generation test failed:', error.message);
    return false;
  }
}

async function testServiceEndpoint() {
  console.log('🔍 Testing service info endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/`);
    const data = await response.json();
    console.log('✅ Service info:', data);
    return true;
  } catch (error) {
    console.error('❌ Service info test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Railway Ideas Service Tests\n');

  const results = [];

  results.push(await testServiceEndpoint());
  results.push(await testHealthEndpoint());
  
  console.log('\n⚠️  Testing ideas generation (this may take a few minutes)...');
  results.push(await testIdeasGeneration());

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed! Service is ready for deployment.');
  } else {
    console.log('❌ Some tests failed. Please check the configuration and try again.');
    process.exit(1);
  }
}

// Check if required environment variables are set
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please set them in your .env file');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set - ideas generation will be limited');
}

runTests();