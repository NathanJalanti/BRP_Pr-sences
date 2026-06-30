const players = Array.from({ length: 30 }, (_, i) => `Joueur ${i + 1}`);
const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];
const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

let currentDate = new Date();
let selectedDate = null;
let pendingDate = null;
let pendingPlayer = null;

const STORAGE_KEY = 'agenda_presence_football_v1';
let attendance = loadAttendance();

const calendar = document.getElementById('calendar');
const monthTitle = document.getElementById('monthTitle');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const resultsBody = document.getElementById('resultsBody');
const selectedDateLabel = document.getElementById('selectedDateLabel');
const exportDayBtn = document.getElementById('exportDayBtn');
const exportAllBtn = document.getElementById('exportAllBtn');
const clearDataBtn = document.getElementById('clearDataBtn');

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

validatePlayerBtn.addEventListener('click', () => {
  closeConfirmModal();
  openStatusModal();
});

changePlayerBtn.addEventListener('click', () => {
  pendingDate = null;
  pendingPlayer = null;
  closeConfirmModal();
});

presentBtn.addEventListener('click', () => saveStatus('Présent'));
absentBtn.addEventListener('click', () => saveStatus('Absent'));

exportDayBtn.addEventListener('click', () => {
  if (!selectedDate) return;
  exportCsvForDate(selectedDate);
});

exportAllBtn.addEventListener('click', exportCsvAll);

clearDataBtn.addEventListener('click', () => {
  const ok = confirm('Effacer toutes les présences enregistrées ?');
  if (!ok) return;
  attendance = {};
  saveAttendance();
  renderCalendar();
  renderResults(selectedDate);
});

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
    const isTraining = isTrainingDay(date);

    const dayCell = document.createElement('div');
    dayCell.className = isTraining ? 'day training-day' : 'day';

    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `<span>${day}</span>${isTraining ? '<span class="training-label">Entraînement</span>' : ''}`;
    dayCell.appendChild(header);

    if (isTraining) {
      const select = document.createElement('select');
      select.innerHTML = `<option value="">Choisir un joueur</option>` + players.map(player => `<option value="${player}">${player}</option>`).join('');
      select.addEventListener('change', event => {
        const player = event.target.value;
        if (!player) return;
        pendingDate = dateKey;
        pendingPlayer = player;
        event.target.value = '';
        openConfirmModal(player);
      });
      dayCell.appendChild(select);

      const counts = getCounts(dateKey);
      const countsDiv = document.createElement('div');
      countsDiv.className = 'counts';
      countsDiv.innerHTML = `
        <span class="badge present">✓ ${counts.present}</span>
        <span class="badge absent">✕ ${counts.absent}</span>
      `;
      dayCell.appendChild(countsDiv);

      dayCell.addEventListener('click', event => {
        if (event.target.tagName.toLowerCase() === 'select') return;
        selectedDate = dateKey;
        renderResults(dateKey);
      });
    }

    calendar.appendChild(dayCell);
  }
}

function isTrainingDay(date) {
  const day = date.getDay();
  return day === 1 || day === 3; // lundi ou mercredi
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
  statusText.textContent = `${pendingPlayer} pour le ${formatDateFr(pendingDate)}`;
  statusModal.classList.remove('hidden');
}

function closeStatusModal() {
  statusModal.classList.add('hidden');
}

function saveStatus(status) {
  if (!pendingDate || !pendingPlayer) return;
  if (!attendance[pendingDate]) attendance[pendingDate] = {};
  attendance[pendingDate][pendingPlayer] = status;
  saveAttendance();

  selectedDate = pendingDate;
  pendingDate = null;
  pendingPlayer = null;

  closeStatusModal();
  renderCalendar();
  renderResults(selectedDate);
}

function renderResults(dateKey) {
  resultsBody.innerHTML = '';

  if (!dateKey) {
    selectedDateLabel.textContent = "Clique sur un jour d'entraînement.";
    exportDayBtn.disabled = true;
    return;
  }

  selectedDateLabel.textContent = `Résultats du ${formatDateFr(dateKey)}`;
  exportDayBtn.disabled = false;

  const dayData = attendance[dateKey] || {};

  players.forEach(player => {
    const tr = document.createElement('tr');
    const status = dayData[player] || 'Pas répondu';
    tr.innerHTML = `<td>${player}</td><td>${status}</td>`;
    resultsBody.appendChild(tr);
  });
}

function getCounts(dateKey) {
  const dayData = attendance[dateKey] || {};
  return Object.values(dayData).reduce((acc, status) => {
    if (status === 'Présent') acc.present += 1;
    if (status === 'Absent') acc.absent += 1;
    return acc;
  }, { present: 0, absent: 0 });
}

function loadAttendance() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAttendance() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attendance));
}

function formatDateFr(dateKey) {
  const [year, month, day] = dateKey.split('-');
  return `${day}.${month}.${year}`;
}

function exportCsvForDate(dateKey) {
  const rows = [['Date', 'Joueur', 'Statut']];
  const dayData = attendance[dateKey] || {};
  players.forEach(player => {
    rows.push([dateKey, player, dayData[player] || 'Pas répondu']);
  });
  downloadCsv(rows, `presences_${dateKey}.csv`);
}

function exportCsvAll() {
  const rows = [['Date', 'Joueur', 'Statut']];
  Object.keys(attendance).sort().forEach(dateKey => {
    players.forEach(player => {
      rows.push([dateKey, player, attendance[dateKey][player] || 'Pas répondu']);
    });
  });
  downloadCsv(rows, 'presences_toutes_dates.csv');
}

function downloadCsv(rows, filename) {
  const csvContent = rows.map(row => row.map(escapeCsvValue).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

renderCalendar();
