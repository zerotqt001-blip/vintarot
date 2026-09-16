'use client';
import CardMark from './card-mark';
import { useLanguage } from './language';

/** Two packets sweep across opposing 3D arcs before the fan opens. */
export default function ShuffleDeck({active,settling=false,onStart}:{active:boolean,settling?:boolean,onStart:()=>void}){
 const { t } = useLanguage();
 return <button type="button" className={'shuffle-deck '+(active?'is-mixing':'')+(settling?' is-gathering':'')} aria-label={active?t('room.stopShuffle'):t('room.shuffle')} disabled={settling} onClick={onStart}>
  <span className="shuffle-camera"><span className="shuffle-orbit">
   {[0,1].map(packet=><span className={'shuffle-packet '+(packet===0?'packet-left':'packet-right')} key={packet}>
    {Array.from({length:16},(_,i)=><span className="shuffle-leaf" key={i} style={{'--index':i,'--offset':i-7.5,'--side':packet===0?-1:1,'--delay':`${-(i*.045+packet*.12)}s`} as React.CSSProperties}><span className="shuffle-plane"><span className="card-back"><CardMark/></span></span></span>)}
   </span>)}
  </span></span>
 </button>
}
