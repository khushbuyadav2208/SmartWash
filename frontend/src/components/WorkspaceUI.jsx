import {Inbox, ArrowUpRight} from 'lucide-react';
export function MetricCard({label,value,detail,icon:Icon,tone='blue'}) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span>{Icon&&<span className="metric-icon"><Icon size={18}/></span>}</div><strong className="metric-value">{value??'—'}</strong><p>{detail}</p></article>;
}
export function EmptyState({title,description,action,onAction,icon:Icon=Inbox}) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={25}/></span><h4>{title}</h4><p>{description}</p>{action&&<button className="btn btn-primary" onClick={onAction}>{action}<ArrowUpRight size={16}/></button>}</div>;
}
export function WorkspaceSkeleton(){return <div className="workspace-skeleton" role="status" aria-label="Loading workspace"><span className="skeleton skeleton-heading"/><div className="skeleton-grid">{[0,1,2].map(i=><span key={i} className="skeleton skeleton-card"/>)}</div><span className="skeleton skeleton-panel"/><span className="sr-only">Loading workspace…</span></div>;}
export function StatusBadge({status}){return <span className={`badge badge-${(status||'unknown').split(' ')[0].toLowerCase()}`}><i/>{status||'Unknown'}</span>;}
