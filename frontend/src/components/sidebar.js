import { ensureStyleSheet, escapeHtml, toClassNames } from '../utils/dom.js';

const STYLE_ID = 'sidebar';

function loadStyle() {
  ensureStyleSheet({ id: STYLE_ID, href: new URL('./style/sidebar.css', import.meta.url).href });
}

export function createSidebar({ title = 'Menu', items = [], footer = [] } = {}) {
  loadStyle();

  const sidebar = document.createElement('aside');
  sidebar.className = 'ui-sidebar';

  const header = document.createElement('div');
  header.className = 'ui-sidebar__header';

  const titleEl = document.createElement('strong');
  titleEl.textContent = title;
  header.append(titleEl);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close menu');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => setSidebarOpen(sidebar, false));
  header.append(closeButton);

  const nav = document.createElement('nav');
  items.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href ?? '#';
    link.className = toClassNames(item.active ? 'is-active' : '');
    if (item.active) link.setAttribute('aria-current', 'page');
    if (item.icon) {
      const icon = document.createElement('span');
      icon.innerHTML = item.icon;
      link.append(icon);
    }
    const label = document.createElement('span');
    label.textContent = item.label;
    link.append(label);
    nav.append(link);
  });

  const footerRoot = document.createElement('div');
  footerRoot.className = 'ui-sidebar__footer';
  footer.forEach((item) => {
    const button = document.createElement(item.href ? 'a' : 'button');
    button.textContent = item.label;
    if (item.href) {
      button.href = item.href;
    } else {
      button.type = 'button';
      if (typeof item.onClick === 'function') button.addEventListener('click', item.onClick);
    }
    footerRoot.append(button);
  });

  sidebar.append(header, nav, footerRoot);
  return sidebar;
}

export function setSidebarOpen(sidebar, open) {
  sidebar.classList.toggle('is-open', open);
}
