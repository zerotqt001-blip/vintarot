import assert from 'node:assert/strict';
import test from 'node:test';
import {CYLINDER_RADIUS,SHUFFLE_CARD_COUNT,cylinderOpacity,cylinderPose} from '../lib/shuffle-motion';

test('the deck cards form a symmetric cylinder with radial edges',()=>{
 const front=cylinderPose(0),side=cylinderPose(SHUFFLE_CARD_COUNT/4),back=cylinderPose(SHUFFLE_CARD_COUNT/2);
 for(const pose of [front,side,back])assert.ok(Math.abs(Math.hypot(pose.x,pose.z)-CYLINDER_RADIUS)<.01);
 assert.ok(front.z>side.z&&side.z>back.z);
 assert.equal(Math.round(front.rotateY)%360,90);
 assert.equal(Math.round(side.rotateY)%360,180);
 assert.equal(Math.round(back.rotateY)%360,270);
});

test('one rotation moves every card around the same central axis',()=>{
 const start=cylinderPose(3,SHUFFLE_CARD_COUNT,0),quarter=cylinderPose(3,SHUFFLE_CARD_COUNT,90);
 assert.notEqual(Math.round(start.x),Math.round(quarter.x));
 assert.notEqual(Math.round(start.z),Math.round(quarter.z));
 assert.ok(Math.abs(Math.hypot(start.x,start.z)-Math.hypot(quarter.x,quarter.z))<.01);
});

test('front cards stay brighter than rear cards while the cylinder turns',()=>{
 const front=cylinderOpacity(0,SHUFFLE_CARD_COUNT,0);
 const rear=cylinderOpacity(SHUFFLE_CARD_COUNT/2,SHUFFLE_CARD_COUNT,0);
 assert.ok(front>rear);
 assert.ok(front<=1&&rear>=.28);
});
