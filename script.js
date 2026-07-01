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
  exportExcelForDate(selectedDate);
});

exportAllBtn.addEventListener('click', exportExcelMonth);


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

function exportExcelForDate(dateKey) {
  if (!window.XLSX) {
    alert("La bibliothèque Excel n'est pas chargée. Vérifie ta connexion internet puis réessaie.");
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = buildWorksheetForDate(dateKey);
  XLSX.utils.book_append_sheet(workbook, worksheet, formatDateFr(dateKey));
  XLSX.writeFile(workbook, `presences_${dateKey}.xlsx`);
}

function exportExcelMonth() {
  if (!window.XLSX) {
    alert("La bibliothèque Excel n'est pas chargée. Vérifie ta connexion internet puis réessaie.");
    return;
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const workbook = XLSX.utils.book_new();

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    if (!isTrainingDay(date)) continue;

    const dateKey = toDateKey(date);
    const worksheet = buildWorksheetForDate(dateKey);
    XLSX.utils.book_append_sheet(workbook, worksheet, formatDateFr(dateKey));
  }

  const monthFile = String(month + 1).padStart(2, '0');
  XLSX.writeFile(workbook, `presences_${year}_${monthFile}.xlsx`);
}

function buildWorksheetForDate(dateKey) {
  const rows = [
    ['Date', 'Joueur', 'Statut']
  ];

  const dayData = attendance[dateKey] || {};

  players.forEach(player => {
    rows.push([formatDateFr(dateKey), player, dayData[player] || 'Pas répondu']);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 16 }
  ];

  const range = XLSX.utils.decode_range(worksheet['!ref']);

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    worksheet[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "17202A" } },
      alignment: { horizontal: "center" }
    };
  }

  for (let row = 1; row <= range.e.r; row++) {
    const statusRef = XLSX.utils.encode_cell({ r: row, c: 2 });
    const statusCell = worksheet[statusRef];
    if (!statusCell) continue;

    if (statusCell.v === 'Présent') {
      statusCell.s = {
        fill: { fgColor: { rgb: "C6EFCE" } },
        font: { color: { rgb: "006100" }, bold: true }
      };
    }

    if (statusCell.v === 'Absent') {
      statusCell.s = {
        fill: { fgColor: { rgb: "FFC7CE" } },
        font: { color: { rgb: "9C0006" }, bold: true }
      };
    }
  }

  return worksheet;
}

renderCalendar();
