import { serve } from 'https://deno.land/std@0.168.0/http/server';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const config = {
  cors: {
    origin: '*',
    methods: ['POST'],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
};

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: config.cors });
  }

  try {
    const supabaseUrl = url.searchParams.get('supabaseUrl') || 'https://htglmpydebyfcazhhojo.supabase.co';
    const serviceRoleKey = url.searchParams.get('serviceRoleKey') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: verifyError } = await adminClient.auth.getUser(token);
    if (verifyError || !caller) {
      return json({ error: '令牌无效或已过期' }, 401);
    }

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || !callerProfile.is_admin) {
      return json({ error: '权限不足，仅管理员可执行此操作' }, 403);
    }

    const { email, nickname = '' } = await req.json();
    if (!email) {
      return json({ error: '邮箱不能为空' }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ error: '邮箱格式不正确' }, 400);
    }

    const { data: existingUser } = await adminClient.auth.admin.getUserByEmail(email);
    if (existingUser) {
      return json({ error: '该邮箱已被注册' }, 409);
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: 'Aa123456',
      email_confirm: true,
      data: { nickname: nickname || '新用户' },
    });

    if (createError) {
      return json({ error: `创建用户失败：${createError.message}` }, 500);
    }

    if (newUser?.user?.id) {
      const { error: upsertError } = await adminClient
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          email,
          nickname: nickname || '新用户',
          is_admin: false,
        });

      if (upsertError) {
        console.error('Profile upsert error:', upsertError);
      }
    }

    return json({
      success: true,
      user_id: newUser?.user?.id,
      email,
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return json({ error: err.message || '服务器内部错误' }, 500);
  }
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
