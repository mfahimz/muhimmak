import { createClient as createServerClient } from '@/lib/supabase/server';
import { LoginForm, type StaffDirectoryEntry } from '@/components/auth/LoginForm';

export default async function LoginPage() {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('staff_directory')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  const staff: StaffDirectoryEntry[] = data ?? [];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <LoginForm initialStaff={staff} />
    </div>
  );
}
