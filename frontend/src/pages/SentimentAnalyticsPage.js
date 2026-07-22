import React, { useState, useEffect } from 'react';
import { sentimentAPI } from '../utils/api';

export default function SentimentAnalyticsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sentimentAPI.getReport().then(res => setReport(res.data.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">💬 Sentiment Analytics</div>
          <div className="page-subtitle">Keyword-based bottleneck detection over real patient feedback — surfaces recurring complaint themes by department</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading…</div>
      ) : !report || report.totalFeedback === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No feedback submitted yet.</div>
      ) : (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><span className="card-title">Bottlenecks by Category (worst first)</span></div>
            <div className="card-body">
              {report.categorySummary.map(c => (
                <div key={c.category} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 13px', background:'#f8fafc', borderRadius:9, marginBottom:8 }}>
                  <span style={{ textTransform:'capitalize', fontWeight:600, fontSize:13.5 }}>{c.category.replace('_',' ')}</span>
                  <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>{c.count} responses</span>
                    <span style={{ fontSize:12, color:'#dc2626' }}>{c.negativeCommentRate}% negative</span>
                    <span style={{ fontSize:15, fontWeight:800, color: c.avgRating<3 ? '#dc2626' : c.avgRating<4 ? '#d97706' : '#059669' }}>{c.avgRating}★</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Most-Mentioned Complaint Words</span></div>
            <div className="card-body">
              {report.topBottleneckKeywords.length === 0 ? (
                <div style={{ textAlign:'center', padding:16, color:'#94a3b8', fontSize:12.5 }}>No recurring complaint keywords detected.</div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {report.topBottleneckKeywords.map(k => (
                    <span key={k.keyword} style={{ padding:'6px 14px', background:'#fef2f2', color:'#b91c1c', borderRadius:16, fontSize:13, fontWeight:700 }}>{k.keyword} ({k.count})</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize:11, color:'#cbd5e1', marginTop:16 }}>Keyword-based scoring over feedback comments — not a trained ML model, but a transparent, genuinely useful signal.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
