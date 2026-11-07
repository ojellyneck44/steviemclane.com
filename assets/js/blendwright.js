/* Blendwright formula label demo: add-in toggles show or hide a label row
   and fill or drain that group's layer in the jar. CSS handles the motion. */
(() => {
  const demo = document.querySelector('.bw-demo');
  if (!demo) return;
  demo.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      const group = btn.dataset.toggle;
      btn.setAttribute('aria-pressed', String(on));
      demo.querySelector(`.bw-rows [data-group="${group}"]`).hidden = !on;
      demo.querySelector(`.bw-jar [data-group="${group}"]`).style.setProperty('--h', on ? btn.dataset.h : 0);
    });
  });
})();
