/**
 * TZ Digital — Lightweight scroll controller for simple content pages
 * (no pinned hero/portfolio sections, no Three.js — see js/main.js for the homepage version)
 * Native scroll throughout, no scroll-hijacking library.
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Smooth in-page scroll for anchor links — native, respects reduced-motion. */
  function smoothScrollTo(target, offset) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY + (offset || 0);
    window.scrollTo({ top: y, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('nav-toggle');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      const isOpen = nav.classList.toggle('nav--open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    nav.querySelectorAll('.nav__links a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('nav--open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function scrollLoop() {
    if (nav) {
      nav.classList.toggle('nav--scrolled', window.scrollY > 60);
    }
    requestAnimationFrame(scrollLoop);
  }
  requestAnimationFrame(scrollLoop);

  if (!prefersReducedMotion) {
    const fadeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.fade-in-view').forEach(function (el) {
      fadeObserver.observe(el);
    });
  } else {
    document.querySelectorAll('.fade-in-view').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;
      e.preventDefault();
      smoothScrollTo(targetEl, -80);
    });
  });
})();
