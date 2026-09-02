const ARQUIVOS = [
  'data/base/sao_paulo.xlsx',
  'data/base/goias.xlsx',
  'data/base/santos.xlsx',
  'data/base/rio_de_janeiro.xlsx',
];

let dadosGlobais = [];
let modoRanking = 'tarefas';
let chartBarras = null;
let chartRosca = null;

// Cada filtro guarda seu próprio valor ativo; "campo" é a coluna correspondente na planilha.
const FILTROS = [
  { campo: 'Unidade',      id: 'sel-unidade',     padrao: 'Todas', ativo: 'Todas' },
  { campo: 'Departamento', id: 'sel-depto',       padrao: 'Todos', ativo: 'Todos' },
  { campo: 'Coordenador',  id: 'sel-coordenador', padrao: 'Todos', ativo: 'Todos' },
  { campo: 'Titulo',       id: 'sel-tarefa',      padrao: 'Todas', ativo: 'Todas' },
  { campo: 'Semana',       id: 'sel-semana',      padrao: 'Todas', ativo: 'Todas' },
];

function formatarNumero(n) {
  return n.toLocaleString('pt-BR');
}

function ehAtraso(status) {
  return String(status).toLowerCase().includes('atraso');
}

function ehPrazo(status) {
  const s = String(status).toLowerCase();
  return s.includes('prazo') && !s.includes('atraso');
}

function ehAntecipada(status) {
  return String(status).toLowerCase().includes('antecipa');
}

// Verifica se a linha passa em todos os filtros ativos, exceto o indicado em `campoIgnorado`
// (usado para calcular quais opções ainda fazem sentido oferecer em cada select).
function passaFiltros(d, campoIgnorado) {
  return FILTROS.every(f => {
    if (f.campo === campoIgnorado || f.ativo === f.padrao) return true;
    return String(d[f.campo] || '').trim() === f.ativo;
  });
}

function dadosFiltrados() {
  return dadosGlobais.filter(d => passaFiltros(d, null));
}

function atualizarCards() {
  const dados      = dadosFiltrados();
  const total      = dados.length;
  const prazo      = dados.filter(d => ehPrazo(d['Status'])).length;
  const atraso     = dados.filter(d => ehAtraso(d['Status'])).length;
  const antecipada = dados.filter(d => ehAntecipada(d['Status'])).length;

  document.getElementById('card-total').textContent      = formatarNumero(total);
  document.getElementById('card-prazo').textContent      = formatarNumero(prazo);
  document.getElementById('card-atraso').textContent     = formatarNumero(atraso);
  document.getElementById('card-antecipada').textContent = formatarNumero(antecipada);

  const pct = (n) => total ? `${Math.round((n / total) * 100)}% do total` : '';
  document.getElementById('pct-prazo').textContent      = pct(prazo);
  document.getElementById('pct-atraso').textContent     = pct(atraso);
  document.getElementById('pct-antecipada').textContent = pct(antecipada);
}

// Cores dos status por força (mais forte -> mais fraco) e seus tons de hover.
const CORES_POR_FORCA = ['#991B1B', '#DC2626', '#F87171'];
const HOVER_POR_COR = { '#991B1B': '#7F1717', '#DC2626': '#B91C1C', '#F87171': '#EF4444' };

// Atribui a cor mais forte ao status com mais ocorrências e a mais fraca ao
// com menos, recalculado a cada atualização (pode mudar conforme os filtros).
function coresPorQuantidade(dados) {
  const prazo      = dados.filter(d => ehPrazo(d['Status'])).length;
  const atraso     = dados.filter(d => ehAtraso(d['Status'])).length;
  const antecipada = dados.filter(d => ehAntecipada(d['Status'])).length;

  const ranking = [
    { chave: 'prazo',      valor: prazo },
    { chave: 'atraso',     valor: atraso },
    { chave: 'antecipada', valor: antecipada },
  ].sort((a, b) => b.valor - a.valor);

  const mapa = {};
  ranking.forEach((item, i) => { mapa[item.chave] = CORES_POR_FORCA[i]; });
  return mapa;
}

