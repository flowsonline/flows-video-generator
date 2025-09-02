module.exports = async (req, res) => {
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
    if (!promptImage) throw new Error('Missing promptImage');

    const resp = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model: model || 'gen3_alpha',
        promptImage,
        promptText: promptText || '',
        ratio: ratio || '768:1280',
        duration: Number(duration) || 5
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).send(t);
    }
    const data = await resp.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({ taskId: data.id });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Server error');
  }
};
