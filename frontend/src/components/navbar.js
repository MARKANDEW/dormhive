import { ensureStyleSheet, escapeHtml, toClassNames } from '../utils/dom.js';

const STYLE_ID = 'navbar';

function loadStyle() {
  ensureStyleSheet({ id: STYLE_ID, href: new URL('./style/navbar.css', import.meta.url).href });
}

export function createNavbar({ brand = 'DormHive', brandHref = '/', links = [], actions = [] } = {}) {
  loadStyle();

  const navbar = document.createElement('header');
  navbar.className = 'ui-navbar';

  const brandLink = document.createElement('a');
  brandLink.className = 'ui-navbar__brand';
  brandLink.href = brandHref;
  brandLink.textContent = brand;
  navbar.append(brandLink);

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'ui-navbar__menu';
  menuButton.setAttribute('aria-label', 'Toggle navigation');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.textContent = '☰';
  navbar.append(menuButton);

  const nav = document.createElement('nav');
  nav.className = 'ui-navbar__links';
  links.forEach((link) => {
    const anchor = document.createElement('a');
    anchor.href = link.href ?? '#';
    anchor.textContent = link.label;
    if (link.active) anchor.setAttribute('aria-current', 'page');
    nav.append(anchor);
  });
  navbar.append(nav);

  const actionRoot = document.createElement('div');
  actionRoot.className = 'ui-navbar__actions';

  actions.forEach((action) => {
    const element = action.href ? document.createElement('a') : document.createElement('button');
    element.className = toClassNames('ui-navbar__action', action.variant ? action.variant : '');
    element.textContent = action.label;

    if (action.href) {
      element.href = action.href;
    } else {
      element.type = 'button';
      if (typeof action.onClick === 'function') element.addEventListener('click', action.onClick);
    }

    actionRoot.append(element);
  });

  navbar.append(actionRoot);

  menuButton.addEventListener('click', () => {
    const open = navbar.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  return navbar;
}
