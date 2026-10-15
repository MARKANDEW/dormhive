const viewingTimeGroups = [
  { label: 'Morning (8 AM - 11 AM)', start: 8 * 60, end: 11 * 60 },
  { label: 'Afternoon (12 PM - 4 PM)', start: 12 * 60, end: 16 * 60 },
  { label: 'Evening (5 PM - 7 PM)', start: 17 * 60, end: 19 * 60 }
];

function minutesFromTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function formatTime(minutes) {
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 || 12;
  const minute = String(minutes % 60).padStart(2, '0');
  return `${hour12}:${minute} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

export function viewingTimeFields({ idPrefix, value = '', required = false }) {
  const savedMinutes = minutesFromTime(value);
  const options = viewingTimeGroups.map(({ label, start, end }) => {
    const times = [];
    for (let minutes = start; minutes <= end; minutes += 30) times.push(minutes);
    if (savedMinutes !== null && savedMinutes >= start && savedMinutes <= end && !times.includes(savedMinutes)) {
      times.push(savedMinutes);
      times.sort((first, second) => first - second);
    }
    const items = times.map((minutes) => {
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return `<option value="${time}"${minutes === savedMinutes ? ' selected' : ''}>${formatTime(minutes)}</option>`;
    }).join('');
    return `<optgroup label="${label}">${items}</optgroup>`;
  }).join('');
  const hasSavedTime = savedMinutes !== null && viewingTimeGroups.some(({ start, end }) => savedMinutes >= start && savedMinutes <= end);

  return `<select id="${idPrefix}" class="viewing-time-select" aria-label="Viewing time"${required ? ' required' : ''}>
    <option value=""${hasSavedTime ? '' : ' selected'}>Select a time</option>
    ${options}
  </select>`;
}

export function parseViewingTime(value = '') {
  const time = String(value).trim();
  if (!time) return '';
  const minutes = minutesFromTime(time);
  return minutes !== null && viewingTimeGroups.some(({ start, end }) => minutes >= start && minutes <= end) ? time : null;
}
