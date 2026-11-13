/* Headroom — marketing site. Vanilla JS, no build step.
   Every animation here is one the app has (docs/DESIGN.md "Motion"):
   count-up and swell, numeric roll, meters/rings/bars growing from empty,
   dots and calendar cells popping in one after another, paid bills sliding
   out, the confirmation banner springing up, buttons shrinking under the finger. */
(() => {
  'use strict';

  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => reduceQuery.matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Sample data (docs: marketing brief). Minor units throughout.
  const SAFE = 28500;
  const DAYS = 8;
  const BALANCE = 85000;
  const SPOKEN_FOR = 30000 + 26500; // bills before payday + set aside

  const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
  const fmt = minor => cad.format(minor / 100);
  const perDay = safeMinor => Math.round(safeMinor / DAYS); // half-up, as the app rounds for display
  const MASK = '$•••';

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeSmooth = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Runs `update(value)` from `from` to `to` over `duration` ms. Reduce Motion skips to the end. */
  function tween(from, to, duration, update, easing = easeOut, done) {
    if (reduce() || duration <= 0 || from === to) { update(to); done && done(); return () => {}; }
    let raf = 0;
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      update(from + (to - from) * easing(t));
      if (t < 1) raf = requestAnimationFrame(step); else done && done();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }

  /** Writes a money value into a .money element (split whole/cents when it has them). */
  function writeMoney(el, minor, masked) {
    const text = masked ? MASK : fmt(Math.round(minor));
    const whole = $('.whole', el), cents = $('.cents', el);
    if (whole && cents) {
      if (masked) { whole.textContent = MASK; cents.textContent = ''; }
      else { const i = text.lastIndexOf('.'); whole.textContent = text.slice(0, i); cents.textContent = text.slice(i); }
    } else {
      el.textContent = (el.dataset.prefix || '') + text;
    }
  }

  /** Rolls a .money element to a new value (numericText in the app). */
  function roll(el, toMinor, { duration = 500, delay = 0, easing = easeSmooth } = {}) {
    const from = Number(el.dataset.minor ?? 0);
    el.dataset.minor = String(toMinor);
    const masked = el.closest('.is-masked') != null;
    if (el._stop) el._stop();
    const go = () => { el._stop = tween(from, toMinor, duration, v => writeMoney(el, v, masked), easing); };
    if (delay && !reduce()) setTimeout(go, delay); else go();
  }

  /** The hero swell: scale 1 → 1.04 → 1 when the figure changes. */
  function swell(el) {
    el.classList.remove('swell'); void el.offsetWidth; el.classList.add('swell');
    el.addEventListener('animationend', () => el.classList.remove('swell'), { once: true });
  }

  /** Hide amounts: every .amt and .money inside root masks as $•••. */
  function setMasked(root, on) {
    root.classList.toggle('is-masked', on);
    $$('.amt', root).forEach(el => {
      if (el.classList.contains('money')) return;
      if (!('amt' in el.dataset)) el.dataset.amt = el.textContent;
      if (!('full' in el.dataset)) el.dataset.full = el.textContent;
      el.textContent = on ? el.dataset.full.replace(el.dataset.amt, MASK) : el.dataset.full;
    });
    $$('.money', root).forEach(el => writeMoney(el, Number(el.dataset.minor || 0), on));
  }

  /** Confirmation banner: springs up from the bottom, goes away by itself. */
  function showBanner(el, text, ms = 4500) {
    clearTimeout(el._timer);
    el.textContent = text;
    el.classList.remove('is-shown'); void el.offsetWidth; el.classList.add('is-shown');
    el._timer = setTimeout(() => el.classList.remove('is-shown'), ms);
    el.onclick = () => { clearTimeout(el._timer); el.classList.remove('is-shown'); };
  }

  // ---------- Scroll triggers (once) ----------
  const runners = {};
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      e.target.classList.add('is-in');
      const run = runners[e.target.dataset.animate];
      if (run) run(e.target);
    }
  }, { threshold: .25, rootMargin: '0px 0px -8% 0px' });

  // ---------- Hero mockup (Home) ----------
  const heroPhone = $('#hero-phone');
  if (heroPhone) {
    const figure = $('.js-hero-figure', heroPhone);
    const ring = $('.ring', heroPhone);
    const split = $('.js-split-toggle', heroPhone);
    const fold = $('#split-card');
    const banner = $('.js-banner', heroPhone);
    const eye = $('.js-hide-amounts', heroPhone);
    const counted = $('.coming-head .amt', heroPhone);
    const heroCard = $('.hero-card', heroPhone);
    const stamp = $('.stamp', heroPhone);
    let countedMinor = 30000;
    let safeMinor = SAFE;

    const countUp = () => {
      figure.dataset.minor = '0';
      writeMoney(figure, 0, heroPhone.classList.contains('is-masked'));
      roll(figure, safeMinor, { duration: 1200, delay: 150, easing: easeOut });
      setTimeout(() => ring.classList.add('is-in'), 50);
    };
    heroPhone.dataset.animate = 'hero';
    runners.hero = countUp;
    io.observe(heroPhone);

    split.addEventListener('click', () => {
      const open = split.getAttribute('aria-expanded') !== 'true';
      split.setAttribute('aria-expanded', String(open));
      fold.classList.toggle('is-open', open);
      $('.js-split-label', split).innerHTML = open
        ? 'Hide the breakdown'
        : `Where's the rest of my <span class="amt" data-amt="$850.00">$850.00</span>?`;
      if (heroPhone.classList.contains('is-masked')) setMasked(heroPhone, true);
    });

    eye.addEventListener('click', () => {
      const on = eye.getAttribute('aria-pressed') !== 'true';
      eye.setAttribute('aria-pressed', String(on));
      eye.setAttribute('aria-label', on ? 'Show amounts' : 'Hide amounts');
      setMasked(heroPhone, on);
    });

    const setShort = short => {
      heroCard.classList.toggle('is-short', short);
      stamp.textContent = short ? 'Short' : 'Payday in 8 days';
      let reason = $('.short-reason', heroCard);
      if (short && !reason) {
        reason = document.createElement('p');
        reason.className = 'short-reason';
        reason.innerHTML = `<b>You're <span class="amt" data-amt="$915.00">$915.00</span> short.</b> Bills and set-asides add up to more than your balance. Moving a set-aside would close the gap.`;
        $('.until', heroCard).after(reason);
      } else if (!short && reason) reason.remove();
    };

    $$('.js-pay', heroPhone).forEach(btn => btn.addEventListener('click', () => {
      const row = btn.closest('.bill');
      const wrap = row.parentElement;
      const name = row.dataset.name;
      const amount = Math.round(parseFloat(row.querySelector('.bill-amt').dataset.amt.replace(/[$,]/g, '')) * 100);
      wrap.classList.add('is-paid');
      btn.disabled = true;
      const isCounted = !row.querySelector('.bill-text span').textContent.includes('not counted');
      if (isCounted) {
        countedMinor -= amount;
        counted.dataset.amt = fmt(countedMinor); counted.dataset.full = `${fmt(countedMinor)} counted`;
        if (!heroPhone.classList.contains('is-masked')) counted.textContent = counted.dataset.full;
        showBanner(banner, `${name} marked paid. Safe to spend is still ${fmt(safeMinor)}: the money moved from bills to spent, so it's counted once.`);
      } else {
        safeMinor = Math.max(0, safeMinor - amount);
        roll(figure, safeMinor); swell(figure); setShort(true);
        showBanner(banner, `${name} marked paid. Safe to spend is now ${fmt(safeMinor)}.`);
      }
    }));

    $('.js-hero-replay').addEventListener('click', () => {
      $$('.bill-wrap', heroPhone).forEach(w => { w.classList.remove('is-paid'); w.querySelector('.js-pay').disabled = false; });
      countedMinor = 30000; safeMinor = SAFE;
      counted.dataset.amt = '$300.00'; counted.dataset.full = '$300.00 counted'; counted.textContent = '$300.00 counted';
      setShort(false);
      banner.classList.remove('is-shown');
      fold.classList.remove('is-open'); split.setAttribute('aria-expanded', 'false');
      $('.js-split-label', split).innerHTML = `Where's the rest of my <span class="amt" data-amt="$850.00">$850.00</span>?`;
      ring.classList.remove('is-in');
      if (heroPhone.classList.contains('is-masked')) setMasked(heroPhone, true);
      heroPhone.classList.remove('is-in');
      requestAnimationFrame(() => { heroPhone.classList.add('is-in'); countUp(); });
      heroPhone.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
    });
  }

  // ---------- Formula ----------
  runners.formula = root => {
    $$('.f-fig', root).forEach((el, i) => {
      const target = Number(el.dataset.minor); el.dataset.minor = '0'; writeMoney(el, 0, false);
      roll(el, target, { duration: 500, delay: 200 + i * 240, easing: easeOut });
    });
    const day = $('.f-day', root);
    const target = Number(day.dataset.minor); day.dataset.minor = '0'; writeMoney(day, 0, false);
    roll(day, target, { duration: 600, delay: 1500, easing: easeOut });
  };
  $$('[data-animate]').forEach(el => { if (el.dataset.animate !== 'hero') io.observe(el); });

  // ---------- Try it: the app's sum on the visitor's own figures. Nothing here is stored or sent. ----------
  const tryForm = $('#try-form');
  if (tryForm) {
    const answer = $('#try-answer');
    const icon = $('use', answer);
    const text = $('p', answer);
    // "1,200.50", "1 200,50" (fr-CA) and "$850" all parse; anything else counts as empty.
    const parse = raw => {
      let s = String(raw).replace(/[^0-9.,-]/g, '');
      if (/,\d{1,2}$/.test(s) && !s.includes('.')) s = s.replace(',', '.');
      const n = Number(s.replace(/,/g, ''));
      return s !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
    };
    const render = () => {
      const f = tryForm.elements;
      const balance = parse(f.balance.value), bills = parse(f.bills.value || '0'), aside = parse(f.aside.value || '0');
      const days = Math.max(1, Math.min(62, Math.floor(Number(f.days.value)) || 1));
      if ([balance, bills, aside].some(Number.isNaN)) {
        answer.className = 'answer try-answer is-empty';
        icon.setAttribute('href', '#i-info');
        text.innerHTML = '<span class="detail">Enter your balance to see what\'s safe to spend.</span>';
        return;
      }
      const safe = balance - bills - aside;
      if (safe >= 0) {
        answer.className = 'answer try-answer';
        icon.setAttribute('href', '#i-check');
        text.innerHTML = `<strong class="verdict">${fmt(safe)} safe to spend.</strong> <span class="detail">That's ${fmt(Math.round(safe / days))} a day for ${days} ${days === 1 ? 'day' : 'days'}.</span>`;
      } else {
        answer.className = 'answer try-answer is-no';
        icon.setAttribute('href', '#i-alert');
        text.innerHTML = `<strong class="verdict">${fmt(-safe)} short before payday.</strong> <span class="detail">Bills and set-asides come to more than the balance. The app shows this as a shortfall, never as a negative amount to spend.</span>`;
      }
    };
    tryForm.addEventListener('input', render);
    tryForm.addEventListener('submit', e => e.preventDefault());
    render();
  }

  // ---------- Insights: calendar + ring total ----------
  const cal = $('.js-cal');
  if (cal) {
    const amounts = [14.10, 22.60, 38.30, 0, 9.20, 17.90, 11.45, 29.00, 24.75, 51.20, 8.30, 12.95, 19.40, 0, 23.85, 31.10, 42.60, 7.00, 16.70,
      12.40, 28.75, 46.10, 9.90, 33.10, 0, 21.30, 18.40, 0, 41.20, 12.75, 24.60];
    const busiest = Math.max(...amounts);
    const offset = 3; // October 1, 2026 is a Thursday; Monday-first grid
    const days = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'];
    const frag = document.createDocumentFragment();
    'MTWTFSS'.split('').forEach(l => { const s = document.createElement('span'); s.className = 'wd'; s.textContent = l; frag.appendChild(s); });
    for (let i = 0; i < offset; i++) { const s = document.createElement('span'); s.className = 'cell blank'; frag.appendChild(s); }
    const foot = $('.js-cal-foot');
    const defaultFoot = foot.textContent;
    let selected = null;
    amounts.forEach((amt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      const level = amt === 0 ? 0 : Math.max(1, Math.ceil(amt / busiest * 4));
      b.className = `cell l${level}`;
      b.style.setProperty('--i', i + offset);
      b.textContent = i + 1;
      const label = `${days[i % 7]}, Oct ${i + 1}`;
      b.setAttribute('aria-label', `${label}: ${amt ? fmt(amt * 100) : 'nothing on everyday things'}`);
      b.addEventListener('click', () => {
        if (selected) selected.classList.remove('is-on');
        if (selected === b) { selected = null; foot.textContent = defaultFoot; return; }
        selected = b; b.classList.add('is-on');
        foot.innerHTML = `<b>${label}</b>: ${amt ? fmt(amt * 100) : 'nothing on everyday things'}`;
      });
      frag.appendChild(b);
    });
    cal.appendChild(frag);
    cal.removeAttribute('aria-hidden');
  }
  runners.ring = root => {
    const total = $('.ring-center .money', root);
    const target = Number(total.dataset.minor); total.dataset.minor = '0'; writeMoney(total, 0, false);
    roll(total, target, { duration: 600, delay: 200, easing: easeOut });
  };

  // ---------- Add sheet mockup ----------
  const addPhone = $('#add-phone');
  if (addPhone && $('#home-screen')) {
    const behind = $('.js-behind', addPhone);
    const nav = $('#hero-phone .navbar').cloneNode(true);
    const home = $('#home-screen').cloneNode(true);
    [nav, home].forEach(n => { n.removeAttribute('id'); $$('[id]', n).forEach(e => e.removeAttribute('id')); $$('button', n).forEach(b => { b.tabIndex = -1; b.disabled = true; }); });
    behind.append(nav, home);
    behind.setAttribute('inert', '');
    const bFigure = $('.js-hero-figure', home);
    bFigure.dataset.minor = String(SAFE); writeMoney(bFigure, SAFE, false);
    $('.ring', home).classList.add('is-in');

    const sheet = $('.js-sheet', addPhone);
    const amountEl = $('.js-amount', addPhone);
    const amountField = $('.js-amount-field', addPhone);
    const preview = $('.js-preview', addPhone);
    const [pSafe, pDay] = $$('.money', preview);
    const note = $('.js-note', addPhone);
    const cats = $$('.js-cats span', addPhone);
    const save = $('.js-save', addPhone);
    const banner = $('.js-banner', addPhone);
    let amount = 0;

    const setPreview = () => {
      const after = SAFE - amount;
      roll(pSafe, after); roll(pDay, perDay(after));
    };
    $$('.js-pick', addPhone).forEach(pick => pick.addEventListener('click', () => {
      $$('.js-pick', addPhone).forEach(p => p.classList.toggle('is-on', p === pick));
      amount = Number(pick.dataset.minor);
      amountEl.textContent = (amount / 100).toFixed(2);
      amountEl.classList.remove('placeholder');
      amountField.classList.remove('bump'); void amountField.offsetWidth; amountField.classList.add('bump');
      note.textContent = pick.dataset.note; note.classList.remove('placeholder');
      cats.forEach(c => c.classList.toggle('is-on', c.dataset.cat === pick.dataset.cat));
      save.disabled = false;
      setPreview();
    }));
    save.addEventListener('click', () => {
      if (!amount) return;
      sheet.classList.add('is-down');
      addPhone.classList.add('is-saved');
      const after = SAFE - amount;
      setTimeout(() => {
        roll(bFigure, after); swell(bFigure);
        $('.js-today-left', home).textContent = `${fmt(3088 - amount)} left`;
        showBanner(banner, `Added ${fmt(amount)}. Safe to spend is now ${fmt(after)}.`);
      }, reduce() ? 0 : 350);
    });
    $('.js-add-replay').addEventListener('click', () => {
      banner.classList.remove('is-shown');
      addPhone.classList.remove('is-saved');
      sheet.classList.remove('is-down');
      amount = 0;
      amountEl.textContent = '0.00'; amountEl.classList.add('placeholder');
      note.textContent = 'Note (optional), e.g. Lunch with Sam'; note.classList.add('placeholder');
      cats.forEach(c => c.classList.remove('is-on'));
      $$('.js-pick', addPhone).forEach(p => p.classList.remove('is-on'));
      save.disabled = true;
      roll(pSafe, SAFE); roll(pDay, perDay(SAFE));
      roll(bFigure, SAFE);
      $('.js-today-left', home).textContent = '$30.88 left';
    });
  }

  // ---------- Privacy: hide amounts ----------
  const maskSwitch = $('.js-mask-switch');
  if (maskSwitch) {
    const widget = $('.widget');
    const set = on => { maskSwitch.setAttribute('aria-checked', String(on)); setMasked(widget, on); };
    maskSwitch.addEventListener('click', () => set(maskSwitch.getAttribute('aria-checked') !== 'true'));
    runners.privacy = () => {
      // One demonstration, then it's yours.
      setTimeout(() => set(true), 900);
      setTimeout(() => { if (!maskSwitch.matches(':hover, :focus')) set(false); }, 2600);
    };
  }

  // ---------- Pro themes ----------
  const swatches = $$('.swatch');
  if (swatches.length) {
    const targets = () => [$('#hero-phone'), $('.theme-preview')].filter(Boolean);
    let chosen = 'navy';
    const apply = name => targets().forEach(t => t.dataset.theme = name);
    swatches.forEach(s => {
      s.addEventListener('click', () => {
        chosen = s.dataset.theme; apply(chosen);
        swatches.forEach(o => { const on = o === s; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', String(on)); });
      });
      s.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') apply(s.dataset.theme); });
      s.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') apply(chosen); });
      s.addEventListener('focus', () => apply(s.dataset.theme));
      s.addEventListener('blur', () => apply(chosen));
    });
  }

  // ---------- Launch list (Formspree, plain fetch: no third-party script) ----------
  // Each form says where on the page it is ("placement") and carries the ?ref= tag of the
  // link that brought the visitor, so sign-ups can be counted per ad without any analytics.
  const forms = $$('.js-notify');
  const refTag = (() => {
    const q = new URLSearchParams(location.search);
    return (q.get('ref') || q.get('utm_source') || '').replace(/[^\w.-]/g, '').slice(0, 40);
  })();
  const LABEL = 'Email me at launch';
  const THANKS = 'Thanks. We\'ll email you when Headroom is on the App Store and when there\'s a new update.';
  forms.forEach(notify => {
    const email = $('.js-notify-email', notify);
    const submit = $('.js-notify-submit', notify);
    const status = $('.js-notify-status', notify);
    const say = (text, kind) => { status.textContent = text; status.className = `notify-status js-notify-status ${kind ? 'is-' + kind : ''}`; };
    const invalid = on => email.setAttribute('aria-invalid', String(on));
    notify.elements.ref.value = refTag;

    email.addEventListener('input', () => { if (email.getAttribute('aria-invalid') === 'true' && email.validity.valid) { invalid(false); say(''); } });

    notify.addEventListener('submit', async e => {
      e.preventDefault();
      if (!email.validity.valid) {
        invalid(true);
        say(email.validity.valueMissing ? 'Enter your email address.' : 'That email address doesn\'t look right.', 'error');
        email.focus();
        return;
      }
      invalid(false);
      submit.disabled = true; submit.textContent = 'Sending…'; say('');
      try {
        const res = await fetch(notify.action, { method: 'POST', body: new FormData(notify), headers: { Accept: 'application/json' } });
        if (res.ok) {
          // One sign-up is enough: every form on the page shows the thank-you.
          forms.forEach(f => {
            f.classList.add('is-done');
            const st = $('.js-notify-status', f);
            st.textContent = THANKS;
            st.className = 'notify-status js-notify-status is-done';
          });
          return;
        }
        const data = await res.json().catch(() => ({}));
        const errors = Array.isArray(data.errors) ? data.errors : [];
        if (errors.some(er => er.field === 'email')) { invalid(true); email.focus(); }
        // Formspree's messages read like "should be an email": capitalise and close them.
        const tidy = m => { m = String(m).trim(); return m ? m[0].toUpperCase() + m.slice(1) + (/[.!?]$/.test(m) ? '' : '.') : ''; };
        say(errors.map(er => tidy(er.message)).filter(Boolean).join(' ') || 'That didn\'t go through. Please try again.', 'error');
      } catch {
        say('Couldn\'t send. Check your connection and try again.', 'error');
      } finally {
        if (!notify.classList.contains('is-done')) { submit.disabled = false; submit.textContent = LABEL; }
      }
    });
  });

  // Buttons that lead to a form: scroll to it, focus the email field, and record which button it was.
  const goTo = (formEl, placement) => {
    if (!formEl) return;
    if (placement) formEl.elements.placement.value = placement;
    formEl.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
    $('.js-notify-email', formEl).focus({ preventScroll: true });
  };
  // Until the app is out, the store button takes people to the list.
  $$('.store-badge').forEach(b => b.addEventListener('click', () => goTo($('#notify-hero'), 'nav')));
  $$('.js-try-cta').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goTo($('#notify-closing'), 'calculator'); }));

  // ---------- Promo video: if this browser can't play it, show the poster and a link ----------
  const promo = $('.js-promo');
  if (promo) {
    const fallback = () => {
      if (!promo.isConnected) return;
      const link = document.createElement('a');
      link.className = 'video-fallback'; link.href = 'assets/promo.mp4';
      link.innerHTML = '<img src="assets/promo-poster.jpg" alt=""><span>Watch or download the video</span>';
      promo.replaceWith(link);
    };
    const source = $('source', promo);
    if (source) source.addEventListener('error', fallback);
    promo.addEventListener('error', fallback);
    if (!promo.canPlayType('video/mp4')) fallback();
  }

  // ---------- Reduce Motion: show end states at once ----------
  const applyReduce = () => { if (reduce()) $$('[data-animate]').forEach(el => { el.classList.add('is-in'); io.unobserve(el); const r = runners[el.dataset.animate]; if (r && !el._ran) { el._ran = true; r(el); } }); };
  reduceQuery.addEventListener('change', applyReduce);
  applyReduce();
})();
