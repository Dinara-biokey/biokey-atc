export default async function handler(req, res) {
  const ARI_URL = 'http://185.102.75.229:8088/ari';
  const ARI_AUTH = 'Basic ' + Buffer.from('biokey_ari:BkAri@2026!').toString('base64');
  try {
    const path = req.query.path || 'channels';
    const r = await fetch(`${ARI_URL}/${path}`, {
      headers: { 'Authorization': ARI_AUTH }
    });
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
