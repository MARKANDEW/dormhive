import { ensureStyleSheet, toClassNames } from '../utils/dom.js';

const STYLE_ID = 'card';

function loadStyle() {
  ensureStyleSheet({ id: STYLE_ID, href: new URL('./style/card.css', import.meta.url).href });
}

export function createCard({ title = '', subtitle = '', content = '', footer = '', imageUrl = '', className = '' } = {}) {
  loadStyle();

  const card = document.createElement('article');
  card.className = toClassNames('ui-card', className);

  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'ui-card__image';
    image.src = imageUrl;
    image.alt = title || 'Card image';
    card.append(image);
  }

  const contentWrap = document.createElement('div');
  contentWrap.className = 'ui-card__content';

  if (subtitle) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'ui-card__subtitle';
    subtitleEl.textContent = subtitle;
    contentWrap.append(subtitleEl);
  }

  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    contentWrap.append(titleEl);
  }

  const body = document.createElement('div');
  body.className = 'ui-card__body';
  if (typeof content === 'string') body.innerHTML = content; else if (content) body.append(content);
  contentWrap.append(body);

  if (footer) {
    const footerEl = document.createElement('footer');
    footerEl.className = 'ui-card__footer';
    if (typeof footer === 'string') footerEl.innerHTML = footer; else if (footer) footerEl.append(footer);
    card.append(contentWrap, footerEl);
  } else {
    card.append(contentWrap);
  }

  return card;
}
