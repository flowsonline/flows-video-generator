// /api/runway/image_to_video.js
module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { promptImage, promptText, ratio, duration, model } = req.body || {};
    const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
    if (!RUNWAY_API_KEY) throw new Error('Missing RUNWAY_API_KEY');
    if (!promptImage) throw new Error('Missing promptImage'); // we require an image URL here

    // --- Normalize ratio to a value Runway accepts ---
    const MAP_ASPECT_TO_SIZE = {
      '16:9': '1280:720',
      '9:16': '720:1280',
      '1:1' : '1024:1024',
    };
    const ALLOWED_SIZES = new Set([
      '1024:1024','1080:1080','1168:880','1360:768','1440:1080','1080:1440',
      '1808:768','1920:1080','1080:1920','2112:912','1280:720','720:1280',
      '720:720','960:960','1584:672'
    ]);

    let ratioOut = ratio;
    if (MAP_ASPECT_TO_SIZE[ratioOut]) ratioOut = MAP_ASPECT_TO_SIZE[ratioOut];
    if (!ratioOut || !ALLOWED_SIZES.has(ratioOut)) ratioOut = '1280:720';
    // --- /Normalize ratio ---

    // Duration: make sure we send a safe integer (fallback 5s)
    let durationOut = parseInt(duration, 10);
    if (!Number.isFinite(durationOut) || durationOut <= 0) durationOut = 5;

    // Model: pass through, but default to a safe/cheap one
    const modelOut = (typeof model === 'string' && model.trim()) ? model.trim() : 'gen3_alpha';

    // Kick off the Runway job
    const resp = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model: modelOut,       // e.g. "gen3_alpha" | "gen3_alpha_turbo" | "gen4_turbo"
        promptImage,           // URL to the first frame image
        promptText: promptText || '', // optional guidance
        ratio: ratioOut,       // normalized pixel pair
        duration: durationOut  // seconds
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).send(t);
    }
    const data = await resp.json();

    // Poll for result
    const taskId = data.id;
    const taskUrl = `https://api.dev.runwayml.com/v1/tasks/${taskId}`;

    let outputs = null;
    const start = Date.now();

    while (true) {
      const poll = await fetch(taskUrl, {
        headers: {
          'Authorization': `Bearer ${RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06'
        }
      });

      if (!poll.ok) {
        const tt = await poll.text();
        return res.status(poll.status).send(tt);
      }

      const tj = await poll.json();
      if (tj.status === 'SUCCEEDED') {
        outputs = tj.output || null;
        break;
      }
      if (tj.status === 'FAILED' || tj.status === 'CANCELED') {
        return res.status(500).json({ error: 'image_to_video failed', details: tj });
      }

      await new Promise(r => setTimeout(r, 4000 + Math.random() * 800));

      if (Date.now() - start > 10 * 60 * 1000) {
        return res.status(504).json({ error: 'Timeout waiting for video', taskId });
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    // Most responses expose an array of URLs; the first is usually the playable MP4
    return res.json({
      videoUrl: Array.isArray(outputs) ? outputs[0] : null,
      outputs,
      taskId
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Server error');
  }
};
