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
    const { promptText, ratio } = req.body || {};
    const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
    if (!RUNWAY_API_KEY) throw new Error('Missing RUNWAY_API_KEY');
    if (!promptText) throw new Error('Missing promptText');

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

    const resp = await fetch('https://api.dev.runwayml.com/v1/text_to_image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model: 'gen4_image',
        promptText,
        ratio: ratioOut
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).send(t);
    }
    const data = await resp.json();

    // Wait for the task result by polling /tasks/{id}
    const taskId = data.id;
    const taskUrl = `https://api.dev.runwayml.com/v1/tasks/${taskId}`;

    let outputUrl = null;
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
        outputUrl = tj.output?.[0] || null;
        break;
      }
      if (tj.status === 'FAILED' || tj.status === 'CANCELED') {
        return res.status(500).json({ error: 'text_to_image failed', details: tj });
      }

      await new Promise(r => setTimeout(r, 4000 + Math.random() * 800));

      if (Date.now() - start > 8 * 60 * 1000) {
        return res.status(504).json({ error: 'Timeout waiting for image', taskId });
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({ imageUrl: outputUrl, taskId });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Server error');
  }
};
