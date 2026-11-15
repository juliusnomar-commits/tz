// ---- main.js ----

// Nav scroll behavior
const nav = document.querySelector('nav');
const hasTextHero = !!document.querySelector('.hero-text-only');
if (nav) {
  if (hasTextHero) nav.classList.add('scrolled');
  window.addEventListener('scroll', () => {
    if (hasTextHero) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.toggle('scrolled', window.scrollY > 80);
    }
  });
}

// Mobile nav
const hamburger = document.querySelector('.hamburger');
const mobileNav = document.querySelector('.mobile-nav');
const mobileNavLinks = document.querySelectorAll('.mobile-nav a');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// Section fade-in
const fadeSections = document.querySelectorAll('.fade-in-section');
if (fadeSections.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  fadeSections.forEach(el => observer.observe(el));
}

// ---- Currency Note Bunting — editable via CMS (content/currency.json) ----
// Real banknote photos (from ~/Desktop/bills/), replacing the previous
// flat-icon set. Falls back to these 8 real files if content/currency.json
// hasn't been customized yet.
const defaultCurrencyNotes = [
  { img: 'images/currency-euro.jpg' },
  { img: 'images/currency-dollar.png' },
  { img: 'images/currency-franc.png' },
  { img: 'images/currency-yen.jpg' },
  { img: 'images/currency-rand.jpg' },
  { img: 'images/currency-baht.jpg' },
  { img: 'images/currency-kronor.jpg' },
  { img: 'images/currency-riyal.jpg' },
];
let currencyNotes = defaultCurrencyNotes;

const buntingPaths = [
  'M0,30 Q150,60 300,35 Q450,10 600,40 Q750,70 900,38 Q1050,8 1200,32',
  'M0,38 Q150,10 300,42 Q450,72 600,36 Q750,8 900,44 Q1050,72 1200,30',
];

const buntingPositions = [
  [
    [90, 46, -6], [200, 49, 5],  [315, 36, -4], [425, 27, 7],
    [535, 33, -3], [645, 51, 6], [758, 57, -7], [865, 48, 4],
    [978, 29, -5], [1092, 25, 8]
  ],
  [
    [90, 30, -6], [200, 30, 5],  [315, 48, -4], [425, 59, 7],
    [535, 52, -3], [645, 32, 6], [758, 27, -7], [865, 39, 4],
    [978, 57, -5], [1092, 54, 8]
  ],
];

function makeBanknote(x, y, angle, note) {
  return `<g transform="translate(${x},${y}) rotate(${angle})">
    <image href="${note.img}" x="-30" y="0" width="60" height="30" preserveAspectRatio="xMidYMid meet" style="filter:drop-shadow(1px 2px 3px rgba(0,0,0,0.35))"/>
    <circle cx="0" cy="-3" r="3" fill="#8B6340"/>
  </g>`;
}

function renderBuntings() {
  document.querySelectorAll('.bunting').forEach((el, idx) => {
    const pathIdx = idx % 2;
    const path = buntingPaths[pathIdx];
    const positions = buntingPositions[pathIdx];
    const notes = positions.map((pos, i) => {
      const note = currencyNotes[(i + idx * 3) % currencyNotes.length];
      return makeBanknote(pos[0], pos[1], pos[2], note);
    }).join('\n');
    el.innerHTML = `<svg viewBox="0 0 1200 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" height="140">
  <path d="${path}" stroke="#8B6340" stroke-width="1.5" fill="none"/>
  ${notes}
</svg>`;
  });
}

// ---- Load images from CMS (content/images.json) ----
let siteImages = {};

async function loadSiteImages() {
  try {
    const res = await fetch('content/images.json');
    if (res.ok) siteImages = await res.json();
  } catch (e) {
    console.warn('Could not load images.json, using defaults.');
  }
  try {
    const res2 = await fetch('content/currency.json');
    if (res2.ok) {
      const data = await res2.json();
      if (Array.isArray(data.notes) && data.notes.length) {
        currencyNotes = data.notes.map(n => ({ img: n.src }));
      }
    }
  } catch (e) {
    console.warn('Could not load currency.json, using defaults.');
  }
}

function img(key, fallback) {
  return siteImages[key] || fallback;
}

