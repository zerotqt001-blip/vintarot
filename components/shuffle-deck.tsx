'use client';
import {useEffect,useRef} from 'react';
import CardMark from './card-mark';
import {useLanguage} from './language';
import {SHUFFLE_CARD_COUNT,cylinderOpacity,cylinderPose,poseToTransform} from '@/lib/shuffle-motion';

/** A hands-free 3D carousel: the full deck continuously circles one central axis. */
export default function ShuffleDeck({active,settling=false,onStart}:{active:boolean;settling?:boolean;onStart:()=>void}){
 const {t}=useLanguage();
 const cardRefs=useRef<Array<HTMLSpanElement|null>>([]);

 useEffect(()=>{
  const reset=()=>cardRefs.current.forEach(element=>{if(element){element.style.transform='';element.style.opacity=''}});
  const applyPose=(rotation:number,xScale:number)=>cardRefs.current.forEach((element,index)=>{if(element){element.style.transform=poseToTransform(cylinderPose(index,SHUFFLE_CARD_COUNT,rotation,xScale));element.style.opacity=String(cylinderOpacity(index,SHUFFLE_CARD_COUNT,rotation))}});
  if(!active||settling){if(!active)reset();return}
  const xScale=Math.min(1,Math.max(.72,(window.innerWidth-220)/1060));
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){applyPose(0,xScale);return}
  let frame=0;
  const started=performance.now();
  const duration=10800;
  const tick=(now:number)=>{
   applyPose(((now-started)/duration)*360,xScale);
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[active,settling]);

 return <button type="button" className={'shuffle-deck '+(active?'is-mixing ':'')+(settling?'is-gathering':'')} aria-label={active?t('room.stopShuffle'):t('room.shuffle')} disabled={settling} onClick={onStart}>
  <span className="shuffle-camera"><span className="shuffle-orbit">
   <span className="shuffle-axis" aria-hidden="true" />
   {Array.from({length:SHUFFLE_CARD_COUNT},(_,index)=><span className="shuffle-leaf" key={index} ref={element=>{cardRefs.current[index]=element}}><span className="shuffle-plane"><span className="card-back"><CardMark/></span></span></span>)}
  </span></span>
 </button>;
}
