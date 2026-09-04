let dadosGlobais = [];
let filtrosAtivos = { vendedor: '', bdr: '', origem: '' };
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
    // redirect: 'follow' é fundamental para requisições ao Google Apps Script
    const res = await fetch(SHEETS_ENDPOINT, { redirect: 'follow' });
    dadosGlobais = await res.json();
    
    console.log("Dados carregados com sucesso:", dadosGlobais.length, "registros.");
    
    preencherOpcoesFiltros(dadosGlobais);
    aplicarFiltros();
  } catch (err) {
    console.error("Erro ao buscar dados do Google Sheets:", err);
    alert("Erro ao carregar dados. Verifique o console ou a permissão do Apps Script.");
  } finally {
    if (btnSync) btnSync.innerHTML = '<span class="icon">🔄</span> Atualizar dados';
  }
}

// Preenche os selects customizados com pesquisa interna
function preencherOpcoesFiltros(dados) {
  const vendedores = [...new Set(dados.map(d => d.vendedor))].filter(Boolean).sort();
  const bdrs = [...new Set(dados.map(d => d.bdr))].filter(Boolean).sort();
  const origens = [...new Set(dados.map(d => d.origem))].filter(Boolean).sort();

  povoarListaDropdown('options-vendedor', vendedores, 'vendedor', 'Todos os Vendedores');
  povoarListaDropdown('options-bdr', bdrs, 'bdr', 'Todos os BDRs');
  povoarListaDropdown('options-origem', origens, 'origem', 'Todas as Origens');
}

function povoarListaDropdown(elementId, itens, campo, textoPadrao) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  container.innerHTML = `<div class="option-item" onclick="selecionarFiltro('${campo}', '', '${textoPadrao}')">${textoPadrao}</div>`;
  
  itens.forEach(item => {
    const div = document.createElement('div');
    div.className = 'option-item';
    div.innerText = item;
    div.onclick = () => selecionarFiltro(campo, item, item);
    container.appendChild(div);
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
  const itens = document.getElementById(optionsId).querySelectorAll('.option-item');
  itens.forEach(item => {
    const txt = item.innerText.toLowerCase();
    item.style.display = txt.includes(termo) ? 'block' : 'none';
  });
}

function selecionarFiltro(campo, valor, label) {
  filtrosAtivos[campo] = valor;
  const labelEl = document.getElementById(`label-${campo}`);
  if (labelEl) labelEl.innerText = label;
  document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
  aplicarFiltros();
}

function aplicarFiltros() {
  const dataOpt = document.getElementById('filter-date') ? document.getElementById('filter-date').value : 'todo_periodo';
  
  const filtrados = dadosGlobais.filter(item => {
    const matchVend = !filtrosAtivos.vendedor || item.vendedor === filtrosAtivos.vendedor;
    const matchBdr = !filtrosAtivos.bdr || item.bdr === filtrosAtivos.bdr;
    const matchOrig = !filtrosAtivos.origem || item.origem === filtrosAtivos.origem;
    const matchData = filtrarPorData(item.dataCriacao, dataOpt);
    return matchVend && matchBdr && matchOrig && matchData;
  });

  atualizarKPIs(filtrados);
  renderizarTabelas(filtrados);
  renderizarGraficos(filtrados);
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

function renderizarTabelas(dados) {
  povoarTabela("table-vendedor", dados);
  povoarTabela("table-bdr", dados);
  povoarTabela("table-origem", dados);
  povoarTabela("table-perdidos", dados.filter(d => d.status === "Perdido"));
}

function povoarTabela(tableId, dados) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  
  dados.slice(0, 15).forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta}</td>
      <td>${row.vendedor}</td>
      <td>${row.origem}</td>
      <td>${row.bdr}</td>
      <td>${row.etapa}</td>
      <td>${row.motivoPerda}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderizarGraficos(dados) {
  gerarChart('chartVendedor', agruparPor(dados, 'vendedor'), 'Vendedores');
  gerarChart('chartBDR', agruparPor(dados, 'bdr'), 'BDRs');
  gerarChart('chartOrigem', agruparPor(dados, 'origem'), 'Origens');
  gerarChart('chartPerdidos', agruparPor(dados.filter(d => d.status === 'Perdido'), 'motivoPerda'), 'Motivos de Perda');
}

function agruparPor(dados, chave) {
  const counts = {};
  dados.forEach(d => {
    const val = d[chave] || 'Não informado';
    counts[val] = (counts[val] || 0) + 1;
  });
  return counts;
}

function gerarChart(canvasId, agrupaObj, label) {
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
        backgroundColor: '#38bdf8',
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

// Modal Clicável dos KPIs
function abrirModalDetalhes(status) {
  const modal = document.getElementById("modal-detalhes");
  if (!modal) return;
  
  document.getElementById("modal-titulo").innerText = `Detalhamento de Registros: ${status}`;
  
  let filtrados = dadosGlobais;
  if (status !== 'Criados') {
    filtrados = dadosGlobais.filter(d => d.status === status);
  }
  
  povoarTabelaModal("table-modal", filtrados);
  modal.style.display = "flex";
}

function povoarTabelaModal(tableId, dados) {
  const tbody = document.getElementById(tableId).querySelector("tbody");
  tbody.innerHTML = "";
  
  dados.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta}</td>
      <td>${row.vendedor}</td>
      <td>${row.origem}</td>
      <td>${row.bdr}</td>
      <td>${row.etapa}</td>
      <td>${row.motivoPerda}</td>
    `;
    tbody.appendChild(tr);
  });
}

function fecharModal() {
  const modal = document.getElementById("modal-detalhes");
  if (modal) modal.style.display = "none";
}

// Ordenação Interativa de Tabelas (Maior / Menor)
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

// Exportação em CSV
function exportarCSV() {
  let csv = "Conta,Vendedor,Origem,BDR,Etapa,Status,Motivo Perda\n";
  dadosGlobais.forEach(row => {
    csv += `"${row.conta}","${row.vendedor}","${row.origem}","${row.bdr}","${row.etapa}","${row.status}","${row.motivoPerda}"\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio_bi_puca_crm.csv";
  a.click();
}