// ---- Apply images to the page ----
function applyImages() {
  // HOME — hero background
  const hero = document.querySelector('.hero');
  if (hero && img('home_hero', '')) {
    hero.style.backgroundImage = `url('${img('home_hero', '')}')`;
  }

  // HOME — fixed polaroids
  const familyImg = document.querySelector('.about-polaroid-grid .polaroid:first-child img');
  if (familyImg) familyImg.src = img('home_familie', 'images/family-teaser.jpg');

  const catoImg = document.querySelector('.about-polaroid-grid .polaroid:last-child img');
  if (catoImg) catoImg.src = img('home_cato', 'images/about-cato.jpg');

  // HOME — garden teaser marquee
  const gardenImgs = document.querySelectorAll('.garden-teaser-marquee .polaroid img');
  const gardenKeys = ['home_tuin_1', 'home_tuin_2', 'home_tuin_3', 'home_tuin_4'];
  const gardenDefaults = ['images/garden-teaser-1.jpg', 'images/garden-teaser-2.jpg', 'images/garden-teaser-3.jpg', 'images/garden-teaser-4.jpg'];
  gardenImgs.forEach((el, i) => {
    const key = gardenKeys[i % 4];
    el.src = img(key, gardenDefaults[i % 4]);
  });

  // CATERING — hero
  const cateringHero = document.querySelector('.hero');
  if (cateringHero && document.title.includes('Catering') && img('catering_hero', '')) {
    cateringHero.style.backgroundImage = `url('${img('catering_hero', '')}')`;
  }

  // CATERING — polaroids
  const cateringPolaroids = document.querySelectorAll('.catering-what-polaroid img');
  if (cateringPolaroids.length) {
    if (cateringPolaroids[0]) cateringPolaroids[0].src = img('catering_1', 'images/catering-gallery-1.jpg');
    if (cateringPolaroids[1]) cateringPolaroids[1].src = img('catering_2', 'images/catering-gallery-2.jpg');
  }

  // GARDEN — hero
  const gardenHero = document.querySelector('.hero');
  if (gardenHero && document.title.includes('Garden') && img('garden_hero', '')) {
    gardenHero.style.backgroundImage = `url('${img('garden_hero', '')}')`;
  }

  // GARDEN — origin polaroids
  const originImgs = document.querySelectorAll('.garden-origin .polaroid img');
  if (originImgs[0]) originImgs[0].src = img('garden_origin_1', 'images/tt-africanwoman.jpg');
  if (originImgs[1]) originImgs[1].src = img('garden_origin_2', 'images/tt-village.jpg');

  // GARDEN — gallery (row 1 + row 2; row 3 is still "coming soon" placeholders)
  const galleryImgs = document.querySelectorAll('.garden-gallery .polaroid img');
  const galleryKeys = ['garden_gallery_1','garden_gallery_2','garden_gallery_3','garden_gallery_4','garden_gallery_5','garden_gallery_6','garden_gallery_7','garden_gallery_11'];
  const galleryDefaults = ['images/garden-gallery-1.jpg','images/garden-gallery-2.jpg','images/garden-gallery-3.jpg','images/garden-gallery-4.jpg','images/garden-gallery-5.jpg','images/garden-gallery-6.jpg','images/garden-gallery-7.jpg','images/garden-gallery-11.jpg'];
  galleryKeys.forEach((key, i) => {
    if (galleryImgs[i]) galleryImgs[i].src = img(key, galleryDefaults[i]);
  });

  // ABOUT — hero
  const aboutHero = document.querySelector('.hero');
  if (aboutHero && document.title.includes('Over') && img('about_hero', '')) {
    aboutHero.style.backgroundImage = `url('${img('about_hero', '')}')`;
  }

  // ABOUT — family gallery
  const familyGallery = document.querySelectorAll('.family-gallery .polaroid img');
  ['about_familie_1','about_familie_2','about_familie_3','about_familie_4','about_familie_5'].forEach((key, i) => {
    if (familyGallery[i]) familyGallery[i].src = img(key, `images/family-gallery-${i+1}.jpg`);
  });

  // ABOUT — dogs
  const dogImgs = document.querySelectorAll('.about-dogs .polaroid img');
  if (dogImgs[0]) dogImgs[0].src = img('about_hond_1', 'images/about-dog-1.jpg');
  if (dogImgs[1]) dogImgs[1].src = img('about_hond_2', 'images/about-dog-2.jpg');

  // RESTAURANT — hero
  const restaurantHero = document.querySelector('.hero');
  if (restaurantHero && document.title.includes('Restaurant') && img('restaurant_hero', '')) {
    restaurantHero.style.backgroundImage = `url('${img('restaurant_hero', '')}')`;
  }
}

