const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Config from environment variables (set in Railway dashboard)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID || '220218956';
const MODEL = process.env.MODEL || 'openai/gpt-4o-mini';
const CITY = process.env.CITY || 'Киев и область';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

// Generate text (caption + hashtags + image prompt)
app.post('/api/generate-text', async (req, res) => {
  const { desc, postType, imgStyle, lang, userId } = req.body;

  // Check owner
  if (String(userId) !== String(OWNER_TELEGRAM_ID)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'API ключ не настроен на сервере' });
  }

  const langMap = { ukrainian: 'Ukrainian', russian: 'Russian', english: 'English' };
  const langName = langMap[lang] || 'Ukrainian';

  const prompt = `You are an Instagram content manager for STELIO — professional stretch ceiling installation company in ${CITY}, Ukraine.

Post type: ${postType}
Description: "${desc}"

Write an engaging Instagram post in ${langName} language. Respond ONLY with valid JSON object, no markdown, no extra text:
{"caption":"3-4 sentences, friendly tone, 1-2 emojis, end with call to action","hashtags":"25 relevant hashtags space-separated, mix local and English tags","image_prompt":"detailed English image generation prompt, style: ${imgStyle}, square 1:1, photorealistic, NO text, NO watermarks, NO logos"}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stelio.com.ua',
        'X-Title': 'STELIO Instagram Bot'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenRouter error' });
    }

    let raw = data.choices?.[0]?.message?.content || '';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(500).json({ error: 'Модель не вернула JSON' });
    }

    const parsed = JSON.parse(match[0]);
    res.json({ success: true, ...parsed });

  } catch (err) {
    console.error('Text generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate image via pollinations.ai (free, no key needed)
app.post('/api/generate-image', async (req, res) => {
  const { imagePrompt, userId } = req.body;

  if (String(userId) !== String(OWNER_TELEGRAM_ID)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(imagePrompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

  res.json({ success: true, imageUrl: url });
});

app.listen(PORT, () => {
  console.log(`STELIO Bot server running on port ${PORT}`);
});
