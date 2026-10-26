// Keep the original text; normalization is used only to detect formula prefixes.
const formulaPrefix=/^[\s\p{Cc}\p{Cf}]*[=+@\-]/u;
export function unsafeCSVText(value) {
  return formulaPrefix.test(value.normalize('NFKC')) || /^[\t\r\n]/.test(value);
}

export function csvCell(value,{spreadsheet=false}={}) {
  let text=String(value??'');
  if(typeof value==='string' && unsafeCSVText(text)) text=(spreadsheet?'\t':"'")+text;
  return '"'+text.replaceAll('"','""')+'"';
}

export function encodeCSV(rows,options) {
  return '\uFEFF'+rows.map(row=>row.map(value=>csvCell(value,options)).join(',')).join('\r\n')+'\r\n';
}

export function importedCSVText(value) {
  const text=value.trim();
  return text.startsWith("'") && unsafeCSVText(text.slice(1)) ? text.slice(1) : text;
}
