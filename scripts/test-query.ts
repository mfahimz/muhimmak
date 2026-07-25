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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env');
    return;
  }
  const url = `${supabaseUrl}/rest/v1/`;
  const res = await fetch(url, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    }
  });
  const spec = await res.json();
  console.log('rls_auto_enable path definition:', JSON.stringify(spec.paths['/rpc/rls_auto_enable'], null, 2));
  console.log('has_permission path definition:', JSON.stringify(spec.paths['/rpc/has_permission'], null, 2));
}

run().catch(console.error);
