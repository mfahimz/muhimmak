import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
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

  // Admin client to generate a magic link token
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Client to authenticate as the target user (authenticated role)
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

  console.log('Querying sessions table with profiles join...');
  const { data: sessionsData, error: sessionsError } = await userClient
    .from('sessions')
    .select('created_by, profiles:created_by ( full_name )');

  if (sessionsError) {
    console.error('Query failed:', sessionsError);
  } else {
    console.log('Query succeeded!');
    console.log('Result data:', sessionsData);
  }
}

run().catch(console.error);