function atualizarGraficoBarras() {
  const dados = dadosFiltrados();
  const cores = coresPorQuantidade(dados);

  const classMap = {};
  dados.forEach(d => {
    const cl = String(d['Classificacao'] || 'Sem classificação').trim();
    if (!classMap[cl]) classMap[cl] = { prazo: 0, atraso: 0, antecipada: 0 };
    if (ehAtraso(d['Status']))         classMap[cl].atraso++;
    else if (ehPrazo(d['Status']))     classMap[cl].prazo++;
    else if (ehAntecipada(d['Status'])) classMap[cl].antecipada++;
  });

  const labels       = Object.keys(classMap);
  const prazoD       = labels.map(l => classMap[l].prazo);
  const atrasoD      = labels.map(l => classMap[l].atraso);
  const antecipadaD  = labels.map(l => classMap[l].antecipada);

  if (chartBarras) chartBarras.destroy();

  const ctx = document.getElementById('grafico-barras').getContext('2d');
  chartBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'No Prazo',
          data: prazoD,
          backgroundColor: cores.prazo,
          borderRadius: { topLeft: 4, topRight: 4 },
          stack: 'stack',
        },
        {
          label: 'Em Atraso',
          data: atrasoD,
          backgroundColor: cores.atraso,
          borderRadius: { topLeft: 4, topRight: 4 },
          stack: 'stack',
        },
        {
          label: 'Antecipada',
          data: antecipadaD,
          backgroundColor: cores.antecipada,
          borderRadius: { topLeft: 4, topRight: 4 },
          stack: 'stack',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12, family: "'Inter', sans-serif" }, color: '#6B7280', usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          callbacks: {
            footer(items) {
              const idx   = items[0].dataIndex;
              const total = prazoD[idx] + atrasoD[idx] + antecipadaD[idx];
              return `Total: ${formatarNumero(total)}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#6B7280', font: { size: 12, family: "'Inter', sans-serif" } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: '#6B7280' },
          grid: { color: '#EEF0F3' }
        }
      }
    }
  });
}

function atualizarGraficoRosca() {
  const dados      = dadosFiltrados();
  const prazo      = dados.filter(d => ehPrazo(d['Status'])).length;
  const atraso     = dados.filter(d => ehAtraso(d['Status'])).length;
  const antecipada = dados.filter(d => ehAntecipada(d['Status'])).length;
  const total      = prazo + atraso + antecipada;
  const cores      = coresPorQuantidade(dados);

  if (chartRosca) chartRosca.destroy();

  const ctx = document.getElementById('grafico-rosca').getContext('2d');
  chartRosca = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['No Prazo', 'Em Atraso', 'Antecipada'],
      datasets: [{
        data: [prazo, atraso, antecipada],
        backgroundColor: [cores.prazo, cores.atraso, cores.antecipada],
        hoverBackgroundColor: [HOVER_POR_COR[cores.prazo], HOVER_POR_COR[cores.atraso], HOVER_POR_COR[cores.antecipada]],
        borderWidth: 2,
        borderColor: '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 12, family: "'Inter', sans-serif" }, color: '#6B7280', padding: 16, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          callbacks: {
            label(item) {
              const pct = total ? Math.round((item.raw / total) * 100) : 0;
              return ` ${formatarNumero(item.raw)} tarefas (${pct}%)`;
            }
          }
        }
      }
    },
    plugins: [{
      id: 'centroTexto',
      afterDraw(chart) {
        const { ctx: c, chartArea: { left, right, top, bottom } } = chart;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        c.save();
        c.font = '800 24px Inter, Segoe UI';
        c.fillStyle = '#1F2328';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(formatarNumero(total), cx, cy - 10);
        c.font = '600 12px Inter, Segoe UI';
        c.fillStyle = '#9AA1AC';
        c.fillText('tarefas', cx, cy + 12);
        c.restore();
      }
    }]
  });
}

function atualizarRanking() {
  const dados  = dadosFiltrados();
  const campo  = modoRanking === 'tarefas' ? 'Titulo' : 'UsuarioBaixa';
  const lista  = document.getElementById('ranking-lista');
  lista.innerHTML = '';

  const contagem = {};
  dados.forEach(d => {
    const val = String(d[campo] || '').trim();
    if (val) contagem[val] = (contagem[val] || 0) + 1;
  });

  const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  if (!ordenado.length) {
    lista.innerHTML = '<p style="color:#999;font-size:0.85rem;padding:12px 0;">Nenhum dado disponível.</p>';
    return;
  }

  const max = ordenado[0][1];
  ordenado.forEach(([nome, qtd], i) => {
    const pct  = Math.round((qtd / max) * 100);
    const item = document.createElement('div');
    item.className = 'ranking-item';
    item.innerHTML = `
      <span class="ranking-pos">${i + 1}º</span>
      <span class="ranking-nome" title="${nome}">${nome}</span>
      <div class="ranking-barra-wrap">
        <div class="ranking-barra" style="width:${pct}%"></div>
      </div>
      <span class="ranking-qtd">${formatarNumero(qtd)}</span>
    `;
    lista.appendChild(item);
  });
}

function alternarRanking(modo) {
  modoRanking = modo;
  document.getElementById('btn-tarefas').classList.toggle('active', modo === 'tarefas');
  document.getElementById('btn-colaboradores').classList.toggle('active', modo === 'colaboradores');
  atualizarRanking();
}

function popularSelect(idSelect, valores, valorAtivo, rotuloPadrao) {
  const sel = document.getElementById(idSelect);
  sel.innerHTML = '';
  [rotuloPadrao, ...valores].forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (v === valorAtivo) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderizarFiltros() {
  FILTROS.forEach(f => {
    // Opções calculadas a partir dos dados já filtrados pelos DEMAIS selects (filtro cruzado).
    const disponiveis = dadosGlobais.filter(d => passaFiltros(d, f.campo));
    let valores = [...new Set(disponiveis.map(d => String(d[f.campo] || '').trim()).filter(Boolean))];
    valores = f.campo === 'Semana'
      ? valores.sort((a, b) => Number(a) - Number(b))
      : valores.sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // Se a seleção atual deixou de existir nesse subconjunto, volta para o padrão.
    if (f.ativo !== f.padrao && !valores.includes(f.ativo)) {
      f.ativo = f.padrao;
    }

    popularSelect(f.id, valores, f.ativo, f.padrao);
    document.getElementById(f.id).onchange = e => {
      f.ativo = e.target.value;
      renderizarFiltros(); // recalcula as opções dos demais selects
      atualizarTudo();
    };
  });
}

function atualizarTudo() {
  atualizarCards();
  atualizarGraficoBarras();
  atualizarGraficoRosca();
  atualizarRanking();
}

document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
  FILTROS.forEach(f => { f.ativo = f.padrao; });
  renderizarFiltros();
  atualizarTudo();
});

const ABA_DADOS = 'Pendencias';

function lerPlanilha(planilha) {
  const linhas = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: '' });
  console.log(`Total de linhas brutas lidas: ${linhas.length}`);

  let idxHeader = 0;
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    if (linhas[i].some(c => String(c).trim().toLowerCase() === 'departamento')) {
      idxHeader = i;
      console.log(`Cabeçalho encontrado na linha ${i}`);
      break;
    }
  }

  const cabecalhos = linhas[idxHeader].map(h => String(h).trim());

  // Filtra apenas linhas que possuem ao menos um campo identificador preenchido
  const dados = linhas.slice(idxHeader + 1)
    .filter(row => {
      const cod  = String(row[0] ?? '').trim();
      const nome = String(row[1] ?? '').trim();
      return cod !== '' || nome !== '';
    })
    .map(row => {
      const obj = {};
      cabecalhos.forEach((h, i) => { obj[h] = row[i] ?? ''; });
      return obj;
    });

  console.log(`Registros carregados após parse: ${dados.length}`);
  return dados;
}

async function carregarUmaBase(arquivo) {
  const resp = await fetch(arquivo);
  if (!resp.ok) throw new Error(`${arquivo} não encontrado (${resp.status})`);

  const buffer   = await resp.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const planilha = workbook.Sheets[ABA_DADOS];
  if (!planilha) throw new Error(`${arquivo}: aba "${ABA_DADOS}" não encontrada (abas: ${workbook.SheetNames.join(', ')})`);
  return lerPlanilha(planilha);
}

// Lê data/base_info.json (gravado pelo pipeline toda vez que as bases são
// regeradas) para mostrar quando os dados foram atualizados de fato.
async function carregarDataAtualizacao() {
  try {
    const resp = await fetch('data/base_info.json');
    if (!resp.ok) throw new Error('base_info.json não encontrado');
    const info = await resp.json();
    document.getElementById('header-atualizacao').textContent = `Base atualizada em ${info.atualizado_em}`;
  } catch (e) {
    document.getElementById('header-atualizacao').textContent = '';
  }
}

async function carregarDados() {
  try {
    const resultados = await Promise.allSettled(ARQUIVOS.map(carregarUmaBase));

    const falhas = [];
    dadosGlobais = [];
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        dadosGlobais = dadosGlobais.concat(r.value);
      } else {
        falhas.push(`${ARQUIVOS[i]}: ${r.reason.message}`);
        console.error(r.reason);
      }
    });

    if (!dadosGlobais.length) throw new Error(falhas.join(' | ') || 'Nenhum dado carregado.');

    document.getElementById('loading').style.display   = 'none';
    document.getElementById('dashboard').style.display = 'block';

    renderizarFiltros();
    atualizarTudo();

    if (falhas.length) {
      console.warn(`Base(s) não carregada(s):\n${falhas.join('\n')}`);
    }
  } catch (e) {
    document.getElementById('loading').innerHTML =
      `<span style="color:#C00000;font-weight:600;">Erro ao carregar dados: ${e.message}</span>`;
  }
}

carregarDataAtualizacao();
carregarDados();
