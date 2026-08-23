import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req) => {
  // CORS 预检
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 验证调用者身份
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "未授权" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: verifyError } = await adminClient.auth.getUser(token);
    if (verifyError || !caller) {
      return jsonResponse({ error: "令牌无效或已过期" }, 401);
    }

    // 验证管理员权限
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !callerProfile.is_admin) {
      return jsonResponse({ error: "权限不足，仅管理员可执行此操作" }, 403);
    }

    // 解析请求体
    const { email, nickname = "" } = await req.json();
    if (!email) {
      return jsonResponse({ error: "邮箱不能为空" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonResponse({ error: "邮箱格式不正确" }, 400);
    }

    // 检查邮箱是否已存在
    const { data: existingUser } = await adminClient.auth.admin.getUserByEmail(email);
    if (existingUser?.user) {
      return jsonResponse({ error: "该邮箱已被注册" }, 409);
    }

    // 创建用户
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: "Aa123456",
      email_confirm: true,
      data: { nickname: nickname || "新用户" },
    });

    if (createError) {
      return jsonResponse({ error: `创建用户失败：${createError.message}` }, 500);
    }

    // 写入 profiles 表
    if (newUser?.user?.id) {
      const { error: upsertError } = await adminClient
        .from("profiles")
        .upsert({
          id: newUser.user.id,
          email,
          nickname: nickname || "新用户",
          is_admin: false,
        });

      if (upsertError) {
        console.error("Profile upsert error:", upsertError);
      }
    }

    return jsonResponse({
      success: true,
      user_id: newUser?.user?.id,
      email,
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: err.message || "服务器内部错误" }, 500);
  }
});
