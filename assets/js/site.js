/* Shared behaviour for every page.
   GSAP, ScrollTrigger, SplitText and Flip are loaded from cdnjs before this file. */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  if (!hasGsap) root.classList.remove('motion');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ---------------------------------------------------------------
     Page transition fallback (browsers without cross-document
     view transitions get a quick fade out before navigating).
     --------------------------------------------------------------- */
  if (root.classList.contains('no-vt') && !reduced) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      document.body.classList.add('is-leaving');
      setTimeout(() => { location.href = url.href; }, 260);
    });
    addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('is-leaving'); });
  }

  /* ---------------------------------------------------------------
     Dialogs: resume + contact
     --------------------------------------------------------------- */
  function openSheet(dialog) {
    if (dialog.open) return;
    dialog.showModal();
    if (hasGsap && !reduced) {
      gsap.fromTo(dialog.querySelector('.sheet-inner'),
        { y: 40, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'expo.out' });
    }
  }
  function closeSheet(dialog) {
    if (!dialog.open) return;
    if (hasGsap && !reduced) {
      gsap.to(dialog.querySelector('.sheet-inner'), {
        y: 24, opacity: 0, duration: 0.25, ease: 'power2.in',
        onComplete: () => dialog.close()
      });
    } else {
      dialog.close();
    }
  }
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      const d = document.getElementById(opener.dataset.open);
      if (d) { e.preventDefault(); openSheet(d); }
      return;
    }
    const closer = e.target.closest('[data-close]');
    if (closer) closeSheet(closer.closest('dialog'));
  });
  document.querySelectorAll('dialog.sheet').forEach((d) => {
    // Click on the backdrop (the dialog box itself, outside .sheet-inner) closes it.
    d.addEventListener('click', (e) => { if (e.target === d) closeSheet(d); });
    d.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(d); });
  });

  /* ---------------------------------------------------------------
     Full screen viewer. Any .asset figure can open it; the image
     grows out of its thumbnail (FLIP) and shrinks back on close.
     --------------------------------------------------------------- */
  const viewer = document.getElementById('viewer');
  const vScroll = viewer.querySelector('.viewer-scroll');
  const vPages = viewer.querySelector('.viewer-pages');
  const vTitle = viewer.querySelector('.viewer-title');
  const vDownload = viewer.querySelector('[data-viewer-download]');
  const vBg = viewer.querySelector('.viewer-bg');
  let source = null;

  function pagesOf(fig) {
    if (fig.dataset.pages) return fig.dataset.pages.split(',').map((s) => s.trim());
    const img = fig.querySelector('.asset-frame img');
    return [fig.dataset.full || img.currentSrc || img.src];
  }

  function flipFrom(fromEl, toEl, reverse, done) {
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    if (!a.width || !b.width || reduced || !hasGsap) { done && done(); return; }
    const delta = {
      x: a.left - b.left,
      y: a.top - b.top,
      scaleX: a.width / b.width,
      scaleY: a.height / b.height
    };
    gsap.set(toEl, { transformOrigin: '0 0' });
    if (reverse) {
      gsap.to(toEl, { ...delta, duration: 0.5, ease: 'expo.inOut', onComplete: done });
    } else {
      gsap.fromTo(toEl, delta, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.75, ease: 'expo.out', onComplete: done });
    }
  }

  function openViewer(fig, startIndex = 0) {
    source = fig;
    const pages = pagesOf(fig);
    const title = fig.dataset.title || '';
    vTitle.innerHTML = '';
    vTitle.append(title);
    if (pages.length > 1) {
      const span = document.createElement('span');
      span.textContent = `${pages.length} pages`;
      vTitle.append(span);
    }
    const dl = fig.querySelector('[download]');
    vDownload.hidden = !dl;
    if (dl) {
      vDownload.href = dl.getAttribute('href');
      vDownload.setAttribute('download', dl.getAttribute('download'));
    }
    vPages.className = 'viewer-pages' + (fig.dataset.transparent ? ' is-transparent' : '');
    vPages.innerHTML = '';
    pages.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.alt = pages.length > 1 ? `${title}, page ${i + 1} of ${pages.length}` : title;
      img.decoding = 'async';
      // Documents sit on white; transparent artwork (logos) can name its own backdrop.
      if (fig.dataset.bg) img.style.background = fig.dataset.bg;
      img.addEventListener('click', () => vPages.classList.toggle('is-long'));
      vPages.append(img);
    });
    viewer.showModal();
    document.body.style.overflow = 'hidden';
    const target = vPages.children[startIndex] || vPages.children[0];
    const thumb = fig.querySelector('.asset-frame img');
    const go = () => {
      if (startIndex) target.scrollIntoView({ block: 'start' });
      if (hasGsap && !reduced) {
        gsap.fromTo(vBg, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
        gsap.fromTo(viewer.querySelector('.viewer-bar'), { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.25, ease: 'power3.out' });
        // Pages after the first slide in underneath once the hero image lands.
        gsap.fromTo([...vPages.children].filter((el) => el !== target), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.3, stagger: 0.05, ease: 'power3.out' });
      }
      flipFrom(thumb, target, false);
    };
    target.decode ? target.decode().then(go, go) : go();
  }

  function closeViewer() {
    if (!viewer.open) return;
    const thumb = source && source.querySelector('.asset-frame img');
    const first = [...vPages.children].find((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    }) || vPages.children[0];
    const finish = () => {
      viewer.close();
      document.body.style.overflow = '';
      vPages.innerHTML = '';
      if (thumb) source.querySelector('.asset-frame').focus({ preventScroll: true });
    };
    const thumbVisible = thumb && (() => { const r = thumb.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })();
    if (hasGsap && !reduced) {
      gsap.to(vBg, { opacity: 0, duration: 0.45, ease: 'power2.inOut' });
      gsap.to(viewer.querySelector('.viewer-bar'), { opacity: 0, duration: 0.2 });
      gsap.to([...vPages.children].filter((el) => el !== first), { opacity: 0, duration: 0.2 });
      if (thumbVisible) flipFrom(thumb, first, true, finish);
      else gsap.to(first, { opacity: 0, scale: 0.94, duration: 0.3, ease: 'power2.in', onComplete: finish });
    } else {
      finish();
    }
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.asset-frame, [data-fullscreen]');
    if (!trigger) return;
    const fig = trigger.closest('.asset') || document.getElementById(trigger.dataset.fullscreen);
    if (!fig) return;
    e.preventDefault();
    openViewer(fig, Number(fig.dataset.index || 0));
  });
  viewer.querySelector('[data-viewer-close]').addEventListener('click', closeViewer);
  viewer.addEventListener('cancel', (e) => { e.preventDefault(); closeViewer(); });
  vScroll.addEventListener('click', (e) => { if (e.target === vScroll || e.target === vPages) closeViewer(); });
  window.SiteViewer = { open: openViewer };

  /* ---------------------------------------------------------------
     Deck: one large slide plus a strip of thumbnails
     --------------------------------------------------------------- */
  document.querySelectorAll('[data-deck]').forEach((fig) => {
    const pages = pagesOf(fig);
    const img = fig.querySelector('.asset-frame img');
    const count = fig.querySelector('.deck-count');
    const strip = fig.parentElement.querySelector('.deck-strip');
    const show = (i) => {
      i = (i + pages.length) % pages.length;
      fig.dataset.index = i;
      if (hasGsap && !reduced) {
        gsap.fromTo(img, { opacity: 0.2, x: 24 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' });
      }
      img.src = pages[i];
      img.alt = `Final presentation, slide ${i + 1} of ${pages.length}`;
      count.textContent = `${i + 1} / ${pages.length}`;
      strip.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    };
    fig.querySelector('[data-deck-prev]').addEventListener('click', () => show(Number(fig.dataset.index) - 1));
    fig.querySelector('[data-deck-next]').addEventListener('click', () => show(Number(fig.dataset.index) + 1));
    strip.querySelectorAll('button').forEach((b, j) => b.addEventListener('click', () => show(j)));
  });

  /* ---------------------------------------------------------------
     Home: the name reacts to the cursor, letters thicken as it passes.
     --------------------------------------------------------------- */
  const name = document.querySelector('[data-weight-name]');
  if (name && !reduced && matchMedia('(hover: hover)').matches) {
    const chars = [];
    name.querySelectorAll('.line').forEach((line) => {
      const text = line.textContent;
      line.textContent = '';
      [...text].forEach((c) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        line.append(s);
        chars.push({ el: s, w: 700, target: 700 });
      });
    });
    let px = -1e4, py = -1e4, raf = 0;
    const tick = () => {
      let moving = false;
      chars.forEach((c) => {
        const r = c.el.getBoundingClientRect();
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        c.target = 460 + 440 * Math.max(0, 1 - d / 260);
        c.w += (c.target - c.w) * 0.14;
        if (Math.abs(c.target - c.w) > 0.5) moving = true;
        c.el.style.setProperty('--w', c.w.toFixed(0));
      });
      raf = moving ? requestAnimationFrame(tick) : 0;
    };
    addEventListener('pointermove', (e) => {
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    // Settle into the resting weight once the pointer leaves the window.
    document.addEventListener('pointerleave', () => { px = py = -1e4; if (!raf) raf = requestAnimationFrame(tick); });
    chars.forEach((c) => c.el.style.setProperty('--w', 700));
    requestAnimationFrame(() => { chars.forEach((c) => { c.w = 700; }); px = py = -1e4; raf = requestAnimationFrame(tick); });
  }

  /* Work covers drift a few pixels toward the cursor. */
  if (!reduced && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.work-link').forEach((link) => {
      const media = link.querySelector('.work-media');
      if (!media) return;
      link.addEventListener('pointermove', (e) => {
        const r = media.getBoundingClientRect();
        media.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - 0.5) * -16}px`);
        media.style.setProperty('--my', `${((e.clientY - r.top) / r.height - 0.5) * -16}px`);
      });
      link.addEventListener('pointerleave', () => {
        media.style.setProperty('--mx', '0px');
        media.style.setProperty('--my', '0px');
      });
    });
  }

  if (!hasGsap) return;

  /* ---------------------------------------------------------------
     Progressive disclosure. Each kind of content gets its own move,
     so the page does not fade every block in the same way.
     --------------------------------------------------------------- */
  const reveal = (el, from, extra = {}) => ({
    trigger: el,
    start: 'top 86%',
    once: true,
    ...extra
  });

  if (reduced) {
    gsap.set('[data-reveal]', { autoAlpha: 1 });
  } else {
    // Headings: lines rise out of a mask.
    document.querySelectorAll('[data-reveal="lines"]').forEach((el) => {
      gsap.set(el, { autoAlpha: 1 });
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 110,
          duration: 1,
          stagger: 0.09,
          ease: 'expo.out',
          scrollTrigger: reveal(el)
        })
      });
    });

    // Body copy: words settle in from a slight offset, quick stagger.
    document.querySelectorAll('[data-reveal="text"]').forEach((box) => {
      gsap.set(box, { autoAlpha: 1 });
      // Split each paragraph on its own so block spacing survives.
      const blocks = box.matches('p') ? [box] : box.querySelectorAll('p, li');
      blocks.forEach((el) => SplitText.create(el, {
        type: 'lines',
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          autoAlpha: 0,
          y: 18,
          duration: 0.8,
          stagger: 0.045,
          ease: 'power3.out',
          scrollTrigger: reveal(el, null, { start: 'top 92%' })
        })
      }));
    });

    // Images: a curtain lifts while the picture settles from a slight zoom.
    document.querySelectorAll('[data-reveal="wipe"]').forEach((el) => {
      const img = el.querySelector('img');
      const tl = gsap.timeline({ scrollTrigger: reveal(el, null, { start: 'top 88%' }) });
      tl.fromTo(el, { autoAlpha: 1, clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut' });
      if (img) tl.from(img, { scale: 1.25, duration: 1.6, ease: 'expo.out', clearProps: 'scale' }, 0.15);
    });

    // Pairs (two personas, two maps): slide in from opposite sides and straighten.
    document.querySelectorAll('[data-reveal="pair"]').forEach((el) => {
      gsap.set(el, { autoAlpha: 1 });
      const [a, b] = el.children;
      const tl = gsap.timeline({ scrollTrigger: reveal(el, null, { start: 'top 80%' }) });
      tl.from(a, { xPercent: -14, rotation: -3, autoAlpha: 0, duration: 1.1, ease: 'expo.out' })
        .from(b, { xPercent: 14, rotation: 3, autoAlpha: 0, duration: 1.1, ease: 'expo.out' }, 0.12);
    });

    // Lists and grids: items stack up one after another.
    document.querySelectorAll('[data-reveal="stack"]').forEach((el) => {
      gsap.set(el, { autoAlpha: 1 });
      gsap.from(el.children, {
        y: 48,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'expo.out',
        scrollTrigger: reveal(el)
      });
    });

    // Color swatches pour upward like paint filling a jar.
    document.querySelectorAll('[data-reveal="swatches"]').forEach((el) => {
      gsap.set(el, { autoAlpha: 1 });
      gsap.from(el.children, {
        clipPath: 'inset(100% 0% 0% 0%)',
        duration: 1,
        stagger: 0.09,
        ease: 'expo.inOut',
        scrollTrigger: reveal(el)
      });
    });

    // Sketches drop onto the page like loose paper and land at a slight angle.
    document.querySelectorAll('[data-reveal="paper"]').forEach((el) => {
      gsap.set(el, { autoAlpha: 1 });
      [...el.children].forEach((child, i) => {
        gsap.from(child, {
          y: -80,
          rotation: (i % 2 ? 1 : -1) * (6 + i * 2),
          autoAlpha: 0,
          duration: 1.1,
          delay: i * 0.12,
          ease: 'back.out(1.4)',
          scrollTrigger: reveal(el, null, { start: 'top 78%' })
        });
      });
    });

    // Hero entrance on page load.
    const heroBits = document.querySelectorAll('[data-reveal="load"]');
    if (heroBits.length) {
      gsap.fromTo(heroBits, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1, delay: 0.15, ease: 'expo.out' });
    }
  }

  /* ---------------------------------------------------------------
     Sticky process timeline
     --------------------------------------------------------------- */
  const timeline = document.querySelector('.timeline');
  if (timeline) {
    const links = [...timeline.querySelectorAll('a')];
    const ol = timeline.querySelector('ol');
    const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
    const setActive = (i) => {
      links.forEach((a, j) => {
        a.classList.toggle('is-active', j === i);
        a.classList.toggle('is-done', j < i);
        if (j === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      });
      const a = links[i];
      if (a && ol.scrollWidth > ol.clientWidth) {
        ol.scrollTo({ left: a.parentElement.offsetLeft - 16, behavior: reduced ? 'auto' : 'smooth' });
      }
    };
    sections.forEach((sec, i) => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: (self) => { if (self.isActive) setActive(i); }
      });
    });
    gsap.to(timeline.querySelector('.timeline-fill'), {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: sections[0],
        start: 'top 50%',
        endTrigger: sections[sections.length - 1],
        end: 'bottom 50%',
        scrub: 0.4
      }
    });
  }

  /* ---------------------------------------------------------------
     Final screens: on wide screens, vertical scroll drives the strip
     sideways while the section is pinned.
     --------------------------------------------------------------- */
  const screens = document.querySelector('.screens');
  if (screens && !reduced) {
    gsap.matchMedia().add('(min-width: 900px)', () => {
      const track = screens.querySelector('.screens-track');
      screens.classList.add('is-pinned');
      const distance = () => track.scrollWidth - screens.clientWidth;
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: screens,
          start: 'center 58%',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          // Refresh before the timeline triggers so their positions include the pin spacing.
          refreshPriority: 1
        }
      });
      // Each phone tilts slightly while it travels, then settles.
      track.querySelectorAll('.asset').forEach((card) => {
        gsap.fromTo(card, { rotation: 4, y: 30 }, {
          rotation: 0,
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: card,
            containerAnimation: tween,
            start: 'left right',
            end: 'center center',
            scrub: true
          }
        });
      });
      return () => screens.classList.remove('is-pinned');
    });
  }

  /* Case hero background drifts slower than the page and settles out of its zoom. */
  const heroBg = document.querySelector('.case-bg img');
  if (heroBg && !reduced) {
    gsap.fromTo(heroBg, { '--bg-zoom': 1.14 }, { '--bg-zoom': 1.06, duration: 1.6, ease: 'expo.out' });
    gsap.to(heroBg, {
      '--bg-shift': '120px',
      ease: 'none',
      scrollTrigger: { trigger: '.case-hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
})();
