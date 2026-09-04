/* =========================================================================
   Fundos Constitucionais — app.js
   Painel PNDR | FCO · FNE · FNO | Portaria MIDR n. 3.646/2024
   Roda 100% no navegador (sem servidor/backend).
   Lê data/fundos.json (88 registros: 3 fundos × 4 anos × UFs)
   ========================================================================= */

const CORES = { FCO: '#1565c0', FNE: '#e65100', FNO: '#2e7d32' };
const CORES_DARK = { FCO: '#0d3e8a', FNE: '#b84400', FNO: '#1b5e20' };
const FUNDOS = ['FCO', 'FNE', 'FNO'];

let DADOS = [];         // registros brutos do JSON
let MAPA_JSON = null;   // GeoJSON estados brasileiros

const state = {
  view: 'visao-geral',
  anos: [],          // anos selecionados ([] = todos)
  ufs: [],           // UFs selecionadas ([] = todas)
};

let charts = {};    // instâncias Chart.js ativas

/* ── boot ── */
async function boot() {
  const [dados, mapa] = await Promise.all([
    fetch('data/fundos.json').then(r => r.json()),
    fetch('data/mapa_br.json').then(r => r.json()).catch(() => null),
  ]);
  DADOS = dados;

  // Adicionar id às features do GeoJSON para Plotly
  if (mapa) {
    for (const feat of mapa.features) {
      feat.id = feat.properties.abbrev_state;
    }
    MAPA_JSON = mapa;
  }

  wireTopnav();
  renderSidebar();
  renderView();
}

