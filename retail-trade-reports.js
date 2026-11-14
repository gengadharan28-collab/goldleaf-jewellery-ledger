// Retail Sales and Purchase reports use saved shop records; no separate report data is stored.
let tradeReportArea = 'Sales';
let tradeReportName = 'Sales Summary';
let tradeReportFrom = '';
let tradeReportTo = '';
let tradeReportSearch = '';
window.tradeReportActive = false;
const tradeReportTabs = {
  Sales: ['Sales Summary', 'Sales Register', 'Top Sales by Product', 'Top Sales by Customer'],
  Purchase: ['Purchase Abstract', 'Purchase Register', 'Supplier Wise', 'Product Wise']
};

function tradeReportMoney(value) { return rateMoney(rbRound(value)); }
function tradeReportGrams(value) { return fmt(rbGrams(value)) + ' g'; }
function tradeReportDate(row) { return String(row.when || row.createdAt || '').slice(0, 10); }
function tradeReportInRange(row) {
  const date = tradeReportDate(row);
  return (!tradeReportFrom || date >= tradeReportFrom) && (!tradeReportTo || date <= tradeReportTo);
}
function tradeReportFiltered(rows) {
  const query = tradeReportSearch.trim().toLowerCase();
  return query ? rows.filter(row => row.join(' ').toLowerCase().includes(query)) : rows;
}
function tradeReportSales() { return db.sales.filter(row => ownerType(row) === 'customer' && tradeReportInRange(row)); }
function tradeReportReturns() { return db.payments.filter(row => ownerType(row) === 'customer' && row.retailKind === 'return' && tradeReportInRange(row)); }
function tradeReportPurchases() { return rpDocs('purchase').filter(tradeReportInRange); }
function tradeReportSaleItems(sale) { return (sale.invoiceItems?.length ? sale.invoiceItems : rbInvoiceItems(sale)).map(rbItemCalc); }
function tradeReportPurchaseItems(doc) { return (doc.items || []).map(item => rpItemCalc(item, doc.kind)); }