// ---- Seasonal home polaroids ----
const seasonalPhotos = [
  {
    months: [12, 1, 2],
    slots: [
      { src: 'images/seasonal-winter-a.jpg', alt_nl: 'Winter in de tuin', alt_en: 'Winter in the garden' },
      { src: 'images/seasonal-winter-b.jpg', alt_nl: 'Wintermarkt Maastricht', alt_en: 'Winter market Maastricht' },
    ]
  },
  {
    months: [3, 4, 5],
    slots: [
      { src: 'images/seasonal-spring-a.jpg', alt_nl: 'Lente in de moestuin', alt_en: 'Spring in the garden' },
      { src: 'images/seasonal-spring-b.jpg', alt_nl: 'Eerste oogst', alt_en: 'First harvest' },
    ]
  },
  {
    months: [6, 7, 8],
    slots: [
      { src: img('home_seizoen_a', 'images/seasonal-summer-a.jpg'), alt_nl: 'Zomertuin in bloei', alt_en: 'Summer garden in bloom' },
      { src: img('home_seizoen_b', 'images/seasonal-summer-b.jpg'), alt_nl: 'Verse zomeroogst', alt_en: 'Fresh summer harvest' },
    ]
  },
  {
    months: [9, 10, 11],
    slots: [
      { src: 'images/seasonal-autumn-a.jpg', alt_nl: 'Herfstoogst', alt_en: 'Autumn harvest' },
      { src: 'images/seasonal-autumn-b.jpg', alt_nl: 'Najaarskleuren', alt_en: 'Autumn colours' },
    ]
  },
];

function getCurrentSeason() {
  const m = new Date().getMonth() + 1;
  return seasonalPhotos.find(s => s.months.includes(m)) || seasonalPhotos[2];
}

function renderSeasonalPolaroids() {
  const containers = document.querySelectorAll('.seasonal-polaroid');
  if (!containers.length) return;
  const lang = localStorage.getItem('catobycato-lang') || 'nl';
  const season = getCurrentSeason();
  containers.forEach((container, i) => {
    const slot = season.slots[i % season.slots.length];
    const el = container.querySelector('img');
    if (el) {
      el.src = slot.src;
      el.alt = lang === 'nl' ? slot.alt_nl : slot.alt_en;
    }
  });
}

// ---- Travel photos — image editable via CMS (content/images.json), the
// month/year/caption grid itself stays fixed in code. ----
const travelPhotos = [
  { key: 'travel_may_2026', month: 5, year: 2026, defaultSrc: 'images/travel-may-2026.jpg',  caption_nl: 'Mei 2026',      caption_en: 'May 2026' },
  { key: 'travel_apr_2026', month: 4, year: 2026, defaultSrc: 'images/travel-apr-2026.jpg',  caption_nl: 'April 2026',    caption_en: 'April 2026' },
  { key: 'travel_mar_2026', month: 3, year: 2026, defaultSrc: 'images/travel-mar-2026.jpg',  caption_nl: 'Maart 2026',    caption_en: 'March 2026' },
  { key: 'travel_feb_2026', month: 2, year: 2026, defaultSrc: 'images/travel-feb-2026.jpg',  caption_nl: 'Februari 2026', caption_en: 'February 2026' },
  { key: 'travel_jan_2026', month: 1, year: 2026, defaultSrc: 'images/travel-jan-2026.jpg',  caption_nl: 'Januari 2026',  caption_en: 'January 2026' },
  { key: 'travel_dec_2025', month: 12, year: 2025, defaultSrc: 'images/travel-dec-2025.jpg', caption_nl: 'December 2025', caption_en: 'December 2025' },
  { key: 'travel_nov_2025', month: 11, year: 2025, defaultSrc: 'images/travel-nov-2025.jpg', caption_nl: 'November 2025', caption_en: 'November 2025' },
];

function loadTravelPhotos() {
  const outer = document.getElementById('travel-photo-container');
  if (!outer) return;
  const lang = localStorage.getItem('catobycato-lang') || 'nl';
  const withResolvedSrc = travelPhotos.map(p => ({ ...p, src: img(p.key, p.defaultSrc) }));
  const sorted = [...withResolvedSrc].sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
  const makeItem = (photo) => {
    const caption = lang === 'nl' ? photo.caption_nl : photo.caption_en;
    return `<div class="polaroid travel-polaroid">
      <img src="${photo.src}" alt="${caption}" loading="lazy">
      <span class="travel-caption caveat">${caption}</span>
    </div>`;
  };
  const itemsHtml = sorted.map(makeItem).join('');
  outer.innerHTML = `<div class="marquee-track travel-marquee-track">${itemsHtml}${itemsHtml}</div>`;
  outer.classList.add('marquee-outer');
  const outer2 = document.getElementById('travel-photo-container-2');
  if (outer2) {
    const reversed = [...sorted].reverse();
    const itemsHtml2 = reversed.map(makeItem).join('');
    outer2.innerHTML = `<div class="marquee-track travel-marquee-track travel-marquee-track-reverse">${itemsHtml2}${itemsHtml2}</div>`;
    outer2.classList.add('marquee-outer');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteImages();
  applyImages();
  renderBuntings();
  renderSeasonalPolaroids();
  loadTravelPhotos();
});
