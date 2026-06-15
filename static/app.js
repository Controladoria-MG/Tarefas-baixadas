const ARQUIVO = 'data/base/Tarefas baixadas na semanas.xlsx';

let dadosGlobais = [];
let departamentoAtivo = 'Todos';
let semanaAtiva = 'Todas';
let modoRanking = 'tarefas';
let chartBarras = null;
let chartRosca = null;

function ehAtraso(status) {
  return String(status).toLowerCase().includes('atraso');
}

function ehPrazo(status) {
  const s = String(status).toLowerCase();
  return s.includes('prazo') || (s.includes('baixad') && !s.includes('atraso'));
}

function dadosFiltrados() {
  return dadosGlobais.filter(d => {
    const depto   = departamentoAtivo === 'Todos' || String(d['Departamento'] || '').trim() === departamentoAtivo;
    const semana  = semanaAtiva === 'Todas'       || String(d['Semana']       || '').trim() === semanaAtiva;
    return depto && semana;
  });
}

function atualizarCards() {
  const dados = dadosFiltrados();
  const total  = dados.length;
  const prazo  = dados.filter(d => ehPrazo(d['Status'])).length;
  const atraso = dados.filter(d => ehAtraso(d['Status'])).length;

  document.getElementById('card-total').textContent  = total;
  document.getElementById('card-prazo').textContent  = prazo;
  document.getElementById('card-atraso').textContent = atraso;

  document.getElementById('pct-prazo').textContent  = total ? `${Math.round((prazo  / total) * 100)}% do total` : '';
  document.getElementById('pct-atraso').textContent = total ? `${Math.round((atraso / total) * 100)}% do total` : '';
}

function atualizarGraficoBarras() {
  const dados = dadosFiltrados();

  const classMap = {};
  dados.forEach(d => {
    const cl = String(d['Classificacao'] || 'Sem classificação').trim();
    if (!classMap[cl]) classMap[cl] = { prazo: 0, atraso: 0 };
    if (ehAtraso(d['Status']))     classMap[cl].atraso++;
    else if (ehPrazo(d['Status'])) classMap[cl].prazo++;
  });

  const labels   = Object.keys(classMap);
  const prazoD   = labels.map(l => classMap[l].prazo);
  const atrasoD  = labels.map(l => classMap[l].atraso);

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
          backgroundColor: '#8B0000',
          borderRadius: { topLeft: 4, topRight: 4 },
          stack: 'stack',
        },
        {
          label: 'Em Atraso',
          data: atrasoD,
          backgroundColor: '#C00000',
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
          labels: { font: { size: 12 }, color: '#000' }
        },
        tooltip: {
          callbacks: {
            footer(items) {
              const idx = items[0].dataIndex;
              const total = prazoD[idx] + atrasoD[idx];
              return `Total: ${total}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#000', font: { size: 12 } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: '#000', stepSize: 1 },
          grid: { color: '#f0e8e8' }
        }
      }
    }
  });
}

function atualizarGraficoRosca() {
  const dados = dadosFiltrados();
  const prazo  = dados.filter(d => ehPrazo(d['Status'])).length;
  const atraso = dados.filter(d => ehAtraso(d['Status'])).length;

  if (chartRosca) chartRosca.destroy();

  const ctx = document.getElementById('grafico-rosca').getContext('2d');
  chartRosca = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['No Prazo', 'Em Atraso'],
      datasets: [{
        data: [prazo, atraso],
        backgroundColor: ['#8B0000', '#C00000'],
        hoverBackgroundColor: ['#6B0000', '#A00000'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 12 }, color: '#000', padding: 16 }
        },
        tooltip: {
          callbacks: {
            label(item) {
              const total = prazo + atraso;
              const pct   = total ? Math.round((item.raw / total) * 100) : 0;
              return ` ${item.raw} tarefas (${pct}%)`;
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
        const total = prazo + atraso;
        c.save();
        c.font = 'bold 24px Segoe UI';
        c.fillStyle = '#000';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(total, cx, cy - 10);
        c.font = '12px Segoe UI';
        c.fillStyle = '#888';
        c.fillText('tarefas', cx, cy + 12);
        c.restore();
      }
    }]
  });
}

function atualizarRanking() {
  const dados  = dadosFiltrados();
  const campo  = modoRanking === 'tarefas' ? 'Titulo' : 'UsuarioResponsavel';
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
      <span class="ranking-qtd">${qtd}</span>
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
  const deptos  = [...new Set(dadosGlobais.map(d => String(d['Departamento'] || '').trim()).filter(Boolean))].sort();
  const semanas = [...new Set(dadosGlobais.map(d => String(d['Semana']       || '').trim()).filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b));

  popularSelect('sel-depto',  deptos,  departamentoAtivo, 'Todos');
  popularSelect('sel-semana', semanas, semanaAtiva,       'Todas');

  document.getElementById('sel-depto').onchange = e => {
    departamentoAtivo = e.target.value;
    atualizarTudo();
  };
  document.getElementById('sel-semana').onchange = e => {
    semanaAtiva = e.target.value;
    atualizarTudo();
  };
}

function atualizarTudo() {
  atualizarCards();
  atualizarGraficoBarras();
  atualizarGraficoRosca();
  atualizarRanking();
}

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

async function carregarDados() {
  try {
    const resp = await fetch(ARQUIVO);
    if (!resp.ok) throw new Error(`Arquivo não encontrado (${resp.status})`);

    const buffer   = await resp.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const planilha = workbook.Sheets[ABA_DADOS];
    if (!planilha) throw new Error(`Aba "${ABA_DADOS}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`);
    dadosGlobais   = lerPlanilha(planilha);

    document.getElementById('loading').style.display   = 'none';
    document.getElementById('dashboard').style.display = 'block';

    renderizarFiltros();
    atualizarTudo();
  } catch (e) {
    document.getElementById('loading').innerHTML =
      `<span style="color:#C00000;font-weight:600;">Erro ao carregar dados: ${e.message}</span>`;
  }
}

carregarDados();
