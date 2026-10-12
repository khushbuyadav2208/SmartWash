import {useState,useRef,useEffect} from 'react';
export default function CameraScanner({onScan}){
  const video=useRef(null),controls=useRef(null),generation=useRef(0),onScanRef=useRef(onScan),last=useRef({value:'',time:0});
  const[active,setActive]=useState(false),[error,setError]=useState('');
  onScanRef.current=onScan;
  const stop=()=>{generation.current++;controls.current?.stop();controls.current=null;setActive(false);};
  useEffect(()=>()=>{generation.current++;controls.current?.stop();},[]);
  const start=async()=>{setError('');setActive(true);const own=++generation.current;
    try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires HTTPS or localhost. Use manual entry below.');
      const {BrowserQRCodeReader}=await import('@zxing/browser');const reader=new BrowserQRCodeReader();const control=await reader.decodeFromConstraints({video:{facingMode:'environment'},audio:false},video.current,(result)=>{if(!result||own!==generation.current)return;const value=result.getText();if(last.current.value===value&&Date.now()-last.current.time<2500)return;last.current={value,time:Date.now()};onScanRef.current(value);});
      if(own!==generation.current)control.stop();else controls.current=control;
    }catch(e){if(own===generation.current){setError(`Camera unavailable: ${e.message}. Manual entry remains available.`);setActive(false);}}
  };
  return <div className="camera-panel"><video ref={video} autoPlay playsInline muted aria-label="QR scanning camera" style={{display:active?'block':'none'}}/>{!active&&<p>Scan physical garment labels with your camera.</p>}<button type="button" className="btn btn-secondary" onClick={active?stop:start}>{active?'Stop camera':'Enable camera'}</button>{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
