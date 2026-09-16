import assert from 'node:assert/strict';
import test from 'node:test';
import {CYLINDER_RADIUS,SHUFFLE_CARD_COUNT,cylinderOpacity,cylinderPose} from '../lib/shuffle-motion';

test('the deck cards form two inward-facing arcs around one cylinder',()=>{
 const leftFront=cylinderPose(0),rightFront=cylinderPose(1),leftBack=cylinderPose(SHUFFLE_CARD_COUNT-2),rightBack=cylinderPose(SHUFFLE_CARD_COUNT-1);
 for(const pose of [leftFront,rightFront,leftBack,rightBack])assert.ok(Math.abs(Math.hypot(pose.x,pose.z)-CYLINDER_RADIUS)<.01);
 assert.ok(leftFront.x<0&&rightFront.x>0&&leftFront.z>0&&rightFront.z>0);
 assert.ok(leftBack.z<0&&rightBack.z<0);
 assert.equal(Math.round(leftFront.rotateY)%360,150);
 assert.equal(Math.round(rightFront.rotateY)%360,210);
});

test('one rotation moves every card around the same central axis',()=>{
 const start=cylinderPose(3,SHUFFLE_CARD_COUNT,0),quarter=cylinderPose(3,SHUFFLE_CARD_COUNT,90);
 assert.notEqual(Math.round(start.x),Math.round(quarter.x));
 assert.notEqual(Math.round(start.z),Math.round(quarter.z));
 assert.ok(Math.abs(Math.hypot(start.x,start.z)-Math.hypot(quarter.x,quarter.z))<.01);
});

test('front cards stay brighter than rear cards while the cylinder turns',()=>{
 const front=cylinderOpacity(0,SHUFFLE_CARD_COUNT,0);
 const rear=cylinderOpacity(SHUFFLE_CARD_COUNT-2,SHUFFLE_CARD_COUNT,0);
 assert.ok(front>rear);
 assert.ok(front<=1&&rear>=.28);
});
