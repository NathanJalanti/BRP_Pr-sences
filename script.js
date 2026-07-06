const SUPABASE_URL = 'https://ynrpemxdassbvvmhrcnw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_uGNvyVHYFov3GHQJRScryg_pD3Q78q7';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const testConnectionBtn = document.getElementById('testConnectionBtn');
const loadPlayersBtn = document.getElementById('loadPlayersBtn');
const createEventBtn = document.getElementById('createEventBtn');
const statusBox = document.getElementById('statusBox');
const resultsBody = document.getElementById('resultsBody');

testConnectionBtn.addEventListener('click', testConnection);
loadPlayersBtn.addEventListener('click', loadPlayers);
createEventBtn.addEventListener('click', createTestEvent);

async function testConnection() {
  setStatus('Test de connexion en cours...', 'neutral');

  const { data, error } = await supabaseClient
    .from('players')
    .select('id')
    .limit(1);

  if (error) {
    setStatus(`Erreur connexion Supabase : ${error.message}`, 'error');
    addResult('Connexion Supabase', `Erreur : ${error.message}`);
    return;
  }

  setStatus('Connexion Supabase réussie.', 'success');
  addResult('Connexion Supabase', `OK — ${data.length} ligne test lue.`);
}

async function loadPlayers() {
  setStatus('Lecture des joueurs en cours...', 'neutral');

  const { data, error } = await supabaseClient
    .from('players')
    .select('id, name, active')
    .order('name', { ascending: true });

  if (error) {
    setStatus(`Erreur lecture joueurs : ${error.message}`, 'error');
    addResult('Lecture joueurs', `Erreur : ${error.message}`);
    return;
  }

  setStatus(`${data.length} joueurs lus depuis Supabase.`, 'success');
  addResult('Lecture joueurs', `OK — ${data.length} joueurs trouvés.`);
}

async function createTestEvent() {
  setStatus('Création événement test en cours...', 'neutral');

  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const { data, error } = await supabaseClient
    .from('events')
    .insert({
      name: 'Test Supabase',
      event_date: date,
      event_time: '19:30',
      location: 'BRP'
    })
    .select('id, name, event_date, event_time, location')
    .single();

  if (error) {
    setStatus(`Erreur création événement : ${error.message}`, 'error');
    addResult('Création événement test', `Erreur : ${error.message}`);
    return;
  }

  setStatus(`Événement test créé : ${data.name} — ${data.event_date}`, 'success');
  addResult('Création événement test', `OK — ID : ${data.id}`);
}

function setStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = 'status-box';

  if (type === 'success') {
    statusBox.classList.add('success');
  }

  if (type === 'error') {
    statusBox.classList.add('error');
  }
}

function addResult(testName, result) {
  const row = document.createElement('tr');
  row.innerHTML = `<td>${escapeHtml(testName)}</td><td>${escapeHtml(result)}</td>`;
  resultsBody.prepend(row);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
