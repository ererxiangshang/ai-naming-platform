import { listModels } from './_models.js';

/**
 * GET /api/models
 * 前端下拉框的模型清单，以及每个模型是否已经配好密钥。
 */
export default function handler(req, res) {
  res.status(200).json({ models: listModels() });
}
