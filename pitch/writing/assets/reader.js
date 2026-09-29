(function () {
  'use strict';
  var navLinks = Array.from(document.querySelectorAll('nav a'));
  var chapters = Array.from(document.querySelectorAll('.chapter'));
  document.getElementById('print-page').onclick = function () { window.print(); };
  document.getElementById('font-size').onclick = function () {
    var enlarged = document.body.classList.toggle('large-text');
    this.setAttribute('aria-pressed', String(enlarged));
    this.textContent = enlarged ? '標準字體' : '放大字體';
  };
  function revealArchive() {
    if (location.hash.indexOf('#archive') === 0) {
      document.getElementById('archive-panel').open = true;
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }
  window.addEventListener('hashchange', function () {
    revealArchive();
    setTimeout(updateNav, 50);
  });
  revealArchive();
  var ticking = false;
  function updateNav() {
    var current = 'overview';
    var threshold = window.innerWidth <= 760 ? 160 : 110;
    chapters.forEach(function (chapter) {
      if (chapter.getClientRects().length && chapter.getBoundingClientRect().top <= threshold) current = chapter.id;
    });
    navLinks.forEach(function (link) {
      if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateNav); }
  }, {passive: true});
  updateNav();
}());