function tradeReportData() {
  const sales = tradeReportSales(), returns = tradeReportReturns(), purchases = tradeReportPurchases();
  const name = tradeReportName;
  let columns = [], rows = [], totals = [];
  const sum = (list, key) => list.reduce((value, row) => value + n(row[key]), 0);

  if (name === 'Sales Summary') {
    const saleWeight = sum(sales, 'weight'), saleAmount = sum(sales, 'saleAmount');
    const returnWeight = sum(returns, 'returnWeight'), returnAmount = sum(returns, 'amount');
    columns = ['Particular', 'Sales Weight', 'Return Weight', 'Net Weight', 'Sales Amount', 'Return Amount', 'Net Sales'];
    rows = [
      ['Jewellery sales', tradeReportGrams(saleWeight), tradeReportGrams(returnWeight), tradeReportGrams(saleWeight - returnWeight), tradeReportMoney(saleAmount), tradeReportMoney(returnAmount), tradeReportMoney(saleAmount - returnAmount)],
      ['Chit applied', tradeReportGrams(sum(sales, 'chitUsedWeight')), '—', '—', tradeReportMoney(sum(sales, 'chitAmount')), '—', '—'],
      ['Old jewellery exchange', tradeReportGrams(sum(sales, 'exchangePureGrams')), '—', '—', tradeReportMoney(sum(sales, 'exchangeAmount')), '—', '—']
    ];
    totals = ['Total sales after returns', tradeReportGrams(saleWeight), tradeReportGrams(returnWeight), tradeReportGrams(saleWeight - returnWeight), tradeReportMoney(saleAmount), tradeReportMoney(returnAmount), tradeReportMoney(saleAmount - returnAmount)];
  } else if (name === 'Sales Register') {
    columns = ['Date', 'Bill No.', 'Customer', 'Product', 'Gold Gross', 'Silver Gross', 'Net Weight', 'Bill Amount', 'Discount', 'GST', 'Collected', 'Balance'];
    rows = sales.flatMap(sale => {
      const items = tradeReportSaleItems(sale);
      return items.length ? items.map(item => [tradeReportDate(sale), sale.documentNo || '—', accountName(sale.partyId, 'customer'), item.product || '—',
        tradeReportGrams(item.metalType === 'Silver' ? 0 : item.grossWeight), tradeReportGrams(item.metalType === 'Silver' ? item.grossWeight : 0),
        tradeReportGrams(item.netWeight), tradeReportMoney(item.subtotal), tradeReportMoney(n(sale.discount) * (n(sale.subtotal) ? n(item.subtotal) / n(sale.subtotal) : 0)),
        tradeReportMoney(n(sale.gstAmount) * (n(sale.subtotal) ? n(item.subtotal) / n(sale.subtotal) : 0)),
        tradeReportMoney(n(sale.collectedAmount) * (n(sale.subtotal) ? n(item.subtotal) / n(sale.subtotal) : 0)),
        tradeReportMoney(rbInvoiceBalance(sale) * (n(sale.subtotal) ? n(item.subtotal) / n(sale.subtotal) : 0))]) : [];
    });
    totals = ['Grand total', '', '', '', tradeReportGrams(sales.flatMap(tradeReportSaleItems).filter(x => x.metalType !== 'Silver').reduce((v,x)=>v+n(x.grossWeight),0)),
      tradeReportGrams(sales.flatMap(tradeReportSaleItems).filter(x => x.metalType === 'Silver').reduce((v,x)=>v+n(x.grossWeight),0)),
      tradeReportGrams(sum(sales, 'weight')), tradeReportMoney(sum(sales, 'subtotal')), tradeReportMoney(sum(sales, 'discount')),
      tradeReportMoney(sum(sales, 'gstAmount')), tradeReportMoney(sum(sales, 'collectedAmount')), tradeReportMoney(sales.reduce((v,x)=>v+rbInvoiceBalance(x),0))];
  } else if (name.startsWith('Top Sales')) {
    const byProduct = name.endsWith('Product'), groups = new Map();
    sales.forEach(sale => tradeReportSaleItems(sale).forEach(item => {
      const key = byProduct ? (item.product || 'Unspecified') : accountName(sale.partyId, 'customer');
      const current = groups.get(key) || { count: 0, pieces: 0, weight: 0, amount: 0 };
      current.count++; current.pieces += n(item.pieces); current.weight += n(item.netWeight); current.amount += n(item.subtotal);
      groups.set(key, current);
    }));
    columns = [byProduct ? 'Product' : 'Customer', 'Item Count', 'Pieces', 'Net Weight', 'Item Value'];
    rows = [...groups].sort((a,b)=>b[1].amount-a[1].amount).map(([key,v]) => [key, v.count, v.pieces, tradeReportGrams(v.weight), tradeReportMoney(v.amount)]);
    totals = ['Grand total', rows.reduce((v,x)=>v+n(x[1]),0), rows.reduce((v,x)=>v+n(x[2]),0),
      tradeReportGrams([...groups.values()].reduce((v,x)=>v+x.weight,0)), tradeReportMoney([...groups.values()].reduce((v,x)=>v+x.amount,0))];
  } else if (name === 'Purchase Abstract') {
    const groups = new Map();
    purchases.forEach(doc => tradeReportPurchaseItems(doc).forEach(item => {
      const key = item.metal || 'Other', current = groups.get(key) || { gross: 0, amount: 0, tax: 0, total: 0 };
      current.gross += n(item.grossWeight); current.amount += n(item.subtotal);
      const share = n(doc.subtotal) ? n(item.subtotal) / n(doc.subtotal) : 0;
      current.tax += n(doc.gstAmount) * share; current.total += n(doc.totalAmount) * share;
      groups.set(key, current);
    }));
    columns = ['Particular', 'Gross Weight', 'Amount', 'GST', 'Total'];
    rows = [...groups].map(([key,v]) => [key, tradeReportGrams(v.gross), tradeReportMoney(v.amount), tradeReportMoney(v.tax), tradeReportMoney(v.total)]);
    totals = ['Grand total', tradeReportGrams(sum(purchases, 'grossWeight')), tradeReportMoney(sum(purchases, 'subtotal')),
      tradeReportMoney(sum(purchases, 'gstAmount')), tradeReportMoney(sum(purchases, 'totalAmount'))];
  } else if (name === 'Purchase Register') {
    columns = ['Date', 'Purchase No.', 'Supplier', 'Product', 'Metal', 'Pieces', 'Gross Weight', 'Net Weight', 'Pure Weight', 'Amount', 'GST', 'Paid', 'Balance'];
    rows = purchases.flatMap(doc => tradeReportPurchaseItems(doc).map(item => {
      const share = n(doc.subtotal) ? n(item.subtotal) / n(doc.subtotal) : 0;
      return [tradeReportDate(doc), doc.documentNo || '—', rpSupplier(doc.supplierId)?.name || '—', item.product || '—', item.metal || '—', n(item.pieces),
        tradeReportGrams(item.grossWeight), tradeReportGrams(item.netWeight), tradeReportGrams(item.payablePure), tradeReportMoney(item.subtotal),
        tradeReportMoney(n(doc.gstAmount) * share), tradeReportMoney(n(doc.paidAmount) * share), tradeReportMoney(n(doc.balance) * share)];
    }));
    totals = ['Grand total', '', '', '', '', sum(purchases, 'pieces'), tradeReportGrams(sum(purchases, 'grossWeight')),
      tradeReportGrams(sum(purchases, 'netWeight')), tradeReportGrams(purchases.reduce((v,x)=>v+n(x.goldPure)+n(x.silverPure),0)),
      tradeReportMoney(sum(purchases, 'subtotal')), tradeReportMoney(sum(purchases, 'gstAmount')),
      tradeReportMoney(sum(purchases, 'paidAmount')), tradeReportMoney(sum(purchases, 'balance'))];
  } else {
    const bySupplier = name === 'Supplier Wise', groups = new Map();
    purchases.forEach(doc => tradeReportPurchaseItems(doc).forEach(item => {
      const key = bySupplier ? (rpSupplier(doc.supplierId)?.name || 'Unspecified') : (item.product || 'Unspecified');
      const current = groups.get(key) || { count: 0, pieces: 0, gross: 0, pure: 0, amount: 0 };
      current.count++; current.pieces += n(item.pieces); current.gross += n(item.grossWeight);
      current.pure += n(item.payablePure); current.amount += n(item.subtotal);
      groups.set(key, current);
    }));
    columns = [bySupplier ? 'Supplier' : 'Product', 'Items', 'Pieces', 'Gross Weight', 'Pure Weight', 'Amount'];
    rows = [...groups].sort((a,b)=>b[1].amount-a[1].amount).map(([key,v]) => [key,v.count,v.pieces,tradeReportGrams(v.gross),tradeReportGrams(v.pure),tradeReportMoney(v.amount)]);
    totals = ['Grand total', rows.reduce((v,x)=>v+n(x[1]),0), rows.reduce((v,x)=>v+n(x[2]),0),
      tradeReportGrams(sum(purchases, 'grossWeight')), tradeReportGrams(purchases.reduce((v,x)=>v+n(x.goldPure)+n(x.silverPure),0)),
      tradeReportMoney(sum(purchases, 'subtotal'))];
  }
  if (tradeReportSearch.trim()) totals[0] = 'Date-range total';
  return { columns, rows: tradeReportFiltered(rows), totals };
}

