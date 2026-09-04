let dadosGlobais = [];
let dadosFiltrados = [];
let selecoesMultiplas = {
  vendedor: [],
  bdr: [],
  origem: [],
  etapa: []
};
let charts = {};

const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlwzE3mH4zPuVITaiGM1GZDpcjrlto0jPtL8Kd90WCVphT8T9ITzfQNKyLh4E5L5eTew/exec";

window.onload = () => {
  carregarDados();
  
  // Fechar dropdowns ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-container')) {
      document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
    }
  });
};

async function carregarDados() {
  const btnSync = document.getElementById("btn-sync");
  if (btnSync) btnSync.innerText = "⏳ Carregando...";

  try {
    const res = await fetch(SHEETS_ENDPOINT, { redirect: 'follow' });
    dadosGlobais = await res.json();
    
    inicializarFiltrosMultiplos(dadosGlobais);
    aplicarFiltros();
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  } finally {
    if (btnSync) btnSync.innerHTML = '<span class="icon">🔄</span> Atualizar dados';
  }
}

// Inicializa os Filtros Multi-Select com Checkbox
function inicializarFiltrosMultiplos(dados) {
  const vendedores = [...new Set(dados.map(d => d.vendedor))].filter(Boolean).sort();
  const bdrs = [...new Set(dados.map(d => d.bdr))].filter(Boolean).sort();
  const origens = [...new Set(dados.map(d => d.origem))].filter(Boolean).sort();
  const etapas = [...new Set(dados.map(d => d.etapa))].filter(Boolean).sort();

  selecoesMultiplas.vendedor = [...vendedores];
  selecoesMultiplas.bdr = [...bdrs];
  selecoesMultiplas.origem = [...origens];
  selecoesMultiplas.etapa = [...etapas];

  povoarCheckboxList('options-vendedor', vendedores, 'vendedor');
  povoarCheckboxList('options-bdr', bdrs, 'bdr');
  povoarCheckboxList('options-origem', origens, 'origem');
  povoarCheckboxList('options-etapa', etapas, 'etapa');
}

function povoarCheckboxList(containerId, lista, campo) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  lista.forEach(item => {
    const label = document.createElement('label');
    label.className = 'option-checkbox';
    label.innerHTML = `
      <input type="checkbox" value="${item}" checked onchange="atualizarSelecaoMultipla('${campo}')">
      <span>${item}</span>
    `;
    container.appendChild(label);
  });
}

