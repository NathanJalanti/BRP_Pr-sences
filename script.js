const players = Array.from({ length: 30 }, (_, i) => `Joueur ${i + 1}`);

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const STORAGE_KEY_EVENTS = 'brp_presences_v8_1_events';
const STORAGE_KEY_ATTENDANCE = 'brp_presences_v8_1_attendance';
const ADMIN_PASSWORD = 'coach';

let currentDate = new Date();
let selectedEventId = null;
let pendingEventId = null;
let pendingPlayer = null;
let isAdminUnlocked = false;

let events = loadJson(STORAGE_KEY_EVENTS, []);
let attendance = loadJson(STORAGE_KEY_ATTENDANCE, {});

const calendar = document.getElementById('calendar');
const monthTitle = document.getElementById('monthTitle');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const resultsBody = document.getElementById('resultsBody');
const selectedDateLabel = document.getElementById('selectedDateLabel');
const exportDayBtn = document.getElementById('exportDayBtn');
const exportAllBtn = document.getElementById('exportAllBtn');

const adminToggleBtn = document.getElementById('adminToggleBtn');
const adminContent = document.getElementById('adminContent');
const eventNameInput = document.getElementById('eventNameInput');
const eventDateInput = document.getElementById('eventDateInput');
const eventTimeInput = document.getElementById('eventTimeInput');
const eventLocationInput = document.getElementById('eventLocationInput');
const createEventBtn = document.getElementById('createEventBtn');

const adminLoginModal = document.getElementById('adminLoginModal');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminErrorText = document.getElementById('adminErrorText');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminCancelBtn = document.getElementById('adminCancelBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmPlayerName = document.getElementById('confirmPlayerName');
const validatePlayerBtn = document.getElementById('validatePlayerBtn');
const changePlayerBtn = document.getElementById('changePlayerBtn');

const statusModal = document.getElementById('statusModal');
const statusText = document.getElementById('statusText');
const presentBtn = document.getElementById('presentBtn');
const absentBtn = document.getElementById('absentBtn');

prevMonth.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

nextMonth.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

adminToggleBtn.addEventListener('click', () => {
  if (isAdminUnlocked) {
    lockAdmin();
    return;
  }

  openAdminLoginModal();
});

adminLoginBtn.addEventListener('click', validateAdminPassword);
adminCancelBtn.addEventListener('click', closeAdminLoginModal);

adminPasswordInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    validateAdminPassword();
  }

  if (event.key === 'Escape') {
    closeAdminLoginModal();
  }
});

createEventBtn.addEventListener('click', createEvent);

validatePlayerBtn.addEventListener('click', () => {
  closeConfirmModal();
  openStatusModal();
});

changePlayerBtn.addEventListener('click', () => {
  pendingEventId = null;
  pendingPlayer = null;
  closeConfirmModal();
});

presentBtn.addEventListener('click', () => saveStatus('Présent'));
absentBtn.addEventListener('click', () => saveStatus('Absent'));

exportDayBtn.addEventListener('click', () => {
  if (!selectedEventId) return;
  exportExcelForEvent(selectedEventId);
});

exportAllBtn.addEventListener('click', exportExcelMonth);

function openAdminLoginModal() {
  adminPasswordInput.value = '';
  adminErrorText.classList.add('hidden');
  adminLoginModal.classList.remove('hidden');
  setTimeout(() => adminPasswordInput.focus(), 0);
}

function closeAdminLoginModal() {
  adminLoginModal.classList.add('hidden');
  adminPasswordInput.value = '';
  adminErrorText.classList.add('hidden');
}

function validateAdminPassword() {
  if (adminPasswordInput.value !== ADMIN_PASSWORD) {
    adminErrorText.classList.remove('hidden');
    adminPasswordInput.select();
    return;
  }

  isAdminUnlocked = true;
  adminContent.classList.remove('hidden');
  adminToggleBtn.textContent = 'Déconnexion admin';
  closeAdminLoginModal();
}

function lockAdmin() {
  isAdminUnlocked = false;
  adminContent.classList.add('hidden');
  adminToggleBtn.textContent = 'Connexion admin';
}

