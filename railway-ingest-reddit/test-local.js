// Quick test script for local development
const dotenv = require('dotenv');
dotenv.config();

async function testLocalServer() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing local Railway server...\n');
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test small ingestion
    console.log('\n2. Testing small ingestion (10 posts)...');
    const ingestResponse = await fetch(`${baseUrl}/ingest-reddit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_posts: 10,
        use_all_reddit: true
      })
    });
    
    const ingestData = await ingestResponse.json();
    console.log('✅ Small ingestion result:', {
      success: ingestData.success,
      posts_fetched: ingestData.posts_fetched,
      posts_stored: ingestData.posts_stored,
      duration: ingestData.duration_readable
    });
    
    console.log('\n🎉 Local server is working! Ready for Railway deployment.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure to:');
    console.log('1. Create .env file with your credentials');
    console.log('2. Run: npm run dev');
    console.log('3. Check environment variables in .env');
  }
}

// Only run if called directly
if (require.main === module) {
  testLocalServer();
}

module.exports = { testLocalServer };