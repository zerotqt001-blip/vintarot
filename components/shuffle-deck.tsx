'use client';
import CardMark from './card-mark';
import { useLanguage } from './language';

/** A stream of cards cascades across a 3D arc before the fan opens. */
export default function ShuffleDeck({active,settling=false,onStart}:{active:boolean,settling?:boolean,onStart:()=>void}){
 const { t } = useLanguage();
 return <button type="button" className={'shuffle-deck '+(active?'is-mixing':'')+(settling?' is-gathering':'')} aria-label={active?t('room.stopShuffle'):t('room.shuffle')} disabled={settling} onClick={onStart}>
  <span className="shuffle-camera"><span className="shuffle-orbit">
   {Array.from({length:32},(_,i)=><span className="shuffle-leaf" key={i} style={{'--index':i,'--offset':i-15.5,'--delay':`${-(i*.08)}s`} as React.CSSProperties}><span className="shuffle-plane"><span className="card-back"><CardMark/></span></span></span>)}
  </span></span>
 </button>
}
