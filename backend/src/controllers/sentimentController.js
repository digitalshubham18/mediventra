const Feedback = require('../models/Feedback');

// A simple, transparent lexicon-based sentiment/bottleneck scorer over
// real patient feedback comments — not a trained ML model (that would
// need a licensed NLP service), but genuinely useful for surfacing
// recurring complaint themes and isn't dressed up as more than it is.
const NEGATIVE_KEYWORDS = ['wait', 'rude', 'delay', 'dirty', 'slow', 'unhygienic', 'expensive', 'unclean', 'noisy', 'cold', 'unprofessional', 'late', 'crowded', 'confusing', 'unresponsive'];
const POSITIVE_KEYWORDS = ['clean', 'friendly', 'quick', 'helpful', 'professional', 'caring', 'excellent', 'comfortable', 'polite', 'efficient', 'attentive'];

function scoreComment(text) {
  const t = (text || '').toLowerCase();
  let pos = 0, neg = 0;
  const hitNeg = [], hitPos = [];
  NEGATIVE_KEYWORDS.forEach(k => { if (t.includes(k)) { neg++; hitNeg.push(k); } });
  POSITIVE_KEYWORDS.forEach(k => { if (t.includes(k)) { pos++; hitPos.push(k); } });
  return { pos, neg, hitPos, hitNeg };
}

// GET /api/sentiment — aggregate sentiment + top bottleneck keywords by category
exports.getSentimentReport = async (req, res) => {
  try {
    const feedback = await Feedback.find().select('category rating message createdAt');

    const byCategory = {};
    const keywordCounts = {};

    feedback.forEach(f => {
      const cat = f.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, totalRating: 0, negativeCommentCount: 0 };
      byCategory[cat].count++;
      byCategory[cat].totalRating += f.rating;

      const { neg, hitNeg } = scoreComment(f.message);
      if (neg > 0) byCategory[cat].negativeCommentCount++;
      hitNeg.forEach(k => { keywordCounts[k] = (keywordCounts[k] || 0) + 1; });
    });

    const categorySummary = Object.entries(byCategory).map(([category, d]) => ({
      category,
      avgRating: Math.round((d.totalRating / d.count) * 10) / 10,
      count: d.count,
      negativeCommentRate: Math.round((d.negativeCommentCount / d.count) * 100),
    })).sort((a,b) => a.avgRating - b.avgRating); // worst first — the bottlenecks

    const topBottleneckKeywords = Object.entries(keywordCounts)
      .sort((a,b) => b[1] - a[1]).slice(0, 8)
      .map(([keyword, count]) => ({ keyword, count }));

    res.json({
      success: true,
      data: { categorySummary, topBottleneckKeywords, totalFeedback: feedback.length },
      method: 'Keyword-based sentiment scoring over feedback comments (not a trained ML model)',
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
