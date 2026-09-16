'use client';
import CardMark from './card-mark';
import { useLanguage } from './language';

/** Layered orbit: each card counter-rotates to retain its readable plane. */
export default function ShuffleDeck({active,paused=false,settling=false,onStart}:{active:boolean,paused?:boolean,settling?:boolean,onStart:()=>void}){
 const { t } = useLanguage();
 return <button type="button" className={'shuffle-deck '+(active?'is-mixing':'')+(settling?' is-gathering':'')+(paused?' is-paused':'')} aria-label={active?(paused?t('room.resumeShuffle'):t('room.pauseShuffle')):t('room.shuffle')} disabled={settling} onClick={onStart}>
  <span className="shuffle-camera"><span className="shuffle-orbit">
   {Array.from({length:32},(_,i)=><span className="shuffle-leaf" key={i} style={{'--index':i,'--delay':`${-i*.055}s`} as React.CSSProperties}><span className="shuffle-plane"><span className="card-back"><CardMark/></span></span></span>)}
  </span></span>
 </button>
}
