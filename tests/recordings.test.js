const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const L = require('../js/look.js');

const file = path.join(__dirname, '../recordings/looks.json');

test('every recorded photo has its image, valid cells and a decoy', { skip: !existsSync(file) && 'no recordings yet' }, () => {
  const text = readFileSync(file, 'utf8');
  assert.ok(!/sk_[A-Za-z0-9]{6,}/.test(text), 'a secret key in the recording');
  const rec = JSON.parse(text);
  assert.ok(rec.looks.length >= 2);
  for (const lk of rec.looks) {
    assert.ok(existsSync(path.join(__dirname, '../recordings', lk.image)), lk.id + ' image');
    assert.ok(lk.credit && lk.source, lk.id + ' credit');
    if (lk.error) continue;
    assert.ok(lk.claims.length >= 1);
    for (const c of lk.claims) assert.match(c.cell, /^[A-D][1-3]$/);
    assert.ok(lk.decoy && lk.decoy.check, lk.id + ' decoy');
    const t = L.tally(lk.claims, lk.decoy.check);
    assert.equal(t.confirmed + t.disputed + t.unclear, lk.claims.length);
  }
});
