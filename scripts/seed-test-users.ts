import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  {
    name: 'Test CEO',
    email: 'ceo@muhimmak.local',
    role: 'ceo',
    pin: '1234',
  },
  {
    name: 'Test AGM',
    email: 'agm@muhimmak.local',
    role: 'agm',
    pin: '1234',
  },
  {
    name: 'Test Manager',
    email: 'manager@muhimmak.local',
    role: 'manager',
    pin: '1234',
  },
  {
    name: 'Test Receptionist',
    email: 'receptionist@muhimmak.local',
    role: 'receptionist',
    pin: '1234',
  },
];

async function seed() {
  console.log('Starting seeding of test users...');

  for (const user of TEST_USERS) {
    console.log(`Processing: ${user.name} (${user.role})`);

    // 1. Check if user already exists in auth.users by email
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error(`Error listing users: ${listError.message}`);
      continue;
    }

    let authUser = usersData.users.find((u) => u.email === user.email);

    if (!authUser) {
      // Create new user in auth
      const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: `secure_pass_${Math.random().toString(36).slice(-8)}`,
        email_confirm: true,
        user_metadata: {
          full_name: user.name,
          role: user.role, // Pass the role in metadata to satisfy trigger/constraints
        },
      });

      if (createError) {
        console.error(`Failed to create auth user for ${user.name}: ${createError.message}`);
        continue;
      }

      authUser = newUserData.user;
      console.log(`Created auth user: ${user.email} (ID: ${authUser.id})`);
    } else {
      console.log(`Auth user already exists: ${user.email} (ID: ${authUser.id})`);
    }

    // 2. Hash the PIN
    const pinHash = await bcrypt.hash(user.pin, 10);

    // 3. Upsert the profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authUser.id,
      full_name: user.name,
      role: user.role,
      pin_hash: pinHash,
      is_active: true,
      preferred_locale: 'en',
    });

    if (profileError) {
      console.error(`Failed to upsert profile for ${user.name}: ${profileError.message}`);
    } else {
      console.log(`Successfully upserted profile for ${user.name}`);
    }
  }

  // 4. Verify profiles exist
  console.log('\nVerifying profiles in DB:');
  const { data: profiles, error: selectError } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active');

  if (selectError) {
    console.error(`Error selecting profiles: ${selectError.message}`);
  } else {
    console.log('Current profiles in database:');
    profiles.forEach((p) => {
      console.log(`- ${p.full_name} | Role: ${p.role} | Active: ${p.is_active} | ID: ${p.id}`);
    });
  }
}

seed().catch((err) => {
  console.error('Seeding crashed:', err);
  process.exit(1);
});
