/**
 * TZ Digital DE — Main scroll controller
 * Native scroll throughout, except the pinned hero (below) which drives the
 * rotating badge 1:1 off scroll progress. A single RAF loop drives
 * ScrollTrigger sync and scroll-linked effects (no scroll-hijacking library).
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  gsap.registerPlugin(ScrollTrigger);
  // Mobile browsers fire resize events when the address bar hides/shows mid-scroll —
  // without this, ScrollTrigger's own pin math can jump when that happens.
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* Smooth in-page scroll for anchor links/buttons — native, respects
     reduced-motion, no momentum/resistance layered on top. */
  function smoothScrollTo(target, offset) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY + (offset || 0);
    window.scrollTo({ top: y, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  const heroPin = document.getElementById('hero-pin');
  const hero = document.getElementById('hero');
  const heroHeadline = document.getElementById('hero-headline');
  const heroDesc = document.getElementById('hero-desc');

  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('nav-toggle');
  if (navToggle && nav) {
    // .nav--open drives the per-item staggered clip-path reveal +
    // hamburger↔X, toggled instantly both ways. .nav--inverted drives the
    // bar's violet/dark-ink flip — added in the same instant as
    // .nav--open on OPEN, but on CLOSE it's held until the last band
    // finishes retracting (nth-child(1)'s 0.18s delay + 0.3s duration,
    // see styles.css) so the bar only flips back once the whole cascade
    // has actually collapsed, same asymmetry seen on soma.ca.
    let navCloseTimer = null;
    function openNav() {
      clearTimeout(navCloseTimer);
      nav.classList.add('nav--open', 'nav--inverted');
      navToggle.setAttribute('aria-expanded', 'true');
    }
    function closeNav() {
      nav.classList.remove('nav--open');
      navToggle.setAttribute('aria-expanded', 'false');
      clearTimeout(navCloseTimer);
      navCloseTimer = setTimeout(function () {
        nav.classList.remove('nav--inverted');
      }, 480);
    }
    navToggle.addEventListener('click', function () {
      if (nav.classList.contains('nav--open')) closeNav(); else openNav();
    });
    nav.querySelectorAll('.nav__links a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });
  }

  /* DE/EN nav toggle — UI only for now (no English copy on the page yet
     to switch to), just tracks which button is marked active/pressed.
     Single pill in .nav__right, shown at all breakpoints; matched by
     data-lang rather than element identity in case that ever changes. */
  var langButtons = document.querySelectorAll('.nav__lang-btn');
  langButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lang = btn.getAttribute('data-lang');
      langButtons.forEach(function (b) {
        var isMatch = b.getAttribute('data-lang') === lang;
        b.classList.toggle('is-active', isMatch);
        b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
    });
  });

  /* Scroll-spy — keeps the underline on whichever section is currently in view */
  if (nav) {
    const navLinks = Array.from(nav.querySelectorAll('[data-nav-link]'));
    const navSections = navLinks
      .map(function (link) { return document.getElementById(link.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if (navLinks.length && navSections.length) {
      const setActiveNavLink = function (id) {
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
      };
      const sectionObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) setActiveNavLink(entry.target.id);
          });
        },
        { threshold: 0, rootMargin: '-45% 0px -45% 0px' }
      );
      navSections.forEach(function (section) { sectionObserver.observe(section); });
    }
  }

  /* --------------------------------------------------------------------------
     Cached viewport/pin measurements — only recomputed on a debounced resize,
     never mid-scroll. Fixes the mobile address-bar-collapse jitter.
     -------------------------------------------------------------------------- */

  let viewportHeight = window.innerHeight;
  let heroPinHeight = 0;

  function setViewportUnit() {
    viewportHeight = window.innerHeight;
    document.documentElement.style.setProperty('--vh', viewportHeight * 0.01 + 'px');
  }

  function measurePinHeights() {
    if (heroPin) heroPinHeight = heroPin.offsetHeight;
  }

  setViewportUnit();
  measurePinHeights();

  /* Hero — pinned rotating badge. Pins for 120vh (see .hero-pin in CSS)
     while scroll progress 0→1 drives updateHeroBadge() below, which writes
     CSS custom properties read by .hero__badge-mark/.hero__content (see
     styles.css) — the mark's zoom is glued to the scrollbar, no lag, the
     acceleration is baked into the eased progress→scale curve, not into
     timing. Skipped entirely under reduced motion, where the CSS fallback
     (auto height, no pin, static badge) takes over instead. */
  if (!prefersReducedMotion) {
    ScrollTrigger.create({
      trigger: heroPin, start: 'top top', end: 'bottom bottom',
      pin: hero, pinSpacing: false, invalidateOnRefresh: true,
    });
  }

  function easeInQuint(t) { return t * t * t * t * t; }

  const BADGE_ZOOM_START = 0.55; // fraction of scroll progress where the mark starts scaling up
  const BADGE_MAX_MARK_SCALE = 1.8; // multiplier added at progress 1 — mark grows to fill as much of
                                     // the ring's text circle as it can without overlapping the words
  const BADGE_IDLE_DEG_PER_SEC = 15; // constant background spin — always running, scroll or not
  const BADGE_WHEEL_TURNS = 2.5; // extra turns the ring gains across the full scroll-through, layered
                                  // on top of the idle spin — makes it feel like scroll is turning a
                                  // wheel: speeds up going down, unwinds going back up

  const heroBadgeStartTime = performance.now();

  // The ring's rotation is idle-spin (time-based, always on) + a scroll-linked
  // "wheel" term (pure function of progress, reversible on scroll-up) — the
  // two compose into one --badge-rotation value. Everything else (mark scale/
  // opacity, content fade) stays a pure function of progress only.
  function updateHeroBadge(progress) {
    if (!hero || prefersReducedMotion) return; // CSS fallback owns the static reduced-motion state entirely

    const idleDeg = ((performance.now() - heroBadgeStartTime) / 1000) * BADGE_IDLE_DEG_PER_SEC;
    const wheelDeg = progress * BADGE_WHEEL_TURNS * 360;
    const rotation = idleDeg + wheelDeg;

    const zoomT = Math.min(1, Math.max(0, (progress - BADGE_ZOOM_START) / (1 - BADGE_ZOOM_START)));
    const zoomEase = easeInQuint(zoomT);
    const markScale = 0.6 + zoomEase * BADGE_MAX_MARK_SCALE;
    const markOpacity = Math.min(1, zoomT * 2.5);
    const fade = 1 - Math.min(1, zoomT * 1.3);

    hero.style.setProperty('--badge-rotation', rotation + 'deg');
    hero.style.setProperty('--mark-scale', markScale.toFixed(3));
    hero.style.setProperty('--mark-opacity', markOpacity.toFixed(3));
    hero.style.setProperty('--badge-fade', fade.toFixed(3));
  }

  function initHeadlineAnimation() {
    if (heroHeadline) heroHeadline.classList.add('is-visible');
    if (heroDesc) heroDesc.classList.add('is-visible');
  }

  function getPinProgress(pinEl, cachedPinHeight) {
    if (!pinEl) return 0;
    const rect = pinEl.getBoundingClientRect();
    const maxScroll = cachedPinHeight - viewportHeight;
    if (maxScroll <= 0) return 0;
    const scrolled = -rect.top;
    return Math.max(0, Math.min(1, scrolled / maxScroll));
  }

  function updateScrollEffects() {
    const heroProgress = prefersReducedMotion ? 1 : getPinProgress(heroPin, heroPinHeight);
    updateHeroBadge(heroProgress);
    if (nav) nav.classList.toggle('nav--scrolled', window.scrollY > 60);
  }

  function scrollLoop() {
    if (!prefersReducedMotion) ScrollTrigger.update();
    updateScrollEffects();
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
    document.querySelectorAll('.fade-in-view').forEach(function (el) { fadeObserver.observe(el); });
  } else {
    document.querySelectorAll('.fade-in-view').forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Trust-signal bento cards ("Über uns") — pop up staggered once the
     grid scrolls into view; delay stagger is handled per-card in CSS. */
  const trustGrid = document.getElementById('trust-grid');
  if (trustGrid) {
    if (!prefersReducedMotion) {
      const trustObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              trustObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: '0px 0px -60px 0px' }
      );
      trustObserver.observe(trustGrid);
    } else {
      trustGrid.classList.add('is-visible');
    }
  }

  /* Reviews — cuberto.com "Trusted by our clients" pattern. The 5 cards
     already sit in their final bento-grid position in the DOM/CSS; as the
     section scrolls into view they scrub apart from a fanned, overlapping
     pile straight to that resting grid position, matching cuberto's actual
     continuous scroll-scrub (not a discrete "clump/pop" state machine —
     card position is always `f(scroll progress)`, recalculated every
     frame, so there's nothing that can get stuck out of sync on reload, a
     #bewertungen deep link, or scroll restoration landing mid-section).
     ScrollTrigger.matchMedia keeps this desktop-only and reverts cleanly on
     a breakpoint change instead of caching a stale isMobile flag — mobile
     shows the reviews-carousel below instead. */
  const reviewsGrid = document.getElementById('reviews-grid');
  const reviewCards = reviewsGrid ? Array.from(reviewsGrid.querySelectorAll('.review-card')) : [];

  if (reviewCards.length) {
    if (prefersReducedMotion) {
      gsap.set(reviewCards, { x: 0, y: 0, rotation: 0 });
    } else {
      // Tight, heavily overlapping deck-of-cards fan — small shared-point
      // offsets with large alternating rotation, matching cuberto's clump.
      const scatterX = [-14, 18, -6, 14, -16];
      const scatterY = [10, -12, 4, -14, 12];
      const rotations = [-16, 12, -6, 18, -13];

      ScrollTrigger.matchMedia({
        '(min-width: 761px)': function () {
          // clearProps first so this always measures each card's true
          // untransformed rest box — measuring mid-clump (e.g. a previous
          // breakpoint's leftover transform) would bake that offset into
          // the new pile math and the cards would drift further apart
          // every time this re-runs instead of landing back in the grid.
          gsap.set(reviewCards, { clearProps: 'transform' });
          const gridRect = reviewsGrid.getBoundingClientRect();
          const pileX = gridRect.left + gridRect.width / 2;
          const pileY = gridRect.top + gridRect.height / 2;
          const clump = reviewCards.map(function (card, i) {
            const rect = card.getBoundingClientRect();
            return {
              x: (pileX + scatterX[i]) - (rect.left + rect.width / 2),
              y: (pileY + scatterY[i]) - (rect.top + rect.height / 2),
              rotation: rotations[i],
            };
          });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: reviewsGrid,
              start: 'top 90%',
              end: 'top 40%',
              scrub: 0.4,
              invalidateOnRefresh: true,
            },
          });
          reviewCards.forEach(function (card, i) {
            tl.fromTo(
              card,
              { x: clump[i].x, y: clump[i].y, rotation: clump[i].rotation, zIndex: reviewCards.length - i },
              { x: 0, y: 0, rotation: 0, ease: 'power1.out', duration: 1 },
              i * 0.12
            );
          });

          // Re-sync once the serif webfont swaps in, in case it reflowed
          // card heights — refresh re-samples the current scroll progress
          // against the trigger's new start/end pixels immediately.
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
          }

          // Returning a cleanup fn is how matchMedia knows to revert this
          // context (kill the trigger + tween) when the breakpoint changes.
          return function () { tl.kill(); };
        },
        '(max-width: 760px)': function () {
          gsap.set(reviewCards, { clearProps: 'transform' });
        },
      });
    }
  }

  /* About hero — scroll-scrubbed word-by-word color reveal ("Hey founder"
     style), applied across every [data-reveal] element in the section
     (headline lines + both copy blocks) so the whole hero fills in together */
  const aboutHero = document.getElementById('about-hero');
  if (aboutHero && !prefersReducedMotion) {
    const revealTargets = aboutHero.querySelectorAll('[data-reveal]');
    revealTargets.forEach(function (el) {
      const text = el.textContent;
      el.textContent = '';
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach(function (chunk) {
        if (!chunk) return;
        if (/^\s+$/.test(chunk)) {
          frag.appendChild(document.createTextNode(chunk));
        } else {
          const span = document.createElement('span');
          span.className = 'reveal-word';
          span.textContent = chunk;
          frag.appendChild(span);
        }
      });
      el.appendChild(frag);
    });

    const revealWords = aboutHero.querySelectorAll('.reveal-word');
    if (revealWords.length) {
      gsap.timeline({
        scrollTrigger: {
          trigger: aboutHero,
          start: 'top 80%',
          end: 'bottom 25%',
          scrub: true,
        },
      }).to(revealWords, { color: '#f7f7f8', stagger: 0.04, ease: 'none' });
    }
  }

  /* CTA gradient hero — the section is two viewport-heights tall; the
     headline/button/footer are pinned centered on screen for that whole
     length while the gradient scrolls past behind them. The headline and
     button start blurred/invisible and blur-sharpen into view early in the
     scroll, then hold fully visible for the rest of the pin — the reveal
     reads as caused by the gradient settling into its violet/black stops,
     not as its own independent pop-in. */
  const ctaMerge = document.getElementById('kontakt');
  const ctaPin = ctaMerge ? ctaMerge.querySelector('.cta-merge__pin') : null;
  const ctaHeadline = ctaMerge ? ctaMerge.querySelector('.cta-merge__headline') : null;
  const ctaButton = ctaMerge ? ctaMerge.querySelector('.btn--swap') : null;
  if (ctaMerge && ctaPin && ctaHeadline && ctaButton) {
    if (prefersReducedMotion) {
      ctaHeadline.style.opacity = 1;
      ctaButton.style.opacity = 1;
    } else {
      // Scrub maps the full pin scroll range (0–1) to the timeline's full
      // duration (1 here), so each position below is literally that
      // fraction of the scroll — tuned to line up with the gradient's own
      // stops (black 0%, mid violet 32%, dark violet 62%, black 100%):
      // blur in early over the black opening, hold fully visible for the
      // rest of the pin — white text reads cleanly against every stop now
      // that the gradient never passes through a light/near-white value.
      gsap.timeline({
        scrollTrigger: {
          trigger: ctaMerge,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          pin: ctaPin,
          pinSpacing: false,
        },
      })
        .set([ctaHeadline, ctaButton], { opacity: 0, filter: 'blur(20px)' })
        .to(ctaHeadline, { opacity: 1, filter: 'blur(0px)', ease: 'none', duration: 0.22 }, 0.08)
        .to(ctaButton, { opacity: 1, filter: 'blur(0px)', ease: 'none', duration: 0.16 }, 0.2)
        .to({}, { duration: 0.64 });
    }
  }

  /* Our Work — two counter-scrolling marquee rows of real desktop
     screenshots (morez.co client-logo-strip format). Each row's track is
     its 3 projects rendered twice back-to-back in the HTML; a single
     signed px offset per row is advanced every frame and wrapped at
     exactly half the track's rendered width, so the loop is seamless with
     no visible jump. Both rows auto-drift continuously in opposite
     directions (row A left, row B right) at a slow base speed, and that
     speed gets a temporary boost — proportional to how fast the page is
     being scrolled, using the scroll velocity's magnitude only (not its
     sign), so scrolling up speeds the rows up exactly as much as
     scrolling down does, always on top of the base drift, never against
     it — that boost bleeds back off over roughly a third of a second.
     Tuned deliberately more
     aggressive than morez.co's own strip (re-checked frame-by-frame against
     the recording: theirs barely reacts to scroll at all, mostly ambient
     drift) — this one is a clear, snappy reaction on purpose. window.scrollY
     is what drives it, so touch-scroll on mobile feeds the exact same path
     as wheel/trackpad on desktop — no device branching, same feel both
     places. */
  let renderPortfolioMarquee = null;
  const portfolioTrackA = document.getElementById('portfolio-track-a');
  const portfolioTrackB = document.getElementById('portfolio-track-b');
  if (portfolioTrackA && portfolioTrackB) {
    const BASE_SPEED = 130; // px/sec of ambient drift (upped from 68 for a faster idle marquee)
    const SCROLL_BOOST = 2.1; // extra px/sec of marquee travel per px/sec the page scrolls (halved from 4.2)
    const BOOST_DECAY = 3.4; // 1/sec — how fast the scroll boost bleeds back to 0
    const MAX_TOTAL_SPEED = 1500; // px/sec cap (base + boost) — keeps huge mobile flicks from smearing

    let offsetA = 0;
    let offsetB = 0;
    let boost = 0; // shared signed px/sec contributed by recent page-scroll velocity
    let lastScrollY = window.scrollY;
    let lastFrameTime = null;
    let halfWidthA = 0;
    let halfWidthB = 0;

    function measure() {
      halfWidthA = portfolioTrackA.scrollWidth / 2;
      halfWidthB = portfolioTrackB.scrollWidth / 2;
    }
    renderPortfolioMarquee = measure;

    function wrap(offset, halfWidth) {
      if (halfWidth <= 0) return 0;
      return ((offset % halfWidth) + halfWidth) % halfWidth;
    }

    function tick(now) {
      if (lastFrameTime === null) lastFrameTime = now;
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      const scrollY = window.scrollY;
      const scrollDelta = scrollY - lastScrollY;
      lastScrollY = scrollY;
      // scrollDelta is px moved this frame; dividing by dt turns it into an
      // instantaneous px/sec velocity before it's weighted into the boost —
      // keeps the reaction consistent regardless of the frame rate. Only the
      // magnitude feeds the boost (not the sign) so scroll-up adds exactly
      // as much speed as scroll-down — it never subtracts from the base drift.
      boost += (dt > 0 ? Math.abs(scrollDelta / dt) : 0) * SCROLL_BOOST * dt;
      boost -= boost * Math.min(1, BOOST_DECAY * dt);

      if (!prefersReducedMotion) {
        let speed = BASE_SPEED + boost;
        speed = Math.max(-MAX_TOTAL_SPEED, Math.min(MAX_TOTAL_SPEED, speed));
        offsetA = wrap(offsetA + speed * dt, halfWidthA);
        offsetB = wrap(offsetB - speed * dt, halfWidthB);
        portfolioTrackA.style.transform = 'translate3d(' + (-offsetA).toFixed(2) + 'px, 0, 0)';
        portfolioTrackB.style.transform = 'translate3d(' + (-offsetB).toFixed(2) + 'px, 0, 0)';
      }
      requestAnimationFrame(tick);
    }

    measure();
    // Re-measure once every screenshot has actually loaded — scrollWidth
    // before that reflects each <img>'s pre-load box, not its real size.
    [portfolioTrackA, portfolioTrackB].forEach(function (track) {
      track.querySelectorAll('img').forEach(function (img) {
        if (!img.complete) img.addEventListener('load', measure, { once: true });
      });
    });
    requestAnimationFrame(tick);
  }

  /* Services — desktop: one-way scroll-reveal cards (cuberto.com "What We
     Do" pattern). Every card starts collapsed (~100px, light gray). A plain
     IntersectionObserver watches each card with rootMargin pulled in on
     both top and bottom, leaving only a thin trigger band around the
     viewport's vertical center — the instant a card crosses it, `.is-open`
     is added and that card is unobserved. Cards never collapse again once
     triggered, even if the user scrolls back up past them. No
     scroll-jacking, no pinned/sticky containers — this only reads scroll
     position via the observer callback.

     Mobile (<=760px): a plain tap accordion instead — cards start collapsed
     and stay that way until tapped; opening one closes whichever other card
     was open, at most one open at a time. No scroll-linked auto-opening. */
  const servicesList = document.getElementById('services-list');
  const servicesItems = servicesList ? Array.from(servicesList.querySelectorAll('.services-panel__item')) : [];
  const servicesIsMobile = window.matchMedia('(max-width: 760px)').matches;
  let serviceObserver = null;

  // Each card that expands grows the document's total height (unlike a
  // single-open accordion, where opening one row closes another and height
  // barely moves — this only matters for the desktop scroll-reveal mode).
  // Anything below — notably the pinned #kontakt ScrollTrigger — has its
  // start/end scroll positions cached, so a growing page under it needs a
  // refresh or the pin math drifts and the section misbehaves. Debounced to
  // fire once after a card's 0.9s height transition settles, even if
  // several cards trigger in quick succession.
  let serviceRefreshTimer;
  function scheduleServiceScrollRefresh() {
    if (typeof ScrollTrigger === 'undefined') return;
    clearTimeout(serviceRefreshTimer);
    serviceRefreshTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 950);
  }

  function triggerServiceItem(item) {
    if (!item || item.classList.contains('is-open')) return;
    item.classList.add('is-open');
    if (serviceObserver) serviceObserver.unobserve(item);
    scheduleServiceScrollRefresh();
  }

  if (servicesItems.length) {
    if (prefersReducedMotion) {
      // No scroll-linked reveal for reduced-motion users — every card opens
      // immediately so all the copy is readable without relying on scroll.
      servicesItems.forEach(triggerServiceItem);
    } else if (servicesIsMobile) {
      servicesItems.forEach(function (item) {
        const head = item.querySelector('.services-panel__item-head');
        if (!head) return;
        head.setAttribute('role', 'button');
        head.setAttribute('tabindex', '0');
        head.setAttribute('aria-expanded', 'false');

        function toggle() {
          const isOpen = item.classList.contains('is-open');
          servicesItems.forEach(function (other) {
            if (other === item) return;
            other.classList.remove('is-open');
            const otherHead = other.querySelector('.services-panel__item-head');
            if (otherHead) otherHead.setAttribute('aria-expanded', 'false');
          });
          item.classList.toggle('is-open', !isOpen);
          head.setAttribute('aria-expanded', String(!isOpen));
          scheduleServiceScrollRefresh();
        }

        head.addEventListener('click', toggle);
        head.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      });
    } else {
      serviceObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) triggerServiceItem(entry.target);
          });
        },
        { threshold: 0, rootMargin: '-45% 0px -45% 0px' }
      );
      servicesItems.forEach(function (item) { serviceObserver.observe(item); });
    }
  }

  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      setViewportUnit();
      measurePinHeights();
      ScrollTrigger.refresh();
      updateScrollEffects();
      if (renderPortfolioMarquee) renderPortfolioMarquee();
    }, 150);
  });

  /* Swap button — measures icon/label widths so the hover animation (icon and
     label glide past each other and trade places) travels the right distance
     for any label length. */
  const swapButtons = document.querySelectorAll('.btn--swap');
  swapButtons.forEach(function (btn) {
    const icon = btn.querySelector('.btn__icon-slot');
    const label = btn.querySelector('.btn__label');
    if (!icon || !label) return;
    function measure() {
      const gap = parseFloat(getComputedStyle(btn).gap) || 0;
      btn.style.setProperty('--icon-shift', (label.offsetWidth + gap) + 'px');
      btn.style.setProperty('--label-shift', (icon.offsetWidth + gap) + 'px');
    }
    measure();
    window.addEventListener('resize', measure);
  });

  /* Team × Trust pairing carousel — mobile only. Native horizontal
     scroll-snap drives the swipe itself; this keeps the dots and prev/next
     arrows in sync with whichever slide is centered, and lets a dot or
     arrow click jump to one. */
  const teamTrustCarousel = document.getElementById('team-trust-carousel');
  const teamTrustTrack = document.getElementById('team-trust-track');
  const teamTrustDots = document.getElementById('team-trust-dots');
  const teamTrustPrev = document.getElementById('team-trust-prev');
  const teamTrustNext = document.getElementById('team-trust-next');
  if (teamTrustCarousel && teamTrustTrack && teamTrustDots) {
    const teamTrustSlides = Array.from(teamTrustTrack.querySelectorAll('.team-trust-slide'));
    const teamTrustDotEls = Array.from(teamTrustDots.querySelectorAll('.team-trust-carousel__dot'));
    let teamTrustActive = 0;

    function goToTeamTrustSlide(index) {
      const target = teamTrustSlides[index];
      if (!target) return;
      teamTrustTrack.scrollTo({
        left: target.offsetLeft - (teamTrustTrack.clientWidth - target.clientWidth) / 2,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }

    // Arrows are pinned dead center in CSS (top: 50%, fixed) so they hold
    // the same height across every slide — this only toggles which ones
    // are visible. (Previously re-measured each slide's divider line and
    // set an inline top per slide, which made the arrows hop up/down as
    // the copy length changed between slides.)
    function updateTeamTrustArrows(index) {
      if (teamTrustPrev) teamTrustPrev.hidden = index === 0;
      if (teamTrustNext) teamTrustNext.hidden = index === teamTrustSlides.length - 1;
    }

    function setActiveTeamTrustSlide(index) {
      teamTrustActive = index;
      teamTrustDotEls.forEach(function (dot, i) {
        const isActive = i === index;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      updateTeamTrustArrows(index);
    }

    let teamTrustScrollTimer;
    teamTrustTrack.addEventListener('scroll', function () {
      clearTimeout(teamTrustScrollTimer);
      teamTrustScrollTimer = setTimeout(function () {
        const trackRect = teamTrustTrack.getBoundingClientRect();
        const center = trackRect.left + trackRect.width / 2;
        let closest = 0;
        let closestDist = Infinity;
        teamTrustSlides.forEach(function (slide, i) {
          const r = slide.getBoundingClientRect();
          const dist = Math.abs((r.left + r.width / 2) - center);
          if (dist < closestDist) { closestDist = dist; closest = i; }
        });
        setActiveTeamTrustSlide(closest);
      }, 100);
    }, { passive: true });

    teamTrustDotEls.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goToTeamTrustSlide(i); });
    });

    if (teamTrustPrev) teamTrustPrev.addEventListener('click', function () { goToTeamTrustSlide(teamTrustActive - 1); });
    if (teamTrustNext) teamTrustNext.addEventListener('click', function () { goToTeamTrustSlide(teamTrustActive + 1); });

    setActiveTeamTrustSlide(0);
  }

  /* Reviews carousel — mobile only. Same mechanism as the team × trust
     carousel just above: native horizontal scroll-snap drives the swipe,
     this keeps the dots and prev/next arrows in sync with whichever slide
     is centered. */
  const reviewsCarousel = document.getElementById('reviews-carousel');
  const reviewsTrack = document.getElementById('reviews-track');
  const reviewsDots = document.getElementById('reviews-dots');
  const reviewsPrev = document.getElementById('reviews-prev');
  const reviewsNext = document.getElementById('reviews-next');
  if (reviewsCarousel && reviewsTrack && reviewsDots) {
    const reviewsSlides = Array.from(reviewsTrack.querySelectorAll('.reviews-carousel__slide'));
    const reviewsDotEls = Array.from(reviewsDots.querySelectorAll('.reviews-carousel__dot'));
    let reviewsActive = 0;

    function goToReviewsSlide(index) {
      const target = reviewsSlides[index];
      if (!target) return;
      reviewsTrack.scrollTo({
        left: target.offsetLeft - (reviewsTrack.clientWidth - target.clientWidth) / 2,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }

    // Arrows are pinned dead center in CSS (top: 50%, fixed) so they hold
    // the same height across every slide — this only toggles which ones
    // are visible. (Previously re-measured each slide's divider line and
    // set an inline top per slide, which made the arrows hop up/down as
    // the quote length changed between slides.)
    function updateReviewsArrows(index) {
      if (reviewsPrev) reviewsPrev.hidden = index === 0;
      if (reviewsNext) reviewsNext.hidden = index === reviewsSlides.length - 1;
    }

    function setActiveReviewsSlide(index) {
      reviewsActive = index;
      reviewsDotEls.forEach(function (dot, i) {
        const isActive = i === index;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      updateReviewsArrows(index);
    }

    let reviewsScrollTimer;
    reviewsTrack.addEventListener('scroll', function () {
      clearTimeout(reviewsScrollTimer);
      reviewsScrollTimer = setTimeout(function () {
        const trackRect = reviewsTrack.getBoundingClientRect();
        const center = trackRect.left + trackRect.width / 2;
        let closest = 0;
        let closestDist = Infinity;
        reviewsSlides.forEach(function (slide, i) {
          const r = slide.getBoundingClientRect();
          const dist = Math.abs((r.left + r.width / 2) - center);
          if (dist < closestDist) { closestDist = dist; closest = i; }
        });
        setActiveReviewsSlide(closest);
      }, 100);
    }, { passive: true });

    reviewsDotEls.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goToReviewsSlide(i); });
    });

    if (reviewsPrev) reviewsPrev.addEventListener('click', function () { goToReviewsSlide(reviewsActive - 1); });
    if (reviewsNext) reviewsNext.addEventListener('click', function () { goToReviewsSlide(reviewsActive + 1); });

    setActiveReviewsSlide(0);
  }

  /* Live clock in the CTA section footer */
  const ctaClock = document.getElementById('cta-clock');
  if (ctaClock) {
    function updateCtaClock() {
      const now = new Date();
      const pad = function (n) { return String(n).padStart(2, '0'); };
      ctaClock.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()) + ' (Essen)';
    }
    updateCtaClock();
    setInterval(updateCtaClock, 1000);
  }

  /* Contact overlay — slide-in panel opened by any [data-open-contact] trigger */
  const contactOverlay = document.getElementById('contact-overlay');
  if (contactOverlay) {
    const contactCloseTriggers = contactOverlay.querySelectorAll('[data-close-contact]');
    const contactOpenTriggers = document.querySelectorAll('[data-open-contact]');
    const contactPanel = contactOverlay.querySelector('.contact-overlay__panel');
    let lastFocused = null;

    function openContactOverlay() {
      lastFocused = document.activeElement;
      // Drop any leftover inline transform/is-dragging state from a prior
      // drag/spring so the CSS class transition (translateX(100%) -> 0)
      // drives this open, not whatever px value the last gesture left behind.
      if (contactPanel) {
        contactPanel.classList.remove('is-dragging');
        if (window.gsap) gsap.set(contactPanel, { clearProps: 'transform' });
      }
      contactOverlay.classList.add('is-open');
      contactOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const closeBtn = document.getElementById('contact-overlay-close');
      if (closeBtn) closeBtn.focus();
    }

    function closeContactOverlay() {
      contactOverlay.classList.remove('is-open');
      contactOverlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      // Same cleanup as open — a drag-close leaves the panel positioned via
      // inline transform; clear it once the class-driven closed state
      // (translateX(100%)) is in effect so it doesn't fight the CSS next time.
      if (contactPanel) {
        contactPanel.classList.remove('is-dragging');
        if (window.gsap) gsap.set(contactPanel, { clearProps: 'transform' });
      }
    }

    contactOpenTriggers.forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        openContactOverlay();
      });
    });

    contactCloseTriggers.forEach(function (trigger) {
      trigger.addEventListener('click', closeContactOverlay);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && contactOverlay.classList.contains('is-open')) {
        closeContactOverlay();
      }
    });

    if (window.location.hash === '#kontakt') {
      openContactOverlay();
    }

    /* Swipe-to-close — grab the panel anywhere except its own interactive
       controls (links, buttons, form fields) and it tracks the pointer 1:1
       toward the right edge it entered from (same path in and out, per
       Apple's spatial-consistency rule). Dragging the other way — deeper
       "into" the screen, past its resting open position — rubber-bands
       instead of moving 1:1, since there's nowhere further open to go.
       Release past a distance/velocity threshold and it continues off
       screen at the release velocity; short of that, it springs back to
       resting open. Vertical intent (scrolling the form) is detected from
       the same first move and wins over the horizontal drag, so the two
       gestures never fight. Skipped entirely under reduced motion — the
       tap-to-close / Escape path already covers that. */
    if (contactPanel && window.gsap && !prefersReducedMotion) {
      const DRAG_COMMIT_THRESHOLD = 10; // px before a press resolves as horizontal drag vs. vertical scroll/tap
      const CLOSE_DISTANCE_RATIO = 0.35; // fraction of panel width past which release closes
      const CLOSE_VELOCITY = 0.5; // px/ms — a flick past this closes regardless of distance
      const RUBBERBAND_CONST = 0.55;
      const VELOCITY_WINDOW = 120; // ms of recent pointer history used for release velocity

      let dragging = false;
      let committed = false; // true once horizontal drag intent is confirmed
      let rejected = false; // true once vertical intent won and this gesture is ceded
      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let samples = [];

      function rubberband(overshoot, dimension) {
        return (overshoot * dimension * RUBBERBAND_CONST) / (dimension + RUBBERBAND_CONST * Math.abs(overshoot));
      }

      function onPanelPointerDown(e) {
        if (!contactOverlay.classList.contains('is-open')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('a, button, input, textarea, select, label')) return;
        dragging = true;
        committed = false;
        rejected = false;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        samples = [{ x: e.clientX, t: e.timeStamp }];
      }

      function onPanelPointerMove(e) {
        if (!dragging || e.pointerId !== pointerId || rejected) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!committed) {
          if (Math.abs(dx) > DRAG_COMMIT_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            committed = true;
            gsap.killTweensOf(contactPanel);
            contactPanel.classList.add('is-dragging');
            try { contactPanel.setPointerCapture(pointerId); } catch (err) { /* no-op */ }
          } else if (Math.abs(dy) > DRAG_COMMIT_THRESHOLD) {
            rejected = true; // vertical scroll wins — let the panel's own overflow-y handle it
            return;
          } else {
            return;
          }
        }
        e.preventDefault();
        const x = dx < 0 ? rubberband(dx, contactPanel.offsetWidth) : dx;
        gsap.set(contactPanel, { x: x });
        samples.push({ x: e.clientX, t: e.timeStamp });
        const cutoff = e.timeStamp - VELOCITY_WINDOW;
        while (samples.length > 2 && samples[0].t < cutoff) samples.shift();
      }

      function onPanelPointerUp(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        if (contactPanel.hasPointerCapture && contactPanel.hasPointerCapture(pointerId)) {
          try { contactPanel.releasePointerCapture(pointerId); } catch (err) { /* no-op */ }
        }
        if (!committed || rejected) return;

        const first = samples[0];
        const last = samples[samples.length - 1];
        const elapsed = last.t - first.t;
        const releasePxPerMs = elapsed > 0 ? (last.x - first.x) / elapsed : 0;
        const dx = last.x - startX;
        const panelWidth = contactPanel.offsetWidth;
        const shouldClose = dx > panelWidth * CLOSE_DISTANCE_RATIO || releasePxPerMs > CLOSE_VELOCITY;

        if (shouldClose) {
          // Continue off screen carrying the release velocity (px/s) — no
          // seam between the drag and the animation that finishes it. is-dragging
          // (transition:none) stays on through this tween so the CSS
          // transition doesn't also try to animate the same property gsap
          // is driving — closeContactOverlay's clearProps removes both.
          gsap.to(contactPanel, {
            x: panelWidth,
            duration: 0.22,
            ease: 'power2.in',
            overwrite: true,
            onComplete: function () {
              contactPanel.classList.remove('is-dragging');
              closeContactOverlay();
            },
          });
        } else {
          gsap.to(contactPanel, {
            x: 0,
            duration: 0.35,
            ease: 'power3.out',
            overwrite: true,
            onComplete: function () { contactPanel.classList.remove('is-dragging'); },
          });
        }
      }

      contactPanel.addEventListener('pointerdown', onPanelPointerDown);
      contactPanel.addEventListener('pointermove', onPanelPointerMove);
      contactPanel.addEventListener('pointerup', onPanelPointerUp);
      contactPanel.addEventListener('pointercancel', onPanelPointerUp);
      // Safety net — catches release even if pointer capture didn't take.
      window.addEventListener('pointerup', onPanelPointerUp);
      window.addEventListener('pointercancel', onPanelPointerUp);
    }
  }

  /* Contact form — Formspree AJAX submit (German-only status text, no lang branching) */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('form-status');

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Wird gesendet…';
      }
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.remove('form-status--success', 'form-status--error');
      }

      const formData = new FormData(contactForm);

      fetch(contactForm.action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      })
        .then(function (response) {
          if (response.ok) {
            if (statusEl) {
              statusEl.textContent = 'Danke – wir melden uns innerhalb von 24 Stunden.';
              statusEl.classList.add('form-status--success');
            }
            contactForm.reset();
          } else {
            return response.json().then(function (data) {
              const message =
                data && data.errors && data.errors.length
                  ? data.errors.map(function (err) { return err.message; }).join(', ')
                  : 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt eine E-Mail.';
              throw new Error(message);
            });
          }
        })
        .catch(function (error) {
          if (statusEl) {
            statusEl.textContent = error.message || 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt eine E-Mail.';
            statusEl.classList.add('form-status--error');
          }
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Nachricht senden';
          }
        });
    });
  }

  /* Smooth-scroll same-page anchor links — native window.scrollTo */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    if (link.hasAttribute('data-open-contact')) return;
    link.addEventListener('click', function (e) {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;
      e.preventDefault();
      smoothScrollTo(targetEl, -80);
    });
  });

  initHeadlineAnimation();
  updateScrollEffects();
  ScrollTrigger.refresh();

  // Below-the-fold images keep changing the page's total height well after
  // this script runs and even after `window.load` fires, which shifts every
  // ScrollTrigger start pixel calculated against the shorter, pre-reflow
  // page. That's why a trigger like the reviews pop (~line 199) could fire
  // too early on the very first scroll pass — while the section was still
  // off-screen, so it looked un-clumped from the start — and only behaved
  // correctly once you scrolled back up and down again (by then the layout
  // had long settled and a later refresh had already corrected it).
  //
  // Rather than chasing each individual async cause, watch the page's
  // actual rendered height and resync whenever it changes, for any reason,
  // for as long as the page lives.
  if ('ResizeObserver' in window) {
    let bodyResizeTimer;
    let lastBodyHeight = document.body.offsetHeight;
    const bodyResizeObserver = new ResizeObserver(function () {
      const height = document.body.offsetHeight;
      if (height === lastBodyHeight) return;
      lastBodyHeight = height;
      clearTimeout(bodyResizeTimer);
      bodyResizeTimer = setTimeout(function () {
        // The reviews trigger's own onRefresh handler (~line 277) resyncs
        // its pop/clump state to whatever this refresh finds.
        ScrollTrigger.refresh();
      }, 120);
    });
    bodyResizeObserver.observe(document.body);
  } else {
    // Old-browser fallback: at least catch the image settle window.
    window.addEventListener('load', function () {
      ScrollTrigger.refresh();
    });
  }
})();
