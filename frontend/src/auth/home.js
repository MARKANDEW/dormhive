function removeAuthStyles() {
  document.querySelectorAll('link[data-dormhive-auth]').forEach((link) => link.remove());
  document.querySelectorAll('link[id^="dormhive-"]').forEach((link) => link.remove());
  // Also remove body classes from auth pages
  document.body.className = '';
}

function loadStylesheet() {
  const id = 'dormhive-home-style';
  if (document.querySelector(`#${id}`)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style/home.css', import.meta.url).href;
  document.head.appendChild(link);
}

export function renderHomePage(root = document.querySelector('#app')) {
  if (!root) throw new Error('Home page requires #app');

  removeAuthStyles();
  loadStylesheet();

  root.innerHTML = `
    <div class="dh-home">
      <header class="dh-header">
        <div class="dh-header-inner">
          <a class="dh-brand" href="#/" aria-label="DormHive home">
            <span class="dh-brand-mark" aria-hidden="true"></span>
            <span>DormHive</span>
          </a>

          <label class="dh-search" aria-label="Search dorms">
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="Search dorms, universities..." />
          </label>

          <nav class="dh-nav" aria-label="Main navigation">
            <a href="#/about">About</a>
            <a href="#/dorms">Dorms</a>
            <a href="#/login">Login</a>
          </nav>
        </div>
      </header>

      <div class="dh-shell">
        <section class="dh-hero" aria-label="DormHive hero promotion">
          <div class="dh-hero-inner">
            <div class="dh-hero-content">
              <h1 class="dh-hero-title">Find Your Perfect Dorm<br />or Student Housing</h1>
              <p class="dh-hero-subtitle">Comfortable and Affordable Student Living</p>
              <a href="#/dorms" class="dh-cta">Find My Dorm!</a>
            </div>
          </div>
        </section>

        <section class="dh-section" aria-labelledby="about-title">
          <h2 id="about-title">About DormHive</h2>
          <p class="dh-about-copy">
            DormHive is your trusted platform for finding verified and comfortable student accommodations.
            Whether you're looking for a shared room or a private dorm, we've got you covered with a variety
            of options to suit your needs and budget.
          </p>

          <div class="dh-feature-grid">
            <article class="dh-feature">
              <div class="dh-feature-icon" aria-hidden="true">👤</div>
              <h3>Verified Student Housing</h3>
              <p>All listings are verified for safety and student-friendly amenities.</p>
            </article>

            <article class="dh-feature">
              <div class="dh-feature-icon" aria-hidden="true">💰</div>
              <h3>Budget-Friendly Options</h3>
              <p>Flexible payment plans to fit any student budget.</p>
            </article>

            <article class="dh-feature">
              <div class="dh-feature-icon" aria-hidden="true">🎧</div>
              <h3>24/7 Student Support</h3>
              <p>Our team is here to help you with any issues, anytime.</p>
            </article>
          </div>
        </section>

        <section class="dh-section" aria-labelledby="types-title">
          <h2 id="types-title">Our Dorm Types</h2>
          <div class="dh-types-grid">
            <article class="dh-card">
              <div class="dh-card-media" style="background-image:url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80');"></div>
              <div class="dh-card-body">
                <h3>Shared Room</h3>
                <p>Cost-effective shared living with essential amenities.</p>
              </div>
            </article>

            <article class="dh-card">
              <div class="dh-card-media" style="background-image:url('https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80');"></div>
              <div class="dh-card-body">
                <h3>Private Dorm</h3>
                <p>The perfect balance of comfort and privacy.</p>
              </div>
            </article>

            <article class="dh-card">
              <div class="dh-card-media" style="background-image:url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80');"></div>
              <div class="dh-card-body">
                <h3>Studio Apartment</h3>
                <p>Premium accommodations with top-tier amenities and private space.</p>
              </div>
            </article>
          </div>
        </section>

        <section class="dh-section" aria-labelledby="featured-title">
          <h2 id="featured-title">Featured Dorms</h2>
          <p class="dh-about-copy">Discover our top-rated rental options.</p>

          <div class="dh-featured-grid">
            <article class="dh-featured-card">
              <div class="dh-card-media" style="background-image:url('https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80');"></div>
              <div class="dh-card-body">
                <h3>University Heights Dorm</h3>
                <p>Modern facilities close to campus. 4.5 stars.</p>
                <div class="dh-stars" aria-label="4.5 stars">★★★★★</div>
              </div>
            </article>

            <article class="dh-featured-card">
              <div class="dh-card-media" style="background-image:url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80');"></div>
              <div class="dh-card-body">
                <h3>Maple Street Student House</h3>
                <p>Historic charm with modern shared spaces. 4.2 stars.</p>
                <div class="dh-stars" aria-label="4.2 stars">★★★★☆</div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  `;
}