function renderCalendar() {
  calendar.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthTitle.textContent = `${monthNames[month]} ${year}`;

  dayNames.forEach(day => {
    const cell = document.createElement('div');
    cell.className = 'day-name';
    cell.textContent = day;
    calendar.appendChild(cell);
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayIndex = convertJsDayToMondayIndex(firstDay.getDay());

  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement('div');
    empty.className = 'day empty';
    calendar.appendChild(empty);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);
    const dayEvents = getEventsForDate(dateKey);

    const dayCell = document.createElement('div');
    dayCell.className = dayEvents.length ? 'day training-day' : 'day';

    if (dayEvents.some(eventItem => eventItem.id === selectedEventId)) {
      dayCell.classList.add('selected-event-day');
    }

    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `<span>${day}</span>${dayEvents.length ? '<span class="training-label">Événement</span>' : ''}`;
    dayCell.appendChild(header);

    dayEvents.forEach(eventItem => {
      const eventCard = document.createElement('div');
      eventCard.className = 'event-card';
      eventCard.innerHTML = `
        <strong>${escapeHtml(eventItem.name)}</strong>
        <div class="event-meta">${eventItem.time || '--:--'}${eventItem.location ? ' — ' + escapeHtml(eventItem.location) : ''}</div>
      `;

      eventCard.addEventListener('click', () => {
        selectedEventId = eventItem.id;
        renderCalendar();
        renderResults(eventItem.id);
      });

      const select = document.createElement('select');
      select.innerHTML = `<option value="">Choisir un joueur</option>` + players.map(player => `<option value="${player}">${player}</option>`).join('');

      select.addEventListener('change', event => {
        const player = event.target.value;
        if (!player) return;

        pendingEventId = eventItem.id;
        pendingPlayer = player;
        event.target.value = '';
        openConfirmModal(player);
      });

      const counts = getCounts(eventItem.id);
      const countsDiv = document.createElement('div');
      countsDiv.className = 'counts';
      countsDiv.innerHTML = `
        <span class="badge present">✓ ${counts.present}</span>
        <span class="badge absent">✕ ${counts.absent}</span>
      `;

      dayCell.appendChild(eventCard);
      dayCell.appendChild(select);
      dayCell.appendChild(countsDiv);
    });

    calendar.appendChild(dayCell);
  }
}

function createEvent() {
  if (!isAdminUnlocked) {
    openAdminLoginModal();
    return;
  }

  const name = eventNameInput.value.trim();
  const date = eventDateInput.value;
  const time = eventTimeInput.value;
  const location = eventLocationInput.value.trim();

  if (!name || !date) {
    alert("Le nom et la date de l'événement sont obligatoires.");
    return;
  }

  events.push({
    id: createEventId(),
    name,
    date,
    time,
    location
  });

  events.sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
  saveJson(STORAGE_KEY_EVENTS, events);

  eventNameInput.value = '';
  eventDateInput.value = '';
  eventTimeInput.value = '';
  eventLocationInput.value = '';

  currentDate = new Date(`${date}T12:00:00`);
  renderCalendar();
}

function getEventsForDate(dateKey) {
  return events.filter(eventItem => eventItem.date === dateKey);
}

function getEventById(eventId) {
  return events.find(eventItem => eventItem.id === eventId) || null;
}

