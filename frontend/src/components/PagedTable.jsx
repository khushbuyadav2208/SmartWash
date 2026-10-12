import {EmptyState} from './WorkspaceUI';
import {Children,cloneElement,isValidElement,useState} from 'react';
// Retain each portal's table markup while adding keyboard accessible page controls.
export default function PagedTable({children,emptyTitle="No records to show",emptyDescription="Records will appear here when available. Try clearing your filters."}){
 const [requested,setPage]=useState(1);let count=0;const size=10;
 const transform=node=>{if(!isValidElement(node))return node;if(node.type==='tbody'){const rows=Children.toArray(node.props.children).filter(isValidElement);count=rows.length;const page=Math.min(requested,Math.max(1,Math.ceil(count/size)));return cloneElement(node,{},rows.slice((page-1)*size,page*size));}if(node.props.children)return cloneElement(node,{},Children.map(node.props.children,transform));return node;};
 const table=Children.map(children,transform),pages=Math.max(1,Math.ceil(count/size)),page=Math.min(requested,pages);
 return <><div className="custom-table-container">{table}</div>{!count&&<EmptyState title={emptyTitle} description={emptyDescription}/>}{count>size&&<nav className="table-pagination" aria-label="Table pages"><button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous page</button><span>{page} / {pages} · {count} records</span><button className="btn btn-secondary" disabled={page===pages} onClick={()=>setPage(page+1)}>Next page</button></nav>}</>;
}
