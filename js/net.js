/* All network access lives here.
 *   GET  gen.pollinations.ai/v1/models             (prices, free or paid-only)
 *   POST gen.pollinations.ai/v1/chat/completions   (the explanation, and each blind yes/no check)
 * The visitor's key is passed in as an argument; this app never logs or stores it.
 */
(function () {
  'use strict';
  var C = window.SL.config;

  // { id: { paidOnly, pricing } }
  function prices() {
    return fetch(C.API + '/v1/models', { credentials: 'omit', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
    }).then(function (j) {
      var out = {};
      ((j && (j.data || j.models)) || []).forEach(function (m) { out[m.id] = { paidOnly: !!m.paid_only, pricing: m.pricing || {} }; });
      return out;
    });
  }

  // One chat call. Resolves to { ok, text, usage, ms } or { ok: false, error }; never rejects.
  function chat(key, model, content, maxTokens, signal) {
    if (signal && signal.aborted) return Promise.resolve({ ok: false, error: 'cancelled', cancelled: true });
    var ctrl = new AbortController(), timedOut = false, t0 = Date.now();
    var timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, C.TIMEOUT_MS);
    function stop() { ctrl.abort(); }
    if (signal) signal.addEventListener('abort', stop, { once: true });
    var body = { model: model, messages: [{ role: 'user', content: content }], max_tokens: maxTokens, seed: Math.floor(Math.random() * 2147483647) };
    return fetch(C.API + '/v1/chat/completions', {
      method: 'POST', credentials: 'omit', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (t) { // body read before the timer is cleared, so a stalled body still times out
        var j = null; try { j = JSON.parse(t); } catch (e) { /* not JSON */ }
        var ms = Date.now() - t0;
        if (!res.ok) return { ok: false, ms: ms, usage: j && j.usage, error: 'HTTP ' + res.status + ': ' + String((j && j.error && (j.error.message || j.error)) || t).slice(0, 200) };
        var c = j && j.choices && j.choices[0], text = c && c.message && typeof c.message.content === 'string' ? c.message.content.trim() : '';
        return text ? { ok: true, ms: ms, text: text, usage: j.usage } : { ok: false, ms: ms, error: 'empty reply', usage: j && j.usage };
      });
    }).catch(function (e) {
      if (signal && signal.aborted && !timedOut) return { ok: false, error: 'cancelled', cancelled: true };
      return { ok: false, ms: Date.now() - t0, error: timedOut ? 'timed out' : String((e && e.message) || e) };
    }).then(function (r) { clearTimeout(timer); if (signal) signal.removeEventListener('abort', stop); return r; });
  }

  window.SL.net = { prices: prices, chat: chat };
})();
