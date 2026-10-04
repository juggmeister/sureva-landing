const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const word = (inner) => `<span class="w" aria-hidden="true"><span>${inner}</span></span>`;

// split on ordinary whitespace only; \s would also break on the non-breaking spaces we rely on
const wrap = (text) => text.trim().split(/[ \t\n\r]+/).filter(Boolean).map((w) => word(escape(w))).join(' ');

// text becomes words; [data-word] elements (e.g. the inline logo) move as one word;
// other classed wrappers (e.g. .accent) are kept around their words
function render(node) {
  if (node.nodeType === Node.TEXT_NODE) return wrap(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.hasAttribute('data-word')) return word(node.outerHTML);
  const inner = [...node.childNodes].map(render).filter(Boolean).join(' ');
  return node.className ? `<span class="${escape(node.className)}">${inner}</span>` : inner;
}

// Wraps each word in a clipping span so it can rise into place. Authored line breaks
// (<br>) are kept.
export function splitWords(el) {
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const lines = el.innerHTML.split(/<br\s*\/?>/i).map((html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return [...tmp.childNodes].map(render).filter(Boolean).join(' ');
  });
  el.innerHTML = lines.join('<br>');
  return [...el.querySelectorAll('.w > span')];
}
