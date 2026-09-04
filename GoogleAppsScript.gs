function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var data = [];
  
  // Pula a primeira linha (cabeçalhos)
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    data.push({
      conta: row[0],
      vendedor: row[1],
      origem: row[2],
      bdr: row[3],
      conversao: row[4],
      motivoPerda: row[5],
      status: row[6], // Valores esperados: 'Ganho', 'Perdido', 'Aberto'
      dataCriacao: row[7]
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
