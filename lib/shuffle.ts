export type ShufflePhase='ready'|'shuffling'|'drawing';
export type ShuffleTapAction='start'|'stop'|'noop';

export function shuffleTapAction(phase:ShufflePhase):ShuffleTapAction{
 if(phase==='ready')return 'start';
 if(phase==='shuffling')return 'stop';
 return 'noop';
}
