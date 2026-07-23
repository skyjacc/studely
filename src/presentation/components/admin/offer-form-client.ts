// Client glue for the offer editor forms. Intercepts submit, calls the typed
// offers.create / offers.update action (JSON), and renders the result: on success
// it navigates; on a validation failure it places the field errors inline without
// losing what the operator typed. Shared by /admin/offers/new and /[slug].

import { actions } from 'astro:actions';

interface Options {
  form: HTMLFormElement;
  mode: 'create' | 'edit';
  slug?: string;
}

export function bindOfferForm({ form, mode, slug }: Options) {
  const banner = form.querySelector<HTMLElement>('[data-form-error]');

  const clearErrors = () => {
    form.querySelectorAll('.er[data-client]').forEach((e) => e.remove());
    if (banner) { banner.hidden = true; banner.textContent = ''; }
  };

  const showBanner = (msg: string) => {
    if (banner) { banner.hidden = false; banner.textContent = msg; }
  };

  const showFieldError = (name: string, msg: string) => {
    const field = form.querySelector(`[name="${name}"]`)?.closest('.f');
    if (!field) return showBanner(msg);
    const span = document.createElement('span');
    span.className = 'er';
    span.dataset.client = '1';
    span.textContent = msg;
    field.appendChild(span);
  };

  const collect = () => {
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? '');
    const b = (k: string) => fd.has(k);
    return {
      slug: mode === 'create' ? s('slug') : slug!,
      title: s('title'), provider: s('provider'), category: s('category'), summary: s('summary'),
      value: s('value'), body: s('body'), url: s('url'), verification: s('verification'),
      eligibility: s('eligibility'), offer_type: s('offer_type'), discount_percent: s('discount_percent'),
      status: s('status'), tags: s('tags'), expires_at: s('expires_at'),
      affiliate: b('affiliate'), sponsored: b('sponsored'), featured: b('featured'), ongoing: b('ongoing'),
      attrs: fd.getAll('attr').map(String),
    };
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const btn = (e.submitter as HTMLButtonElement | null) ?? form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (btn) btn.disabled = true;

    const payload = collect();
    const { data, error } = mode === 'create'
      ? await actions.offers.create(payload)
      : await actions.offers.update(payload);

    if (error) {
      showBanner(error.message);
      if (btn) btn.disabled = false;
      return;
    }
    if (!data.ok) {
      for (const [k, msg] of Object.entries(data.errors ?? {})) {
        if (k === '_') showBanner(msg);
        else showFieldError(k, msg);
      }
      if (btn) btn.disabled = false;
      return;
    }

    if (mode === 'create' && 'slug' in data) location.assign(`/admin/offers/${data.slug}?created=1`);
    else location.assign(`/admin/offers/${slug}?done=save`);
  });
}
