// Reports use the same Retail Chit records as Group, Type, Mapping and Entry.
const chitReportNames = [
  'Chit Report', 'Chit Type', 'Chit History', 'Chit Referral',
  'Chit Entry Wise', 'Renewal Missing', 'Chit Closing', 'Chit Pending',
  'Monthly Summary', 'Chit Collection By Chit Type', 'By Employee'
];
let chitReportName = 'Chit Report';
let chitReportSearch = '';
let chitReportFrom = '';
let chitReportTo = '';
let chitReportType = '';
let chitReportStatus = '';

function chitMoney(value) {
  return '₹ ' + n(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function chitReportData() {
  const groups = rcDocs('retail-chit-group');
  const types = rcDocs('retail-chit-type');
  const mappings = rcDocs('retail-chit-mapping');
  const entries = rcDocs('retail-chit-entry');
  const customers = db.customers || [];
  const groupById = new Map(groups.map(row => [row.id, row]));
  const typeById = new Map(types.map(row => [row.id, row]));
  const customerById = new Map(customers.map(row => [row.id, row]));
  const mappingById = new Map(mappings.map(row => [row.id, row]));
  const entriesByMapping = new Map(mappings.map(row => [row.id, []]));
  entries.forEach(row => entriesByMapping.get(row.mappingId)?.push(row));
  return { groups, types, mappings, entries, groupById, typeById, customerById, mappingById, entriesByMapping };
}

function chitEntryAmount(entry) {
  if (entry.entryType === 'Closure') return 0;
  return n(entry.amount) * (entry.entryType === 'Refund' ? -1 : 1);
}

function chitEntryWeight(entry) {
  if (entry.entryType === 'Closure') return 0;
  return n(entry.metalWeight) * (entry.entryType === 'Refund' ? -1 : 1);
}

function chitReportRows() {
  const data = chitReportData();
  const report = chitReportName;
  const dateOf = row => String(row.when || row.date || row.createdAt || '').slice(0, 10);
  const dateMatches = row => (!chitReportFrom || dateOf(row) >= chitReportFrom) &&
    (!chitReportTo || dateOf(row) <= chitReportTo);
  const textMatches = cells => !chitReportSearch || cells.join(' ').toLowerCase().includes(chitReportSearch.toLowerCase());
  const withFilter = rows => rows.filter(row => textMatches(row));
  const customer = mapping => data.customerById.get(mapping.customerId) || {};
  const type = mapping => data.typeById.get(mapping.typeId) || {};
  const group = mapping => data.groupById.get(mapping.groupId) || {};
  const summary = mapping => rcChitSummary(mapping.id) || {};
  const payments = mapping => (data.entriesByMapping.get(mapping.id) || []).filter(row => row.entryType !== 'Closure');
  const lastPaid = mapping => payments(mapping).map(dateOf).sort().at(-1) || '';
  const target = mapping => n(mapping.targetAmount) ||
    n(mapping.installmentAmount || type(mapping).installmentAmount) * n(mapping.totalDues || type(mapping).installments);
  const selected = data.mappings.filter(mapping =>
    (!chitReportType || mapping.typeId === chitReportType) &&
    (!chitReportStatus || (mapping.status || 'Active') === chitReportStatus));
  const selectedIds = new Set(selected.map(row => row.id));
  const selectedEntries = data.entries.filter(row => selectedIds.has(row.mappingId) && dateMatches(row));
  const who = mapping => customer(mapping).name || '—';
  const code = mapping => mapping.chitNumber || '—';

  if (report === 'Chit Type') {
    const rows = data.types.filter(row => !chitReportType || row.id === chitReportType).map(row => {
      const members = selected.filter(mapping => mapping.typeId === row.id);
      return [row.name, members.length, members.filter(mapping => mapping.status === 'Closed').length,
        members.filter(mapping => (mapping.status || 'Active') !== 'Closed').length,
        n(row.installments), row.frequency || '—', chitMoney(row.installmentAmount)];
    });
    return { columns: ['Chit Type Name', 'Total Chit', 'Finished Chit', 'Active Chit', 'Duration', 'Type', 'Amount'], rows: withFilter(rows) };
  }

  if (report === 'Chit Entry Wise') {
    const dates = [...new Set(selectedEntries.filter(row => row.entryType !== 'Closure').map(dateOf))].sort();
    const methods = ['Cash', 'Cashfree', 'Bank', 'Card', 'UPI', 'CCAvenue', 'HDFC PG', 'Razorpay', 'Easebuzz'];
    const rows = dates.map(date => {
      const day = selectedEntries.filter(row => dateOf(row) === date && row.entryType !== 'Closure');
      return [date, ...methods.map(method => chitMoney(day.filter(row => String(row.method || '').toLowerCase() === method.toLowerCase()).reduce((sum, row) => sum + chitEntryAmount(row), 0))),
        fmt(day.reduce((sum, row) => sum + chitEntryWeight(row), 0)),
        chitMoney(day.reduce((sum, row) => sum + chitEntryAmount(row), 0))];
    });
    return { columns: ['Entry Date', ...methods.map(method => 'By ' + method), 'Total Entered Wt', 'Total Collection'], rows: withFilter(rows) };
  }

  if (report === 'Chit Collection By Chit Type') {
    const rows = data.types.map(row => {
      const ids = new Set(selected.filter(mapping => mapping.typeId === row.id).map(mapping => mapping.id));
      const values = selectedEntries.filter(entry => ids.has(entry.mappingId));
      return [row.name, chitMoney(values.filter(entry => entry.entryType === 'Refund').reduce((sum, entry) => sum + n(entry.amount), 0)),
        chitMoney(values.filter(entry => entry.entryType !== 'Refund').reduce((sum, entry) => sum + chitEntryAmount(entry), 0)),
        fmt(values.reduce((sum, entry) => sum + chitEntryWeight(entry), 0))];
    });
    return { columns: ['Details', 'Debit', 'Credit', 'Metal g'], rows: withFilter(rows) };
  }

  if (report === 'Monthly Summary') {
    const months = [...new Set(selectedEntries.map(row => dateOf(row).slice(0, 7)))].filter(Boolean).sort();
    const rows = months.map(month => {
      const values = selectedEntries.filter(row => dateOf(row).startsWith(month));
      const debit = values.filter(row => row.entryType === 'Refund');
      const credit = values.filter(row => row.entryType !== 'Refund');
      return [month, chitMoney(debit.reduce((sum, row) => sum + n(row.amount), 0)),
        chitMoney(credit.reduce((sum, row) => sum + chitEntryAmount(row), 0)),
        chitMoney(values.reduce((sum, row) => sum + chitEntryAmount(row), 0)),
        fmt(debit.reduce((sum, row) => sum + n(row.metalWeight), 0)),
        fmt(credit.reduce((sum, row) => sum + chitEntryWeight(row), 0)),
        fmt(values.reduce((sum, row) => sum + chitEntryWeight(row), 0))];
    });
    return { columns: ['Particulars', 'Debit Amount', 'Credit Amount', 'Balance Amount', 'Debit Weight', 'Credit Weight', 'Balance Weight'], rows: withFilter(rows) };
  }

  if (report === 'Chit History') {
    const rows = selectedEntries.sort(whenCmp).map(entry => {
      const mapping = data.mappingById.get(entry.mappingId) || {};
      return [dateOf(entry), code(mapping), who(mapping), type(mapping).name || '—', entry.entryType || 'Instalment',
        n(entry.installmentNo), chitMoney(chitEntryAmount(entry)), fmt(chitEntryWeight(entry)),
        entry.method || '—', entry.reference || '—'];
    });
    return { columns: ['Date', 'Chit#', 'Customer', 'Chit Type', 'Entry', 'Due No', 'Amount', 'Metal g', 'Method', 'Reference'], rows: withFilter(rows) };
  }

  if (report === 'Chit Referral' || report === 'By Employee') {
    const key = report === 'Chit Referral' ? 'referredBy' : 'assignedTo';
    const people = [...new Set(selected.map(row => row[key]).filter(Boolean))];
    const rows = people.map(name => {
      const members = selected.filter(row => row[key] === name);
      const ids = new Set(members.map(row => row.id));
      const values = selectedEntries.filter(row => ids.has(row.mappingId));
      return [name, members.length, chitMoney(values.reduce((sum, row) => sum + chitEntryAmount(row), 0)),
        fmt(values.reduce((sum, row) => sum + chitEntryWeight(row), 0))];
    });
    return { columns: [report === 'Chit Referral' ? 'Referred By' : 'Employee Name', 'Total Count', 'Total Amt', 'Total Wt'], rows: withFilter(rows) };
  }

  if (report === 'Renewal Missing') {
    const rows = selected.filter(row => row.status === 'Closed' &&
      !data.mappings.some(other => other.id !== row.id && other.customerId === row.customerId &&
        other.typeId === row.typeId && (other.status || 'Active') === 'Active')).map(row =>
      [who(row), customer(row).phone || '', customer(row).city || '', type(row).name || '—',
        code(row), row.status, row.settledAt || '', row.referredBy || '—']);
    return { columns: ['Customer Name', 'Mobile No', 'City', 'Chit Type', 'Chit#', 'Closed Chit', 'Closed Date', 'Referred By'], rows: withFilter(rows) };
  }

  if (report === 'Chit Closing') {
    const rows = selected.filter(row => row.status === 'Closed').map(row =>
      [who(row), customer(row).phone || '', type(row).name || '—', code(row),
        n(row.totalDues || type(row).installments), chitMoney(summary(row).paid),
        chitMoney(summary(row).totalChitAmount), row.maturityDate || '', row.settledAt || '']);
    return { columns: ['Customer Name', 'Mobile No', 'Chit Name', 'Chit#', 'Duration', 'Total Collection', 'Settlement Value', 'Maturity Expected Date', 'Closing Date'], rows: withFilter(rows) };
  }

  if (report === 'Chit Pending') {
    const rows = selected.filter(row => (row.status || 'Active') !== 'Closed' &&
      target(row) > n(summary(row).paid)).map(row => {
      const paidDues = n(summary(row).duesPaid);
      const totalDues = n(row.totalDues || type(row).installments);
      return [who(row), customer(row).phone || '', customer(row).city || '', code(row),
        type(row).name || '—', paidDues, Math.max(0, totalDues - paidDues),
        chitMoney(Math.max(0, target(row) - n(summary(row).paid))),
        chitMoney(summary(row).paid), lastPaid(row)];
    });
    return { columns: ['Customer Name', 'Mobile No', 'City', 'Chit#', 'Chit Type', 'Paid Dues', 'Pending Due', 'Due Amount', 'Acc. Amount', 'Last Entry Date'], rows: withFilter(rows) };
  }

  const rows = selected.filter(row => dateMatches({ when: row.startDate || row.createdAt })).map(row => {
    const s = summary(row);
    const values = payments(row);
    const byMethod = method => chitMoney(values.filter(entry => String(entry.method || '').toLowerCase() === method).reduce((sum, entry) => sum + chitEntryAmount(entry), 0));
    return [row.startDate || String(row.createdAt || '').slice(0, 10), who(row), customer(row).phone || '',
      customer(row).city || '', group(row).name || '—', type(row).name || '—', code(row),
      row.status || 'Active', n(s.duesPaid), n(s.totalDues), chitMoney(s.paid),
      fmt(s.metalWeight), chitMoney(s.avgRate), byMethod('cash'), byMethod('bank'),
      byMethod('upi'), byMethod('card'), row.maturityDate || '', lastPaid(row)];
  });
  return { columns: ['DOJ', 'Customer Name', 'Mobile No', 'City', 'Chit Group', 'Chit Type', 'Chit#', 'Status', 'Paid Dues', 'Total Dues', 'Total Collection', 'Total Entered Wt', 'Avg Rate', 'Cash Amt', 'Bank Amt', 'UPI Amt', 'Card Amt', 'Chit Maturity Date', 'Last Paid On'], rows: withFilter(rows) };
}

function chitReportsView() {
  const data = chitReportRows();
  const types = rcDocs('retail-chit-type');
  const filter = '<div class="rc-grid"><label>Search<input value="' + esc(chitReportSearch) + '" onchange="chitReportSearch=this.value;render()" placeholder="Customer, phone, Chit#"></label>' +
    '<label>From<input type="date" value="' + esc(chitReportFrom) + '" onchange="chitReportFrom=this.value;render()"></label>' +
    '<label>To<input type="date" value="' + esc(chitReportTo) + '" onchange="chitReportTo=this.value;render()"></label>' +
    '<label>Chit type<select onchange="chitReportType=this.value;render()"><option value="">All types</option>' +
    types.map(row => '<option value="' + esc(row.id) + '" ' + (chitReportType === row.id ? 'selected' : '') + '>' + esc(row.name) + '</option>').join('') + '</select></label>' +
    '<label>Status<select onchange="chitReportStatus=this.value;render()"><option value="">All statuses</option>' +
    ['Active', 'Matured', 'Closed'].map(value => '<option ' + (chitReportStatus === value ? 'selected' : '') + '>' + value + '</option>').join('') + '</select></label></div>';
  const tableHtml = data.rows.length ? table(data.columns, data.rows.map(row => row.map(value => esc(value)))) : '<p class="muted">No matching Chit records.</p>';
  return '<section class="panel"><h2>Chit Reports</h2><div class="chit-report-tabs">' +
    chitReportNames.map(name => '<button type="button" class="' + (chitReportName === name ? 'primary' : '') + '" onclick="chitReportName=\'' + name + '\';render()">' + name + '</button>').join('') +
    '</div></section><section class="panel chit-report-panel"><div class="rc-section-title"><h2>' + esc(chitReportName) + '</h2><span>' + data.rows.length + ' rows</span></div>' +
    filter + '<div class="chit-report-actions"><button type="button" onclick="chitReportSearch=chitReportFrom=chitReportTo=chitReportType=chitReportStatus=\'\';render()">Reset</button>' +
    '<button type="button" onclick="chitReportCsv()">Export CSV</button><button type="button" onclick="window.print()">Print / PDF</button></div>' + tableHtml + '</section>';
}

function reportsView() {
  return '<section class="panel"><h2>Reports</h2><button type="button" class="primary" onclick="go(\'Chit Reports\')">Chit Reports</button></section>';
}

function chitReportCsv() {
  const { columns, rows } = chitReportRows();
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const csv = [columns, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Goldleaf-' + chitReportName.replaceAll(' ', '-') + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
