// Test script to verify Supabase connection
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

console.log('Testing Supabase connection...');
console.log('URL:', process.env.SUPABASE_URL);
console.log('Key exists:', !!process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
    try {
        // Try to query projects table
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('❌ Connection failed:', error.message);
            if (error.message.includes('relation') || error.message.includes('does not exist')) {
                console.log('⚠️  Tables may not be created yet. Run migrations first.');
            }
        } else {
            console.log('✅ Connection successful!');
            console.log('Found', data?.length || 0, 'projects');
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
    
    process.exit(0);
}

testConnection();