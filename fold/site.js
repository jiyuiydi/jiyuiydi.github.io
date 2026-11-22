// Shared by index.html and tour.html.

// Where the editor lives, relative to this page. While drafting, the site is
// served from the repository root (website/serve.mjs), so this is the editor's
// own folder. When the site is hosted, copy the editor's index.html and build/
// in beside the site and change this one line.
const EDITOR = './editor-js/index.html';

function editorUrl(hash) {
  return EDITOR + (hash || '');
}

// A live editor frame. It loads at once but stays behind a click-to-edit cover,
// so the page doesn't hand its keyboard to the editor until the reader asks.
function mountFrame(host, hash, { cover = true } = {}) {
  const iframe = host.querySelector('iframe');
  const activate = host.querySelector('.activate');
  iframe.src = editorUrl(hash);
  if (activate) {
    if (!cover) activate.remove();
    else activate.addEventListener('click', () => {
      activate.remove();
      iframe.tabIndex = 0;
      iframe.focus();
      iframe.contentWindow?.focus();
    });
  }
  return iframe;
}

function reloadFrame(iframe) {
  try { iframe.contentWindow.location.reload(); }
  catch { iframe.src = iframe.src; }
}

// The landing page's hero window.
for (const win of document.querySelectorAll('.window[id="hero-window"]')) {
  const host = win.querySelector('.frame-host');
  const iframe = mountFrame(host, host.querySelector('iframe').dataset.src);
  win.querySelector('[data-reset]')?.addEventListener('click', () => reloadFrame(iframe));
}
