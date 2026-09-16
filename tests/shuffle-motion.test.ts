import assert from 'node:assert/strict';
import test from 'node:test';
import {CYLINDER_RADIUS,SHUFFLE_CARD_COUNT,cylinderOpacity,cylinderPose} from '../lib/shuffle-motion';

test('the deck cards are distributed around one complete cylinder',()=>{
 const front=cylinderPose(0),side=cylinderPose(SHUFFLE_CARD_COUNT/4),back=cylinderPose(SHUFFLE_CARD_COUNT/2);
 assert.ok(Math.abs(Math.hypot(front.x,front.z)-CYLINDER_RADIUS)<.01);
 assert.ok(Math.abs(Math.hypot(side.x,side.z)-CYLINDER_RADIUS)<.01);
 assert.ok(front.z>side.z&&side.z>back.z);
 assert.ok(front.rotateY<side.rotateY&&side.rotateY<back.rotateY);
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
