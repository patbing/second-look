const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/look.js');

test('cell boxes cover the right part of the photo, with a clipped margin', () => {
  assert.deepEqual(L.cellBox(400, 300, 'A1', 0), { x: 0, y: 0, w: 100, h: 100 });
  assert.deepEqual(L.cellBox(400, 300, 'D3', 0), { x: 300, y: 200, w: 100, h: 100 });
  assert.deepEqual(L.cellBox(400, 300, 'B2'), { x: 80, y: 80, w: 140, h: 140 });
  assert.deepEqual(L.cellBox(400, 300, 'A1'), { x: 0, y: 0, w: 120, h: 120 });
});

test('claims: bad cells and labels are dropped, text is trimmed, at most six', () => {
  const reply = 'Sure! ```json\n' + JSON.stringify({ summary: ' A  cat ', claims: [
    { cell: 'b1', label: "Cat's face", claim: 'Green eyes.', how_to_spot: 'centre top', know: 'Tabbies are a pattern, not a breed.' },
    { cell: 'E9', label: 'nowhere' }, { cell: 'C2', label: '' }, null,
    ...Array.from({ length: 7 }, (_, i) => ({ cell: 'A' + ((i % 3) + 1), label: 'x' + i }))
  ] }) + '\n```';
  const p = L.claims(reply);
  assert.equal(p.unreadable, false);
  assert.equal(p.summary, 'A cat');
  assert.equal(p.claims.length, 6);
  assert.deepEqual(p.claims[0], { cell: 'B1', label: "Cat's face", claim: 'Green eyes.', spot: 'centre top', know: 'Tabbies are a pattern, not a breed.' });
  assert.equal(p.dropped, 5);
  assert.equal(L.claims('no json here').unreadable, true);
});

test('check replies: only a real boolean counts', () => {
  assert.deepEqual(L.check('{"seen":"a whisk","visible":true}'), { visible: true, seen: 'a whisk' });
  assert.deepEqual(L.check('{"seen":"tiles","visible":"no"}'), { visible: null, seen: 'tiles' });
  assert.deepEqual(L.check(''), { visible: null, seen: '' });
});

test('the decoy shares no word with any claim', () => {
  const cl = [{ label: 'red bicycle wheel' }, { label: 'street sign' }];
  for (let r = 0; r < 1; r += 0.05) {
    const d = L.decoy(cl, r);
    assert.ok(!/bicycle|street|sign|red/.test(d[0]), d[0]);
  }
});

test('tally trusts confirmations only when the decoy was refused; agreement with a person', () => {
  const cl = [{ check: { visible: true }, human: true }, { check: { visible: false }, human: true }, { check: { visible: null }, human: false }];
  assert.deepEqual(L.tally(cl, { visible: false }), { total: 3, confirmed: 1, disputed: 1, unclear: 1, decoy: false, trusted: true });
  assert.equal(L.tally(cl, { visible: true }).trusted, false);
  assert.equal(L.tally(cl, null).trusted, false);
  assert.deepEqual(L.agreement(cl), { n: 2, same: 1 });
});

test('the decoy also avoids words in the claim sentences', () => {
  const cl = [{ label: 'Silver notebook', claim: 'A laptop keyboard with a red cone sticker and a pizza box beside it.' }];
  for (let r = 0; r < 1; r += 0.05) assert.ok(!/laptop|cone|pizza|red/.test(L.decoy(cl, r)[0]));
});
