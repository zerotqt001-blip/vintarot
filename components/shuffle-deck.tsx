'use client';
import {useState} from 'react';
import CardMark from './card-mark';

/** Layered orbit: each card counter-rotates to retain its readable plane. */
export default function ShuffleDeck({active,settling=false,onStart}:{active:boolean,settling?:boolean,onStart:()=>void}){
 const [turn,setTurn]=useState(0);
 return <button type="button" className={'shuffle-deck '+(active?'is-mixing':'')+(settling?' is-gathering':'')} aria-label={active?'Mix deck again':'Shuffle deck'} disabled={settling} onClick={()=>{setTurn(n=>n+1);onStart()}}>
  <span className="shuffle-camera"><span key={turn} className="shuffle-orbit">
   {Array.from({length:32},(_,i)=><span className="shuffle-leaf" key={i} style={{'--index':i,'--delay':`${-i*.055}s`} as React.CSSProperties}><span className="shuffle-plane"><span className="card-back"><CardMark/></span></span></span>)}
  </span></span>
 </button>
}
