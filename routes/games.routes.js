import express from 'express';
import axios from 'axios';

const router = express.Router();

/**
 * GET /api/games/search?q=counter+strike
 * Proxies to Steam's store search API to avoid browser CORS issues.
 */
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ items: [] });
  }

  try {
    const { data } = await axios.get('https://store.steampowered.com/api/storesearch/', {
      params: { term: q.trim(), l: 'english', cc: 'US' },
      timeout: 8000,
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });

    const items = (data?.items || []).slice(0, 8).map(item => ({
      appid: item.id,
      name: item.name,
      image: item.tiny_header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/capsule_sm_120.jpg`,
    }));

    res.json({ items });
  } catch (err) {
    console.error('[games/search] Steam API error:', err.message);
    res.status(502).json({ items: [], error: 'Steam search unavailable' });
  }
});

export default router;
