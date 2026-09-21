// Client glue for the offer editor forms. Intercepts submit, calls the typed
// offers.create / offers.update action (JSON), and renders the result: on success
// it navigates; on a validation failure it places the field errors inline without
// losing what the operator typed. Shared by /admin/offers/new and /[slug].

import { actions } from 'astro:actions';
import { OFFER_FIELDS } from '@domain/offers/offer-fields';

interface Options {
  form: HTMLFormElement;
  mode: 'create' | 'edit';
  slug?: string;
}

export function bindOfferForm({ form, mode, slug }: Options) {
  const banner = document.querySelector<HTMLElement>('[data-form-error]');

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

  // One entry per registry field; the two non-column controls (slug, ongoing)
  // and the attribute chips are added by hand.
  const collect = () => {
    const fd = new FormData(form);
    const out: Record<string, unknown> = {
      slug: mode === 'create' ? String(fd.get('slug') ?? '') : slug!,
      ongoing: fd.has('ongoing'),
      attrs: fd.getAll('attr').map(String),
    };
    for (const f of OFFER_FIELDS) {
      out[f.name] = f.input === 'checkbox' ? fd.has(f.name) : String(fd.get(f.name) ?? '');
    }
    return out;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const btn = (e.submitter as HTMLButtonElement | null) ?? form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (btn) btn.disabled = true;

    const payload = collect() as Parameters<typeof actions.offers.update>[0];
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

    if (mode === 'create' && 'slug' in data) {
      location.assign(`/admin/offers/${data.slug}?created=1`);
    } else {
      const p = new URLSearchParams({ done: 'save' });
      if ('deploy' in data && data.deploy) p.set('deploy', data.deploy.status);
      location.assign(`/admin/offers/${slug}?${p}`);
    }
  });
}
