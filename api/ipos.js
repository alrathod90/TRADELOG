import { fetchMainboardIpos } from './lib/ipo-gmp.js';

export default async function handler(_req, res) {
  try {
    const { ipos, sourceUrl } = await fetchMainboardIpos();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ipos,
      sourceUrl,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ipos endpoint error:', error);
    return res.status(502).json({ error: 'Could not fetch mainboard IPO data. Please try again shortly.' });
  }
}
