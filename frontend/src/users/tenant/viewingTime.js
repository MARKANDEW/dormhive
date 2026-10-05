export function viewingTimeFields({ idPrefix, value = '', required = false }) {
  const savedTime = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  const [, hour24 = '', minute = ''] = savedTime ?? [];
  const hour12 = hour24 ? String(Number(hour24) % 12 || 12).padStart(2, '0') : '';
  const period = hour24 ? (Number(hour24) < 12 ? 'AM' : 'PM') : '';
  const requiredAttribute = required ? ' required' : '';
  const hourOptions = Array.from({ length: 12 }, (_, index) => {
    const hour = String(index + 1).padStart(2, '0');
    return `<option value="${hour}"></option>`;
  }).join('');
  const minuteOptions = Array.from({ length: 60 }, (_, index) => {
    const minuteValue = String(index).padStart(2, '0');
    return `<option value="${minuteValue}"></option>`;
  }).join('');

  const input = (part, label, placeholder, initialValue, options, inputMode = '') => {
    const choices = options.map((option) => `<button type="button" role="option" class="viewing-time-suggestion" data-value="${option}">${option}</button>`).join('');
    return `<span class="viewing-time-part">
      <input id="${idPrefix}-${part}" type="text" ${inputMode} aria-label="${label}" aria-autocomplete="list" aria-expanded="false" aria-controls="${idPrefix}-${part}-suggestions" placeholder="${placeholder}" maxlength="2" autocomplete="off" value="${initialValue}"${requiredAttribute}>
      <span id="${idPrefix}-${part}-suggestions" class="viewing-time-suggestions" role="listbox" hidden>${choices}</span>
    </span>`;
  };

  return `<span class="viewing-time-inputs" role="group" aria-label="Viewing time">
    ${input('hour', 'Hour', 'HH', hour12, Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')), 'inputmode="numeric"')}
    ${input('minute', 'Minute', 'MM', minute, Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')), 'inputmode="numeric"')}
    ${input('period', 'AM or PM', 'AM/PM', period, ['AM', 'PM'])}
  </span>`;
}

export function attachViewingTimeSuggestions(container, idPrefix) {
  for (const part of ['hour', 'minute', 'period']) {
    const input = container.querySelector(`#${idPrefix}-${part}`);
    const menu = container.querySelector(`#${idPrefix}-${part}-suggestions`);
    const options = [...menu.querySelectorAll('[data-value]')];
    const close = () => {
      menu.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    };
    const update = () => {
      const query = input.value.trim().toUpperCase();
      let visibleCount = 0;
      for (const option of options) {
        const matches = option.dataset.value.startsWith(query);
        option.hidden = !matches;
        if (matches) visibleCount += 1;
      }
      menu.hidden = visibleCount === 0;
      input.setAttribute('aria-expanded', String(visibleCount > 0));
    };

    input.addEventListener('focus', update);
    input.addEventListener('input', update);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' && !menu.hidden) {
        event.preventDefault();
        options.find((option) => !option.hidden)?.focus();
      } else if (event.key === 'Escape') {
        close();
      }
    });
    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!menu.contains(document.activeElement)) close();
      }, 0);
    });
    for (const option of options) {
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => {
        input.value = option.dataset.value;
        close();
        input.focus();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      option.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          input.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const visibleOptions = options.filter((item) => !item.hidden);
          const index = visibleOptions.indexOf(option);
          const nextIndex = (index + (event.key === 'ArrowDown' ? 1 : -1) + visibleOptions.length) % visibleOptions.length;
          visibleOptions[nextIndex].focus();
        }
      });
    }
  }
}

export function parseViewingTime(hourValue, minuteValue, periodValue) {
  const hour = hourValue.trim();
  const minute = minuteValue.trim();
  const period = periodValue.trim().toUpperCase();
  if (!hour && !minute && !period) return '';

  if (!/^(?:0?[1-9]|1[0-2])$/.test(hour)
    || !/^(?:[0-5]?[0-9])$/.test(minute)
    || !/^(?:AM|PM)$/.test(period)) return null;

  const hour24 = (Number(hour) % 12) + (period === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
}
