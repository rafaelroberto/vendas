let dadosGlobais = [];
let dadosFiltrados = [];
let selecoesMultiplas = {
  vendedor: [],
  bdr: [],
  origem: [],
  etapa: []
};
let charts = {};
let direcaoOrdenacao = {}; // Guarda o estado da ordenação por coluna

const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlwzE3mH4zPuVITaiGM1GZDpcjrlto0jPtL8Kd90WCVphT8T9ITzfQNKyLh4E5L5eTew/exec";

window.onload = () => {
  carregarDados();
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-container')) {
      document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
    }
  });
};

// FORMATAR DATA EM BRASIL (DD/MM/AAAA HH:mm) DE FORMA ULTRA ROBUSTA
function formatarDataBR(valor) {
  if (!valor || valor === '-' || valor === 'undefined' || valor === 'null') return '-';

  let d = new Date(valor);

  // Se não for ISO pura, tenta parsing de texto PT-BR ou Data do Google
  if (isNaN(d.getTime())) {
    const cleanStr = String(valor).trim();
    // Verifica formato AAAA-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
      d = new Date(cleanStr.replace(' ', 'T'));
    } 
    // Verifica formato DD/MM/AAAA
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(cleanStr)) {
      const parts = cleanStr.split(' ');
      const dateParts = parts[0].split('/');
      const timeStr = parts[1] || '00:00:00';
      d = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timeStr}`);
    }
  }

  if (isNaN(d.getTime())) return String(valor);

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

async function carregarDados() {
  exibirLoadingOverlay();

  let progresso = 0;
  const interval = setInterval(() => {
    if (progresso < 90) {
      progresso += Math.floor(Math.random() * 15) + 5;
      if (progresso > 90) progresso = 90;
      atualizarProgressoLoading(progresso);
    }
  }, 100);

  try {
    const res = await fetch(SHEETS_ENDPOINT, { redirect: 'follow' });
    dadosGlobais = await res.json();
    
    clearInterval(interval);
    atualizarProgressoLoading(100);

    setTimeout(() => {
      inicializarFiltrosMultiplos(dadosGlobais);
      aplicarFiltros();
      esconderLoadingOverlay();
    }, 200);

  } catch (err) {
    clearInterval(interval);
    console.error("Erro ao carregar dados:", err);
    alert("Erro ao conectar com o Google Sheets. Tente atualizar novamente.");
    esconderLoadingOverlay();
  }
}

function exibirLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.remove("hidden");
  atualizarProgressoLoading(0);
}

function esconderLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.add("hidden");
}

function atualizarProgressoLoading(percent) {
  const bar = document.getElementById("progress-bar");
  const txt = document.getElementById("loading-percent");
  if (bar) bar.style.width = `${percent}%`;
  if (txt) txt.innerText = `${percent}%`;
}

// FILTROS MULTI-SELECT
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

  resetarLabelsSelect();
}

function resetarLabelsSelect() {
  ['vendedor', 'bdr', 'origem', 'etapa'].forEach(c => {
    const labelEl = document.getElementById(`label-${c}`);
    if (labelEl) labelEl.innerText = "Todos selecionados";
  });
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

function limparSelecaoIndividual(campo) {
  const container = document.getElementById(`options-${campo}`);
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  atualizarSelecaoMultipla(campo);
}

function resetarTodosFiltros() {
  document.getElementById('filter-date').value = 'todo_periodo';

  ['vendedor', 'bdr', 'origem', 'etapa'].forEach(campo => {
    const container = document.getElementById(`options-${campo}`);
    if (container) {
      container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    }
  });

  inicializarFiltrosMultiplos(dadosGlobais);
  aplicarFiltros();
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
  povoarTabelaFoco(dadosFiltrados);
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
  document.getElementById("kpi-ganhos").innerText = dados.filter(d => String(d.status).toLowerCase() === "ganho").length;
  document.getElementById("kpi-perdidos").innerText = dados.filter(d => String(d.status).toLowerCase() === "perdido").length;
  document.getElementById("kpi-aberto").innerText = dados.filter(d => String(d.status).toLowerCase() === "aberto").length;
}

// GRÁFICO DE LINHAS: EVOLUÇÃO MÊS A MÊS
function renderizarGraficoEvolucaoMensal(dados) {
  const canvas = document.getElementById("chartEvolucao");
  if (!canvas) return;

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
    if (String(d.status).toLowerCase() === 'ganho') ganhosMes[anoMes] = (ganhosMes[anoMes] || 0) + 1;
    if (String(d.status).toLowerCase() === 'perdido') perdidosMes[anoMes] = (perdidosMes[anoMes] || 0) + 1;
  });

  const mesesOrdenados = Array.from(mesesSet).sort();
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
      plugins: { legend: { labels: { color: '#f8fafc' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
      }
    }
  });
}

// Rankings por Barras
function renderizarGraficosRegraNegocio(dados) {
  const dadosGanhos = dados.filter(d => String(d.status).toLowerCase() === 'ganho');
  gerarChartBar('chartVendedor', agruparEOrdenar(dadosGanhos, 'vendedor'), 'Ganhos por Vendedor', '#10b981');

  gerarChartBar('chartBDR', agruparEOrdenar(dados, 'bdr'), 'Criados por BDR', '#38bdf8');

  gerarChartBar('chartOrigem', agruparEOrdenar(dados, 'origem'), 'Criados por Origem', '#f59e0b');

  const dadosPerdidos = dados.filter(d => String(d.status).toLowerCase() === 'perdido');
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

// TABELA NOVE: OPORTUNIDADES EM FOCO (Assinatura, Proposta e Negociação)
function povoarTabelaFoco(dados) {
  const tbody = document.getElementById("table-foco").querySelector("tbody");
  tbody.innerHTML = "";
  
  const etapasFoco = ['assinatura', 'proposta', 'negociação', 'negociacao'];
  const dadosFoco = dados.filter(d => etapasFoco.includes(String(d.etapa).toLowerCase()));

  if (dadosFoco.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" style="text-align:center; padding: 20px; color: var(--text-muted);">Nenhuma conta encontrada nessas etapas ativas.</td>`;
    tbody.appendChild(tr);
    return;
  }

  dadosFoco.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta || '-'}</td>
      <td>${row.vendedor || '-'}</td>
      <td>${row.origem || '-'}</td>
      <td>${row.bdr || '-'}</td>
      <td><strong>${row.etapa || '-'}</strong></td>
      <td>${row.status || '-'}</td>
      <td>${formatarDataBR(row.dataCriacao)}</td>
      <td>${formatarDataBR(row.dataEntradaEtapa)}</td>
      <td>${row.motivoPerda || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarTabelaFoco(termo) {
  const txt = termo.toLowerCase();
  const etapasFoco = ['assinatura', 'proposta', 'negociação', 'negociacao'];
  const dadosFoco = dadosFiltrados.filter(d => etapasFoco.includes(String(d.etapa).toLowerCase()));
  
  const filtrados = dadosFoco.filter(d => {
    return (
      (d.conta && d.conta.toLowerCase().includes(txt)) ||
      (d.vendedor && d.vendedor.toLowerCase().includes(txt)) ||
      (d.bdr && d.bdr.toLowerCase().includes(txt)) ||
      (d.origem && d.origem.toLowerCase().includes(txt)) ||
      (d.etapa && d.etapa.toLowerCase().includes(txt))
    );
  });
  
  const tbody = document.getElementById("table-foco").querySelector("tbody");
  tbody.innerHTML = "";

  filtrados.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta || '-'}</td>
      <td>${row.vendedor || '-'}</td>
      <td>${row.origem || '-'}</td>
      <td>${row.bdr || '-'}</td>
      <td><strong>${row.etapa || '-'}</strong></td>
      <td>${row.status || '-'}</td>
      <td>${formatarDataBR(row.dataCriacao)}</td>
      <td>${formatarDataBR(row.dataEntradaEtapa)}</td>
      <td>${row.motivoPerda || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// TABELA GERAL DE DETALHAMENTO
function povoarTabelaGeral(dados) {
  const tbody = document.getElementById("table-geral").querySelector("tbody");
  tbody.innerHTML = "";
  
  dados.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta || '-'}</td>
      <td>${row.vendedor || '-'}</td>
      <td>${row.origem || '-'}</td>
      <td>${row.bdr || '-'}</td>
      <td>${row.etapa || '-'}</td>
      <td>${row.status || '-'}</td>
      <td>${formatarDataBR(row.dataCriacao)}</td>
      <td>${formatarDataBR(row.dataEntradaEtapa)}</td>
      <td>${row.motivoPerda || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarTabelaGeral(termo) {
  const txt = termo.toLowerCase();
  const filtrados = dadosFiltrados.filter(d => {
    return (
      (d.conta && d.conta.toLowerCase().includes(txt)) ||
      (d.vendedor && d.vendedor.toLowerCase().includes(txt)) ||
      (d.bdr && d.bdr.toLowerCase().includes(txt)) ||
      (d.origem && d.origem.toLowerCase().includes(txt)) ||
      (d.etapa && d.etapa.toLowerCase().includes(txt)) ||
      (d.status && d.status.toLowerCase().includes(txt)) ||
      (d.motivoPerda && d.motivoPerda.toLowerCase().includes(txt))
    );
  });
  povoarTabelaGeral(filtrados);
}

// MODAL / POPUP KPIS CLICÁVEIS
function abrirModalDetalhes(tipoKpi) {
  const modal = document.getElementById("modal-detalhes");
  if (!modal) return;
  
  document.getElementById("modal-titulo").innerText = `Detalhamento de Registros: ${tipoKpi}`;
  
  let listaModal = [];
  const tipo = String(tipoKpi).trim().toLowerCase();

  if (tipo === 'criados') {
    listaModal = dadosFiltrados;
  } else if (tipo === 'ganhos') {
    listaModal = dadosFiltrados.filter(d => String(d.status).toLowerCase() === 'ganho');
  } else if (tipo === 'perdidos') {
    listaModal = dadosFiltrados.filter(d => String(d.status).toLowerCase() === 'perdido');
  } else if (tipo === 'em aberto' || tipo === 'aberto') {
    listaModal = dadosFiltrados.filter(d => String(d.status).toLowerCase() === 'aberto');
  }
  
  const tbodyModal = document.getElementById("tbody-modal");
  tbodyModal.innerHTML = "";
  
  if (listaModal.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" style="text-align:center; padding: 20px; color: var(--text-muted);">Nenhum registro encontrado para este filtro.</td>`;
    tbodyModal.appendChild(tr);
  } else {
    listaModal.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.conta || '-'}</td>
        <td>${row.vendedor || '-'}</td>
        <td>${row.origem || '-'}</td>
        <td>${row.bdr || '-'}</td>
        <td>${row.etapa || '-'}</td>
        <td>${row.status || '-'}</td>
        <td>${formatarDataBR(row.dataCriacao)}</td>
        <td>${formatarDataBR(row.dataEntradaEtapa)}</td>
        <td>${row.motivoPerda || '-'}</td>
      `;
      tbodyModal.appendChild(tr);
    });
  }
  
  modal.style.display = "flex";
}

function fecharModal() {
  const modal = document.getElementById("modal-detalhes");
  if (modal) modal.style.display = "none";
}

// ORDENAÇÃO COMPLETA DE COLUNAS (TEXTO, NÚMERO E DATAS BRASILEIRAS)
function ordenarTabela(tableId, colIndex) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  
  if (rows.length === 0) return;

  const chave = `${tableId}-${colIndex}`;
  direcaoOrdenacao[chave] = direcaoOrdenacao[chave] === "asc" ? "desc" : "asc";
  const asc = direcaoOrdenacao[chave] === "asc";

  // Atualizar ícones visuais nos cabeçalhos
  const ths = table.querySelectorAll("th");
  ths.forEach((th, idx) => {
    const iconSpan = th.querySelector(".sort-icon");
    if (iconSpan) {
      if (idx === colIndex) {
        iconSpan.innerText = asc ? "▲" : "▼";
        iconSpan.style.color = "#38bdf8";
      } else {
        iconSpan.innerText = "⇕";
        iconSpan.style.color = "var(--text-muted)";
      }
    }
  });

  rows.sort((a, b) => {
    const cellA = a.children[colIndex] ? a.children[colIndex].innerText.trim() : "";
    const cellB = b.children[colIndex] ? b.children[colIndex].innerText.trim() : "";

    // Expressão Regular para Data Brasileira DD/MM/AAAA HH:mm
    const regexData = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/;
    const matchA = cellA.match(regexData);
    const matchB = cellB.match(regexData);

    if (matchA && matchB) {
      const dateA = new Date(matchA[3], matchA[2] - 1, matchA[1], matchA[4] || 0, matchA[5] || 0);
      const dateB = new Date(matchB[3], matchB[2] - 1, matchB[1], matchB[4] || 0, matchB[5] || 0);
      return asc ? dateA - dateB : dateB - dateA;
    }

    // Tentar comparação Numérica
    const numA = Number(cellA.replace(',', '.'));
    const numB = Number(cellB.replace(',', '.'));

    if (!isNaN(numA) && !isNaN(numB) && cellA !== "" && cellB !== "") {
      return asc ? numA - numB : numB - numA;
    }

    // Comparação Alfabética em Português
    return asc 
      ? cellA.localeCompare(cellB, 'pt-BR', { numeric: true, sensitivity: 'base' })
      : cellB.localeCompare(cellA, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  // Re-inserir as linhas ordenadas
  rows.forEach(row => tbody.appendChild(row));
}

// Exportar CSV
function exportarCSV() {
  let csv = "Conta,Vendedor,Origem,BDR,Etapa,Status,Data Criacao,Entrada Etapa Atual,Motivo Perda\n";
  dadosFiltrados.forEach(row => {
    csv += `"${row.conta}","${row.vendedor}","${row.origem}","${row.bdr}","${row.etapa}","${row.status}","${formatarDataBR(row.dataCriacao)}","${formatarDataBR(row.dataEntradaEtapa)}","${row.motivoPerda}"\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio_bi_lifeapps_crm.csv";
  a.click();
}
