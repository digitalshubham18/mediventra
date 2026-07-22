import React, { useState, useEffect } from 'react';
import { researchHubAPI } from '../utils/api';
import toast from 'react-hot-toast';

export default function ResearchHubPage() {
  const [query, setQuery] = useState('');
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  const search = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try { const res = await researchHubAPI.getFeed(query); setFeed(res.data.data || []); }
    catch { toast.error('Couldn\u2019t reach PubMed right now'); }
    setLoading(false);
  };

  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📚 Research Hub</div>
          <div className="page-subtitle">Live feed of clinical trials and medical journal articles from PubMed, filtered by your specialty</div>
        </div>
      </div>

      <form onSubmit={search} style={{ display:'flex', gap:10, marginBottom:20, maxWidth:520 }}>
        <input className="form-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a topic (defaults to your specialty)…" />
        <button className="btn btn-primary" disabled={loading}>{loading?'Searching…':'🔍 Search'}</button>
      </form>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : feed.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No articles found — try a different search term.</div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {feed.map(a => (
            <a key={a.pmid} href={a.url} target="_blank" rel="noreferrer" className="card" style={{ padding:16, textDecoration:'none', display:'block' }}>
              <div style={{ fontWeight:700, fontSize:14.5, color:'#1648c9', marginBottom:5 }}>{a.title}</div>
              <div style={{ fontSize:12.5, color:'#64748b' }}>{a.journal} · {a.pubDate}</div>
              {a.authors && <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:4 }}>{a.authors}</div>}
            </a>
          ))}
        </div>
      )}
      <div style={{ fontSize:11, color:'#cbd5e1', marginTop:16 }}>Live feed from PubMed (National Library of Medicine) — real, current medical literature.</div>
    </div>
  );
}
