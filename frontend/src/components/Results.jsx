import React from "react";
import { fmtPct } from "../api.js";

export default function Results({ live }) {
  if (!live) return <div>No active question yet.</div>;
  const { q, options, votes = {}, total = 0 } = live;
  return (
    <div>
      <div style={{marginBottom:8}}><b>{q}</b></div>
      {options.map(o => {
        const v = votes[o] || 0;
        const pct = fmtPct(v, Math.max(1,total));
        return (
          <div key={o} style={{marginBottom:8}}>
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <span>{o}</span><span>{v} ({fmtPct(v, total)}%)</span>
            </div>
            <div style={{height:10, background:"#eee", borderRadius:8, overflow:"hidden", border:"1px solid #ddd"}}>
              <div style={{height:"100%", width:`${pct}%`, background:"#222"}} />
            </div>
          </div>
        );
      })}
      <div className="badge">Total responses: {total}</div>
    </div>
  );
}
