/**
 * A copy-to-clipboard button for a snippet.
 *
 * The point of the snippet is that somebody pastes it somewhere: into an
 * AGENTS.md, into a chat with an agent, into a terminal. Making them
 * select the text by hand is the tax that stops them doing it, so the
 * button is part of the snippet rather than a nicety next to it.
 *
 * It is a plain button with a `data-copy` attribute holding the text to
 * copy, and one small script that wires up every button on the page. No
 * library, no framework, and the page still works if the script does not
 * run: the button is only added when there is something to copy, and the
 * text is always selectable by hand.
 *
 * The clipboard API needs a secure context, so the fallback is a hidden
 * textarea plus `document.execCommand('copy')`, which still works.
 *
 * The escaping helpers are duplicated here rather than imported. `html.ts`
 * imports this module for the script, and importing back would be a
 * cycle. The copies are the same two functions, and the test suite covers
 * them.
 */

/** Escape text for use inside a double-quoted attribute. */
function escAttr(value: unknown): string {
  return esc(value);
}

/** Escape text for use in HTML content. */
function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

/** The button markup. `text` is the thing that goes on the clipboard. */
export function copyButton(text: string, label = "Copy"): string {
  // The text goes in a data attribute. `escAttr` handles the quoting, and
  // the script reads it with `getAttribute`, so no HTML parsing is involved.
  return `<button type="button" class="copybtn" data-copy="${escAttr(text)}" data-copied="Copied" data-label="${escAttr(label)}">${esc(label)}</button>`;
}

/**
 * The script that makes the buttons work.
 *
 * It is small on purpose. It finds every `[data-copy]` button, copies the
 * text on click, says so for a moment, and falls back to a hidden textarea
 * when the clipboard API is unavailable.
 */
export const COPY_SCRIPT = `<script>
(function(){
  function flash(btn, text){
    var old = btn.textContent;
    btn.textContent = text;
    btn.classList.add('done');
    setTimeout(function(){ btn.textContent = old; btn.classList.remove('done'); }, 1400);
  }
  function legacyCopy(text){
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly','');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('[data-copy]') : null;
    if(!btn) return;
    e.preventDefault();
    var text = btn.getAttribute('data-copy') || '';
    var copied = btn.getAttribute('data-copied') || 'Copied';
    var failed = btn.getAttribute('data-failed') || 'Press Ctrl+C';
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){ flash(btn, copied); }, function(){ flash(btn, legacyCopy(text) ? copied : failed); });
    } else {
      flash(btn, legacyCopy(text) ? copied : failed);
    }
  });
})();
</script>`;
