const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT;

async function submit(email) {
  if (!ENDPOINT) {
    if (import.meta.env.DEV) {
      console.warn('[waitlist] VITE_WAITLIST_ENDPOINT is not set; this signup was not stored.');
      await new Promise((r) => setTimeout(r, 600));
      return;
    }
    throw new Error('waitlist endpoint not configured');
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'landing' }),
  });
  if (!res.ok) throw new Error(`waitlist ${res.status}`);
}

export function initWaitlists() {
  for (const form of document.querySelectorAll('[data-waitlist]')) {
    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');
    const field = form.querySelector('.field');
    const status = form.querySelector('[data-status]');
    const idleText = status.textContent;

    input.addEventListener('input', () => {
      if (field.classList.contains('is-invalid')) {
        field.classList.remove('is-invalid');
        status.textContent = idleText;
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = input.value.trim();
      if (!EMAIL.test(email)) {
        field.classList.remove('is-invalid');
        void field.offsetWidth;
        field.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        status.textContent = 'That email doesn’t look right. Check it and try again.';
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      button.disabled = true;
      button.dataset.label ??= button.textContent;
      button.textContent = 'Joining…';
      try {
        await submit(email);
        form.classList.add('is-done');
        input.value = '';
        status.textContent = 'You’re on the list. We’ll email you once, when it’s ready.';
        button.textContent = 'On the list';
      } catch {
        status.textContent = 'Couldn’t reach the list just now. Try again in a moment.';
        button.textContent = button.dataset.label;
        button.disabled = false;
      }
    });
  }
}
