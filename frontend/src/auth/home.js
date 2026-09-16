function removeAuthStyles() {
  document.querySelectorAll('link[data-dormhive-auth]').forEach((link) => link.remove());
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

export async function renderHomePage(root = document.querySelector('#app')) {
  if (!root) throw new Error('Home page requires #app');

  removeAuthStyles();
  loadStylesheet();

  root.innerHTML = `
    <div class="dh-home dh-home-loading" aria-live="polite" aria-busy="true" aria-label="Loading homepage">
      <header class="dh-header dh-skeleton-header">
        <div class="dh-header-inner">
          <div class="dh-skeleton-brand" aria-hidden="true"></div>
          <nav class="dh-nav dh-skeleton-nav" aria-hidden="true">
            <span class="dh-skeleton-pill"></span>
            <span class="dh-skeleton-pill"></span>
            <span class="dh-skeleton-pill"></span>
          </nav>
        </div>
      </header>

      <div class="dh-shell">
        <section class="dh-hero dh-skeleton-hero" aria-hidden="true"></section>

        <section class="dh-section">
          <div class="dh-skeleton-title dh-skeleton-title-wide"></div>
          <div class="dh-skeleton-copy dh-skeleton-copy-wide"></div>
          <div class="dh-feature-grid">
            <div class="dh-feature dh-skeleton-feature"></div>
            <div class="dh-feature dh-skeleton-feature"></div>
            <div class="dh-feature dh-skeleton-feature"></div>
          </div>
        </section>

        <section class="dh-section">
          <div class="dh-skeleton-title"></div>
          <div class="dh-types-grid">
            <div class="dh-card dh-skeleton-card">
              <div class="dh-card-media dh-skeleton-media"></div>
              <div class="dh-card-body">
                <div class="dh-skeleton-line short"></div>
                <div class="dh-skeleton-line"></div>
              </div>
            </div>
            <div class="dh-card dh-skeleton-card">
              <div class="dh-card-media dh-skeleton-media"></div>
              <div class="dh-card-body">
                <div class="dh-skeleton-line short"></div>
                <div class="dh-skeleton-line"></div>
              </div>
            </div>
            <div class="dh-card dh-skeleton-card">
              <div class="dh-card-media dh-skeleton-media"></div>
              <div class="dh-card-body">
                <div class="dh-skeleton-line short"></div>
                <div class="dh-skeleton-line"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  await new Promise((resolve) => setTimeout(resolve, 280));

  root.innerHTML = `
    <div class="dh-home">
      <header class="dh-header">
        <div class="dh-header-inner">
          <a class="dh-brand" href="#/" aria-label="DormHive home">
            <span class="dh-brand-mark" aria-hidden="true"><svg class="dh-brand-icon" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
              <defs>
                <linearGradient id="dormhive-navy-home" x1="20" y1="10" x2="160" y2="170" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#203E69"/>
                  <stop offset="0.55" stop-color="#102B4F"/>
                  <stop offset="1" stop-color="#071B35"/>
                </linearGradient>
                <linearGradient id="dormhive-gold-home" x1="70" y1="30" x2="120" y2="145" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#FFE08A"/>
                  <stop offset="0.35" stop-color="#F5BE42"/>
                  <stop offset="1" stop-color="#C98213"/>
                </linearGradient>
                <filter id="dormhive-shadow-home" x="-30%" y="-30%" width="160%" height="170%">
                  <feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity="0.20"/>
                </filter>
                <filter id="dormhive-glow-home">
                  <feGaussianBlur stdDeviation="2.5" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path d="M90 8 C126 8 157 36 162 71 C167 106 148 139 119 157 C108 164 98 169 90 172 C82 169 72 164 61 157 C32 139 13 106 18 71 C23 36 54 8 90 8Z" fill="url(#dormhive-navy-home)" filter="url(#dormhive-shadow-home)"/>
              <path d="M90 20 C120 20 146 43 150 72 C154 101 139 128 114 144 C105 150 97 154 90 157 C83 154 75 150 66 144 C41 128 26 101 30 72 C34 43 60 20 90 20Z" fill="none" stroke="url(#dormhive-gold-home)" stroke-width="2" opacity=".75"/>
              <path d="M90 31 L105 40 L105 57 L90 66 L75 57 L75 40Z" fill="none" stroke="url(#dormhive-gold-home)" stroke-width="3" opacity=".9"/>
              <path d="M55 55 L70 64 L70 81 L55 90 L40 81 L40 64Z" fill="none" stroke="url(#dormhive-gold-home)" stroke-width="3" opacity=".55"/>
              <path d="M125 55 L140 64 L140 81 L125 90 L110 81 L110 64Z" fill="none" stroke="url(#dormhive-gold-home)" stroke-width="3" opacity=".55"/>
              <path d="M59 54 L59 122 C59 133 67 139 78 139 L91 139 C119 139 137 121 137 96 C137 71 119 54 91 54 Z M78 71 L91 71 C108 71 119 81 119 96 C119 111 108 122 91 122 L78 122 Z" fill="white" fill-rule="evenodd"/>
              <path d="M69 88 L89 69 L109 88" fill="none" stroke="url(#dormhive-gold-home)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#dormhive-glow-home)"/>
              <path d="M82 119 L82 99 C82 94 85 91 90 91 C95 91 98 94 98 99 L98 119" fill="url(#dormhive-gold-home)"/>
              <circle cx="94" cy="105" r="2" fill="#102B4F"/>
              <circle cx="90" cy="42" r="3" fill="#FFE08A"/>
              <circle cx="48" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/>
              <circle cx="132" cy="72" r="2.5" fill="#F5BE42" opacity=".8"/>
              <path d="M68 148 C75 152 83 155 90 158 C97 155 105 152 112 148" fill="none" stroke="url(#dormhive-gold-home)" stroke-width="3" stroke-linecap="round"/>
            </svg></span>
            <span class="dh-brand-name"><span>Dorm</span><span>Hive</span></span>
          </a>

          <nav class="dh-nav" aria-label="Main navigation">
            <a href="#about-title">About</a>
            <a href="#types-title">Dorms</a>
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
              <a href="#types-title" class="dh-cta">Find My Dorm!</a>
            </div>
          </div>
        </section>

        <section class="dh-section" aria-labelledby="about-title">
          <h2 id="about-title">About DormHive</h2>
          <p class="dh-about-copy">
            DormHive is your trusted platform for finding verified and comfortable student accommodations.
            Whether you're looking for a bedspace, solo room, or studio unit, we've got you covered with verified
            options to suit your needs and budget.
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
                <h3>Bedspace</h3>
                <p>Cost-effective shared living with essential amenities.</p>
              </div>
            </article>

            <article class="dh-card">
              <div class="dh-card-media" style="background-image:url('https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80');"></div>
              <div class="dh-card-body">
                <h3>Solo Room</h3>
                <p>The perfect balance of comfort and privacy.</p>
              </div>
            </article>

            <article class="dh-card">
              <div class="dh-card-media" style="background-image:url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80');"></div>
              <div class="dh-card-body">
                <h3>Studio Unit</h3>
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
