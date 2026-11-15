/* Preview bridge. This file is bundled only with the portal's Cato snapshot. */
(() => {
  const allowedOrigin = window.location.origin;
  const root = document.documentElement;
  let mode = 'text';
  let state = { changes: {}, images: {}, colors: {}, pins: [] };
  let originals = {};
  let imageKeys = {};
  const style = document.createElement('style');
  style.textContent = 'body{position:relative}[data-i18n].tz-selectable:hover,.tz-image-selectable:hover{outline:3px solid #a88af5!important;outline-offset:3px;cursor:pointer!important}.tz-pin-mode,.tz-pin-mode *{cursor:crosshair!important}.tz-preview-pin{position:absolute;z-index:9999;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;border:2px solid white;background:#7454c7;color:white;font:700 13px Arial;box-shadow:0 3px 12px #0008;transform:translate(-50%,-50%);cursor:pointer!important}';
  document.head.appendChild(style);
  function send(type, detail = {}) { window.parent.postMessage({ source: 'tz-site-preview', type, ...detail }, allowedOrigin); }
  function normalize(path) { try { return new URL(path, location.href).pathname.split('/').pop(); } catch { return path; } }
  function apply() {
    Object.entries(originals).forEach(([key, value]) => document.querySelectorAll('[data-i18n="' + key + '"]').forEach(el => { el.textContent = state.changes[key] ?? value; }));
    Object.entries(state.colors).forEach(([key, value]) => root.style.setProperty('--' + key, value));
    document.querySelectorAll('[data-tz-image-key]').forEach(el => {
      const key = el.getAttribute('data-tz-image-key');
      const path = state.images[key] || imageKeys[key];
      if (!path) return;
      const resolved = path.startsWith('images/') ? 'https://cato-brown.vercel.app/' + path : path;
      if (el.tagName === 'IMG') el.src = resolved;
      else el.style.backgroundImage = 'url("' + resolved.replaceAll('"', '') + '")';
    });
    document.querySelectorAll('.tz-preview-pin').forEach(el => el.remove());
    state.pins.forEach((pin, index) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'tz-preview-pin';
      el.style.left = pin.x + '%'; el.style.top = pin.y + '%'; el.textContent = String(index + 1);
      el.title = pin.comment; el.setAttribute('aria-label', 'Comment ' + (index + 1));
      el.addEventListener('click', event => { event.stopPropagation(); send('pin-selected', { id: pin.id }); });
      document.body.appendChild(el);
    });
  }
  function prepare() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!(key in originals)) originals[key] = el.textContent.trim();
      el.classList.add('tz-selectable');
    });
    Object.entries(imageKeys).forEach(([key, path]) => {
      document.querySelectorAll('img').forEach(el => { if (normalize(el.getAttribute('src')) === normalize(path)) { el.setAttribute('data-tz-image-key', key); el.classList.add('tz-image-selectable'); } });
      document.querySelectorAll('[style*="background-image"]').forEach(el => { if (el.style.backgroundImage.includes(normalize(path))) { el.setAttribute('data-tz-image-key', key); el.classList.add('tz-image-selectable'); } });
    });
    apply(); send('ready');
  }
  window.addEventListener('message', event => {
    if (event.origin !== allowedOrigin || event.source !== window.parent || event.data?.source !== 'tz-portal-editor') return;
    if (event.data.type === 'configure') { imageKeys = event.data.imageKeys || {}; state = event.data.state || state; mode = event.data.mode || 'text'; root.classList.toggle('tz-pin-mode', mode === 'pins'); prepare(); }
    if (event.data.type === 'update') { state = event.data.state || state; mode = event.data.mode || mode; root.classList.toggle('tz-pin-mode', mode === 'pins'); apply(); }
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.tz-preview-pin')) return;
    const target = event.target.closest('[data-i18n], [data-tz-image-key]');
    if (mode === 'pins') {
      event.preventDefault(); event.stopPropagation();
      const x = Math.max(0, Math.min(100, event.pageX / document.documentElement.scrollWidth * 100));
      const y = Math.max(0, Math.min(100, event.pageY / document.documentElement.scrollHeight * 100));
      send('pin-place', { x, y, target: target?.getAttribute('data-i18n') || target?.getAttribute('data-tz-image-key') || 'page' });
    } else if (target && (mode === 'text' || mode === 'images')) {
      const key = mode === 'text' ? target.getAttribute('data-i18n') : target.getAttribute('data-tz-image-key');
      if (key) { event.preventDefault(); event.stopPropagation(); send('select', { kind: mode, key }); }
    }
  }, true);
  window.addEventListener('load', () => { send('ready'); setTimeout(() => send('ready'), 900); });
})();
