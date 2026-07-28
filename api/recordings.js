export default async function handler(req, res) {
  try {
    const response = await fetch('http://185.102.75.229:8091/recordings');
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
