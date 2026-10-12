import {useRef,useState,useEffect} from 'react';
import {ShieldAlert} from 'lucide-react';
import Modal from './Modal';
import {ConfirmContext as Context} from './confirmContext';
export default function ConfirmProvider({children}) {
  const [options,setOptions]=useState(null),resolver=useRef(null);
  useEffect(()=>()=>resolver.current?.(false),[]);
  const confirm=opts=>new Promise(resolve=>{resolver.current?.(false);resolver.current=resolve;setOptions(typeof opts==='string'?{description:opts}:opts);});
  const finish=value=>{resolver.current?.(value);resolver.current=null;setOptions(null);};
  return <Context.Provider value={confirm}>{children}{options&&<Modal title={options.title||'Confirm action'} onClose={()=>finish(false)}><div className="confirm-body"><span className="empty-icon"><ShieldAlert size={26}/></span><p>{options.description}</p></div><div className="dialog-actions"><button autoFocus className="btn btn-secondary" onClick={()=>finish(false)}>Keep record</button><button className="btn btn-danger" onClick={()=>finish(true)}>{options.action||'Confirm action'}</button></div></Modal>}</Context.Provider>;
}
