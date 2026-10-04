// The early-access sheet. Any [data-open-waitlist] opens it; the native <dialog> gives us
// focus containment, Esc and the backdrop, and we add the enter/leave motion.
export function initSheet(lenis) {
  const sheet = document.querySelector('[data-sheet]');
  if (!sheet) return null;
  const input = sheet.querySelector('input[type="email"]');
  let opener = null;

  const open = (trigger) => {
    if (sheet.open) return;
    opener = trigger ?? null;
    sheet.classList.remove('is-closing');
    sheet.showModal();
    lenis?.stop();
    requestAnimationFrame(() => input?.focus({ preventScroll: true }));
  };

  const finish = () => {
    sheet.classList.remove('is-closing');
    if (sheet.open) sheet.close();
  };

  const close = () => {
    if (!sheet.open || sheet.classList.contains('is-closing')) return;
    sheet.classList.add('is-closing');
    const fallback = setTimeout(finish, 450);
    sheet.addEventListener('animationend', (e) => {
      if (e.target !== sheet) return;
      clearTimeout(fallback);
      finish();
    }, { once: true });
  };

  sheet.addEventListener('close', () => {
    lenis?.start();
    opener?.focus?.({ preventScroll: true });
  });
  sheet.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // a click that lands on the dialog itself is a click on the backdrop
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close();
  });
  sheet.querySelector('[data-sheet-close]')?.addEventListener('click', close);

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open-waitlist]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger);
  });

  if (location.hash === '#early-access') open();
  return { open, close };
}
