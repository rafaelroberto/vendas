let dadosGlobais = [];
const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlwzE3mH4zPuVITaiGM1GZDpcjrlto0jPtL8Kd90WCVphT8T9ITzfQNKyLh4E5.../exec";

// Configuração de carregamento inicial
window.onload = () => {
  carregarDados();
  setInterval(carregarDados, 300000); // Atualiza automaticamente a cada 5 minutos
};

async function carregarDados() {
  try {
    const response = await fetch(SHEETS_ENDPOINT);
    dadosGlobais = await response.json();
    aplicarFiltros();
  } catch (err) {
    console.error("Erro ao carregar dados do Google Sheets:", err);
  }
}

function aplicarFiltros() {
  const vend = document.getElementById("search-vendedor").value.toLowerCase();
  const bdr = document.getElementById("search-bdr").value.toLowerCase();
  const origem = document.getElementById("search-origem").value.toLowerCase();

  const filtrados = dadosGlobais.filter(item => {
    return (
      (!vend || item.vendedor.toLowerCase().includes(vend)) &&
      (!bdr || item.bdr.toLowerCase().includes(bdr)) &&
      (!origem || item.origem.toLowerCase().includes(origem))
    );
  });

  atualizarKPIs(filtrados);
  renderizarTabelasECard(filtrados);
}

function atualizarKPIs(dados) {
  document.getElementById("kpi-criados").innerText = dados.length;
  document.getElementById("kpi-ganhos").innerText = dados.filter(d => d.status === "Ganho").length;
  document.getElementById("kpi-perdidos").innerText = dados.filter(d => d.status === "Perdido").length;
  document.getElementById("kpi-aberto").innerText = dados.filter(d => d.status === "Aberto").length;
}

function renderizarTabelasECard(dados) {
  povoarTabela("table-vendedor", dados);
  povoarTabela("table-bdr", dados);
  povoarTabela("table-origem", dados);
  povoarTabela("table-perdidos", dados.filter(d => d.status === "Perdido"));
}

function povoarTabela(tableId, dados) {
  const tbody = document.getElementById(tableId).querySelector("tbody");
  tbody.innerHTML = "";

  dados.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.conta}</td>
      <td>${row.vendedor}</td>
      <td>${row.origem}</td>
      <td>${row.bdr}</td>
      <td>${row.conversao}%</td>
      <td>${row.motivoPerda || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Ordenação interativa de colunas (Maior/Menor)
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
      
      let xVal = isNaN(x.innerHTML) ? x.innerHTML.toLowerCase() : Number(x.innerHTML);
      let yVal = isNaN(y.innerHTML) ? y.innerHTML.toLowerCase() : Number(y.innerHTML);

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

// Modal Clicável dos KPIs
function abrirModalDetalhes(status) {
  const modal = document.getElementById("modal-detalhes");
  document.getElementById("modal-titulo").innerText = `Detalhamento: ${status}`;
  
  let filtrados = dadosGlobais;
  if (status !== 'Criados') {
    filtrados = dadosGlobais.filter(d => d.status === status);
  }
  
  povoarTabela("table-modal", filtrados);
  modal.style.display = "flex";
}

function fecharModal() {
  document.getElementById("modal-detalhes").style.display = "none";
}

// Exportação CSV
function exportarCSV() {
  let csv = "Conta,Vendedor,Origem,BDR,Conversão,Motivo Perda\n";
  dadosGlobais.forEach(row => {
    csv += `"${row.conta}","${row.vendedor}","${row.origem}","${row.bdr}","${row.conversao}%","${row.motivoPerda}"\n`;
  });
  
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", "relatorio_bi.csv");
  a.click();
}
