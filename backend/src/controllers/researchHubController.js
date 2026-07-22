// Pulls real recent articles from PubMed's public E-utilities API
// (National Library of Medicine — no API key required for light,
// non-commercial use) filtered by the doctor's specialty. This is
// genuinely live medical literature, not a mock feed.
const ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

// GET /api/research-hub?query=cardiology
exports.getFeed = async (req, res) => {
  try {
    const query = req.query.query || req.user.specialization || 'general medicine';
    const searchUrl = `${ESEARCH}?db=pubmed&retmode=json&retmax=10&sort=pub+date&term=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (!ids.length) return res.json({ success: true, data: [] });

    const summaryUrl = `${ESUMMARY}?db=pubmed&retmode=json&id=${ids.join(',')}`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json();

    const articles = ids.map(id => {
      const item = summaryData.result?.[id];
      if (!item) return null;
      return {
        pmid: id,
        title: item.title,
        journal: item.fulljournalname || item.source,
        authors: (item.authors || []).slice(0, 3).map(a => a.name).join(', '),
        pubDate: item.pubdate,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      };
    }).filter(Boolean);

    res.json({ success: true, data: articles, query });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Couldn\u2019t reach PubMed right now. Please try again shortly.' });
  }
};
