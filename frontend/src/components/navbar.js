function loadStyle() {
  if (document.querySelector('[data-component-style="navbar"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./style/navbar.css', import.meta.url);
  link.dataset.componentStyle = 'navbar';
  document.head.append(link);
}

export function createNavbar({ brand = 'DormHive', brandHref = '/', links = [], actions = [] } = {}) {
  loadStyle();
  const navbar = document.createElement('header');
  navbar.className = 'ui-navbar';
  navbar.innerHTML = `<a class="ui-navbar__brand" href="${brandHref}">${brand}</a><button class="ui-navbar__menu" type="button" aria-label="Toggle navigation" aria-expanded="false">?</button><nav class="ui-navbar__links">${links.map((link) => `<a href="${link.href}"${link.active ? ' aria-current="page"' : ''}>${link.label}</a>`).join('')}</nav><div class="ui-navbar__actions"></div>`;
  const actionRoot = navbar.querySelector('.ui-navbar__actions');
  actions.forEach((action) => {
    const element = document.createElement(action.href ? 'a' : 'button');
    element.textContent = action.label;
    element.className = `ui-navbar__action ${action.variant ?? ''}`;
    if (action.href) element.href = action.href;
    else { element.type = 'button'; element.addEventListener('click', action.onClick); }
    actionRoot.append(element);
  });
  const toggle = navbar.querySelector('.ui-navbar__menu');
  toggle.addEventListener('click', () => {
    const open = navbar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  return navbar;
}
