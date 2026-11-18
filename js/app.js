/* Second Look: the page. Model text is only ever inserted with textContent. */
(function () {
  'use strict';
  var C = window.SL.config, L = window.SL.look, N = window.SL.net;
  var app = { key: null, prices: null, busy: false, ctrl: null, spent: 0 };

  function $(id) { return document.getElementById(id); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function trusted(fn) { return function (ev) { if (ev && ev.isTrusted === false) return; fn(ev); }; }
  function say(t, warn) { var n = $('notice'); n.textContent = t || ''; n.className = 'notice' + (warn ? ' warn' : ''); }
  function fmtP(x) { return x == null ? '?' : (x < 0.001 ? x.toFixed(5) : x.toFixed(4)) + ' P'; }

  // ---------- pictures ----------
  function loadImage(src) {
    return new Promise(function (ok, bad) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { bad(new Error('not an image this browser can read')); }; i.src = src; });
  }
  function fit(img) { // longest side to C.SIDE, as a canvas
    var s = Math.min(1, C.SIDE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    var c = document.createElement('canvas');
    c.width = Math.round((img.naturalWidth || img.width) * s); c.height = Math.round((img.naturalHeight || img.height) * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  function gridLines(g, w, hgt, labels) {
    g.strokeStyle = 'yellow'; g.lineWidth = 3;
    for (var i = 1; i < 4; i++) { g.beginPath(); g.moveTo(w * i / 4, 0); g.lineTo(w * i / 4, hgt); g.stroke(); }
    for (var j = 1; j < 3; j++) { g.beginPath(); g.moveTo(0, hgt * j / 3); g.lineTo(w, hgt * j / 3); g.stroke(); }
    if (!labels) return;
    g.font = 'bold 22px sans-serif'; g.textBaseline = 'top';
    for (i = 0; i < 4; i++) for (j = 0; j < 3; j++) {
      var x = w * i / 4 + 8, y = hgt * j / 3 + 6;
      g.fillStyle = 'black'; g.fillRect(x - 4, y - 2, 38, 28); g.fillStyle = 'yellow'; g.fillText(L.COLS[i] + L.ROWS[j], x, y);
    }
  }
  function withGrid(photo) { // what the describer sees: the same grid as the one drawn in the pilot that chose these models
    var c = document.createElement('canvas'); c.width = photo.width; c.height = photo.height;
    var g = c.getContext('2d'); g.drawImage(photo, 0, 0); gridLines(g, c.width, c.height, true);
    return c.toDataURL('image/jpeg', 0.85);
  }
  function cropCanvas(photo, cell) {
    var b = L.cellBox(photo.width, photo.height, cell), s = Math.max(1, C.CROP_MIN / Math.min(b.w, b.h));
    var c = document.createElement('canvas'); c.width = Math.round(b.w * s); c.height = Math.round(b.h * s);
    c.getContext('2d').drawImage(photo, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
    return c;
  }

  // ---------- one photo, recorded or live ----------
  var COLOR = { yes: '#1f9d55', no: '#d93025', none: '#8a8a8a' };
  function verdictOf(c) { var v = c.check && c.check.visible; return v === true ? 'yes' : v === false ? 'no' : 'none'; }

  function drawResult(photo, r) {
    var c = document.createElement('canvas'); c.width = photo.width; c.height = photo.height;
    var g = c.getContext('2d'); g.drawImage(photo, 0, 0); gridLines(g, c.width, c.height, false);
    r.claims.forEach(function (cl, k) {
      var i = L.COLS.indexOf(cl.cell[0]), j = L.ROWS.indexOf(cl.cell[1]), cw = c.width / 4, ch = c.height / 3;
      g.lineWidth = 6; g.strokeStyle = COLOR[verdictOf(cl)]; g.strokeRect(i * cw + 3, j * ch + 3, cw - 6, ch - 6);
      var x = i * cw + 10 + (k % 2) * 40, y = j * ch + 10;
      g.fillStyle = COLOR[verdictOf(cl)]; g.beginPath(); g.arc(x + 16, y + 16, 17, 0, 7); g.fill();
      g.fillStyle = 'white'; g.font = 'bold 20px sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(String(k + 1), x + 16, y + 17);
    });
    c.className = 'shot'; c.setAttribute('role', 'img');
    c.setAttribute('aria-label', 'The photo with ' + r.claims.length + ' pinned claims; green confirmed, red disputed, grey unclear.');
    return c;
  }

  function render(box, photo, r) {
    box.textContent = '';
    if (r.error) { box.appendChild(h('p', 'warn', r.error)); return; }
    var t = L.tally(r.claims, r.decoy && r.decoy.check);
    var head = h('div', 'score');
    head.appendChild(h('strong', null, t.confirmed + ' of ' + t.total + ' claims confirmed by a blind second look'));
    head.appendChild(h('span', null, (t.disputed ? ' · ' + t.disputed + ' disputed' : '') + (t.unclear ? ' · ' + t.unclear + ' unclear' : '')));
    box.appendChild(head);
    if (r.decoy) {
      var dv = r.decoy.check && r.decoy.check.visible;
      box.appendChild(h('p', dv === false ? 'facts' : 'warn', dv === false
        ? 'Control: asked whether "' + r.decoy.label + '" was in cell ' + r.decoy.cell + ', the second look said no, so it can say no.'
        : dv === true ? 'Control failed: the second look said "' + r.decoy.label + '" was in cell ' + r.decoy.cell + '. It says yes too easily on this photo, so treat its confirmations as weak.'
          : 'Control unanswered (' + ((r.decoy.check && r.decoy.check.error) || 'no yes or no') + '), so the confirmations are unverified.'));
    }
    var ag = L.agreement(r.claims);
    if (ag.n) box.appendChild(h('p', 'facts', 'A person checked these claims against the photo too: the second look agreed with them on ' + ag.same + ' of ' + ag.n + '.'));
    if (r.summary) box.appendChild(h('p', 'summary', r.summary));
    if (r.dropped) box.appendChild(h('p', 'fine', r.dropped + ' claim' + (r.dropped > 1 ? 's' : '') + ' dropped: no valid grid cell or label.'));
    var wrap = h('div', 'look'); wrap.appendChild(drawResult(photo, r));
    var list = h('ol', 'claims');
    r.claims.forEach(function (cl) {
      var v = verdictOf(cl), li = h('li', 'claim ' + v);
      var top = h('button', 'claimhead'); top.type = 'button'; top.setAttribute('aria-expanded', 'false');
      top.appendChild(h('span', 'badge ' + v, v === 'yes' ? 'confirmed' : v === 'no' ? 'disputed' : 'unclear'));
      top.appendChild(h('span', 'label', cl.label));
      top.appendChild(h('span', 'cell', cl.cell));
      li.appendChild(top);
      li.appendChild(h('p', null, cl.claim));
      var more = h('div', 'more'); more.hidden = true;
      more.appendChild(h('p', 'seen', 'Second look, shown only this crop: "' + ((cl.check && cl.check.seen) || '—') + '"' + (cl.check && cl.check.error ? ' (' + cl.check.error + ')' : '')));
      if (cl.spot) more.appendChild(h('p', 'fine', 'How to spot it: ' + cl.spot));
      if (typeof cl.human === 'boolean') more.appendChild(h('p', 'fine', 'Person checking the photo: ' + (cl.human ? 'it is there' : 'it is not there') + (cl.humanNote ? ' (' + cl.humanNote + ')' : '')));
      li.appendChild(more);
      if (cl.know) li.appendChild(h('p', 'know', 'Did you know: ' + cl.know + ' (from the model\'s knowledge, not checked against the photo)'));
      top.addEventListener('click', trusted(function () {
        more.hidden = !more.hidden; top.setAttribute('aria-expanded', String(!more.hidden));
        if (!more.hidden && !more.querySelector('canvas')) { var cc = cropCanvas(photo, cl.cell); cc.className = 'crop'; more.insertBefore(cc, more.firstChild); }
      }));
      list.appendChild(li);
    });
    wrap.appendChild(list); box.appendChild(wrap);
    if (r.models) box.appendChild(h('p', 'fine', 'Explained by ' + r.models.describe + ', checked by ' + r.models.check + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1) + ' s' : '') + '.'));
  }

  // ---------- recorded photos, no sign-in ----------
  function loadRecordings() {
    return fetch('recordings/looks.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (rec) {
      var list = $('shots'); list.textContent = '';
      rec.looks.forEach(function (lk, i) {
        var b = h('button', 'take', (i + 1) + '. ' + lk.title); b.type = 'button';
        b.addEventListener('click', trusted(function () { showRecorded(lk); }));
        list.appendChild(b);
      });
      $('recmeta').textContent = rec.looks.length + ' photos recorded ' + rec.recordedAt.slice(0, 10) + ' with ' + rec.models.describe + ' and ' + rec.models.check + '. Real model replies; the tally is recomputed here.' +
        (rec.looks.some(function (lk) { return L.agreement(lk.claims || []).n; }) ? ' A person also marked each claim against the photo.' : '');
      if (rec.looks.length) showRecorded(rec.looks[0]);
    }).catch(function () { $('recmeta').textContent = 'The recorded photos are not published yet. Sign in to try your own.'; });
  }
  function showRecorded(lk) {
    loadImage('recordings/' + lk.image).then(function (img) {
      render($('recresult'), fit(img), lk);
      var a = $('credit'); a.textContent = lk.credit || ''; a.href = lk.source || '#'; a.hidden = !lk.credit;
    }).catch(function (e) { $('recresult').textContent = 'Could not load the photo: ' + e.message; });
  }

  // ---------- live photo ----------
  function priceOf(id) { var p = ((app.prices || {})[id] || {}).pricing || {}; return { in: Number(p.promptTextTokens) || 0, img: Number(p.promptImageTokens || p.promptTextTokens) || 0, out: Number(p.completionTextTokens) || 0 }; }
  function worst() { // upper bound for one photo from listed prices: describe once, check up to 6 claims and a decoy
    if (!app.prices) return null;
    var d = priceOf(C.DESCRIBE), k = priceOf(C.CHECK);
    return 3000 * d.img + 400 * d.in + C.DESCRIBE_MAX * d.out + 7 * (1500 * k.img + 120 * k.in + C.CHECK_MAX * k.out);
  }
  function cost(model, u) { var p = priceOf(model); return u ? (u.prompt_tokens || 0) * p.in + (u.completion_tokens || 0) * p.out : 0; }
  function freeCheck() {
    var p = app.prices || {}, bad = [C.DESCRIBE, C.CHECK].filter(function (id) { return !p[id] || p[id].paidOnly; });
    if (bad.length) return 'Not run: ' + bad.join(', ') + (app.prices ? ' is paid-only or missing from the model list today.' : ' (model list not loaded).');
    var w = worst();
    if (w == null || !(w > 0)) return 'Not run: no price for these models, so the cost cannot be checked.';
    if (app.spent + w > C.CAP) return 'Not run: this visit has spent ≈ ' + fmtP(app.spent) + ' and the next photo could pass the ' + fmtP(C.CAP) + ' cap. Reload the page to start a new visit.';
    return null;
  }

  function pick(ev) {
    var f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f || app.busy || !app.key) return;
    var stop = freeCheck(); if (stop) return say(stop, true);
    if (!/^image\//.test(f.type)) return say('That is not an image.', true);
    if (f.size > 15e6) return say('That photo is over 15 MB.', true);
    app.busy = true; paint();
    var url = URL.createObjectURL(f);
    loadImage(url).then(function (img) { return run(fit(img)); })
      .catch(function (e) { say('Something broke: ' + (e && e.message || e), true); })
      .then(function () { URL.revokeObjectURL(url); app.busy = false; app.ctrl = null; paint(); });
  }

  function run(photo) {
    var key = app.key, r = { claims: [], models: { describe: C.DESCRIBE, check: C.CHECK } }, t0 = Date.now();
    if (!key) { say('Signed out: the photo was not sent.', true); return Promise.resolve(); }
    app.ctrl = new AbortController(); var sig = app.ctrl.signal;
    say('Explaining the photo… (' + C.DESCRIBE + ')');
    $('liveresult').textContent = '';
    return N.chat(key, C.DESCRIBE, [{ type: 'text', text: L.DESCRIBE }, { type: 'image_url', image_url: { url: withGrid(photo) } }], C.DESCRIBE_MAX, sig).then(function (d) {
      app.spent += d.ok ? cost(C.DESCRIBE, d.usage) : 0;
      if (!d.ok) { r.error = 'The explanation failed: ' + d.error + '. Nothing was checked.'; return; }
      var p = L.claims(d.text);
      if (p.unreadable || !p.claims.length) { r.error = 'The explanation came back without usable claims, so there is nothing to check.'; return; }
      r.summary = p.summary; r.claims = p.claims; r.dropped = p.dropped;
      var dc = L.decoy(p.claims), dcell = p.claims[Math.floor(Math.random() * p.claims.length)].cell;
      r.decoy = { label: dc[0], cell: dcell };
      say('A second model looks at each pinned crop without the explanation… (' + C.CHECK + ')');
      var asks = p.claims.map(function (c) { return [c.cell, c.label, c.spot]; }).concat([[dcell, dc[0], dc[1]]]);
      return Promise.all(asks.map(function (a) {
        return N.chat(key, C.CHECK, [{ type: 'text', text: L.checkPrompt(a[1], a[2]) }, { type: 'image_url', image_url: { url: cropCanvas(photo, a[0]).toDataURL('image/jpeg', 0.85) } }], C.CHECK_MAX, sig)
          .then(function (k) { app.spent += k.ok ? cost(C.CHECK, k.usage) : 0; return k.ok ? L.check(k.text) : { visible: null, seen: '', error: k.error }; });
      })).then(function (res) {
        r.claims.forEach(function (c, k) { c.check = res[k]; });
        r.decoy.check = res[res.length - 1];
      });
    }).then(function () {
      r.ms = Date.now() - t0;
      if (!r.error) say('');
      render($('liveresult'), photo, r);
    });
  }

  // ---------- sign-in ----------
  function readKey(c, e) {
    var k = (c && c.apiKey) || (e && e.detail && (e.detail.apiKey || e.detail.key)) || null;
    return typeof k === 'string' && k ? k : null;
  }
  function wireConnect() {
    var c = $('connect');
    c.setAttribute('app-key', C.APP_KEY);
    Promise.race([customElements.whenDefined('polli-connect'), new Promise(function (r) { setTimeout(r, 8000); })]).then(function () {
      if (!customElements.get('polli-connect')) { c.hidden = true; $('connect-fallback').hidden = false; }
      onKey(readKey(c));
    });
    c.addEventListener('change', function (e) { onKey(readKey(c, e)); });
  }
  function onKey(k) { if (k === app.key) return; app.key = k; if (!k && app.ctrl) app.ctrl.abort(); paint(); }

  function paint() {
    var signed = !!app.key;
    $('signin').hidden = signed;
    $('camera').disabled = $('upload').disabled = !signed || app.busy;
    var w = worst();
    $('cost').textContent = w == null ? '' : 'At most ' + fmtP(w) + ' per photo from listed prices.';
    $('spent').hidden = !app.spent; $('spent').textContent = 'spent ≈ ' + fmtP(app.spent);
  }

  function init() {
    $('camera').addEventListener('change', trusted(pick));
    $('upload').addEventListener('change', trusted(pick));
    $('src').href = C.REPO_URL;
    wireConnect();
    N.prices().then(function (p) { app.prices = p; paint(); }).catch(function (e) { say('Model list unavailable: ' + e.message, true); });
    loadRecordings();
    paint();
  }
  init();
})();