window.tradeReportOpen = function(area) {
  window.tradeReportActive = true;
  tradeReportArea = area === 'Purchase' ? 'Purchase' : 'Sales';
  tradeReportName = tradeReportTabs[tradeReportArea][0];
  render();
};
window.tradeReportBack = function() { window.tradeReportActive = false; render(); };
window.tradeReportSelect = function(name) {
  if (!tradeReportTabs[tradeReportArea].includes(name)) return;
  tradeReportName = name; render();
};
window.tradeReportReset = function() { tradeReportFrom = tradeReportTo = tradeReportSearch = ''; render(); };

function tradeReportsView() {
  const data = tradeReportData();
  const reportTable = data.rows.length ? table(data.columns, [...data.rows, data.totals].map(row => row.map(value => esc(value)))) :
    '<p class="muted">No matching saved entries.</p>';
  return '<section class="panel chit-report-panel trade-report-panel"><div class="rc-section-title"><h2>' + esc(tradeReportArea) + ' Reports</h2><button type="button" onclick="tradeReportBack()">← Reports</button></div>' +
    '<div class="chit-report-tabs">' + tradeReportTabs[tradeReportArea].map(name => '<button type="button" class="' + (name === tradeReportName ? 'primary' : '') + '" onclick="tradeReportSelect(\'' + name + '\')">' + name + '</button>').join('') + '</div></section>' +
    '<section class="panel chit-report-panel trade-report-panel"><div class="rc-section-title"><h2>' + esc(tradeReportName) + '</h2><span>' + data.rows.length + ' rows</span></div>' +
    '<div class="rc-grid"><label>Search<input value="' + esc(tradeReportSearch) + '" onchange="tradeReportSearch=this.value;render()" placeholder="Bill, customer, supplier or product"></label>' +
    '<label>From<input type="date" value="' + esc(tradeReportFrom) + '" onchange="tradeReportFrom=this.value;render()"></label>' +
    '<label>To<input type="date" value="' + esc(tradeReportTo) + '" onchange="tradeReportTo=this.value;render()"></label></div>' +
    '<div class="chit-report-actions"><button type="button" onclick="tradeReportReset()">Reset</button><button type="button" onclick="tradeReportCsv()">Export CSV</button><button type="button" onclick="window.print()">Print / PDF</button></div>' +
    (tradeReportSearch.trim() ? '<p class="hint">The final total covers the selected dates before text search.</p>' : '') + reportTable + '</section>';
}

window.tradeReportCsv = function() {
  const data = tradeReportData(), quote = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
  const csv = [data.columns, ...data.rows, data.totals].map(row => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url;
  link.download = 'Goldleaf-' + tradeReportName.replaceAll(' ','-') + '.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
