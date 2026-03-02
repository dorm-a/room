const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

require('dotenv').config({ path: 'e:/01.Room_info/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    const dummyFileContent = 'dummy image content';

    const { data, error } = await supabase.storage
        .from('floor_plan_imgs')
        .upload('test_image.txt', dummyFileContent, {
            contentType: 'text/plain',
            upsert: true
        });

    if (error) {
        console.error('Upload Error:', error);
    } else {
        console.log('Upload Success:', data);
    }
}

testUpload();