function toggleDropdown(id) {
  document.querySelectorAll('.custom-dropdown').forEach(d => {
    if (d.id !== id) d.classList.remove('open');
  });
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function filtrarListaOptions(input, optionsId) {
  const termo = input.value.toLowerCase();
  const itens = document.getElementById(optionsId).querySelectorAll('.option-checkbox');
  itens.forEach(item => {
    const txt = item.innerText.toLowerCase();
    item.style.display = txt.includes(termo) ? 'flex' : 'none';
  });
}

function atualizarSelecaoMultipla(campo) {
  const container = document.getElementById(`options-${campo}`);
  const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
  
  selecoesMultiplas[campo] = Array.from(checkboxes).map(cb => cb.value);
  
  const labelEl = document.getElementById(`label-${campo}`);
  const total = container.querySelectorAll('input[type="checkbox"]').length;
  const selecionados = selecoesMultiplas[campo].length;

  if (selecionados === 0) {
    labelEl.innerText = "Nenhum selecionado";
  } else if (selecionados === total) {
    labelEl.innerText = "Todos selecionados";
  } else {
    labelEl.innerText = `${selecionados} selecionados`;
  }

  aplicarFiltros();
}

function limparSelecao(campo) {
  const container = document.getElementById(`options-${campo}`);
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  atualizarSelecaoMultipla(campo);
}

function aplicarFiltros() {
  const dataOpt = document.getElementById('filter-date') ? document.getElementById('filter-date').value : 'todo_periodo';
  
  dadosFiltrados = dadosGlobais.filter(item => {
    const matchVend = selecoesMultiplas.vendedor.includes(item.vendedor);
    const matchBdr = selecoesMultiplas.bdr.includes(item.bdr);
    const matchOrig = selecoesMultiplas.origem.includes(item.origem);
    const matchEtapa = selecoesMultiplas.etapa.includes(item.etapa);
    const matchData = filtrarPorData(item.dataCriacao, dataOpt);
    
    return matchVend && matchBdr && matchOrig && matchEtapa && matchData;
  });

  atualizarKPIs(dadosFiltrados);
  renderizarGraficoEvolucaoMensal(dadosFiltrados);
  renderizarGraficosRegraNegocio(dadosFiltrados);
  povoarTabelaGeral(dadosFiltrados);
}

function filtrarPorData(dataIso, filtro) {
  if (filtro === 'todo_periodo' || !dataIso) return true;
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return true;

  const hoje = new Date();
  
  if (filtro === 'hoje') {
    return d.toDateString() === hoje.toDateString();
  }
  if (filtro === 'esta_semana') {
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    return d >= inicioSemana;
  }
  if (filtro === 'este_mes') {
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }
  if (filtro === 'mes_passado') {
    const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return d.getMonth() === mesPassado.getMonth() && d.getFullYear() === mesPassado.getFullYear();
  }
  if (filtro === 'este_ano') {
    return d.getFullYear() === hoje.getFullYear();
  }
  if (filtro === 'ano_passado') {
    return d.getFullYear() === (hoje.getFullYear() - 1);
  }
  return true;
}

function atualizarKPIs(dados) {
  document.getElementById("kpi-criados").innerText = dados.length;
  document.getElementById("kpi-ganhos").innerText = dados.filter(d => d.status === "Ganho").length;
  document.getElementById("kpi-perdidos").innerText = dados.filter(d => d.status === "Perdido").length;
  document.getElementById("kpi-aberto").innerText = dados.filter(d => d.status === "Aberto").length;
}

// GRÁFICO DE LINHAS: EVOLUÇÃO MÊS A MÊS
function renderizarGraficoEvolucaoMensal(dados) {
  const canvas = document.getElementById("chartEvolucao");
  if (!canvas) return;

  // Agrupar dados por YYYY-MM
  const mesesSet = new Set();
  const criadosMes = {};
  const ganhosMes = {};
  const perdidosMes = {};

  dados.forEach(d => {
    if (!d.dataCriacao) return;
    const dt = new Date(d.dataCriacao);
    if (isNaN(dt.getTime())) return;

    const anoMes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    mesesSet.add(anoMes);

    criadosMes[anoMes] = (criadosMes[anoMes] || 0) + 1;
    if (d.status === 'Ganho') ganhosMes[anoMes] = (ganhosMes[anoMes] || 0) + 1;
    if (d.status === 'Perdido') perdidosMes[anoMes] = (perdidosMes[anoMes] || 0) + 1;
  });

  const mesesOrdenados = Array.from(mesesSet).sort();
  
  // Formatador para exibição (Ex: "12/2024")
  const labelsExibicao = mesesOrdenados.map(m => {
    const [ano, mes] = m.split('-');
    return `${mes}/${ano}`;
  });

  const arrCriados = mesesOrdenados.map(m => criadosMes[m] || 0);
  const arrGanhos = mesesOrdenados.map(m => ganhosMes[m] || 0);
  const arrPerdidos = mesesOrdenados.map(m => perdidosMes[m] || 0);

  const ctx = canvas.getContext('2d');
  if (charts["chartEvolucao"]) charts["chartEvolucao"].destroy();

  charts["chartEvolucao"] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsExibicao,
      datasets: [
        {
          label: 'Criados',
          data: arrCriados,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Ganhos',
          data: arrGanhos,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3
        },
        {
          label: 'Perdidos',
          data: arrPerdidos,
          borderColor: '#f43f5e',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#f8fafc' } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
      }
    }
  });
}

// Rankings por Barras
function renderizarGraficosRegraNegocio(dados) {
  const dadosGanhos = dados.filter(d => d.status === 'Ganho');
  gerarChartBar('chartVendedor', agruparEOrdenar(dadosGanhos, 'vendedor'), 'Ganhos por Vendedor', '#10b981');

  gerarChartBar('chartBDR', agruparEOrdenar(dados, 'bdr'), 'Criados por BDR', '#38bdf8');

  gerarChartBar('chartOrigem', agruparEOrdenar(dados, 'origem'), 'Criados por Origem', '#f59e0b');

  const dadosPerdidos = dados.filter(d => d.status === 'Perdido');
  gerarChartBar('chartPerdidos', agruparEOrdenar(dadosPerdidos, 'motivoPerda'), 'Perdidos por Motivo', '#f43f5e');
}

