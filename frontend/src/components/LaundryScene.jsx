import washerStudio from '../assets/washer-studio.webp';
import {useState} from 'react';
import {Pause, Play, Sparkles, ShieldCheck} from 'lucide-react';

// Native CSS surfaces retain their flat illustration when 3D transforms are unavailable.
export default function LaundryScene({studio=false}){
  const [paused,setPaused]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  return <div className={`laundry-scene ${studio&&!imageFailed?'studio-scene':''} ${paused?'is-paused':''}`} onPointerMove={e=>{if(!studio||paused||!window.matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches)return;const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--scene-x',`${(e.clientX-r.left-r.width/2)*.012}px`);e.currentTarget.style.setProperty('--scene-y',`${(e.clientY-r.top-r.height/2)*.012}px`);}} onPointerLeave={e=>{e.currentTarget.style.setProperty('--scene-x','0px');e.currentTarget.style.setProperty('--scene-y','0px');}}>
    {studio&&!imageFailed&&<img className="studio-washer" src={washerStudio} alt="Pearl-white washing machine with a chrome drum, floating shirt and mint towel in a cobalt studio" width="1254" height="1254" fetchPriority="high" onError={()=>setImageFailed(true)}/>}
    <div className="laundry-stage" aria-hidden="true">
      <div className="scene-halo"/><div className="scene-floor"/>
      <svg className="floating-garment garment-shirt" viewBox="0 0 120 120"><path d="M38 18 20 28 7 51 28 63 37 46 37 105 85 105 85 46 94 63 115 51 102 28 84 18Q60 36 38 18Z" fill="currentColor"/><path d="M46 21Q60 39 77 21M42 48V94M80 48V94" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3"/></svg>
      <svg className="floating-garment garment-towel" viewBox="0 0 90 110"><path d="M15 12H76L68 98H7Z" fill="currentColor"/><path d="M13 80 70 80M12 88 69 88" stroke="#fff" strokeOpacity=".65" strokeWidth="3"/></svg>
      <div className="washer-shadow"/>
      <div className="washer-model">
        <div className="washer-top"/><div className="washer-side"/>
        <div className="washer-front">
          <div className="washer-panel"><div className="detergent-drawer"><span>SMARTWASH</span><i/></div><div className="washer-dial"/><div className="washer-display"><span>01:24</span><i/></div></div>
          <div className="washer-porthole"><div className="washer-glass"><div className="washer-drum"><i/><i/><i/></div><div className="glass-reflection"/></div><div className="washer-handle"/></div>
          <div className="washer-base"><span>GARMENT CARE</span><i/></div><div className="washer-feet"><i/><i/></div>
        </div>
      </div>
      <div className="scene-note"><ShieldCheck size={17}/><span>Care in every cycle<small>From drop-off to fresh folds</small></span></div>
      <div className="scene-spark"><Sparkles size={20}/></div>
    </div>
    <button type="button" className="scene-motion-toggle" aria-pressed={paused} onClick={()=>setPaused(p=>!p)}>{paused?<Play size={12}/>:<Pause size={12}/>} {paused?'Resume visual motion':'Pause visual motion'}</button>
  </div>;
}
