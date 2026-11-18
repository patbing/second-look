/* Second Look: pure functions, no network, no DOM. Browser (window.SL.look) and node (require).
 * One model explains a photo as claims pinned to grid cells. A second model of another family sees only each cell's crop
 * and answers yes or no: is the claimed thing there? A decoy question per photo checks that the second model can say no. */
(function (root) {
  'use strict';

  var COLS = 'ABCD', ROWS = '123', MAX_CLAIMS = 6;

  var DECOYS = [
    ['a red bicycle', 'two wheels and a red frame'],
    ['a printed street sign', 'a flat sign with printed letters'],
    ['a slice of pizza', 'a triangle of crust, cheese and toppings'],
    ['a yellow rubber duck', 'a small yellow toy duck'],
    ['a laptop keyboard', 'rows of square keys with letters'],
    ['a traffic cone', 'an orange cone with white stripes']
  ];

  // Crop box of a grid cell plus a margin on each side, in pixels, clipped to the image.
  function cellBox(w, h, cell, margin) {
    margin = margin == null ? 0.2 : margin;
    var i = COLS.indexOf(cell[0]), j = ROWS.indexOf(cell[1]), cw = w / COLS.length, ch = h / ROWS.length;
    var x0 = Math.max(0, (i - margin) * cw), y0 = Math.max(0, (j - margin) * ch);
    var x1 = Math.min(w, (i + 1 + margin) * cw), y1 = Math.min(h, (j + 1 + margin) * ch);
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  }

  var DESCRIBE = 'This photo has a yellow grid: columns A-D left to right, rows 1-3 top to bottom. Explain what the photo shows ' +
    'as 3 to 5 claims about distinct things you can see. Each claim must name the one grid cell where that thing is most visible. ' +
    'Add one short fact you know about each thing that the photo itself cannot show. ' +
    'Reply with JSON only: {"summary":"one sentence: what this photo is","claims":[{"cell":"B2","label":"2-4 word name of the thing",' +
    '"claim":"one sentence about what is visible","how_to_spot":"one short line","know":"one short fact, not visible in the photo"}]}';

  function checkPrompt(label, spot) {
    return 'This is a crop from a larger photo. First say in 3-6 words what you see in it. Then answer: is this clearly visible ' +
      'in the crop: "' + label + '"' + (spot ? ' (' + spot + ')' : '') + '? Reply with JSON only: {"seen": "...", "visible": true or false}';
  }

  function parseJSON(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  }

  function clip(v, n) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : ''; }

  // The describer's reply, validated: cells must exist, labels must be text. Bad claims are dropped and counted.
  function claims(text) {
    var j = parseJSON(text);
    if (!j || !Array.isArray(j.claims)) return { summary: '', claims: [], dropped: 0, unreadable: true };
    var out = [], dropped = 0;
    j.claims.forEach(function (c) {
      var cell = c && String(c.cell || '').trim().toUpperCase();
      if (!c || !/^[A-D][1-3]$/.test(cell) || !clip(c.label, 60) || out.length >= MAX_CLAIMS) { dropped++; return; }
      out.push({ cell: cell, label: clip(c.label, 60), claim: clip(c.claim, 300), spot: clip(c.how_to_spot, 160), know: clip(c.know, 240) });
    });
    return { summary: clip(j.summary, 300), claims: out, dropped: dropped, unreadable: false };
  }

  function check(text) {
    var j = parseJSON(text);
    return { visible: j && typeof j.visible === 'boolean' ? j.visible : null, seen: clip(j && j.seen, 80) };
  }

  // A decoy whose words share nothing with any claim label or sentence, so "not visible" is the right answer.
  function decoy(list, rand) {
    var words = {};
    list.forEach(function (c) { (c.label + ' ' + (c.claim || '')).toLowerCase().split(/\W+/).forEach(function (w) { if (w.length > 2) words[w] = 1; }); });
    var ok = DECOYS.filter(function (d) { return !d[0].toLowerCase().split(/\W+/).some(function (w) { return words[w]; }); });
    var pool = ok.length ? ok : DECOYS;
    return pool[Math.floor((rand == null ? Math.random() : rand) * pool.length) % pool.length];
  }

  // The verdict for one photo. A decoy answered "visible" means this second look says yes too easily: its confirmations are not trusted.
  function tally(list, decoyResult) {
    var t = { total: list.length, confirmed: 0, disputed: 0, unclear: 0, decoy: decoyResult ? decoyResult.visible : null };
    list.forEach(function (c) {
      var v = c.check && c.check.visible;
      if (v === true) t.confirmed++; else if (v === false) t.disputed++; else t.unclear++;
    });
    t.trusted = t.decoy === false;
    return t;
  }

  // Recorded photos carry a person's answer for each claim (true: the thing is there). Agreement of the second look with it.
  function agreement(list) {
    var n = 0, same = 0;
    list.forEach(function (c) {
      if (typeof c.human !== 'boolean' || !c.check || typeof c.check.visible !== 'boolean') return;
      n++; if (c.check.visible === c.human) same++;
    });
    return { n: n, same: same };
  }

  var api = { COLS: COLS, ROWS: ROWS, DECOYS: DECOYS, DESCRIBE: DESCRIBE, cellBox: cellBox, checkPrompt: checkPrompt,
    parseJSON: parseJSON, claims: claims, check: check, decoy: decoy, tally: tally, agreement: agreement };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SL = root.SL || {}; root.SL.look = api; }
})(typeof window !== 'undefined' ? window : this);
