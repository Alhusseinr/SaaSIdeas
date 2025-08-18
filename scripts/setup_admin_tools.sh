#!/bin/bash

# Setup script for subscription admin tools

echo "🚀 Setting up Subscription Admin Tools"
echo "======================================"
echo

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found"
    echo "Please create a .env.local file with your Supabase credentials first"
    exit 1
fi

# Check if required environment variables exist
if ! grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
    echo "Please add your Supabase URL to .env.local"
    exit 1
fi

if ! grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
    echo
    echo "To use the admin tools, you need to add your Supabase service role key:"
    echo "1. Go to your Supabase dashboard"
    echo "2. Navigate to Settings → API"
    echo "3. Copy the 'service_role' key (not the anon key)"
    echo "4. Add it to your .env.local file:"
    echo
    echo "   echo 'SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here' >> .env.local"
    echo
    echo "⚠️  Warning: This key has admin privileges. Keep it secure!"
    echo
    read -p "Press Enter when you've added the service role key..."
fi

# Install required dependencies
echo "📦 Installing required dependencies..."
npm install @supabase/supabase-js dotenv

echo
echo "✅ Setup complete!"
echo
echo "🎯 Available admin tools:"
echo
echo "1. Full-featured CLI script:"
echo "   node scripts/update_user_subscription_tier.js --help"
echo
echo "2. Simple ES module script:"
echo "   node scripts/update_subscription_simple.mjs user@example.com pro monthly"
echo
echo "3. TypeScript admin service (for code integration):"
echo "   See: src/lib/admin/subscriptionAdmin.ts"
echo
echo "4. REST API endpoint (requires ADMIN_API_KEY):"
echo "   POST /api/admin/subscription-update"
echo
echo "📚 Full documentation: docs/SUBSCRIPTION_ADMIN.md"
echo

# Test if everything works
echo "🧪 Testing configuration..."
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('❌ Configuration test failed - missing environment variables');
  process.exit(1);
}

const supabase = createClient(url, key);
console.log('✅ Configuration test passed - ready to use admin tools!');
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "🎉 All tests passed! You're ready to manage subscriptions."
else
    echo "❌ Configuration test failed. Please check your environment variables."
fi