function loadStyle() {
  if (document.querySelector('[data-component-style="sidebar"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/sidebar.css', import.meta.url);
  link.dataset.componentStyle = 'sidebar';
  document.head.append(link);
}

export function createSidebar({ title = 'Menu', items = [], footer = [] } = {}) {
  loadStyle();
  const sidebar = document.createElement('aside');
  sidebar.className = 'ui-sidebar';
  sidebar.innerHTML = `<div class="ui-sidebar__header"><strong>${title}</strong><button type="button" aria-label="Close menu">×</button></div><nav>${items.map((item) => `<a class="${item.active ? 'is-active' : ''}" href="${item.href}"${item.active ? ' aria-current="page"' : ''}>${item.icon ? `<span>${item.icon}</span>` : ''}${item.label}</a>`).join('')}</nav><div class="ui-sidebar__footer"></div>`;
  const footerRoot = sidebar.querySelector('.ui-sidebar__footer');
  footer.forEach((item) => {
    const button = document.createElement(item.href ? 'a' : 'button');
    button.textContent = item.label;
    if (item.href) button.href = item.href;
    else { button.type = 'button'; button.addEventListener('click', item.onClick); }
    footerRoot.append(button);
  });
  sidebar.querySelector('button').addEventListener('click', () => setSidebarOpen(sidebar, false));
  return sidebar;
}

export function setSidebarOpen(sidebar, open) { sidebar.classList.toggle('is-open', open); }
