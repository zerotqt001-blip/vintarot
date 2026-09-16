export type ShufflePose={x:number;y:number;z:number;rotateX:number;rotateY:number;rotateZ:number};

export const SHUFFLE_CARD_COUNT=32;
export const CYLINDER_RADIUS=198;
const DEGREES_TO_RADIANS=Math.PI/180;

function cylinderAngle(index:number,count:number,rotation:number){
 return (rotation+(count<=1?0:index/count*360))*DEGREES_TO_RADIANS;
}

function normalizedRotation(rotation:number){
 const normalized=rotation%360;
 return normalized<0?normalized+360:normalized;
}

/** Place each card on the circumference of a 3D cylinder around the deck's centre. */
export function cylinderPose(index:number,count=SHUFFLE_CARD_COUNT,rotation=0,xScale=1):ShufflePose{
 const angle=cylinderAngle(index,count,rotation);
 const side=Math.sin(angle),depth=Math.cos(angle);
 const visualRotation=normalizedRotation(rotation);
 return {
  x:side*CYLINDER_RADIUS*xScale,
  y:Math.sin(angle*2)*8,
  z:depth*CYLINDER_RADIUS,
  rotateX:Math.cos(angle*2)*3.5,
  rotateY:(visualRotation+(count<=1?0:index/count*360)),
  rotateZ:side*4,
 };
}

/** Keep rear cards visible enough to read as a complete rotating cylinder. */
export function cylinderOpacity(index:number,count=SHUFFLE_CARD_COUNT,rotation=0){
 const depth=(Math.cos(cylinderAngle(index,count,rotation))+1)/2;
 return .4+depth*.6;
}

export function poseToTransform(pose:ShufflePose){
 return `translate3d(${pose.x.toFixed(2)}px,${pose.y.toFixed(2)}px,${pose.z.toFixed(2)}px) rotateX(${pose.rotateX.toFixed(2)}deg) rotateY(${pose.rotateY.toFixed(2)}deg) rotateZ(${pose.rotateZ.toFixed(2)}deg)`;
}
