import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 客户端（可选）。
 * 只配置了 SUPABASE_URL + SUPABASE_ANON_KEY 时才会创建；
 * 没配置也不影响起名功能，只是不保存历史。
 */
let client = null;

export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes('你的')) return null;
  client = createClient(url, anonKey, { auth: { persistSession: false } });
  return client;
}

/** 保存一条起名历史；任何异常都只打日志，不打断主流程 */
export async function saveHistory({ requirement, result, modelName }) {
  const sb = getSupabase();
  if (!sb) return { saved: false, reason: 'supabase 未配置' };
  try {
    const { data, error } = await sb
      .from('name_history')
      .insert({ user_requirement: requirement, name_result: result, model_name: modelName })
      .select('id')
      .single();
    if (error) throw error;
    return { saved: true, id: data?.id ?? null };
  } catch (err) {
    console.error('[supabase] 保存历史失败：', err.message);
    return { saved: false, reason: err.message };
  }
}

/** 读取最近的历史记录 */
export async function readHistory(limit = 20) {
  const sb = getSupabase();
  if (!sb) return { rows: [], reason: 'supabase 未配置' };
  const { data, error } = await sb
    .from('name_history')
    .select('id,user_requirement,name_result,model_name,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { rows: data || [] };
}
