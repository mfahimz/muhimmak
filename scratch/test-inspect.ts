import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Missing env vars');
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Generating link for ceo@muhimmak.local...');
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'ceo@muhimmak.local',
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('Error generating link:', linkError);
    return;
  }

  console.log('Authenticating client via verifyOtp...');
  const { error: verifyError } = await userClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    console.error('Authentication failed:', verifyError);
    return;
  }

  console.log('Querying forms table...');
  const { data: formsData, error: formsError } = await userClient
    .from('forms')
    .select('*');

  if (formsError) {
    console.error('Forms Query failed:', formsError);
  } else {
    console.log(`Forms found: ${formsData.length}`);
    console.log('Forms:', JSON.stringify(formsData, null, 2));
  }

  console.log('Querying form_types table...');
  const { data: typesData, error: typesError } = await userClient
    .from('form_types')
    .select('*');

  if (typesError) {
    console.error('Form Types Query failed:', typesError);
  } else {
    console.log(`Form Types found: ${typesData.length}`);
    console.log('Form Types:', JSON.stringify(typesData, null, 2));
  }
}

run().catch(console.error);
