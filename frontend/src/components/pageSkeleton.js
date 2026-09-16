function ensureSkeletonStyles() {
  if (document.querySelector('[data-dormhive-route-skeleton]')) return;

  const style = document.createElement('style');
  style.dataset.dormhiveRouteSkeleton = '1';
  style.textContent = `
    .dh-route-skeleton {
      --skeleton-bg-1: #edf3f1;
      --skeleton-bg-2: #f9fbfa;
      --skeleton-bg-3: #e8f0ee;
      --skeleton-radius: 14px;
      display: block;
      width: 100%;
      min-height: 100vh;
      background: #fff;
      animation: dh-route-skeleton-fade 0.2s ease-out;
    }

    .dh-route-skeleton__block,
    .dh-route-skeleton__line,
    .dh-route-skeleton__circle,
    .dh-route-skeleton__media,
    .dh-route-skeleton__logo,
    .dh-route-skeleton__nav,
    .dh-route-skeleton__avatar,
    .dh-route-skeleton__tile,
    .dh-route-skeleton__table,
    .dh-route-skeleton__form-field,
    .dh-route-skeleton__button {
      position: relative;
      overflow: hidden;
      background: linear-gradient(90deg, var(--skeleton-bg-1) 0%, var(--skeleton-bg-2) 40%, var(--skeleton-bg-3) 100%);
      background-size: 220% 100%;
      animation: dh-route-skeleton-shimmer 1.4s linear infinite;
    }

    .dh-route-skeleton__block,
    .dh-route-skeleton__tile,
    .dh-route-skeleton__table,
    .dh-route-skeleton__media,
    .dh-route-skeleton__nav,
    .dh-route-skeleton__button,
    .dh-route-skeleton__form-field {
      border-radius: var(--skeleton-radius);
    }

    .dh-route-skeleton__dashboard {
      display: grid;
      grid-template-columns: 256px minmax(0, 1fr);
      min-height: 100vh;
      background: #f5f7f6;
    }

    .dh-route-skeleton__owner-dashboard {
      display: grid;
      grid-template-columns: 256px minmax(0, 1fr);
      min-height: 100vh;
      background: #f5f7f6;
    }

    .dh-route-skeleton__owner-sidebar {
      background: #ffffff;
      border-right: 1px solid rgba(23, 37, 34, 0.08);
      padding: 22px 16px;
    }

    .dh-route-skeleton__owner-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
      padding: 0 8px;
    }

    .dh-route-skeleton__owner-logo {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #103b63 0%, #0f2f52 100%);
      position: relative;
      overflow: hidden;
    }

    .dh-route-skeleton__owner-logo::before {
      content: "";
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      border: 3px solid rgba(217, 182, 102, 0.85);
      background: rgba(255, 255, 255, 0.04);
    }

    .dh-route-skeleton__owner-main {
      padding: 20px 24px 28px;
    }

    .dh-route-skeleton__owner-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 20px;
    }

    .dh-route-skeleton__owner-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dh-route-skeleton__owner-button {
      width: 112px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(90deg, var(--skeleton-bg-1) 0%, var(--skeleton-bg-2) 40%, var(--skeleton-bg-3) 100%);
      background-size: 220% 100%;
      animation: dh-route-skeleton-shimmer 1.4s linear infinite;
    }

    .dh-route-skeleton__owner-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(90deg, var(--skeleton-bg-1) 0%, var(--skeleton-bg-2) 40%, var(--skeleton-bg-3) 100%);
      background-size: 220% 100%;
      animation: dh-route-skeleton-shimmer 1.4s linear infinite;
    }

    .dh-route-skeleton__owner-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 22px;
    }

    .dh-route-skeleton__owner-tile {
      min-height: 136px;
      border-radius: 18px;
      background: linear-gradient(90deg, var(--skeleton-bg-1) 0%, var(--skeleton-bg-2) 40%, var(--skeleton-bg-3) 100%);
      background-size: 220% 100%;
      animation: dh-route-skeleton-shimmer 1.4s linear infinite;
    }

    .dh-route-skeleton__owner-content {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
      gap: 20px;
      margin-bottom: 20px;
    }

    .dh-route-skeleton__owner-panel {
      border-radius: 18px;
      background: #fff;
      border: 1px solid rgba(15, 23, 42, 0.04);
      padding: 18px;
      min-height: 260px;
    }

    .dh-route-skeleton__owner-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .dh-route-skeleton__owner-map {
      height: 180px;
      border-radius: 12px;
      background: linear-gradient(90deg, var(--skeleton-bg-1) 0%, var(--skeleton-bg-2) 40%, var(--skeleton-bg-3) 100%);
      background-size: 220% 100%;
      animation: dh-route-skeleton-shimmer 1.4s linear infinite;
    }

    .dh-route-skeleton__owner-panel-body {
      display: grid;
      gap: 12px;
    }

    .dh-route-skeleton__owner-list {
      height: 84px;
      width: 100%;
      border-radius: 12px;
      background: linear-gradient(90deg, var(--skeleton-bg-1) 0%, var(--skeleton-bg-2) 40%, var(--skeleton-bg-3) 100%);
      background-size: 220% 100%;
      animation: dh-route-skeleton-shimmer 1.4s linear infinite;
    }

    .dh-route-skeleton__sidebar {
      background: #ffffff;
      border-right: 1px solid rgba(23, 37, 34, 0.08);
      padding: 22px 16px;
    }

    .dh-route-skeleton__brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
      padding: 0 8px;
    }

    .dh-route-skeleton__logo {
      width: 42px;
      height: 42px;
      border-radius: 12px;
    }

    .dh-route-skeleton__brand .dh-route-skeleton__line {
      width: 120px;
      height: 18px;
      border-radius: 999px;
    }

    .dh-route-skeleton__nav {
      height: 52px;
      width: 100%;
      margin-bottom: 14px;
      border-radius: 12px;
    }

    .dh-route-skeleton__main {
      padding: 20px 24px 28px;
    }

    .dh-route-skeleton__topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 20px;
    }

    .dh-route-skeleton__topbar .dh-route-skeleton__line {
      width: 220px;
      height: 18px;
      border-radius: 999px;
    }

    .dh-route-skeleton__actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dh-route-skeleton__avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
    }

    .dh-route-skeleton__button {
      width: 112px;
      height: 40px;
      border-radius: 10px;
    }

    .dh-route-skeleton__stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 22px;
    }

    .dh-route-skeleton__tile {
      min-height: 140px;
    }

    .dh-route-skeleton__content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
      gap: 20px;
    }

    .dh-route-skeleton__panel {
      border-radius: 18px;
      background: #fff;
      border: 1px solid rgba(15, 23, 42, 0.04);
      padding: 18px;
    }

    .dh-route-skeleton__panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .dh-route-skeleton__line.short {
      width: 35%;
    }

    .dh-route-skeleton__line.medium {
      width: 55%;
    }

    .dh-route-skeleton__line.long {
      width: 80%;
    }

    .dh-route-skeleton__media {
      height: 180px;
      width: 100%;
      border-radius: 16px;
      margin-bottom: 14px;
    }

    .dh-route-skeleton__card-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .dh-route-skeleton__card {
      background: #fff;
      border: 1px solid rgba(15, 23, 42, 0.04);
      border-radius: 18px;
      padding: 14px;
    }

    .dh-route-skeleton__table {
      height: 240px;
      width: 100%;
      border-radius: 18px;
      background: #fff;
    }

    .dh-route-skeleton__auth {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #f7f5f1 0%, #eff5f4 100%);
      padding: 28px;
    }

    .dh-route-skeleton__auth-shell {
      width: min(1180px, 100%);
      min-height: 720px;
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 18px 48px rgba(24, 39, 33, 0.08);
      overflow: hidden;
    }

    .dh-route-skeleton__auth-shell--register {
      grid-template-columns: 1fr 1fr;
    }

    .dh-route-skeleton__auth-left {
      padding: 32px 36px 28px;
      background: linear-gradient(180deg, #f8faf9 0%, #eef4f2 100%);
      border-right: 1px solid rgba(15, 23, 42, 0.06);
    }

    .dh-route-skeleton__auth-left--register {
      background: linear-gradient(180deg, #f6f9fb 0%, #edf3f8 100%);
    }

    .dh-route-skeleton__auth-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
    }

    .dh-route-skeleton__brand-mark {
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }

    .dh-route-skeleton__auth-form {
      display: grid;
      gap: 16px;
      margin-top: 20px;
    }

    .dh-route-skeleton__auth-form--register {
      gap: 14px;
    }

    .dh-route-skeleton__register-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .dh-route-skeleton__auth-form .dh-route-skeleton__line {
      height: 18px;
      border-radius: 10px;
    }

    .dh-route-skeleton__auth-form .dh-route-skeleton__form-field {
      height: 52px;
      width: 100%;
      border-radius: 12px;
    }

    .dh-route-skeleton__auth-form .dh-route-skeleton__button {
      width: 100%;
      height: 52px;
      margin-top: 4px;
    }

    .dh-route-skeleton__auth-right {
      position: relative;
      padding: 30px 32px;
      background: linear-gradient(180deg, #0f2d4a 0%, #102d4d 100%);
    }

    .dh-route-skeleton__auth-right--register {
      background: linear-gradient(180deg, #f2f2f2 0%, #e4e4e4 100%);
    }

    .dh-route-skeleton__auth-panel {
      position: absolute;
      inset: 26px 28px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 16px;
    }

    .dh-route-skeleton__auth-panel .dh-route-skeleton__line {
      height: 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
    }

    .dh-route-skeleton__auth-panel .dh-route-skeleton__button {
      width: 170px;
      height: 52px;
      background: rgba(255, 255, 255, 0.16);
    }

    .dh-route-skeleton__auth-social {
      width: 100%;
      height: 48px;
      border-radius: 12px;
    }

    @keyframes dh-route-skeleton-shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    @keyframes dh-route-skeleton-fade {
      from {
        opacity: 0.3;
      }
      to {
        opacity: 1;
      }
    }

    @media (max-width: 980px) {
      .dh-route-skeleton__dashboard {
        grid-template-columns: 1fr;
      }

      .dh-route-skeleton__sidebar {
        padding-bottom: 10px;
      }

      .dh-route-skeleton__content-grid,
      .dh-route-skeleton__auth-shell,
      .dh-route-skeleton__stats,
      .dh-route-skeleton__card-row {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.append(style);
}

function dashboardSkeleton() {
  return `
    <div class="dh-route-skeleton dh-route-skeleton__dashboard" aria-live="polite" aria-busy="true" aria-label="Loading page">
      <aside class="dh-route-skeleton__sidebar">
        <div class="dh-route-skeleton__brand" aria-hidden="true">
          <div class="dh-route-skeleton__line long"></div>
        </div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
      </aside>

      <main class="dh-route-skeleton__main">
        <div class="dh-route-skeleton__topbar">
          <div class="dh-route-skeleton__line"></div>
          <div class="dh-route-skeleton__actions">
            <div class="dh-route-skeleton__button"></div>
            <div class="dh-route-skeleton__avatar"></div>
          </div>
        </div>

        <section class="dh-route-skeleton__stats">
          <div class="dh-route-skeleton__tile"></div>
          <div class="dh-route-skeleton__tile"></div>
          <div class="dh-route-skeleton__tile"></div>
          <div class="dh-route-skeleton__tile"></div>
        </section>

        <section class="dh-route-skeleton__content-grid">
          <div class="dh-route-skeleton__panel">
            <div class="dh-route-skeleton__panel-header">
              <div class="dh-route-skeleton__line medium"></div>
              <div class="dh-route-skeleton__line short"></div>
            </div>
            <div class="dh-route-skeleton__media"></div>
            <div class="dh-route-skeleton__media"></div>
          </div>

          <div class="dh-route-skeleton__panel">
            <div class="dh-route-skeleton__panel-header">
              <div class="dh-route-skeleton__line medium"></div>
              <div class="dh-route-skeleton__line short"></div>
            </div>
            <div class="dh-route-skeleton__table"></div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function adminSkeleton() {
  return `
    <div class="dh-route-skeleton dh-route-skeleton__dashboard" aria-live="polite" aria-busy="true" aria-label="Loading admin page">
      <aside class="dh-route-skeleton__sidebar">
        <div class="dh-route-skeleton__brand" aria-hidden="true">
          <div class="dh-route-skeleton__line long"></div>
        </div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
      </aside>

      <main class="dh-route-skeleton__main">
        <div class="dh-route-skeleton__topbar">
          <div class="dh-route-skeleton__line"></div>
          <div class="dh-route-skeleton__actions">
            <div class="dh-route-skeleton__button"></div>
            <div class="dh-route-skeleton__avatar"></div>
          </div>
        </div>

        <section class="dh-route-skeleton__stats">
          <div class="dh-route-skeleton__tile"></div>
          <div class="dh-route-skeleton__tile"></div>
          <div class="dh-route-skeleton__tile"></div>
          <div class="dh-route-skeleton__tile"></div>
        </section>

        <section class="dh-route-skeleton__content-grid">
          <div class="dh-route-skeleton__panel">
            <div class="dh-route-skeleton__panel-header">
              <div class="dh-route-skeleton__line medium"></div>
              <div class="dh-route-skeleton__line short"></div>
            </div>
            <div class="dh-route-skeleton__media"></div>
            <div class="dh-route-skeleton__media"></div>
          </div>

          <div class="dh-route-skeleton__panel">
            <div class="dh-route-skeleton__panel-header">
              <div class="dh-route-skeleton__line medium"></div>
              <div class="dh-route-skeleton__line short"></div>
            </div>
            <div class="dh-route-skeleton__table"></div>
          </div>
        </section>

        <section class="dh-route-skeleton__content-grid">
          <div class="dh-route-skeleton__panel">
            <div class="dh-route-skeleton__panel-header">
              <div class="dh-route-skeleton__line medium"></div>
            </div>
            <div class="dh-route-skeleton__table"></div>
          </div>
          <div class="dh-route-skeleton__panel">
            <div class="dh-route-skeleton__panel-header">
              <div class="dh-route-skeleton__line medium"></div>
            </div>
            <div class="dh-route-skeleton__table"></div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function ownerSkeleton() {
  return `
    <div class="dh-route-skeleton dh-route-skeleton__owner-dashboard" aria-live="polite" aria-busy="true" aria-label="Loading owner dashboard">
      <aside class="dh-route-skeleton__owner-sidebar">
        <div class="dh-route-skeleton__owner-brand">
          <div class="dh-route-skeleton__owner-logo"></div>
          <div class="dh-route-skeleton__line long"></div>
        </div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
        <div class="dh-route-skeleton__nav"></div>
      </aside>

      <main class="dh-route-skeleton__owner-main">
        <div class="dh-route-skeleton__owner-topbar">
          <div class="dh-route-skeleton__line"></div>
          <div class="dh-route-skeleton__owner-actions">
            <div class="dh-route-skeleton__owner-button"></div>
            <div class="dh-route-skeleton__owner-avatar"></div>
          </div>
        </div>

        <section class="dh-route-skeleton__owner-stats">
          <div class="dh-route-skeleton__owner-tile"></div>
          <div class="dh-route-skeleton__owner-tile"></div>
          <div class="dh-route-skeleton__owner-tile"></div>
        </section>

        <section class="dh-route-skeleton__owner-content">
          <div class="dh-route-skeleton__owner-panel">
            <div class="dh-route-skeleton__owner-panel-header">
              <div class="dh-route-skeleton__line medium"></div>
              <div class="dh-route-skeleton__line short"></div>
            </div>
            <div class="dh-route-skeleton__owner-map"></div>
          </div>

          <div class="dh-route-skeleton__owner-panel">
            <div class="dh-route-skeleton__owner-panel-header">
              <div class="dh-route-skeleton__line medium"></div>
            </div>
            <div class="dh-route-skeleton__owner-panel-body">
              <div class="dh-route-skeleton__owner-list"></div>
              <div class="dh-route-skeleton__owner-list"></div>
              <div class="dh-route-skeleton__owner-list"></div>
            </div>
          </div>
        </section>

        <section class="dh-route-skeleton__owner-panel">
          <div class="dh-route-skeleton__owner-panel-header">
            <div class="dh-route-skeleton__line medium"></div>
            <div class="dh-route-skeleton__line short"></div>
          </div>
          <div class="dh-route-skeleton__owner-map" style="height: 120px;"></div>
        </section>
      </main>
    </div>
  `;
}

function loginSkeleton() {
  return `
    <div class="dh-route-skeleton dh-route-skeleton__auth dh-route-skeleton__auth-login" aria-live="polite" aria-busy="true" aria-label="Loading login page">
      <div class="dh-route-skeleton__auth-shell">
        <div class="dh-route-skeleton__auth-left">
          <div class="dh-route-skeleton__auth-brand">
            <div class="dh-route-skeleton__brand-mark"></div>
            <div class="dh-route-skeleton__line long"></div>
          </div>

          <div class="dh-route-skeleton__auth-form">
            <div class="dh-route-skeleton__line medium"></div>
            <div class="dh-route-skeleton__form-field"></div>
            <div class="dh-route-skeleton__form-field"></div>
            <div class="dh-route-skeleton__line short"></div>
            <div class="dh-route-skeleton__button"></div>
            <div class="dh-route-skeleton__line medium"></div>
            <div class="dh-route-skeleton__button dh-route-skeleton__auth-social"></div>
            <div class="dh-route-skeleton__button dh-route-skeleton__auth-social"></div>
          </div>
        </div>

        <div class="dh-route-skeleton__auth-right">
          <div class="dh-route-skeleton__auth-panel">
            <div class="dh-route-skeleton__line long"></div>
            <div class="dh-route-skeleton__line short"></div>
            <div class="dh-route-skeleton__line long"></div>
            <div class="dh-route-skeleton__line medium"></div>
            <div class="dh-route-skeleton__button"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function registerSkeleton() {
  return `
    <div class="dh-route-skeleton dh-route-skeleton__auth dh-route-skeleton__auth-register" aria-live="polite" aria-busy="true" aria-label="Loading registration page">
      <div class="dh-route-skeleton__auth-shell dh-route-skeleton__auth-shell--register">
        <div class="dh-route-skeleton__auth-left dh-route-skeleton__auth-left--register">
          <div class="dh-route-skeleton__auth-brand">
            <div class="dh-route-skeleton__brand-mark"></div>
            <div class="dh-route-skeleton__line long"></div>
          </div>

          <div class="dh-route-skeleton__auth-form dh-route-skeleton__auth-form--register">
            <div class="dh-route-skeleton__line medium"></div>
            <div class="dh-route-skeleton__register-row">
              <div class="dh-route-skeleton__form-field"></div>
              <div class="dh-route-skeleton__form-field"></div>
            </div>
            <div class="dh-route-skeleton__form-field"></div>
            <div class="dh-route-skeleton__form-field"></div>
            <div class="dh-route-skeleton__form-field"></div>
            <div class="dh-route-skeleton__form-field"></div>
            <div class="dh-route-skeleton__form-field"></div>
            <div class="dh-route-skeleton__button"></div>
          </div>
        </div>

        <div class="dh-route-skeleton__auth-right dh-route-skeleton__auth-right--register">
          <div class="dh-route-skeleton__auth-panel">
            <div class="dh-route-skeleton__line long"></div>
            <div class="dh-route-skeleton__line short"></div>
            <div class="dh-route-skeleton__line long"></div>
            <div class="dh-route-skeleton__line medium"></div>
            <div class="dh-route-skeleton__button"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function authSkeleton(path = '/login') {
  if (path === '/register') return registerSkeleton();
  return loginSkeleton();
}

function homeSkeleton() {
  return `
    <div class="dh-route-skeleton" aria-live="polite" aria-busy="true" aria-label="Loading homepage">
      <div class="dh-route-skeleton__topbar" style="padding: 20px 24px 0; background: #fff;">
        <div class="dh-route-skeleton__line" style="width: 180px; height: 22px; margin: 0 auto;"></div>
      </div>
      <div class="dh-route-skeleton__media" style="max-width: 1200px; margin: 18px auto 0; height: 420px; border-radius: 20px;"></div>
      <div style="max-width: 1040px; margin: 24px auto 0; display: grid; gap: 18px;">
        <div class="dh-route-skeleton__line medium" style="margin: 0 auto;"></div>
        <div class="dh-route-skeleton__line long" style="margin: 0 auto;"></div>
        <div class="dh-route-skeleton__card-row">
          <div class="dh-route-skeleton__card" style="min-height: 150px;"></div>
          <div class="dh-route-skeleton__card" style="min-height: 150px;"></div>
          <div class="dh-route-skeleton__card" style="min-height: 150px;"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderRouteSkeleton(root, path = '/') {
  if (!root) return;
  ensureSkeletonStyles();

  if (path === '/' || path === '/forgot-password' || path === '/reset-password' || path === '/oauth/callback') {
    root.innerHTML = path === '/' ? homeSkeleton() : authSkeleton(path);
    return;
  }

  if (path === '/login' || path === '/register') {
    root.innerHTML = authSkeleton(path);
    return;
  }

  if (path.startsWith('/owner/')) {
    root.innerHTML = ownerSkeleton();
    return;
  }

  if (path.startsWith('/admin/')) {
    root.innerHTML = adminSkeleton();
    return;
  }

  if (path.startsWith('/tenant/')) {
    root.innerHTML = dashboardSkeleton();
    return;
  }

  root.innerHTML = homeSkeleton();
}
