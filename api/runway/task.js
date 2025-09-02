module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  const { id } = req.query || {};
  if (!id) return res.status(400).send('Missing id');
  try {
    const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
    const r = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, {
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      }
    });
    const j = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({ status: j.status, output: j.output || null, details: j });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};
