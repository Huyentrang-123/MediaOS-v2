'use strict';
const express = require('express');
const router = express.Router();
const config = require('../config');

router.post('/translate', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Trường text là bắt buộc' });
    }
    if (!config.anthropicApiKey) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY chưa được cấu hình trên server' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Bạn là dịch giả chuyên nghiệp. Hãy dịch đoạn văn bản sau từ tiếng Trung phồn thể (Đài Loan) sang tiếng Việt tự nhiên, chính xác. Chỉ trả về bản dịch, không giải thích:\n\n${text.trim()}`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `Anthropic lỗi: ${response.status}`;
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    res.json({ translation: data.content[0].text });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