function agruparEOrdenar(dados, chave) {
  const counts = {};
  dados.forEach(d => {
    let val = d[chave] || 'Não informado';
    if (val === '-' || val === '') val = 'Não Informado';
    counts[val] = (counts[val] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
}

function gerarChartBar(canvasId, agrupaObj, label, corHex) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(agrupaObj);
  const data = Object.values(agrupaObj);

  if (charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: corHex || '#38bdf8',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
      }
    }
  });
}

// Tabela Geral de Detalhamento
function povoarTabelaGeral(dados) {
  const tbody = document.getElementById("table-geral").querySelector("tbody");
  tbody.innerHTML = "";
  
  dados.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta}</td>
      <td>${row.vendedor}</td>
      <td>${row.origem}</td>
      <td>${row.bdr}</td>
      <td>${row.etapa}</td>
      <td>${row.status}</td>
      <td>${row.motivoPerda}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarTabelaGeral(termo) {
  const txt = termo.toLowerCase();
  const filtrados = dadosFiltrados.filter(d => {
    return (
      d.conta.toLowerCase().includes(txt) ||
      d.vendedor.toLowerCase().includes(txt) ||
      d.bdr.toLowerCase().includes(txt) ||
      d.origem.toLowerCase().includes(txt) ||
      d.etapa.toLowerCase().includes(txt) ||
      d.status.toLowerCase().includes(txt) ||
      d.motivoPerda.toLowerCase().includes(txt)
    );
  });
  povoarTabelaGeral(filtrados);
}

// MODAL / POPUP KPIS CLICÁVEIS (REVISADO)
function abrirModalDetalhes(status) {
  const modal = document.getElementById("modal-detalhes");
  if (!modal) return;
  
  document.getElementById("modal-titulo").innerText = `Detalhamento de Registros: ${status}`;
  
  let listaModal = dadosFiltrados;
  if (status !== 'Criados') {
    listaModal = dadosFiltrados.filter(d => d.status === status);
  }
  
  const tbodyModal = document.getElementById("tbody-modal");
  tbodyModal.innerHTML = "";
  
  listaModal.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta}</td>
      <td>${row.vendedor}</td>
      <td>${row.origem}</td>
      <td>${row.bdr}</td>
      <td>${row.etapa}</td>
      <td>${row.status}</td>
      <td>${row.motivoPerda}</td>
    `;
    tbodyModal.appendChild(tr);
  });
  
  modal.style.display = "flex";
}

function fecharModal() {
  const modal = document.getElementById("modal-detalhes");
  if (modal) modal.style.display = "none";
}

// Ordenação de Colunas
function ordenarTabela(tableId, colIndex) {
  const table = document.getElementById(tableId);
  let rows, switching = true, i, x, y, shouldSwitch, dir = "asc", switchcount = 0;
  
  while (switching) {
    switching = false;
    rows = table.rows;
    for (i = 1; i < (rows.length - 1); i++) {
      shouldSwitch = false;
      x = rows[i].getElementsByTagName("TD")[colIndex];
      y = rows[i + 1].getElementsByTagName("TD")[colIndex];
      
      if (!x || !y) continue;

      let xVal = x.innerText.toLowerCase();
      let yVal = y.innerText.toLowerCase();

      if (dir === "asc") {
        if (xVal > yVal) { shouldSwitch = true; break; }
      } else if (dir === "desc") {
        if (xVal < yVal) { shouldSwitch = true; break; }
      }
    }
    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchcount++;
    } else {
      if (switchcount === 0 && dir === "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
}

// Exportar CSV
function exportarCSV() {
  let csv = "Conta,Vendedor,Origem,BDR,Etapa,Status,Motivo Perda\n";
  dadosFiltrados.forEach(row => {
    csv += `"${row.conta}","${row.vendedor}","${row.origem}","${row.bdr}","${row.etapa}","${row.status}","${row.motivoPerda}"\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio_bi_puca_crm.csv";
  a.click();
}
