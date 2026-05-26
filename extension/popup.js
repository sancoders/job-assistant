const WEBHOOK = 'https://YOUR_N8N_INSTANCE/webhook/cover-letter';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
let lastAnswers = [];

// Runs in the page context — expands "ver más" and extracts the FULL job posting.
async function extractJob() {
  const pick = (sels) => {
    for (const s of sels) {
      const e = document.querySelector(s);
      if (e && e.innerText && e.innerText.trim()) return e.innerText.trim();
    }
    return '';
  };
  const moreSelectors = [
    '.jobs-description__footer-button',
    'button.show-more-less-html__button--more',
    'button[aria-label*="more" i]',
    'button[aria-label*="más" i]'
  ];
  for (const sel of moreSelectors) {
    const btn = document.querySelector(sel);
    if (btn) { try { btn.click(); } catch (e) {} }
  }
  const descRoots = ['#job-details', '.jobs-description', '.jobs-box', '.jobs-description__content'];
  for (const rootSel of descRoots) {
    const root = document.querySelector(rootSel);
    if (!root) continue;
    for (const el of root.querySelectorAll('button, a[role="button"]')) {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (t === 'más' || t === 'ver más' || t === '…ver más' || t === 'see more' ||
          t === 'show more' || t.endsWith('ver más') || t.endsWith('…más')) {
        try { el.click(); } catch (e) {}
      }
    }
  }
  await new Promise((r) => setTimeout(r, 300));

  const title = pick(['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', 'h1']);
  const company = pick(['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.jobs-unified-top-card__primary-description a']);
  const descSelectors = ['#job-details', '.jobs-description__content', '.jobs-description-content__text', '.jobs-description__container', '.jobs-box__html-content'];
  let description = '';
  for (const s of descSelectors) {
    const e = document.querySelector(s);
    const txt = e ? (e.textContent || '').trim() : '';
    if (txt.length > 40) { description = txt; break; }
  }
  if (!description || description.length < 80) description = (document.body.innerText || '').substring(0, 8000);
  description = description.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return { title, company, description: description.substring(0, 8000), url: location.href };
}

async function run(mode) {
  $('btnScore').disabled = true;
  $('btnApply').disabled = true;
  $('result').classList.add('hidden');
  statusEl.textContent = '🔎 Leyendo la oferta...';
  statusEl.className = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: job }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJob });
    if (!job || !job.description || job.description.length < 40) {
      throw new Error('No encontré la descripción del trabajo en esta página.');
    }

    job.mode = mode;
    if (mode === 'apply') {
      job.questions = $('questions').value.split('\n').map((q) => q.trim()).filter(Boolean);
      statusEl.textContent = job.questions.length
        ? '✍️ Generando cover letter + ' + job.questions.length + ' respuesta(s)...'
        : '✍️ Generando cover letter...';
    } else {
      statusEl.textContent = '🎯 Evaluando fit...';
    }

    const resp = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) });
    if (!resp.ok) throw new Error('El servidor respondió ' + resp.status);
    const data = await resp.json();

    render(data);
    statusEl.textContent = mode === 'apply' ? '✅ Listo (también al Telegram).' : '✅ Score guardado.';
  } catch (e) {
    statusEl.textContent = '❌ ' + e.message;
    statusEl.className = 'err';
  } finally {
    $('btnScore').disabled = false;
    $('btnApply').disabled = false;
  }
}

function render(d) {
  const mode = d.mode || 'apply';
  const title = d.title || '(sin título)';
  const company = d.company || '';
  const cv = d.which_cv || d.recommendation || '';
  const lang = (d.language || d.verdict || '').toUpperCase();

  // Meta header
  let meta = '<b>' + escapeHtml(title) + '</b>' + (company ? ' — ' + escapeHtml(company) : '') + '<br>';
  if (mode === 'score') {
    const fit = (d.fit_score != null ? d.fit_score : d.score);
    meta += '<span class="badge fit">Fit ' + fit + '/100</span> ';
  }
  meta += '<span class="badge">CV ' + escapeHtml(cv) + '</span> <span class="badge">' + escapeHtml(lang) + '</span>';
  if (d.salary_note) meta += '<br>💰 ' + escapeHtml(d.salary_note);
  $('meta').innerHTML = meta;

  // Reasons (score only)
  if (mode === 'score') {
    const reasons = d.top_reasons || [];
    const flags = d.red_flags || [];
    let r = '';
    if (reasons.length) r += '<b>✅ Por qué matcheás:</b><br>' + reasons.map((x, i) => (i + 1) + '. ' + escapeHtml(x)).join('<br>');
    if (flags.length) r += '<br><br><b>⚠️ Red flags:</b><br>' + flags.map((x) => '• ' + escapeHtml(x)).join('<br>');
    $('reasons').innerHTML = r;
    $('reasonsWrap').classList.remove('hidden');
  } else {
    $('reasonsWrap').classList.add('hidden');
  }

  // Cover letter + answers (apply only)
  if (mode === 'apply') {
    $('letter').value = d.cover_letter || d.cover_letter_hook || '';
    $('coverWrap').classList.remove('hidden');

    const answers = Array.isArray(d.answers) ? d.answers : [];
    lastAnswers = answers;
    const list = $('answers');
    list.innerHTML = '';
    if (answers.length) {
      answers.forEach((a, i) => {
        const div = document.createElement('div');
        div.className = 'qa';
        const q = document.createElement('div');
        q.className = 'q';
        q.textContent = (i + 1) + '. ' + (a.question || '');
        const ans = document.createElement('div');
        ans.className = 'a';
        ans.textContent = a.answer || '';
        const btn = document.createElement('button');
        btn.className = 'copy';
        btn.textContent = '📋 Copiar respuesta';
        btn.addEventListener('click', () => copyText(a.answer || '', btn));
        div.appendChild(q); div.appendChild(ans); div.appendChild(btn);
        list.appendChild(div);
      });
      $('answersWrap').classList.remove('hidden');
    } else {
      $('answersWrap').classList.add('hidden');
    }
  } else {
    $('coverWrap').classList.add('hidden');
    $('answersWrap').classList.add('hidden');
  }

  $('result').classList.remove('hidden');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  const old = btn.textContent;
  btn.textContent = '✅ Copiada!';
  setTimeout(() => { btn.textContent = old; }, 1500);
}

$('copyLetter').addEventListener('click', () => copyText($('letter').value, $('copyLetter')));
$('copyAllAnswers').addEventListener('click', () => {
  const text = lastAnswers.map((a, i) => (i + 1) + '. ' + (a.question || '') + '\n' + (a.answer || '')).join('\n\n');
  copyText(text, $('copyAllAnswers'));
});
$('btnScore').addEventListener('click', () => run('score'));
$('btnApply').addEventListener('click', () => run('apply'));
