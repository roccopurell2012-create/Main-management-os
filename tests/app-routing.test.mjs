import test from 'node:test';
import assert from 'node:assert/strict';
import {isRecordId} from '../app/record-id.js';
test('record routes reject malformed IDs before a database query',()=>{
  for(const value of [undefined,null,12,[],{},'','../company','not-a-uuid','00000000-0000-4000-8000-000000000001/extra']) assert.equal(isRecordId(value),false);
});
test('record routes accept valid synthetic UUIDs',()=>{
  assert.equal(isRecordId('00000000-0000-4000-8000-000000000001'),true);
  assert.equal(isRecordId('ABCDEF01-1234-4321-ABCD-123456789ABC'),true);
});