function createEventId() {
  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function convertJsDayToMondayIndex(jsDay) {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function openConfirmModal(player) {
  confirmPlayerName.textContent = player;
  confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
  confirmModal.classList.add('hidden');
}

function openStatusModal() {
  const eventItem = getEventById(pendingEventId);
  const eventLabel = eventItem ? `${eventItem.name} du ${formatDateFr(eventItem.date)}` : "l'événement sélectionné";
  statusText.textContent = `${pendingPlayer} pour ${eventLabel}`;
  statusModal.classList.remove('hidden');
}

function closeStatusModal() {
  statusModal.classList.add('hidden');
}

function saveStatus(status) {
  if (!pendingEventId || !pendingPlayer) return;

  if (!attendance[pendingEventId]) {
    attendance[pendingEventId] = {};
  }

  attendance[pendingEventId][pendingPlayer] = status;
  saveJson(STORAGE_KEY_ATTENDANCE, attendance);

  selectedEventId = pendingEventId;
  pendingEventId = null;
  pendingPlayer = null;

  closeStatusModal();
  renderCalendar();
  renderResults(selectedEventId);
}

function renderResults(eventId) {
  resultsBody.innerHTML = '';

  if (!eventId) {
    selectedDateLabel.textContent = "Clique sur un événement.";
    exportDayBtn.disabled = true;
    return;
  }

  const eventItem = getEventById(eventId);

  if (!eventItem) {
    selectedDateLabel.textContent = "Événement introuvable.";
    exportDayBtn.disabled = true;
    return;
  }

  selectedDateLabel.textContent = `${eventItem.name} — ${formatDateFr(eventItem.date)}${eventItem.time ? ' à ' + eventItem.time : ''}${eventItem.location ? ' — ' + eventItem.location : ''}`;
  exportDayBtn.disabled = false;

  const eventData = attendance[eventId] || {};

  players.forEach(player => {
    const tr = document.createElement('tr');
    const status = eventData[player] || 'Pas répondu';
    tr.innerHTML = `<td>${player}</td><td>${status}</td>`;
    resultsBody.appendChild(tr);
  });
}

function getCounts(eventId) {
  const eventData = attendance[eventId] || {};

  return Object.values(eventData).reduce((acc, status) => {
    if (status === 'Présent') acc.present += 1;
    if (status === 'Absent') acc.absent += 1;
    return acc;
  }, { present: 0, absent: 0 });
}

function loadJson(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;
  return JSON.parse(raw);
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatDateFr(dateKey) {
  const [year, month, day] = dateKey.split('-');
  return `${day}.${month}.${year}`;
}

function exportExcelForEvent(eventId) {
  const eventItem = getEventById(eventId);
  if (!eventItem) return;

  const workbook = XLSX.utils.book_new();
  const worksheet = buildWorksheetForEvent(eventItem);

  XLSX.utils.book_append_sheet(workbook, worksheet, makeSheetName(eventItem));
  XLSX.writeFile(workbook, `presences_${eventItem.date}_${sanitizeFilename(eventItem.name)}.xlsx`);
}

function exportExcelMonth() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthEvents = events
    .filter(eventItem => {
      const eventDate = new Date(`${eventItem.date}T12:00:00`);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    })
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

  if (!monthEvents.length) {
    alert("Aucun événement à exporter sur ce mois.");
    return;
  }

  const workbook = XLSX.utils.book_new();

  monthEvents.forEach(eventItem => {
    const worksheet = buildWorksheetForEvent(eventItem);
    XLSX.utils.book_append_sheet(workbook, worksheet, makeSheetName(eventItem));
  });

  const monthFile = String(month + 1).padStart(2, '0');
  XLSX.writeFile(workbook, `presences_${year}_${monthFile}.xlsx`);
}

function buildWorksheetForEvent(eventItem) {
  const eventData = attendance[eventItem.id] || {};
  const rows = [
    ['Événement', eventItem.name],
    ['Date', formatDateFr(eventItem.date)],
    ['Heure', eventItem.time || ''],
    ['Lieu', eventItem.location || ''],
    [],
    ['Joueur', 'Statut']
  ];

  players.forEach(player => {
    rows.push([player, eventData[player] || 'Pas répondu']);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 24 }, { wch: 18 }];

  styleWorksheet(worksheet);
  return worksheet;
}

function styleWorksheet(worksheet) {
  const range = XLSX.utils.decode_range(worksheet['!ref']);

  for (let row = range.s.r; row <= range.e.r; row++) {
    const firstCellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
    const secondCellRef = XLSX.utils.encode_cell({ r: row, c: 1 });
    const firstCell = worksheet[firstCellRef];
    const secondCell = worksheet[secondCellRef];

    if ([0, 1, 2, 3].includes(row) && firstCell) {
      firstCell.s = { font: { bold: true } };
    }

    if (row === 5) {
      [firstCell, secondCell].forEach(cell => {
        if (!cell) return;
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "17202A" } },
          alignment: { horizontal: "center" }
        };
      });
    }

    if (!secondCell) continue;

    if (secondCell.v === 'Présent') {
      secondCell.s = {
        fill: { fgColor: { rgb: "C6EFCE" } },
        font: { color: { rgb: "006100" }, bold: true }
      };
    }

    if (secondCell.v === 'Absent') {
      secondCell.s = {
        fill: { fgColor: { rgb: "FFC7CE" } },
        font: { color: { rgb: "9C0006" }, bold: true }
      };
    }
  }
}

function makeSheetName(eventItem) {
  const baseName = formatDateFr(eventItem.date);
  const sameDateEvents = events.filter(item => item.date === eventItem.date);

  if (sameDateEvents.length <= 1) {
    return baseName;
  }

  const index = sameDateEvents.findIndex(item => item.id === eventItem.id) + 1;
  return `${baseName}_${index}`;
}

function sanitizeFilename(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'evenement';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

renderCalendar();