/* ── topnav ── */
function wireTopnav() {
  document.getElementById('topnav').addEventListener('click', e => {
    const a = e.target.closest('a[data-view]');
    if (!a) return;
    document.querySelectorAll('.topnav a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    state.view = a.dataset.view;
    renderView();
  });
}

/* ── filtros / sidebar ── */
function renderSidebar() {
  const anos = [...new Set(DADOS.map(d => d.ANO))].sort();
  const ufs  = [...new Set(DADOS.map(d => d.UF))].sort();

  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <h3>Filtros de Análise</h3>
    <div class="group">
      <div class="group-label">Ano</div>
      <div class="seg" id="seg-ano">
        <button data-v="" class="on">Todos</button>
        ${anos.map(a => `<button data-v="${a}">${a}</button>`).join('')}
      </div>
    </div>
    <div class="group">
      <div class="group-label">UF</div>
      <select id="f-uf">
        <option value="">Todas</option>
        ${ufs.map(u => `<option value="${u}">${u}</option>`).join('')}
      </select>
    </div>
  `;

  // Eventos ano
  sidebar.querySelector('#seg-ano').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    sidebar.querySelectorAll('#seg-ano button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.anos = btn.dataset.v ? [parseInt(btn.dataset.v)] : [];
    renderView();
  });

  // Evento UF
  sidebar.querySelector('#f-uf').addEventListener('change', e => {
    state.ufs = e.target.value ? [e.target.value] : [];
    renderView();
  });
}

/* ── dados filtrados ── */
function dadosFiltrados() {
  return DADOS.filter(d => {
    if (state.anos.length && !state.anos.includes(d.ANO)) return false;
    if (state.ufs.length && !state.ufs.includes(d.UF)) return false;
    return true;
  });
}

/* ── agregar por FUNDO/ANO ── */
function agregaPorFundoAno(df) {
  const mapa = {};
  for (const r of df) {
    const k = `${r.FUNDO_ORIGEM}|${r.ANO}`;
    if (!mapa[k]) mapa[k] = { FUNDO_ORIGEM: r.FUNDO_ORIGEM, ANO: r.ANO, _n: 0,
      VALOR_TOTAL_CONTRATADO: 0, QTD_OPERACOES: 0,
      VALOR_TIPOLOGIA_PRIORITARIA: 0, VALOR_PORTE_PRIORITARIO: 0,
      VALOR_PORTE_16M: 0, VALOR_PRONAF: 0, VALOR_SEMIARIDO: 0,
      VALOR_FRONTEIRA: 0, VALOR_INTERMEDIADORAS: 0,
      VALOR_RURAL: 0, VALOR_NAO_RURAL: 0, VALOR_INFRAESTRUTURA: 0,
      VALOR_CAPITAL_GIRO: 0, VALOR_INVESTIMENTO: 0, VALOR_CUSTEIO: 0,
    };
    const g = mapa[k];
    g._n++;
    g.VALOR_TOTAL_CONTRATADO      += r.VALOR_TOTAL_CONTRATADO || 0;
    g.QTD_OPERACOES               += r.QTD_OPERACOES || 0;
    g.VALOR_TIPOLOGIA_PRIORITARIA += r.VALOR_TIPOLOGIA_PRIORITARIA || 0;
    g.VALOR_PORTE_PRIORITARIO     += r.VALOR_PORTE_PRIORITARIO || 0;
    g.VALOR_PORTE_16M             += r.VALOR_PORTE_16M || 0;
    g.VALOR_PRONAF                += r.VALOR_PRONAF || 0;
    g.VALOR_SEMIARIDO              += r.VALOR_SEMIARIDO || 0;
    g.VALOR_FRONTEIRA             += r.VALOR_FRONTEIRA || 0;
    g.VALOR_INTERMEDIADORAS       += r.VALOR_INTERMEDIADORAS || 0;
    g.VALOR_RURAL                 += r.VALOR_RURAL || 0;
    g.VALOR_NAO_RURAL             += r.VALOR_NAO_RURAL || 0;
    g.VALOR_INFRAESTRUTURA        += r.VALOR_INFRAESTRUTURA || 0;
    g.VALOR_CAPITAL_GIRO          += r.VALOR_CAPITAL_GIRO || 0;
    g.VALOR_INVESTIMENTO          += r.VALOR_INVESTIMENTO || 0;
    g.VALOR_CUSTEIO               += r.VALOR_CUSTEIO || 0;
  }
  // Calcular percentuais
  const result = Object.values(mapa);
  for (const g of result) {
    const v = g.VALOR_TOTAL_CONTRATADO;
    g.pct_tipologia    = v ? g.VALOR_TIPOLOGIA_PRIORITARIA / v * 100 : 0;
    g.pct_porte_prio   = v ? g.VALOR_PORTE_PRIORITARIO / v * 100 : 0;
    g.pct_porte_16m    = v ? g.VALOR_PORTE_16M / v * 100 : 0;
    g.pct_pronaf       = v ? g.VALOR_PRONAF / v * 100 : 0;
    g.pct_semiarido    = v ? g.VALOR_SEMIARIDO / v * 100 : 0;
    g.pct_fronteira    = v ? g.VALOR_FRONTEIRA / v * 100 : 0;
    g.pct_intermediad  = v ? g.VALOR_INTERMEDIADORAS / v * 100 : 0;
    g.pct_rural        = v ? g.VALOR_RURAL / v * 100 : 0;
    g.pct_nao_rural    = v ? g.VALOR_NAO_RURAL / v * 100 : 0;
    g.pct_infra        = v ? g.VALOR_INFRAESTRUTURA / v * 100 : 0;
    g.pct_capital_giro = v ? g.VALOR_CAPITAL_GIRO / v * 100 : 0;
    g.pct_investimento = v ? g.VALOR_INVESTIMENTO / v * 100 : 0;
    g.pct_custeio      = v ? g.VALOR_CUSTEIO / v * 100 : 0;
    g.tiquete          = g.QTD_OPERACOES ? g.VALOR_TOTAL_CONTRATADO / g.QTD_OPERACOES / 1000 : 0;
  }
  return result.sort((a, b) => a.ANO - b.ANO || a.FUNDO_ORIGEM.localeCompare(b.FUNDO_ORIGEM));
}

/* ── agregar por UF ── */
function agregaPorUF(df) {
  const mapa = {};
  for (const r of df) {
    const k = r.UF;
    if (!mapa[k]) mapa[k] = { UF: k, VALOR_TOTAL: 0, VALOR_TIPOLOGIA: 0 };
    mapa[k].VALOR_TOTAL    += r.VALOR_TOTAL_CONTRATADO || 0;
    mapa[k].VALOR_TIPOLOGIA += r.VALOR_TIPOLOGIA_PRIORITARIA || 0;
  }
  return Object.values(mapa).map(g => ({
    ...g,
    pct_pndr: g.VALOR_TOTAL ? g.VALOR_TIPOLOGIA / g.VALOR_TOTAL * 100 : 0,
    vol_bi: g.VALOR_TOTAL / 1e9,
  })).sort((a, b) => b.vol_bi - a.vol_bi);
}

/* ── agregar por FUNDO/UF ── */
function agregaPorFundoUF(df) {
  const totais = {};
  for (const r of df) {
    totais[r.FUNDO_ORIGEM] = (totais[r.FUNDO_ORIGEM] || 0) + (r.VALOR_TOTAL_CONTRATADO || 0);
  }
  const mapa = {};
  for (const r of df) {
    const k = `${r.FUNDO_ORIGEM}|${r.UF}`;
    if (!mapa[k]) mapa[k] = { FUNDO_ORIGEM: r.FUNDO_ORIGEM, UF: r.UF, VALOR_UF: 0 };
    mapa[k].VALOR_UF += r.VALOR_TOTAL_CONTRATADO || 0;
  }
  return Object.values(mapa).map(g => ({
    ...g,
    pct_uf: totais[g.FUNDO_ORIGEM] ? g.VALOR_UF / totais[g.FUNDO_ORIGEM] * 100 : 0,
  }));
}

/* ── helpers Chart.js ── */
function anos(df) {
  return [...new Set(df.map(d => d.ANO))].sort();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function lineChart(id, labels, datasets, yLabel = '%') {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: datasets.map(ds => ({
      ...ds, tension: 0.3, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2.5,
    }))},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => yLabel === '%' ? v.toFixed(1) + '%' : 'R$ ' + v.toFixed(0) + ' mi' } },
      },
    },
  });
}

function barChart(id, labels, datasets, stacked = false, yLabel = '%') {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { stacked, grid: { display: false } },
        y: { stacked, grid: { color: '#f0f0f0' }, ticks: { callback: v => yLabel === '%' ? v.toFixed(1) + '%' : 'R$ ' + v.toFixed(1) + ' Bi' } },
      },
    },
  });
}

/* ── KPIs ── */
function renderKPIs(df, agr) {
  const total  = df.reduce((s, r) => s + (r.VALOR_TOTAL_CONTRATADO || 0), 0);
  const ops    = df.reduce((s, r) => s + (r.QTD_OPERACOES || 0), 0);
  const tip    = df.reduce((s, r) => s + (r.VALOR_TIPOLOGIA_PRIORITARIA || 0), 0);
  const porte  = df.reduce((s, r) => s + (r.VALOR_PORTE_PRIORITARIO || 0), 0);
  const rural  = df.reduce((s, r) => s + (r.VALOR_RURAL || 0), 0);
  const tiquete = ops ? total / ops / 1000 : 0;

  const bar = (pct, cor) => `<div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${cor}"></div></div>`;

  return `
    <div class="kpi-grid">
      <div class="kpi-card" style="--accent:#1565c0">
        <div class="kpi-label">Volume Total Contratado</div>
        <div class="kpi-value">R$ ${(total/1e9).toFixed(1)} Bi</div>
        <div class="kpi-delta">FCO + FNE + FNO</div>
        ${bar(100,'#1565c0')}
      </div>
      <div class="kpi-card" style="--accent:#009C3B">
        <div class="kpi-label">Aderência PNDR</div>
        <div class="kpi-value">${(tip/total*100).toFixed(1)}%</div>
        <div class="kpi-delta">Tipologia Prioritária sobre total</div>
        ${bar(tip/total*100,'#009C3B')}
      </div>
      <div class="kpi-card" style="--accent:#1565c0">
        <div class="kpi-label">Porte Prioritário</div>
        <div class="kpi-value">${(porte/total*100).toFixed(1)}%</div>
        <div class="kpi-delta">Tomadores até R$ 4,8 mi</div>
        ${bar(porte/total*100,'#1565c0')}
      </div>
      <div class="kpi-card" style="--accent:#009C3B">
        <div class="kpi-label">Setor Rural</div>
        <div class="kpi-value">${(rural/total*100).toFixed(1)}%</div>
        <div class="kpi-delta">Sobre o total contratado</div>
        ${bar(rural/total*100,'#009C3B')}
      </div>
      <div class="kpi-card" style="--accent:#666">
        <div class="kpi-label">Tíquete Médio</div>
        <div class="kpi-value">R$ ${tiquete.toFixed(0)} mil</div>
        <div class="kpi-delta">${ops.toLocaleString('pt-BR')} operações</div>
        ${bar(Math.min(tiquete/5000*100,100),'#666')}
      </div>
    </div>`;
}

/* ── aviso filtro ── */
function avisoFiltro() {
  const partes = [];
  if (state.anos.length) partes.push(`Anos: ${state.anos.join(', ')}`);
  if (state.ufs.length)  partes.push(`UFs: ${state.ufs.join(', ')}`);
  if (!partes.length) return '';
  return `<div class="note">⚠️ Filtro ativo — ${partes.join(' | ')}</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEWS
═══════════════════════════════════════════════════════════════════════════ */

function renderView() {
  const df  = dadosFiltrados();
  const agr = agregaPorFundoAno(df);
  const main = document.getElementById('main');
  main.innerHTML = '';

  if (!df.length) {
    main.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Nenhum dado encontrado para os filtros selecionados.</div>';
    return;
  }

  switch (state.view) {
    case 'visao-geral':     renderVisaoGeral(main, df, agr); break;
    case 'aderencia':       renderAderencia(main, df, agr);  break;
    case 'democratizacao':  renderDemocratizacao(main, df, agr); break;
    case 'territorios':     renderTerritorios(main, df, agr); break;
    case 'setorial':        renderSetorial(main, df, agr);   break;
    case 'geografica':      renderGeografica(main, df);      break;
    case 'metodologia':     renderMetodologia(main);         break;
  }
}

/* ── Visão Geral ── */
function renderVisaoGeral(main, df, agr) {
  const _anos = anos(agr);
  main.innerHTML = `
    ${avisoFiltro()}
    ${renderKPIs(df, agr)}
    <div class="two-col">
      <div class="card">
        <div class="card-title">Volume Total Contratado por Ano (R$ Bilhões)</div>
        <div class="card-desc">Valor absoluto das contratações realizadas por cada fundo no período.</div>
        <div style="height:300px"><canvas id="c-vol"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Ind. 1 — Tíquete Médio (R$ mil / operação)</div>
        <div class="card-desc">Razão entre o valor total contratado e a quantidade de operações. Critério: quanto menor, melhor.</div>
        <div style="height:300px"><canvas id="c-tiquete"></canvas></div>
      </div>
    </div>`;

  // Vol por ano
  lineChart('c-vol', _anos,
    FUNDOS.map(f => ({
      label: f,
      borderColor: CORES[f],
      backgroundColor: CORES[f] + '20',
      fill: true,
      data: _anos.map(a => {
        const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a);
        return r ? +(r.VALOR_TOTAL_CONTRATADO / 1e9).toFixed(2) : null;
      }),
    })), 'Bi');

  // Tíquete
  lineChart('c-tiquete', _anos,
    FUNDOS.map(f => ({
      label: f,
      borderColor: CORES[f],
      backgroundColor: CORES[f] + '20',
      data: _anos.map(a => {
        const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a);
        return r ? +r.tiquete.toFixed(0) : null;
      }),
    })), 'R$ mil');
}

/* ── Aderência à PNDR ── */
function renderAderencia(main, df, agr) {
  const _anos = anos(agr);
  main.innerHTML = `
    ${avisoFiltro()}
    <div class="section-title">Seção 2 — Aderência à PNDR</div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Ind. 2 — Tipologia Prioritária PNDR (%)</div>
        <div class="card-desc">Razão entre o valor contratado com tipologias prioritárias da PNDR (municípios de baixa e média rendas, com todos os seus dinamismos) e o valor total contratado no exercício.</div>
        <div style="height:320px"><canvas id="c-tip"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Ranking por UF — Volume Total (R$ Bi)</div>
        <div class="card-desc">Distribuição geográfica do valor total contratado por Unidade da Federação.</div>
        <div style="height:320px"><canvas id="c-rank-uf"></canvas></div>
      </div>
    </div>`;

  lineChart('c-tip', _anos,
    FUNDOS.map(f => ({
      label: f, borderColor: CORES[f], backgroundColor: CORES[f] + '20',
      data: _anos.map(a => {
        const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a);
        return r ? +r.pct_tipologia.toFixed(2) : null;
      }),
    })));

  // Ranking UF
  const ufData = agregaPorUF(df).sort((a,b) => a.vol_bi - b.vol_bi);
  destroyChart('c-rank-uf');
  const ctx = document.getElementById('c-rank-uf').getContext('2d');
  charts['c-rank-uf'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ufData.map(u => u.UF),
      datasets: [{ label: 'Volume (R$ Bi)', data: ufData.map(u => +u.vol_bi.toFixed(2)),
        backgroundColor: '#1565c0', borderRadius: 3 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `R$ ${ctx.raw.toFixed(1)} Bi` } } },
      scales: { x: { grid: { color: '#f0f0f0' }, ticks: { callback: v => `R$ ${v} Bi` } }, y: { grid: { display: false } } },
    },
  });
}

/* ── Democratização do Crédito ── */
function renderDemocratizacao(main, df, agr) {
  const _anos = anos(agr);
  const agruFNEFNO = agr.filter(d => ['FNE','FNO'].includes(d.FUNDO_ORIGEM));

  main.innerHTML = `
    ${avisoFiltro()}
    <div class="section-title">Seção 3 — Democratização do Crédito</div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Ind. 3 — Porte Prioritário — até R$ 4,8 mi (%)</div>
        <div class="card-desc">Razão entre o valor contratado com tomadores de menor porte (até R$ 4,8 milhões de faturamento bruto anual) e o valor total contratado pelo Fundo no exercício.</div>
        <div style="height:280px"><canvas id="c-porte3"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Ind. 4 — Tomadores até R$ 16 mi (%)</div>
        <div class="card-desc">Razão entre o valor contratado com tomadores de menor porte (até R$ 16,0 milhões de faturamento bruto anual) e o valor total contratado no exercício.</div>
        <div style="height:280px"><canvas id="c-porte4"></canvas></div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Ind. 5 — Pronaf — FNE e FNO (%)</div>
        <div class="card-desc">Razão entre o valor total contratado junto ao Pronaf e o valor total contratado no exercício. Aplicável ao FNE e FNO. Meta mínima legal: 10% (Lei n. 9.126/1995).</div>
        <div style="height:280px"><canvas id="c-pronaf"></canvas></div>
      </div>
    </div>`;

  const dsLine = (campo) => FUNDOS.map(f => ({
    label: f, borderColor: CORES[f], backgroundColor: CORES[f] + '20',
    data: _anos.map(a => {
      const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a);
      return r ? +r[campo].toFixed(2) : null;
    }),
  }));

  lineChart('c-porte3', _anos, dsLine('pct_porte_prio'));
  lineChart('c-porte4', _anos, dsLine('pct_porte_16m'));

  // Pronaf — apenas FNE e FNO
  destroyChart('c-pronaf');
  const ctxP = document.getElementById('c-pronaf').getContext('2d');
  const _anosP = [...new Set(agruFNEFNO.map(d => d.ANO))].sort();
  charts['c-pronaf'] = new Chart(ctxP, {
    type: 'line',
    data: {
      labels: _anosP,
      datasets: ['FNE','FNO'].map(f => ({
        label: f, borderColor: CORES[f], backgroundColor: CORES[f] + '20',
        tension: 0.3, pointRadius: 5, borderWidth: 2.5,
        data: _anosP.map(a => {
          const r = agruFNEFNO.find(d => d.FUNDO_ORIGEM === f && d.ANO === a);
          return r ? +r.pct_pronaf.toFixed(2) : null;
        }),
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
        tooltip: { mode: 'index', intersect: false },
        annotation: {},
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => v.toFixed(1) + '%' },
          afterDataLimits: axis => { if (axis.max < 12) axis.max = 12; } },
      },
    },
  });

  // Linha de meta 10%
  const datasetsP = charts['c-pronaf'].data.datasets;
  datasetsP.push({
    label: 'Mín. 10% (Lei n. 9.126/1995)',
    data: _anosP.map(() => 10),
    borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 1.5,
    pointRadius: 0, fill: false,
  });
  charts['c-pronaf'].update();
}

/* ── Territórios Específicos ── */
function renderTerritorios(main, df, agr) {
  const _anos = anos(agr);
  const agrFNE    = agr.filter(d => d.FUNDO_ORIGEM === 'FNE');
  const agrFNOFCO = agr.filter(d => ['FNO','FCO'].includes(d.FUNDO_ORIGEM));
  const _anosFNE  = [...new Set(agrFNE.map(d => d.ANO))].sort();
  const _anosFNOFCO = [...new Set(agrFNOFCO.map(d => d.ANO))].sort();

  // Médias acumuladas
  const media = (arr, campo) => arr.reduce((s,r) => s + r[campo], 0) / (arr.length || 1);
  const totalFNE    = agrFNE.reduce((s,r) => s + r.VALOR_TOTAL_CONTRATADO, 0);
  const totalFNOFCO = agrFNOFCO.reduce((s,r) => s + r.VALOR_TOTAL_CONTRATADO, 0);
  const totalAll    = agr.reduce((s,r) => s + r.VALOR_TOTAL_CONTRATADO, 0);
  const semAcu  = agrFNE.reduce((s,r) => s + r.VALOR_SEMIARIDO, 0) / (totalFNE || 1) * 100;
  const frontAcu = agrFNOFCO.reduce((s,r) => s + r.VALOR_FRONTEIRA, 0) / (totalFNOFCO || 1) * 100;
  const interAcu = agr.reduce((s,r) => s + r.VALOR_INTERMEDIADORAS, 0) / (totalAll || 1) * 100;

  const gauge = (val, label, cor, meta) => `
    <div class="card">
      <div style="text-align:center;padding:10px 0">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#888;margin-bottom:8px">${label}</div>
        <div style="font-size:32px;font-weight:700;color:${cor}">${val.toFixed(1)}%</div>
        <div style="font-size:11px;color:#aaa;margin-top:4px">Média do período</div>
        ${meta ? `<div style="font-size:11px;color:#dc2626;margin-top:4px">Meta: ≥ ${meta}%</div>` : ''}
      </div>
      <div style="height:8px;background:#e5e7eb;border-radius:4px;margin-top:8px">
        <div style="height:8px;width:${Math.min(val,100).toFixed(1)}%;background:${cor};border-radius:4px"></div>
      </div>
      ${meta ? `<div style="position:relative"><div style="position:absolute;left:${meta}%;top:-16px;width:2px;height:24px;background:#dc2626"></div></div>` : ''}
    </div>`;

  const lineSimple = (id, _anosL, datasets) => {
    destroyChart(id);
    const ctx = document.getElementById(id).getContext('2d');
    charts[id] = new Chart(ctx, {
      type: 'line',
      data: { labels: _anosL, datasets: datasets.map(ds => ({ ...ds, tension: 0.3, pointRadius: 5, borderWidth: 2.5 })) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } }, tooltip: { mode: 'index', intersect: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: '#f0f0f0' }, ticks: { callback: v => v.toFixed(1) + '%' } } },
      },
    });
  };

  main.innerHTML = `
    ${avisoFiltro()}
    <div class="section-title">Seção 4 — Territórios Específicos</div>
    <div class="three-col">
      <div class="card">
        ${gauge(semAcu, 'Semiárido (FNE)', '#e65100', 50)}
        <div style="height:200px;margin-top:12px"><canvas id="c-semi"></canvas></div>
        <div class="ind-desc">Ind. 6 — Razão entre o valor contratado na região semiárida e o total contratado pelo FNE. Meta mínima legal: 50% (art. 13, §1º, IX).</div>
      </div>
      <div class="card">
        ${gauge(frontAcu, 'Faixa de Fronteira', '#2e7d32')}
        <div style="height:200px;margin-top:12px"><canvas id="c-front"></canvas></div>
        <div class="ind-desc">Ind. 7/8 — Razão entre o valor contratado nos municípios da Faixa de Fronteira e o valor total contratado pelo FNO (Ind. 7) e FCO (Ind. 8).</div>
      </div>
      <div class="card">
        ${gauge(interAcu, 'Cidades Intermediadoras', '#cc0000')}
        <div style="height:200px;margin-top:12px"><canvas id="c-inter"></canvas></div>
        <div class="ind-desc">Ind. 9 — Razão entre o valor contratado nos municípios do Programa Cidades Intermediadoras e o valor total contratado no exercício.</div>
      </div>
    </div>`;

  lineSimple('c-semi', _anosFNE, [
    { label: 'FNE', borderColor: '#e65100', backgroundColor: '#e6510020', data: _anosFNE.map(a => { const r = agrFNE.find(d => d.ANO === a); return r ? +r.pct_semiarido.toFixed(2) : null; }) },
    { label: 'Meta 50%', borderColor: '#dc2626', borderDash: [6,4], data: _anosFNE.map(() => 50), pointRadius: 0, fill: false },
  ]);

  lineSimple('c-front', _anosFNOFCO, ['FNO','FCO'].map(f => ({
    label: f, borderColor: CORES[f], backgroundColor: CORES[f] + '20',
    data: _anosFNOFCO.map(a => { const r = agrFNOFCO.find(d => d.FUNDO_ORIGEM === f && d.ANO === a); return r ? +r.pct_fronteira.toFixed(2) : null; }),
  })));

  lineSimple('c-inter', _anos, FUNDOS.map(f => ({
    label: f, borderColor: CORES[f], backgroundColor: CORES[f] + '20',
    data: _anos.map(a => { const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a); return r ? +r.pct_intermediad.toFixed(2) : null; }),
  })));
}

/* ── Composição Setorial ── */
function renderSetorial(main, df, agr) {
  const _anos = anos(agr);

  const dsLine = (campo, cores) => (cores || FUNDOS).map(f => ({
    label: f, borderColor: CORES[f], backgroundColor: CORES[f] + '20', tension: 0.3, pointRadius: 5, borderWidth: 2.5,
    data: _anos.map(a => { const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a); return r ? +r[campo].toFixed(2) : null; }),
  }));

  main.innerHTML = `
    ${avisoFiltro()}
    <div class="section-title">Seção 5 — Composição Setorial</div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Ind. 10/11 — Setor Rural e não Rural (%)</div>
        <div class="card-desc">Razão entre o valor total contratado no setor rural (Ind. 10) e no setor não rural (Ind. 11) e o valor total contratado no exercício. Rural e não rural somam 100%; infraestrutura é um subconjunto do não rural (Ind. 12).</div>
        <div style="height:300px"><canvas id="c-rural"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Ind. 12 — Infraestrutura (%)</div>
        <div class="card-desc">Razão entre o valor total contratado no setor de infraestrutura e o valor total contratado no exercício.</div>
        <div style="height:300px"><canvas id="c-infra"></canvas></div>
      </div>
    </div>
    <div class="section-title" style="font-size:17px;margin-top:8px">Ind. 13 — Contratações por Finalidade da Operação</div>
    <div class="section-sub">Razão entre o total contratado em cada finalidade (capital de giro, investimento, custeio e comercialização) e o total contratado pelo Fundo no exercício.</div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">13a — Capital de Giro (%)</div>
        <div style="height:260px"><canvas id="c-cg"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">13b — Investimento (%)</div>
        <div style="height:260px"><canvas id="c-inv"></canvas></div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">13c — Custeio e Comercialização (%)</div>
        <div style="height:260px"><canvas id="c-cust"></canvas></div>
      </div>
    </div>`;

  // Rural empilhado
  destroyChart('c-rural');
  const ctxR = document.getElementById('c-rural').getContext('2d');
  charts['c-rural'] = new Chart(ctxR, {
    type: 'bar',
    data: {
      labels: _anos,
      datasets: FUNDOS.flatMap(f => [
        { label: `${f} — Rural`, backgroundColor: CORES[f], stack: f,
          data: _anos.map(a => { const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a); return r ? +r.pct_rural.toFixed(2) : null; }) },
        { label: `${f} — não Rural`, backgroundColor: CORES[f] + '60', stack: f,
          data: _anos.map(a => { const r = agr.find(d => d.FUNDO_ORIGEM === f && d.ANO === a); return r ? +r.pct_nao_rural.toFixed(2) : null; }) },
      ]),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } }, tooltip: { mode: 'index', intersect: false } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, max: 100, grid: { color: '#f0f0f0' }, ticks: { callback: v => v + '%' } } },
    },
  });

  lineChart('c-infra',  _anos, dsLine('pct_infra'));
  lineChart('c-cg',     _anos, dsLine('pct_capital_giro'));
  lineChart('c-inv',    _anos, dsLine('pct_investimento'));
  lineChart('c-cust',   _anos, dsLine('pct_custeio'));
}

/* ── Análise Geográfica ── */
function renderGeografica(main, df) {
  const ufData    = agregaPorUF(df).sort((a,b) => b.pct_pndr - a.pct_pndr);
  const fundoUFData = agregaPorFundoUF(df);

  main.innerHTML = `
    ${avisoFiltro()}
    <div class="section-title">Análise Geográfica</div>
    <div class="two-col" style="align-items:start">
      <div class="card">
        <div class="card-title">Mapa de Aderência à PNDR por UF</div>
        <div id="mapa-pndr" style="height:380px;width:100%"></div>
      </div>
      <div class="card">
        <div class="card-title">Ranking de Aderência à PNDR por UF</div>
        <div class="card-desc">Percentual de contratações em tipologias prioritárias da PNDR por UF.</div>
        <div style="height:380px"><canvas id="c-rank-pndr"></canvas></div>
      </div>
    </div>
    <div class="section-title" style="font-size:17px;margin-top:8px">Ind. 14 — Contratações por UF (% sobre total do Fundo)</div>
    <div class="section-sub">Razão entre o total contratado na UF e o total contratado pelo Fundo no exercício.</div>
    <div class="three-col">
      <div class="card"><div class="card-title">FCO — % por UF</div><div id="mapa-fco" style="height:280px;width:100%"></div></div>
      <div class="card"><div class="card-title">FNE — % por UF</div><div id="mapa-fne" style="height:280px;width:100%"></div></div>
      <div class="card"><div class="card-title">FNO — % por UF</div><div id="mapa-fno" style="height:280px;width:100%"></div></div>
    </div>
    <div class="card">
      <div class="card-title">Ind. 14 — Contratações por UF (% sobre total do Fundo)</div>
      <div id="wrap-ind14"><canvas id="c-ind14"></canvas></div>
    </div>`;

  // Ranking barras horizontais
  const ufRank = [...ufData].sort((a,b) => a.pct_pndr - b.pct_pndr);
  destroyChart('c-rank-pndr');
  const ctx14 = document.getElementById('c-rank-pndr').getContext('2d');
  charts['c-rank-pndr'] = new Chart(ctx14, {
    type: 'bar',
    data: {
      labels: ufRank.map(u => u.UF),
      datasets: [{ label: '% PNDR', data: ufRank.map(u => +u.pct_pndr.toFixed(1)),
        backgroundColor: ufRank.map(u => `rgba(21,101,192,${0.3 + u.pct_pndr/140})`), borderRadius: 3 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw.toFixed(1)}%` } } },
      scales: { x: { max: 100, grid: { color: '#f0f0f0' }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false } } },
    },
  });

  // Ind. 14 agrupado
  const ufsInd14 = [...new Set(fundoUFData.map(d => d.UF))].sort();
  const wrapInd14 = document.getElementById('wrap-ind14');
  const altInd14 = Math.max(ufsInd14.length * 30 + 80, 400);
  wrapInd14.style.height = altInd14 + 'px';
  destroyChart('c-ind14');
  const ctx = document.getElementById('c-ind14').getContext('2d');
  charts['c-ind14'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ufsInd14,
      datasets: FUNDOS.map(f => ({
        label: f, backgroundColor: CORES[f],
        data: ufsInd14.map(u => {
          const r = fundoUFData.find(d => d.FUNDO_ORIGEM === f && d.UF === u);
          return r ? +r.pct_uf.toFixed(2) : 0;
        }),
      })),
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
        tooltip: { mode: 'index', intersect: false, callbacks: { label: c => `${c.dataset.label}: ${c.raw.toFixed(1)}%` } },
      },
      scales: {
        x: { grid: { color: '#f0f0f0' }, ticks: { callback: v => v + '%' }, title: { display: true, text: '% do total do fundo' } },
        y: { grid: { display: false } },
      },
    },
  });

  // Mapas Plotly
  if (MAPA_JSON && window.Plotly) {

    // Configuração geo comum para Plotly.js no browser
    const geoBase = {
      showframe: false,
      showcoastlines: false,
      showland: false,
      showocean: false,
      showlakes: false,
      showrivers: false,
      projection: { type: 'mercator' },
      fitbounds: 'locations',
      visible: false,
    };

    const layoutBase = {
      margin: { r: 0, t: 30, l: 0, b: 0 },
      paper_bgcolor: 'white',
      geo: geoBase,
    };

    function makeChoropleth(ufs, zvals, zmin, zmax, colorbar_title, hoverTpl) {
      return [{
        type: 'choropleth',
        geojson: MAPA_JSON,
        locations: ufs,
        z: zvals,
        colorscale: 'Blues',
        zmin, zmax,
        colorbar: { title: colorbar_title, ticksuffix: '%', thickness: 14, len: 0.8 },
        marker: { line: { color: 'white', width: 0.8 } },
        hovertemplate: hoverTpl,
      }];
    }

    // Mapa principal — aderência PNDR
    Plotly.newPlot('mapa-pndr',
      makeChoropleth(
        ufData.map(u => u.UF),
        ufData.map(u => +u.pct_pndr.toFixed(1)),
        0, 100, '% PNDR',
        '<b>%{location}</b><br>% PNDR: %{z:.1f}%<extra></extra>'
      ),
      { ...layoutBase, height: 380 },
      { responsive: true, displayModeBar: false }
    );

    // Mapas por fundo
    const zoomFundo = {
      FCO: {},
      FNE: {},
      FNO: {},
    };

    ['FCO','FNE','FNO'].forEach(f => {
      const fData = fundoUFData.filter(d => d.FUNDO_ORIGEM === f);
      if (!fData.length) return;
      const geo = { ...geoBase, ...zoomFundo[f] };
      Plotly.newPlot(`mapa-${f.toLowerCase()}`,
        makeChoropleth(
          fData.map(d => d.UF),
          fData.map(d => +d.pct_uf.toFixed(2)),
          0, 50, '% Fundo',
          '<b>%{location}</b><br>%{z:.1f}%<extra></extra>'
        ),
        { margin: { r: 0, t: 0, l: 0, b: 0 }, paper_bgcolor: 'white', geo, height: 280 },
        { responsive: true, displayModeBar: false }
      );
    });

  } else {
    ['mapa-pndr','mapa-fco','mapa-fne','mapa-fno'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#888;font-size:13px">Mapa indisponível.</div>';
    });
  }
  // Ind. 14 agrupado


  // Mapas Plotly
  if (MAPA_JSON && window.Plotly) {
    // Mapa principal
    const ufs   = ufData.map(u => u.UF);
    const z     = ufData.map(u => +u.pct_pndr.toFixed(1));
    Plotly.newPlot('mapa-pndr', [{
      type: 'choropleth', geojson: MAPA_JSON, locations: ufs, z,
      colorscale: 'Blues', zmin: 0, zmax: 100,
      colorbar: { title: '% PNDR', ticksuffix: '%', len: 0.8 },
      marker: { line: { color: 'white', width: 0.5 } },
      hovertemplate: '<b>%{location}</b><br>% PNDR: %{z:.1f}%<extra></extra>',
    }], {
      geo: { visible: false, projection: { type: 'mercator' }, lonaxis: { range: [-74,-32] }, lataxis: { range: [-34,6] } },
      margin: { r:0, t:0, l:0, b:0 }, paper_bgcolor: 'white',
    }, { responsive: true, displayModeBar: false });

    // Mapas por fundo
    const zoomFundo = { FCO: { lat:[-25,-6], lon:[-62,-44] }, FNE: { lat:[-19,2], lon:[-49,-32] }, FNO: { lat:[-14,5], lon:[-74,-46] } };
    ['FCO','FNE','FNO'].forEach(f => {
      const fData = fundoUFData.filter(d => d.FUNDO_ORIGEM === f);
      const z = { FCO: [0,50], FNE: [0,50], FNO: [0,50] };
      Plotly.newPlot(`mapa-${f.toLowerCase()}`, [{
        type: 'choropleth', geojson: MAPA_JSON,
        locations: fData.map(d => d.UF), z: fData.map(d => +d.pct_uf.toFixed(2)),
        colorscale: 'Blues', zmin: 0, zmax: 50,
        colorbar: { title: '% Fundo', ticksuffix: '%', len: 0.8 },
        marker: { line: { color: 'white', width: 0.5 } },
        hovertemplate: '<b>%{location}</b><br>%{z:.1f}%<extra></extra>',
      }], {
        geo: { visible: false, projection: { type: 'mercator' }, lonaxis: { range: zoomFundo[f].lon }, lataxis: { range: zoomFundo[f].lat } },
        margin: { r:0, t:0, l:0, b:0 }, paper_bgcolor: 'white',
      }, { responsive: true, displayModeBar: false });
    });
  } else {
    ['mapa-pndr','mapa-fco','mapa-fne','mapa-fno'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#888;font-size:13px">Mapa indisponível — Plotly não carregado.</div>';
    });
  }
}

