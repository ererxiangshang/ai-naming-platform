import { readHistory, getSupabase } from './_supabase.js';

/**
 * GET /api/history
 * 返回最近的起名历史（从 Supabase 读）。
 */
export default async function handler(req, res) {
  try {
    if (!getSupabase()) {
      res.status(200).json({ rows: [], warning: 'Supabase 未配置，历史记录暂不可用' });
      return;
    }
    const { rows } = await readHistory(20);
    res.status(200).json({ rows });
  } catch (err) {
    res.status(500).json({ rows: [], error: err.message });
  }
}
