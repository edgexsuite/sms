// supabase/functions/create-staff-user/index.ts
// Always returns HTTP 200. Errors are in { error: "message" }, success in { success: true } or { user_id, email }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ok  = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

const err = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) return err('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body   = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (!action) return err('Missing action field');

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { email, password, school_id, role, staff_id, permissions } = body;
      if (!email)     return err('email is required');
      if (!password)  return err('password is required');
      if (!school_id) return err('school_id is required');
      if (!role)      return err('role is required');
      if (!staff_id)  return err('staff_id is required');

      // 1. Create auth user
      let uid: string;
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { school_id, role },
      });

      if (authErr) {
        if (authErr.message.includes('already been registered') || authErr.message.includes('already exists')) {
          // User exists — lookup directly in auth
          const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
          const user = users.find((u: any) => u.email === email);
          
          if (listErr || !user) {
             return err('Auth error: ' + authErr.message + ' (and fallback lookup failed)');
          }
          uid = user.id;
          
          // Optional: update metadata to include this school if needed (keeping it simple for now)
        } else {
          return err('Auth error: ' + authErr.message);
        }
      } else {
        uid = authData.user.id;
      }

      // 2. Insert user_roles row
      const { error: roleErr } = await admin.from('user_roles').insert({
        user_id:     uid,
        school_id,
        role,
        staff_id,
        permissions: permissions ?? {},
        is_active:   true,
      });

      if (roleErr) {
        // If it's a duplicate key error, it means the user already has a role here
        if (roleErr.code === '23505') {
           return err('Account already exists: This user already has an active role in this school.');
        }
        // If we just created the auth user, we should roll back (delete them)
        // But if they were an existing user, we should NOT delete them.
        if (!authErr) {
          await admin.auth.admin.deleteUser(uid); 
        }
        return err('user_roles insert error: ' + roleErr.message);
      }

      // 3. Update staff record
      const { error: staffErr } = await admin.from('staff')
        .update({ user_id: uid, has_login: true })
        .eq('id', staff_id);
      if (staffErr) {
        console.warn('staff update warning:', staffErr.message);
      }

      return ok({ user_id: uid, email, linked_existing: !!authErr });
    }

    // ── RESET PASSWORD ────────────────────────────────────────────────────────
    if (action === 'reset_password') {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) return err('user_id and new_password are required');

      const { error: e } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
      if (e) return err('Reset error: ' + e.message);
      return ok({ success: true });
    }

    // ── REVOKE ACCESS ─────────────────────────────────────────────────────────
    if (action === 'revoke') {
      const { user_id, staff_id } = body;
      if (!user_id) return err('user_id is required');

      await admin.from('user_roles').delete().eq('user_id', user_id);
      if (staff_id) {
        await admin.from('staff').update({ user_id: null, has_login: false }).eq('id', staff_id);
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) return err('Delete auth user error: ' + delErr.message);
      return ok({ success: true });
    }

    return err('Unknown action: ' + action);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return err('Unexpected error: ' + msg);
  }
});
