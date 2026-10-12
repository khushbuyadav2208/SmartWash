import {useEffect,useRef} from 'react';
export default function Modal({title,onClose,children}){
  const ref=useRef(null);const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const el=ref.current,previous=document.activeElement;el.showModal();const cancel=e=>{e.preventDefault();close.current();};el.addEventListener('cancel',cancel);return()=>{el.removeEventListener('cancel',cancel);el.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="record-dialog" aria-label={title}><header className="section-heading"><h3>{title}</h3><button className="btn btn-secondary" onClick={onClose} aria-label={`Close ${title}`}>Close</button></header>{children}</dialog>;
}
