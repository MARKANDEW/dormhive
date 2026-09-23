function loadStylesheet() {
  const existing = document.querySelector('link[data-dormhive-legal="auth"]');
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', resolve, { once: true }));

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/authSplit.css', import.meta.url).href;
  link.dataset.dormhiveLegal = 'auth';
  document.head.append(link);

  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

import { createModal, openModal } from '../components/modal.js';

export const legalContent = {
  terms: {
    title: 'Terms of Service',
    intro: 'These Terms of Service outline the rules and responsibilities for using DormHive services.',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By creating an account and using DormHive, you agree to these terms and any updates we may issue. If you do not agree, please do not use the platform.',
      },
      {
        heading: '2. Account Responsibility',
        body: 'You are responsible for keeping your account secure, using accurate information, and maintaining compliance with local laws and community standards.',
      },
      {
        heading: '3. Listings and Transactions',
        body: 'DormHive helps connect renters and property owners. We do not guarantee the availability, condition, or legal validity of any listing, and users remain responsible for their own agreements.',
      },
      {
        heading: '4. Prohibited Conduct',
        body: 'Users may not misuse the service, submit fraudulent information, harass others, or violate the security or integrity of the platform.',
      },
      {
        heading: '5. Changes to Terms',
        body: 'DormHive may revise these terms at any time. Continued use of the platform after changes are posted means you accept the revised terms.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'We value your privacy and handle personal information with care to support a safer and more transparent housing experience.',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We may collect your name, email, phone number, account details, property preferences, and communications used to provide our services.',
      },
      {
        heading: '2. How We Use Information',
        body: 'Your information helps us create accounts, match renters and owners, process bookings or inquiries, improve platform features, and maintain service quality.',
      },
      {
        heading: '3. Data Sharing',
        body: 'We only share personal information with trusted services necessary to operate the platform, and only when required by law or with user consent for specific actions.',
      },
      {
        heading: '4. Security',
        body: 'We use reasonable safeguards to protect account data and platform information, but no system is fully infallible. Please help protect your account by using a strong password and keeping your access secure.',
      },
      {
        heading: '5. Your Rights',
        body: 'You may request access, correction, or deletion of your personal information in accordance with applicable privacy laws and platform policy.',
      },
    ],
  },
};

export function legalContentMarkup({ intro, sections }) {
  return `<p class="legal-modal-intro">${intro}</p>${sections.map((section) => `<section class="legal-modal-section"><h3>${section.heading}</h3><p>${section.body}</p></section>`).join('')}`;
}

export function openLegalModal(initialKey = 'terms') {
  const modal = createModal({
    title: legalContent[initialKey].title,
    content: legalContentMarkup(legalContent[initialKey]),
    footerMarkup: `<div class="legal-modal-tabs" role="tablist" aria-label="Legal documents">
      <button type="button" class="legal-modal-tab" data-legal-tab="terms" role="tab">Terms of Service</button>
      <button type="button" class="legal-modal-tab" data-legal-tab="privacy" role="tab">Privacy Policy</button>
    </div>`,
  });
  const title = modal.querySelector('.ui-modal__header h2');
  const body = modal.querySelector('.ui-modal__body');
  const tabs = modal.querySelectorAll('[data-legal-tab]');
  const selectTab = (key) => {
    title.textContent = legalContent[key].title;
    body.innerHTML = legalContentMarkup(legalContent[key]);
    tabs.forEach((tab) => {
      const selected = tab.dataset.legalTab === key;
      tab.classList.toggle('is-selected', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    body.scrollTop = 0;
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.legalTab)));
  selectTab(initialKey);
  openModal(modal);
  return modal;
}

function renderLegalPage(root, { title, intro, sections }) {
  if (!root) throw new Error('Legal page requires an element with id "app".');
  root.innerHTML = `
    <div class="password-reset-page">
      <div class="password-reset-card" style="max-width: 760px; width: min(100%, 760px);">
        <a class="password-reset-back" href="#/register">← Back to register</a>
        <h1>${title}</h1>
        <p class="password-reset-intro">${intro}</p>
        ${sections
          .map(
            (section) => `
              <section style="margin-top: 1.25rem;">
                <h2 style="font-size: 1.08rem; margin: 0 0 0.5rem; color: #17352f;">${section.heading}</h2>
                <p style="margin: 0; color: #465b57; line-height: 1.7; font-size: 0.95rem;">${section.body}</p>
              </section>
            `,
          )
          .join('')}
      </div>
    </div>
  `;
}

export async function renderTermsPage(root = document.querySelector('#app')) {
  await loadStylesheet();
  renderLegalPage(root, legalContent.terms);
}

export async function renderPrivacyPage(root = document.querySelector('#app')) {
  await loadStylesheet();
  renderLegalPage(root, legalContent.privacy);
}
