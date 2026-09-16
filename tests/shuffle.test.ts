import assert from 'node:assert/strict';
import test from 'node:test';
import {shuffleTapAction} from '../lib/shuffle';

test('the first deck tap starts shuffling and the second tap stops it',()=>{
 assert.equal(shuffleTapAction('ready'),'start');
 assert.equal(shuffleTapAction('shuffling'),'stop');
 assert.equal(shuffleTapAction('drawing'),'noop');
});