/* ── Metodologia ── */
function renderMetodologia(main) {
  main.innerHTML = `
    <div class="section-title">Metodologia e Indicadores</div>
    <div class="metodologia-content">
      <h3>Contexto</h3>
      <p>Os Fundos Constitucionais de Financiamento — <strong>FNO</strong> (Norte), <strong>FNE</strong> (Nordeste) e <strong>FCO</strong> (Centro-Oeste) — são instrumentos da Política Nacional de Desenvolvimento Regional (PNDR), instituída pelo Decreto n. 11.962/2024. Os indicadores seguem o Anexo III da Portaria MIDR n. 3.646/2024.</p>

      <h3>Fonte de Dados</h3>
      <p>Bases de contratações consolidadas dos Bancos Administradores (Banco da Amazônia — BASA, Banco do Nordeste — BNB e Banco do Brasil — BB), agregadas pelo MIDR/SNIDR. Todos os percentuais são calculados sobre o valor total contratado no período, por fundo.</p>

      <div class="divider-line"></div>
      <h3>Indicadores de Contexto</h3>
      <p class="ind-item"><strong>Vol. 1 — Volume Total Contratado:</strong> Valor absoluto das contratações realizadas por cada fundo no período. Base de cálculo de todos os indicadores percentuais.</p>

      <div class="divider-line"></div>
      <h3>Indicadores do Anexo III — Portaria MIDR n. 3.646/2024</h3>
      <p class="ind-item"><strong>Ind. 1 — Tíquete Médio:</strong> Razão entre o valor total contratado no exercício e a quantidade de operações totais contratadas no exercício. Critério: <em>quanto menor, melhor</em>.</p>
      <p class="ind-item"><strong>Ind. 2 — Tipologia Prioritária PNDR:</strong> Razão entre o valor contratado com tipologias prioritárias da PNDR (municípios de baixa e média rendas, com todos os seus dinamismos) e o valor total contratado no exercício.</p>
      <p class="ind-item"><strong>Ind. 3 — Porte até R$ 4,8 mi:</strong> Razão entre o valor contratado com tomadores de menor porte (até R$ 4,8 milhões de faturamento bruto anual) e o valor total contratado pelo Fundo no exercício.</p>
      <p class="ind-item"><strong>Ind. 4 — Porte até R$ 16 mi:</strong> Razão entre o valor contratado com tomadores de menor porte (até R$ 16,0 milhões de faturamento bruto anual) e o valor total contratado no exercício.</p>
      <p class="ind-item"><strong>Ind. 5 — Pronaf — FNE e FNO:</strong> Razão entre o valor total contratado junto ao Pronaf e o valor total contratado no exercício. Meta mínima legal: <strong>10%</strong> (Lei n. 9.126/1995). Aplicável ao FNE e FNO.</p>
      <p class="ind-item"><strong>Ind. 6 — Semiárido / FNE:</strong> Razão entre o valor contratado na região semiárida e o total contratado pelo FNE. Meta mínima legal: <strong>50%</strong> (art. 13, §1º, IX).</p>
      <p class="ind-item"><strong>Ind. 7 / Ind. 8 — Faixa de Fronteira — FNO / FCO:</strong> Razão entre o valor contratado nos municípios da Faixa de Fronteira e o valor total contratado no exercício pelo FNO (Ind. 7) e pelo FCO (Ind. 8).</p>
      <p class="ind-item"><strong>Ind. 9 — Cidades Intermediadoras:</strong> Razão entre o valor contratado nos municípios do Programa Cidades Intermediadoras e o valor total contratado no exercício.</p>
      <p class="ind-item"><strong>Ind. 10 — Setor Rural:</strong> Razão entre o valor total contratado no setor rural e o valor total contratado no exercício.</p>
      <p class="ind-item"><strong>Ind. 11 — Setor não Rural:</strong> Razão entre o valor total contratado no setor não rural e o valor total contratado no exercício.</p>
      <p class="ind-item"><strong>Ind. 12 — Infraestrutura:</strong> Razão entre o valor total contratado no setor de infraestrutura e o valor total contratado no exercício.</p>
      <p class="ind-item"><strong>Ind. 13 — Finalidade da Operação:</strong> Razão entre o total contratado em cada finalidade (capital de giro, investimento, custeio e comercialização) e o total contratado pelo Fundo no exercício.</p>
      <p class="ind-item"><strong>Ind. 14 — Contratações por UF:</strong> Razão entre o total contratado na UF e o total contratado pelo Fundo no exercício.</p>

      <div class="nota">
        <strong>Critério geral:</strong> salvo indicação em contrário, todos os indicadores seguem o princípio <em>quanto maior, melhor</em>, respeitando os montantes mínimos definidos pelos Conselhos Deliberativos (Anexo III, Portaria MIDR n. 3.646/2024).<br><br>
        <strong>Indisponíveis neste painel:</strong> Índice de Aplicação (falta valor orçado); Inadimplência Total, Risco Fundo e Risco Compartilhado — dado não fornecido pelos bancos administradores na base de contratações.
      </div>
    </div>`;
}

/* ── init ── */
boot();
