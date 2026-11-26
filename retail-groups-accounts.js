// Retail Accounts Module: Dedicated Accounts workspace with expandable sidebar navigation,
// Ledger Lists & Statements, Bulk Inline Opening Balance, Accounting Groups, Expenses,
// Journal Entry, Contra Entry, Bill Entry, Cash/Bank/DayBook Books, Financial Statements & Shop Masters.
(function(){
  const RGA_PRIMARY_GROUPS = [
    { id:'pg-branch', name:'Branch / Divisions', type:'ASSET', system:true, children:[] },
    { id:'pg-capital', name:'Capital Account', type:'EQUITY', system:true, children:[
      { id:'pg-reserves', name:'Reserves and Surplus', type:'EQUITY', system:true }
    ]},
    { id:'pg-curr-assets', name:'Current Assets', type:'ASSET', system:true, children:[
      { id:'pg-bank', name:'Bank Accounts', type:'ASSET', system:true },
      { id:'pg-cash', name:'Cash in hand', type:'ASSET', system:true },
      { id:'pg-deposits', name:'Deposits (Asset)', type:'ASSET', system:true },
      { id:'pg-loans-adv', name:'Loans & Advances(Assets)', type:'ASSET', system:true },
      { id:'pg-stock', name:'Stock in hand', type:'ASSET', system:true },
      { id:'pg-debtors', name:'Sundry Debtors', type:'ASSET', system:true }
    ]},
    { id:'pg-curr-liab', name:'Current Liabilities', type:'LIABILITY', system:true, children:[
      { id:'pg-duties', name:'Duties & Taxes', type:'LIABILITY', system:true },
      { id:'pg-provisions', name:'Provisions', type:'LIABILITY', system:true },
      { id:'pg-creditors', name:'Sundry Creditors', type:'LIABILITY', system:true }
    ]},
    { id:'pg-dir-exp', name:'Direct Expenses', type:'EXPENSE', system:true, children:[] },
    { id:'pg-dir-inc', name:'Direct Incomes', type:'INCOME', system:true, children:[] },
    { id:'pg-fixed-assets', name:'Fixed Assets', type:'ASSET', system:true, children:[] },
    { id:'pg-ind-exp', name:'Indirect Expenses', type:'EXPENSE', system:true, children:[] },
    { id:'pg-ind-inc', name:'Indirect Incomes', type:'INCOME', system:true, children:[] },
    { id:'pg-investments', name:'Investments', type:'ASSET', system:true, children:[] },
    { id:'pg-loans-liab', name:'Loans(Liability)', type:'LIABILITY', system:true, children:[
      { id:'pg-bank-od', name:'Bank OD A/c', type:'LIABILITY', system:true },
      { id:'pg-sec-loans', name:'Secured Loans', type:'LIABILITY', system:true },
      { id:'pg-unsec-loans', name:'Unsecured Loans', type:'LIABILITY', system:true }
    ]},
    { id:'pg-misc-exp', name:'Misc.Expenses (Asset)', type:'ASSET', system:true, children:[] },
    { id:'pg-pnl', name:'Profit & Loss A/c', type:'EQUITY', system:true, children:[] },
    { id:'pg-purchase', name:'Purchase Accounts', type:'EXPENSE', system:true, children:[] },
    { id:'pg-sales', name:'Sales Accounts', type:'INCOME', system:true, children:[] },
    { id:'pg-suspense', name:'Suspense A/c', type:'LIABILITY', system:true, children:[] }
  ];

  const RGA_NAV_SECTIONS = [
    {
      heading: 'Ledgers',
      items: [
        ['Ledger', 'Ledger'],
        ['Opening Balance', 'Opening Balance'],
        ['Accounting Groups', 'Ledger Groups']
      ]
    },
    {
      heading: 'Entries & Expenses',
      items: [
        ['Expenses', 'Expenses'],
        ['Journal Entry', 'Journal Entry'],
        ['Contra Entry', 'Contra Entry'],
        ['Bill Entry', 'Bill Entry']
      ]
    },
    {
      heading: 'Statements & Setup',
      items: [
        ['Accounts & Reports', 'Financial Statements'],
        ['Books & DayBook', 'Cash / Bank / DayBook'],
        ['Product Groups', 'Product Groups'],
        ['Shop Masters', 'Shop Masters']
      ]
    }
  ];

  window.rgaState = Object.assign({
    mainTab: 'Ledger',
    sidebarOpen: false,
    grpSearch: '', grpViewMode: 'group', grpExpanded: new Set(['pg-curr-assets','pg-curr-liab','pg-loans-liab','pg-capital']),
    pgSearch: '', pgViewMode: 'group', pgShowForm: false, pgEditId: '', pgViewId: '', pgViewTab: 'Details', pgFilterOpen: false,
    pgFilter: { parentId:'', ornament:'', isParent:'All', isEcom:'All' }, pgExpanded: new Set(),
    ledSearch: '', ledShowForm: false, ledEditId: '', ledViewId: '', ledFilterGroup: '', ledShowZero: true, ledShowDisabled: false, ledShowOB: true, ledIncludeParties: true,
    obSearch: '', obFilterGroup: '', obScope: 'All',
    postingEditId: '', postingShowForm: false, postingSearch: '', postingFrom: '', postingTo: '', postingFilter: '',
    bookTab: 'Cashbook', bookFrom: '', bookTo: '', bookSearch: '',
    repTab: 'Trial Balance', repShowDetail: false, repExpanded: new Set(['Current Assets','Current Liabilities']),
    repPayGroup: '', repPaySearch: '', repStockGroupBy: 'Product Group', repStockMetal: 'All', repStockZero: false, repStockExpanded: new Set(),
    masterCat: 'Ornament Purity', masterEditId: ''
  }, window.rgaState || {});

  const normalizeTab = (t) => {
    if (t === 'Ledgers') return 'Ledger';
    return t || 'Ledger';
  };

  const isAccountsPage = () => page === 'Accounts' || page === 'Parent Group';

  // Inject Accounts sidebar & hub styles once
  if (!document.getElementById('rgaAccountsStyle')) {
    const st = document.createElement('style');
    st.id = 'rgaAccountsStyle';
    st.textContent = `
      .rga-sidebar-sub{display:grid;gap:2px;margin:2px 0 6px 12px;padding:6px 6px 6px 10px;border-left:2px solid rgba(195,160,108,0.45);background:rgba(24,57,42,0.04);border-radius:0 8px 8px 0}
      html[data-theme="dark"] .rga-sidebar-sub{background:rgba(255,255,255,0.03);border-left-color:rgba(195,160,108,0.5)}
      body.erp-sidebar-collapsed:not(.erp-mobile-nav-open) .rga-sidebar-sub{display:none!important}
      .rga-sidebar-sub-head{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7280);padding:5px 6px 2px;margin-top:2px}
      .rga-sidebar-sub-head:first-child{margin-top:0}
      .rga-sidebar-sub button{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:30px!important;padding:4px 8px!important;border:0!important;border-radius:6px!important;background:transparent!important;color:var(--ink,#1f2937)!important;font-size:12px!important;font-weight:600!important;text-align:left!important;cursor:pointer!important}
      .rga-sidebar-sub button:hover{background:rgba(24,57,42,0.08)!important}
      .rga-sidebar-sub button.active{background:#18392a!important;color:#fff!important;font-weight:750!important}
      html[data-theme="dark"] .rga-sidebar-sub button.active{background:#c3a06c!important;color:#181c1a!important}
      .rga-roof-bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:0 0 14px}
      .rga-roof-group{background:var(--white,#fff);border:1px solid var(--line,#e2dccf);border-radius:11px;padding:9px 11px;box-shadow:0 1px 4px rgba(0,0,0,0.03)}
      .rga-roof-group-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7280);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between}
      .rga-roof-pills{display:flex;flex-wrap:wrap;gap:5px}
      .rga-roof-pills button{min-height:31px;padding:4px 10px;font-size:12px;font-weight:650;border-radius:7px;border:1px solid var(--line,#dfd8c8);background:var(--paper,#faf8f3);color:var(--ink,#1e293b);cursor:pointer}
      .rga-roof-pills button.active{background:#18392a;border-color:#18392a;color:#fff;font-weight:750}
      html[data-theme="dark"] .rga-roof-pills button.active{background:#c3a06c;border-color:#c3a06c;color:#181c1a}
      .rga-ob-input{width:110px!important;min-height:32px!important;padding:4px 7px!important;font-size:12.5px!important}
      .rga-ob-select{width:68px!important;min-height:32px!important;padding:4px 5px!important;font-size:12px!important}
      .rga-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px}
      .rga-kpi{padding:9px 12px;border-radius:9px;border:1px solid var(--line,#e2dccf);background:var(--paper,#faf8f3)}
      .rga-kpi small{display:block;font-size:10px;font-weight:750;text-transform:uppercase;color:var(--muted,#6b7280)}
      .rga-kpi b{font-size:15px;color:var(--ink,#111827)}
    `;
    document.head.appendChild(st);
  }

  const docs = (t) => {
    if (typeof rcEnsure === 'function') rcEnsure();
    return (db.retailDocuments || []).filter(d => d && (d.kind === t || d.type === t));
  };
  const saveDoc = (t, d) => {
    if (window.rcSaveDoc) return window.rcSaveDoc(t, d);
    if (!Array.isArray(db.retailDocuments)) db.retailDocuments = [];
    const now = new Date().toISOString();
    const clean = Object.assign({}, d);
    if (!clean.id) delete clean.id;
    const row = Object.assign({ id: crypto.randomUUID(), type: t, accountType: 'customer', createdAt: d.createdAt || now, updatedAt: now }, clean, { type: t, updatedAt: now });
    if (typeof RC_SQL_KINDS !== 'undefined' && RC_SQL_KINDS.has(t)) row.kind = t; else delete row.kind;
    const i = db.retailDocuments.findIndex(x => x && x.id === row.id);
    if (i < 0) db.retailDocuments.unshift(row); else db.retailDocuments[i] = row;
    if (typeof rcEnsure === 'function') rcEnsure();
    save(); return row;
  };
  const delDoc = (t, id) => {
    if (t === 'retail-ledger' && docs('retail-account-posting').some(row => row.lines?.some(line => line.ledgerId === id))) {
      return say('This ledger has account entries and cannot be deleted.');
    }
    if (window.rcDeleteDoc) return window.rcDeleteDoc(t, id);
    if (!Array.isArray(db.deletedRetailDocumentIds)) db.deletedRetailDocumentIds = [];
    if (id && !db.deletedRetailDocumentIds.includes(String(id))) db.deletedRetailDocumentIds.push(String(id));
    db.retailDocuments = (db.retailDocuments || []).filter(x => x && x.id !== id);
    save();
  };
  const opts = (arr, cur, empty) => (empty !== undefined ? '<option value="">' + esc(empty) + '</option>' : '') + arr.map(v => '<option value="' + esc(v) + '" ' + (String(cur || '') === String(v) ? 'selected' : '') + '>' + esc(v) + '</option>').join('');
  const csvDownload = (filename, rows) => {
    const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  window.rgaOpen = function(tab) {
    if (typeof rbCanLeave === 'function' && !rbCanLeave()) return;
    workspaceMode = 'retail';
    localStorage.setItem('goldleaf-workspace-mode', 'retail');
    rgaState.mainTab = normalizeTab(tab);
    rgaState.sidebarOpen = true;
    rgaState.postingEditId = '';
    rgaState.postingShowForm = false;
    rgaState.ledShowForm = false;
    rgaState.ledViewId = '';
    page = 'Accounts';
    window.goldleafRememberView?.();
    render();
    window.scrollTo?.(0, 0);
  };

  // Standard starter ledgers helper (1-click setup if shop has no Cash/Bank/Expense ledgers yet)
  window.rgaSeedStandardLedgers = function() {
    const existing = new Set(docs('retail-ledger').map(l => String(l.name || '').trim().toLowerCase()));
    const starters = [
      { name: 'Main Cash in Hand', parentGroup: 'Cash in hand', ornamentsType: 'None' },
      { name: 'Petty Cash Drawer', parentGroup: 'Cash in hand', ornamentsType: 'None' },
      { name: 'Main Bank Current A/c', parentGroup: 'Bank Accounts', ornamentsType: 'None' },
      { name: 'UPI / Card Settlement Bank A/c', parentGroup: 'Bank Accounts', ornamentsType: 'None' },
      { name: 'Showroom Electricity & Rent', parentGroup: 'Indirect Expenses', ornamentsType: 'None' },
      { name: 'Staff Salary & Tea Welfare', parentGroup: 'Indirect Expenses', ornamentsType: 'None' },
      { name: 'Hallmarking & Making Charges', parentGroup: 'Direct Expenses', ornamentsType: 'GOLD' },
      { name: 'Proprietor Capital A/c', parentGroup: 'Capital Account', ornamentsType: 'None' }
    ];
    let added = 0;
    for (const s of starters) {
      if (!existing.has(s.name.toLowerCase())) {
        saveDoc('retail-ledger', {
          salutation: '', name: s.name, printName: s.name, parentGroup: s.parentGroup,
          ornamentsType: s.ornamentsType, gstRegType: 'Un Registered', state: 'TAMIL NADU',
          openingAmount: 0, openingSide: 'DR', pureWeight: 0, pureSide: 'DR', disabled: false
        });
        added++;
      }
    }
    say(added ? ('Created ' + added + ' standard Cash, Bank, Expense & Capital ledgers.') : 'Standard ledgers already exist.');
    render();
  };

  // Build full accounting group hierarchy (16 primary + built-in children + custom sub-groups)
  window.rgaAllAccountingGroups = () => {
    const custom = docs('retail-ledger-group');
    const tree = RGA_PRIMARY_GROUPS.map(p => {
      const childCustom = custom.filter(c => c.parentId === p.id).map(c => ({ id: c.id, name: c.name, type: c.groupType || p.type, parentId: p.id, parentName: p.name, system: false }));
      const childBuiltIn = (p.children || []).map(c => ({ id: c.id, name: c.name, type: c.type, parentId: p.id, parentName: p.name, system: true }));
      return { id: p.id, name: p.name, type: p.type, system: true, children: [...childBuiltIn, ...childCustom] };
    });
    const flat = [];
    tree.forEach(p => {
      flat.push({ id: p.id, name: p.name, type: p.type, parentId: '', parentName: '', system: true });
      p.children.forEach(c => flat.push(c));
    });
    flat.sort((a, b) => a.name.localeCompare(b.name));
    return { tree, flat };
  };

  window.rgaAccountingGroupOptions = (selected = '') => {
    const { flat } = window.rgaAllAccountingGroups();
    return '<option value="">-- Select Parent Group --</option>' + flat.map(g => '<option value="' + esc(g.name) + '" ' + (g.name === selected ? 'selected' : '') + '>' + esc(g.name) + ' (' + esc(g.type) + ')</option>').join('');
  };

  window.rgaProductGroupOptions = (selected = '', onlyParents = false) => {
    const list = docs('retail-product-group').filter(g => !onlyParents || g.isParent !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return '<option value="">-- Select Product Group --</option>' + list.map(g => '<option value="' + esc(g.name) + '" ' + (g.name === selected ? 'selected' : '') + '>' + esc(g.name) + (g.parentName ? ' (' + esc(g.parentName) + ')' : '') + '</option>').join('');
  };

  // ======================== 1. ACCOUNTING / LEDGER GROUPS ========================
  window.rgaOpenGroupModal = (parentId, editId = '') => {
    const { tree } = window.rgaAllAccountingGroups();
    const parent = tree.find(p => p.id === parentId);
    const custom = editId ? docs('retail-ledger-group').find(c => c.id === editId) : null;
    const grpType = custom?.groupType || parent?.type || 'ASSET';
    const parentName = parent?.name || custom?.parentName || '';
    document.getElementById('rgaGroupModal')?.remove();
    const html = '<div id="rgaGroupModal" class="retail-modal-backdrop" role="dialog" aria-modal="true"><section class="retail-modal" style="max-width:460px">'
      + '<div class="retail-modal-head"><div><h2>' + (custom ? 'Group :: Edit' : 'Group :: Add') + '</h2><p>Under: <b>' + esc(parentName) + '</b></p></div><button type="button" onclick="document.getElementById(\'rgaGroupModal\').remove()">Close</button></div>'
      + '<form onsubmit="rgaSaveAccountingGroup(event)">'
      + '<input type="hidden" name="id" value="' + esc(custom?.id || '') + '">'
      + '<input type="hidden" name="parentId" value="' + esc(parentId || custom?.parentId || '') + '">'
      + '<input type="hidden" name="parentName" value="' + esc(parentName) + '">'
      + '<input type="hidden" name="groupType" value="' + esc(grpType) + '">'
      + '<div class="rco-grid-2">'
      + '<label class="rco-field wide"><span>Group Name *</span><input name="name" required placeholder="Enter Group Name" value="' + esc(custom?.name || '') + '"></label>'
      + '<label class="rco-field wide"><span>Group Type</span><select disabled>' + opts(['ASSET','EQUITY','LIABILITY','EXPENSE','INCOME'], grpType) + '</select></label>'
      + '</div><div class="retail-modal-actions"><button type="button" onclick="document.getElementById(\'rgaGroupModal\').remove()">Cancel</button><button type="submit" class="primary">Save</button></div></form></section></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  window.rgaSaveAccountingGroup = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(); if (!name) return say('Group Name is required.');
    saveDoc('retail-ledger-group', { id: f.id.value || undefined, name, parentId: f.parentId.value, parentName: f.parentName.value, groupType: f.groupType.value });
    document.getElementById('rgaGroupModal')?.remove();
    say('Accounting group saved.'); render();
  };

  function rgaAccountingGroupsView() {
    const { tree, flat } = window.rgaAllAccountingGroups();
    const q = rgaState.grpSearch.trim().toLowerCase();
    let html = '<div class="rco-toolbar"><div class="rco-toolbar-left"><h3>Ledger Groups :: Hierarchy</h3><input class="rco-search" placeholder="Search By Group Name..." value="' + esc(rgaState.grpSearch) + '" oninput="rgaState.grpSearch=this.value;render()"></div>'
      + '<div class="rco-toolbar-right"><button type="button" class="' + (rgaState.grpViewMode === 'group' ? 'primary' : '') + '" onclick="rgaState.grpViewMode=\'group\';render()">Group-wise</button><button type="button" class="' + (rgaState.grpViewMode === 'list' ? 'primary' : '') + '" onclick="rgaState.grpViewMode=\'list\';render()">List-wise</button>'
      + (rgaState.grpViewMode === 'group' ? '<button type="button" onclick="rgaToggleAllAcctExpand()">' + (rgaState.grpExpanded.size ? 'Collapse All' : 'Expand All') + '</button>' : '')
      + '</div></div>';

    if (rgaState.grpViewMode === 'list') {
      const rows = flat.filter(g => !q || g.name.toLowerCase().includes(q) || g.parentName.toLowerCase().includes(q));
      html += table(['Group Name','Parent Group','Type','Origin','Action'], rows.map(g => [
        '<b>' + esc(g.name) + '</b>', esc(g.parentName || 'Primary Group'),
        '<span class="rco-badge rco-badge-open">' + esc(g.type) + '</span>',
        g.system ? 'System' : 'Custom',
        !g.parentId ? '<button type="button" onclick="rgaOpenGroupModal(\'' + esc(g.id) + '\')">＋ Sub-Group</button>' : (!g.system ? '<button type="button" onclick="rgaOpenGroupModal(\'' + esc(g.parentId) + '\',\'' + esc(g.id) + '\')">Edit</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-ledger-group\',\'' + esc(g.id) + '\')}">Delete</button>' : '—')
      ]));
    } else {
      let body = '';
      tree.forEach(p => {
        const matchP = !q || p.name.toLowerCase().includes(q) || p.children.some(c => c.name.toLowerCase().includes(q));
        if (!matchP) return;
        const exp = q ? true : rgaState.grpExpanded.has(p.id);
        body += '<tr>'
          + '<td><button type="button" onclick="rgaToggleAcct(\'' + esc(p.id) + '\')">' + (p.children.length ? (exp ? '−' : '+') : '·') + '</button> <b>' + esc(p.name) + '</b> <small class="muted">(' + (p.children.length) + ')</small></td>'
          + '<td><span class="rco-badge rco-badge-open">' + esc(p.type) + '</span></td>'
          + '<td><button type="button" onclick="rgaOpenGroupModal(\'' + esc(p.id) + '\')" title="Add Sub-Group">＋ Add Sub-Group</button></td>'
          + '</tr>';
        if (exp) {
          p.children.forEach(c => {
            if (q && !c.name.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return;
            body += '<tr style="background:var(--paper,#faf8f4)">'
              + '<td style="padding-left:34px">↳ ' + esc(c.name) + '</td>'
              + '<td><span class="pill">' + esc(c.type) + '</span></td>'
              + '<td>' + (c.system ? '<span class="muted">System</span>' : '<button type="button" onclick="rgaOpenGroupModal(\'' + esc(p.id) + '\',\'' + esc(c.id) + '\')">Edit</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete sub-group?\')){rgaDel(\'retail-ledger-group\',\'' + esc(c.id) + '\')}">Delete</button>') + '</td>'
              + '</tr>';
          });
        }
      });
      html += '<div class="table"><table><thead><tr><th>Groups</th><th>Type</th><th>Action</th></tr></thead><tbody>' + body + '</tbody></table></div>';
    }
    return html;
  }
  window.rgaToggleAcct = (id) => { if (rgaState.grpExpanded.has(id)) rgaState.grpExpanded.delete(id); else rgaState.grpExpanded.add(id); render(); };
  window.rgaToggleAllAcctExpand = () => { if (rgaState.grpExpanded.size) rgaState.grpExpanded.clear(); else RGA_PRIMARY_GROUPS.forEach(p => rgaState.grpExpanded.add(p.id)); render(); };

  // ======================== 2. PRODUCT GROUPS ========================
  window.rgaSaveProductGroup = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(); if (!name) return say('Group Name is required.');
    const isParent = !!f.isParent.checked;
    const parentId = isParent ? '' : f.parentId.value;
    if (!isParent && !parentId) return say('Select a Parent Group when Is Parent is unchecked.');
    const parentObj = parentId ? docs('retail-product-group').find(g => g.id === parentId) : null;
    saveDoc('retail-product-group', {
      id: rgaState.pgEditId || undefined,
      name, isParent, parentId, parentName: parentObj?.name || '',
      ornamentType: f.ornamentType.value, baseGroup: f.baseGroup.value.trim(),
      sizes: f.sizes.value.trim(), description: f.description.value.trim(),
      isEcommerce: !!f.isEcommerce.checked
    });
    rgaState.pgShowForm = false; rgaState.pgEditId = '';
    say('Product Group saved.'); render();
  };

  function rgaProductGroupsView() {
    const all = docs('retail-product-group');
    const prods = docs('retail-product');
    const prodCount = (gName) => prods.filter(p => String(p.group || '').toLowerCase() === String(gName || '').toLowerCase()).length;

    if (rgaState.pgViewId) {
      const g = all.find(x => x.id === rgaState.pgViewId);
      if (!g) rgaState.pgViewId = '';
      else {
        const children = all.filter(c => c.parentId === g.id);
        const linkedProds = prods.filter(p => String(p.group || '').toLowerCase() === g.name.toLowerCase());
        return '<div class="rco-toolbar"><h3>Product Group · ' + esc(g.name) + '</h3><div class="rco-toolbar-right"><button type="button" onclick="rgaState.pgEditId=\'' + esc(g.id) + '\';rgaState.pgShowForm=true;rgaState.pgViewId=\'\';render()">Edit</button><button type="button" onclick="rgaState.pgViewId=\'\';render()">← Back</button></div></div>'
          + '<div class="rco-tabs">' + ['Details','Child Groups (' + children.length + ')','Products (' + linkedProds.length + ')','History'].map((t, i) => { const k = ['Details','Child','Products','History'][i]; return '<button type="button" class="' + (rgaState.pgViewTab === k ? 'active' : '') + '" onclick="rgaState.pgViewTab=\'' + k + '\';render()">' + esc(t) + '</button>'; }).join('') + '</div>'
          + (rgaState.pgViewTab === 'Details'
            ? '<div class="rco-section-card"><p><b>Group Name:</b> ' + esc(g.name) + '</p><p><b>Is Parent:</b> ' + (g.isParent !== false ? 'Yes' : 'No') + '</p><p><b>Parent Group:</b> ' + esc(g.parentName || '—') + '</p><p><b>Ornament Type:</b> ' + esc(g.ornamentType || 'None') + '</p><p><b>Base Group:</b> ' + esc(g.baseGroup || '—') + '</p><p><b>Sizes:</b> ' + esc(g.sizes || '—') + '</p><p><b>Ecommerce:</b> ' + (g.isEcommerce ? 'Yes' : 'No') + '</p><p><b>Description:</b> ' + esc(g.description || '—') + '</p></div>'
            : rgaState.pgViewTab === 'Child'
            ? (children.length ? table(['Child Group','Ornament Type','Products','Actions'], children.map(c => ['<b>' + esc(c.name) + '</b>', esc(c.ornamentType || '—'), prodCount(c.name), '<button type="button" onclick="rgaState.pgViewId=\'' + esc(c.id) + '\';render()">View</button>'])) : '<p class="empty">No child product groups.</p>')
            : rgaState.pgViewTab === 'Products'
            ? (linkedProds.length ? table(['Product','Purity','Wastage','Making','Stock Net g'], linkedProds.map(p => ['<b>' + esc(p.name) + '</b>', n(p.purity) + '%', n(p.wastage) + (p.wastageMode === 'grams' ? ' g' : '%'), rateMoney(p.makingRate), fmt(p.openingNet) + ' g'])) : '<p class="empty">No products assigned to this group.</p>')
            : '<div class="rco-section-card"><p><b>Created:</b> ' + esc(g.createdAt || '—') + '</p><p><b>Updated:</b> ' + esc(g.updatedAt || '—') + '</p></div>');
      }
    }

    if (rgaState.pgShowForm) {
      const g = rgaState.pgEditId ? all.find(x => x.id === rgaState.pgEditId) : null;
      const isPar = g ? g.isParent !== false : true;
      const parentOpts = '<option value="">-- Select Parent Group --</option>' + all.filter(x => x.id !== g?.id && x.isParent !== false).map(x => '<option value="' + esc(x.id) + '" ' + (x.id === g?.parentId ? 'selected' : '') + '>' + esc(x.name) + '</option>').join('');
      return '<section class="rco-section-card"><h3>' + (g ? 'Edit Product Group' : 'Create Product Group') + ' <button type="button" onclick="rgaState.pgShowForm=false;rgaState.pgEditId=\'\';render()">← Back</button></h3>'
        + '<form onsubmit="rgaSaveProductGroup(event)"><div class="rco-grid">'
        + '<div class="rco-field wide"><div class="rco-check-row"><label><input name="isParent" type="checkbox" ' + (isPar ? 'checked' : '') + ' onchange="document.getElementById(\'rgaPgParentWrap\').classList.toggle(\'hidden\', this.checked)"> Is Parent Group</label><label><input name="isEcommerce" type="checkbox" ' + (g?.isEcommerce !== false ? 'checked' : '') + '> Is Ecommerce</label></div></div>'
        + '<label id="rgaPgParentWrap" class="rco-field ' + (isPar ? 'hidden' : '') + '"><span>Parent Group *</span><select name="parentId">' + parentOpts + '</select></label>'
        + '<label class="rco-field"><span>Group Name *</span><input name="name" required placeholder="e.g. CHAINS, 12G Chain" value="' + esc(g?.name || '') + '"></label>'
        + '<label class="rco-field"><span>Ornaments Type</span><select name="ornamentType">' + opts(['None','Gold','Silver','Diamond','Alloy','Stone','Platinum','Gift Item'], g?.ornamentType || 'None') + '</select></label>'
        + '<label class="rco-field"><span>Base Group (optional)</span><input name="baseGroup" placeholder="e.g. 92.5 JEWELLERY, ORD" value="' + esc(g?.baseGroup || '') + '"></label>'
        + '<label class="rco-field"><span>Product Sizes</span><input name="sizes" placeholder="e.g. 16 In, 18 In, 20 In" value="' + esc(g?.sizes || '') + '"></label>'
        + '<label class="rco-field wide"><span>Description</span><textarea name="description" rows="2">' + esc(g?.description || '') + '</textarea></label>'
        + '</div><div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Product Group</button></div></form></section>';
    }

    const q = rgaState.pgSearch.trim().toLowerCase();
    const filtered = all.filter(g => {
      if (q && !(g.name || '').toLowerCase().includes(q) && !(g.parentName || '').toLowerCase().includes(q)) return false;
      if (rgaState.pgFilter.parentId && g.parentId !== rgaState.pgFilter.parentId) return false;
      if (rgaState.pgFilter.ornament && g.ornamentType !== rgaState.pgFilter.ornament) return false;
      if (rgaState.pgFilter.isParent === 'Yes' && g.isParent === false) return false;
      if (rgaState.pgFilter.isParent === 'No' && g.isParent !== false) return false;
      return true;
    });

    let content = '';
    if (rgaState.pgViewMode === 'group' && !q && !rgaState.pgFilter.parentId && rgaState.pgFilter.isParent === 'All') {
      const parents = filtered.filter(g => g.isParent !== false);
      let rowsHtml = '';
      parents.forEach(p => {
        const kids = filtered.filter(c => c.parentId === p.id);
        const exp = rgaState.pgExpanded.has(p.id);
        rowsHtml += '<tr><td>' + (kids.length ? '<button type="button" onclick="if(rgaState.pgExpanded.has(\'' + esc(p.id) + '\'))rgaState.pgExpanded.delete(\'' + esc(p.id) + '\');else rgaState.pgExpanded.add(\'' + esc(p.id) + '\');render()">' + (exp ? '−' : '+') + '</button> ' : '') + '<b>' + esc(p.name) + '</b></td><td>—</td><td>' + prodCount(p.name) + '</td><td><span class="rco-badge rco-badge-open">Yes</span></td><td>' + esc(p.ornamentType || '—') + '</td><td>' + (p.isEcommerce ? 'Yes' : 'No') + '</td><td>' + esc(p.description || '—') + '</td><td><button type="button" onclick="rgaState.pgEditId=\'' + esc(p.id) + '\';rgaState.pgShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rgaState.pgViewId=\'' + esc(p.id) + '\';render()">View</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-product-group\',\'' + esc(p.id) + '\')}">Delete</button></td></tr>';
        if (exp) {
          kids.forEach(c => {
            rowsHtml += '<tr style="background:var(--paper,#faf8f4)"><td style="padding-left:32px">↳ <b>' + esc(c.name) + '</b></td><td>' + esc(p.name) + '</td><td>' + prodCount(c.name) + '</td><td><span class="pill">No</span></td><td>' + esc(c.ornamentType || '—') + '</td><td>' + (c.isEcommerce ? 'Yes' : 'No') + '</td><td>' + esc(c.description || '—') + '</td><td><button type="button" onclick="rgaState.pgEditId=\'' + esc(c.id) + '\';rgaState.pgShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rgaState.pgViewId=\'' + esc(c.id) + '\';render()">View</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-product-group\',\'' + esc(c.id) + '\')}">Delete</button></td></tr>';
          });
        }
      });
      content = parents.length ? '<div class="table"><table><thead><tr><th>Group Name</th><th>Parent Group</th><th>Products</th><th>Parent</th><th>Ornament Type</th><th>Ecommerce</th><th>Description</th><th>Actions</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' : '<p class="empty">No product groups yet. Click ＋ Create Product Group.</p>';
    } else {
      content = filtered.length ? table(['Group Name','Parent Group','Products','Parent','Ornament Type','Ecommerce','Description','Actions'], filtered.map(g => ['<b>' + esc(g.name) + '</b>', esc(g.parentName || '—'), prodCount(g.name), g.isParent !== false ? 'Yes' : 'No', esc(g.ornamentType || '—'), g.isEcommerce ? 'Yes' : 'No', esc(g.description || '—'), '<button type="button" onclick="rgaState.pgEditId=\'' + esc(g.id) + '\';rgaState.pgShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rgaState.pgViewId=\'' + esc(g.id) + '\';render()">View</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-product-group\',\'' + esc(g.id) + '\')}">Delete</button>'])) : '<p class="empty">No product groups match.</p>';
    }

    return '<div class="rco-toolbar"><div class="rco-toolbar-left"><input class="rco-search" placeholder="Search By Group Name..." value="' + esc(rgaState.pgSearch) + '" oninput="rgaState.pgSearch=this.value;render()"></div>'
      + '<div class="rco-toolbar-right"><button type="button" class="' + (rgaState.pgViewMode === 'group' ? 'primary' : '') + '" onclick="rgaState.pgViewMode=\'group\';render()">Group-wise</button><button type="button" class="' + (rgaState.pgViewMode === 'list' ? 'primary' : '') + '" onclick="rgaState.pgViewMode=\'list\';render()">List-wise</button><button type="button" onclick="rgaState.pgFilterOpen=!rgaState.pgFilterOpen;render()">Filter</button><button type="button" class="primary" onclick="rgaState.pgEditId=\'\';rgaState.pgShowForm=true;render()">＋ Create Product Group</button></div></div>'
      + (rgaState.pgFilterOpen ? '<div class="rco-filter-box"><label class="rco-field"><span>Ornament Type</span><select onchange="rgaState.pgFilter.ornament=this.value;render()">' + opts(['','Gold','Silver','Diamond','Alloy','Stone','Platinum','Gift Item'], rgaState.pgFilter.ornament) + '</select></label><label class="rco-field"><span>Parent</span><select onchange="rgaState.pgFilter.isParent=this.value;render()">' + opts(['All','Yes','No'], rgaState.pgFilter.isParent) + '</select></label></div>' : '')
      + content;
  }

  // ======================== 3. LEDGER :: LISTS, CREATE & STATEMENT ========================
  const postingTabs = ['Journal Entry','Contra Entry','Expenses','Bill Entry'];
  const postingKind = 'retail-account-posting';
  const cashGroup = 'Cash in hand', bankGroup = 'Bank Accounts';
  const billEntryTypes = ['Debit','Credit','Advance'];
  const billEntryStatuses = ['Delivered','Undelivered','Old Gold'];
  const billEntryDirection = value => value === 'Receipt' ? 'Credit' : value === 'Payment' ? 'Debit' : value;
  const transferTypes = ['Bank to Bank','Cash to Cash','Cash Deposit to Bank','Cash Withdrawal from Bank'];
  const retailLedgers = () => docs('retail-ledger');
  const cashBank = rows => rows.filter(l => [cashGroup, bankGroup].includes(l.parentGroup));

  function rgaLedgerCurrentBalance(ledger) {
    let dr = ledger.openingSide === 'DR' ? n(ledger.openingAmount) : 0;
    let cr = ledger.openingSide === 'CR' ? n(ledger.openingAmount) : 0;
    let wtDr = ledger.pureSide === 'DR' ? n(ledger.pureWeight) : 0;
    let wtCr = ledger.pureSide === 'CR' ? n(ledger.pureWeight) : 0;
    for (const v of docs(postingKind)) {
      for (const line of v.lines || []) {
        if (line.ledgerId !== ledger.id) continue;
        if (v.measure === 'Amount') { dr += n(line.debit); cr += n(line.credit); }
        else { wtDr += n(line.debit); wtCr += n(line.credit); }
      }
    }
    const netAmt = dr - cr;
    const netWt = wtDr - wtCr;
    return { dr, cr, netAmt, side: netAmt >= 0 ? 'DR' : 'CR', absAmt: Math.abs(netAmt), netWt, wtSide: netWt >= 0 ? 'DR' : 'CR', absWt: Math.abs(netWt) };
  }

  function rgaLedgerStatementEntries(targetId) {
    const led = retailLedgers().find(x => x.id === targetId);
    if (led) {
      const txRows = [];
      if (n(led.openingAmount) > 0 || n(led.pureWeight) > 0) {
        txRows.push({
          date: led.openingEffectiveDate || 'Opening',
          ref: 'OB',
          type: 'Opening Balance' + (led.openingIsAdvance ? ' (Advance)' : ''),
          particulars: 'Opening Balance brought forward',
          dr: led.openingSide === 'DR' ? n(led.openingAmount) : 0,
          cr: led.openingSide === 'CR' ? n(led.openingAmount) : 0,
          wt: (led.pureSide === 'CR' ? -1 : 1) * n(led.pureWeight)
        });
      }
      for (const v of docs(postingKind)) {
        for (const line of v.lines || []) {
          if (line.ledgerId !== led.id) continue;
          txRows.push({
            date: line.date || v.date || '',
            ref: v.billNumber || v.number || '',
            type: v.voucherType,
            particulars: line.remarks || v.description || v.detail || v.direction || v.voucherType,
            dr: v.measure === 'Amount' ? n(line.debit) : 0,
            cr: v.measure === 'Amount' ? n(line.credit) : 0,
            wt: v.measure !== 'Amount' ? (n(line.debit) - n(line.credit)) : n(v.billWeight || 0)
          });
        }
      }
      txRows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return { name: led.name, group: led.parentGroup, mobile: led.mobile || '', rows: txRows };
    }
    const cust = (db.customers || []).find(c => 'cust:' + c.id === targetId || c.id === targetId);
    if (cust) {
      const txRows = [];
      if (n(cust.opening) !== 0) {
        txRows.push({ date: 'Opening', ref: 'OB', type: 'Opening Balance', particulars: 'Customer opening balance', dr: n(cust.opening) > 0 ? n(cust.opening) : 0, cr: n(cust.opening) < 0 ? Math.abs(n(cust.opening)) : 0, wt: 0 });
      }
      (db.sales || []).filter(s => s.partyId === cust.id && s.accountType === 'customer').forEach(s => {
        txRows.push({ date: String(s.when || '').slice(0, 10), ref: s.documentNo || s.id.slice(0, 8), type: 'Sales Bill', particulars: s.product || 'Jewellery Sale', dr: n(s.amount), cr: 0, wt: n(s.weight) });
        if (n(s.collectedAmount) > 0) {
          txRows.push({ date: String(s.when || '').slice(0, 10), ref: s.documentNo || s.id.slice(0, 8), type: 'Bill Receipt', particulars: 'Collected · ' + (s.collectedMethod || 'Cash'), dr: 0, cr: n(s.collectedAmount), wt: 0 });
        }
      });
      (db.payments || []).filter(p => p.partyId === cust.id && p.accountType === 'customer').forEach(p => {
        txRows.push({ date: String(p.when || p.date || '').slice(0, 10), ref: p.documentNo || p.id.slice(0, 8), type: p.kind || 'Receipt', particulars: [p.method, p.product, p.reference, p.notes].filter(Boolean).join(' · '), dr: 0, cr: n(p.amount), wt: n(p.pureGrams) });
      });
      txRows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return { name: cust.name, group: cust.parentGroup || 'Sundry Debtors', mobile: cust.phone || '', rows: txRows };
    }
    const sup = (db.retailSuppliers || []).find(s => 'sup:' + s.id === targetId || s.id === targetId);
    if (sup) {
      const txRows = [];
      if (n(sup.openingAmount) !== 0 || n(sup.openingGold) !== 0) {
        txRows.push({ date: 'Opening', ref: 'OB', type: 'Opening Balance', particulars: 'Supplier opening', dr: n(sup.openingAmount) < 0 ? Math.abs(n(sup.openingAmount)) : 0, cr: n(sup.openingAmount) > 0 ? n(sup.openingAmount) : 0, wt: n(sup.openingGold) });
      }
      docs('retail-purchase').filter(p => p.supplierId === sup.id).forEach(p => {
        txRows.push({ date: String(p.when || p.date || '').slice(0, 10), ref: p.billNo || p.documentNo || p.id.slice(0, 8), type: 'Purchase', particulars: p.remarks || 'Supplier Purchase', dr: n(p.paidAmount), cr: n(p.netAmount || p.amount), wt: n(p.netWeight || p.grossWeight) });
      });
      txRows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return { name: sup.name, group: sup.parentGroup || 'Sundry Creditors', mobile: sup.phone || '', rows: txRows };
    }
    return null;
  }

  window.rgaPrintLedgerStatement = (targetId) => {
    const st = rgaLedgerStatementEntries(targetId);
    if (!st) return say('Ledger not found.');
    let run = 0;
    const rows = st.rows.map(r => {
      run += (r.dr - r.cr);
      return [r.date, r.ref, r.type, r.particulars, rateMoney(r.dr), rateMoney(r.cr), rateMoney(Math.abs(run)) + ' ' + (run >= 0 ? 'DR' : 'CR')];
    });
    const totDr = st.rows.reduce((s, r) => s + r.dr, 0);
    const totCr = st.rows.reduce((s, r) => s + r.cr, 0);
    pdfPrintModel({
      kind: 'ledger', retail: true, title: 'LEDGER ACCOUNT STATEMENT',
      entityLabel: 'Ledger', entityName: st.name, entityDetails: st.group + (st.mobile ? ' · ' + st.mobile : ''),
      reference: 'Statement', date: new Date().toLocaleDateString('en-IN'),
      heads: ['Date','Voucher / Ref','Type','Particulars','Debit ₹','Credit ₹','Closing Balance'],
      rows,
      totals: [['Total Debit', rateMoney(totDr)], ['Total Credit', rateMoney(totCr)], ['Closing Balance', rateMoney(Math.abs(totDr - totCr)) + ' ' + (totDr >= totCr ? 'DR' : 'CR'), true]]
    }, 'retail', 'classic');
  };

  window.rgaSaveLedger = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(), parentGroup = f.parentGroup.value;
    if (!name || !parentGroup) return say('Ledger Name and Parent Group are required.');
    saveDoc('retail-ledger', {
      id: rgaState.ledEditId || undefined,
      salutation: f.salutation.value, name, printName: f.printName.value.trim() || name,
      parentGroup, team: f.team.value, mobile: f.mobile.value.trim(), landline: f.landline.value.trim(),
      businessType: f.businessType.value, gstRegType: f.gstRegType.value, gst: f.gst.value.trim().toUpperCase(), pan: f.pan.value.trim().toUpperCase(),
      address: f.address.value.trim(), city: f.city.value.trim(), pinCode: f.pinCode.value.trim(), district: f.district.value.trim(), state: f.state.value,
      tcsTds: f.tcsTds.value, ornamentsType: f.ornamentsType.value,
      openingEffectiveDate: f.openingEffectiveDate.value, openingIsAdvance: f.openingIsAdvance.checked,
      openingAmount: n(f.openingAmount.value), openingSide: f.openingSide.value,
      pureWeight: n(f.pureWeight.value), pureSide: f.pureSide.value,
      creditDays: f.creditDays.value, creditLimit: n(f.creditLimit.value), remarks: f.remarks.value.trim(),
      disabled: !!f.disabled?.checked
    });
    rgaState.ledShowForm = false; rgaState.ledEditId = '';
    say('Ledger saved.'); render();
  };

  window.rgaExportLedgers = () => {
    const lines = [['Ledger Name','Print Name','Parent Group','Mobile','GST','Opening Balance','Opening Side','Current Balance','Current Side','Pure Weight g','Status']];
    retailLedgers().forEach(l => {
      const b = rgaLedgerCurrentBalance(l);
      lines.push([l.name, l.printName || l.name, l.parentGroup, l.mobile || '', l.gst || '', n(l.openingAmount).toFixed(2), l.openingSide || 'DR', b.absAmt.toFixed(2), b.side, b.absWt.toFixed(3), l.disabled ? 'Disabled' : 'Active']);
    });
    csvDownload('accounts-ledgers.csv', lines);
  };

  function rgaLedgersView() {
    if (rgaState.ledViewId) {
      const st = rgaLedgerStatementEntries(rgaState.ledViewId);
      if (!st) rgaState.ledViewId = '';
      else {
        let run = 0;
        const totDr = st.rows.reduce((s, r) => s + r.dr, 0);
        const totCr = st.rows.reduce((s, r) => s + r.cr, 0);
        const rows = st.rows.map(r => {
          run += (r.dr - r.cr);
          return [esc(r.date), '<b>' + esc(r.ref) + '</b>', esc(r.type), esc(r.particulars), rateMoney(r.dr), rateMoney(r.cr), r.wt ? fmt(r.wt) + ' g' : '—', '<b>' + rateMoney(Math.abs(run)) + ' ' + (run >= 0 ? 'DR' : 'CR') + '</b>'];
        });
        return '<div class="rco-toolbar"><div class="rco-toolbar-left"><h3>Ledger Statement :: ' + esc(st.name) + ' <small class="muted">(' + esc(st.group) + ')</small></h3></div>'
          + '<div class="rco-toolbar-right"><button type="button" class="primary" onclick="rgaPrintLedgerStatement(\'' + esc(rgaState.ledViewId) + '\')">Print Statement</button><button type="button" onclick="rgaState.ledViewId=\'\';render()">← Back to Ledgers</button></div></div>'
          + '<div class="rga-kpis"><div class="rga-kpi"><small>Total Debit</small><b>' + rateMoney(totDr) + '</b></div><div class="rga-kpi"><small>Total Credit</small><b>' + rateMoney(totCr) + '</b></div><div class="rga-kpi"><small>Closing Balance</small><b>' + rateMoney(Math.abs(totDr - totCr)) + ' ' + (totDr >= totCr ? 'DR' : 'CR') + '</b></div></div>'
          + (rows.length ? table(['Date','Voucher / Ref','Type','Particulars','Debit ₹','Credit ₹','Weight g','Running Balance'], rows) : '<p class="empty">No transactions posted to this ledger yet.</p>');
      }
    }

    const list = retailLedgers();
    if (rgaState.ledShowForm) {
      const l = rgaState.ledEditId ? list.find(x => x.id === rgaState.ledEditId) : null;
      return '<section class="rco-section-card"><div class="rco-toolbar"><h3>' + (l ? 'Ledger :: Edit · ' + esc(l.name) : 'Ledger :: Create') + '</h3><button type="button" onclick="rgaState.ledShowForm=false;rgaState.ledEditId=\'\';render()">← Back to Lists</button></div>'
        + '<form onsubmit="rgaSaveLedger(event)"><div class="rco-grid">'
        + '<label class="rco-field"><span>Parent Group *</span><select name="parentGroup" required>' + window.rgaAccountingGroupOptions(l?.parentGroup || '') + '</select></label>'
        + '<label class="rco-field"><span>Salutation</span><select name="salutation">' + opts(['','MR.','MRS.','Ms','M/S'], l?.salutation || '') + '</select></label>'
        + '<label class="rco-field"><span>Ledger Name *</span><input name="name" required value="' + esc(l?.name || '') + '"></label>'
        + '<label class="rco-field"><span>Print Name</span><input name="printName" value="' + esc(l?.printName || '') + '"></label>'
        + '<label class="rco-field"><span>Team</span><select name="team">' + opts(['','AK','Arjeeth','SSJ','SSN','VKL'], l?.team || '') + '</select></label>'
        + '<label class="rco-field"><span>Mobile</span><input name="mobile" type="tel" value="' + esc(l?.mobile || '') + '"></label>'
        + '<label class="rco-field"><span>Landline</span><input name="landline" value="' + esc(l?.landline || '') + '"></label>'
        + '<label class="rco-field"><span>Business Type</span><select name="businessType">' + opts(['','LARGE','MEDIUM','SMALL'], l?.businessType || '') + '</select></label>'
        + '<label class="rco-field"><span>GST Reg Type</span><select name="gstRegType">' + opts(['Un Registered','Regular','Composition'], l?.gstRegType || 'Un Registered') + '</select></label>'
        + '<label class="rco-field"><span>GST No</span><input name="gst" maxlength="15" value="' + esc(l?.gst || '') + '"></label>'
        + '<label class="rco-field"><span>PAN Number</span><input name="pan" maxlength="10" value="' + esc(l?.pan || '') + '"></label>'
        + '<label class="rco-field"><span>TCS / TDS</span><select name="tcsTds">' + opts(['','TCS @ 0.01%','TDS @ 1%','TDS @ 2%'], l?.tcsTds || '') + '</select></label>'
        + '<label class="rco-field"><span>Ornaments Type</span><select name="ornamentsType">' + opts(['None','GOLD','SILVER','DIAMOND'], l?.ornamentsType || 'None') + '</select></label>'
        + '<label class="rco-field"><span>Opening effective date</span><input type="date" name="openingEffectiveDate" value="' + esc(l?.openingEffectiveDate || '') + '"></label>'
        + '<label class="rco-field"><span>Opening balance is an advance</span><input type="checkbox" name="openingIsAdvance" ' + (l?.openingIsAdvance ? 'checked' : '') + '></label>'
        + '<label class="rco-field"><span>Opening Balance (₹)</span><input name="openingAmount" type="number" step=".01" value="' + (l?.openingAmount || 0) + '"></label>'
        + '<label class="rco-field"><span>Balance Type</span><select name="openingSide">' + opts(['DR','CR'], l?.openingSide || 'DR') + '</select></label>'
        + '<label class="rco-field"><span>Pure Weight (g)</span><input name="pureWeight" type="number" step=".001" value="' + (l?.pureWeight || 0) + '"></label>'
        + '<label class="rco-field"><span>Pure Side</span><select name="pureSide">' + opts(['DR','CR'], l?.pureSide || 'DR') + '</select></label>'
        + '<label class="rco-field"><span>Address</span><input name="address" value="' + esc(l?.address || '') + '"></label>'
        + '<label class="rco-field"><span>City</span><input name="city" value="' + esc(l?.city || '') + '"></label>'
        + '<label class="rco-field"><span>Pin Code</span><input name="pinCode" value="' + esc(l?.pinCode || '') + '"></label>'
        + '<label class="rco-field"><span>District</span><input name="district" value="' + esc(l?.district || '') + '"></label>'
        + '<label class="rco-field"><span>State</span><input name="state" value="' + esc(l?.state || 'TAMIL NADU') + '"></label>'
        + '<label class="rco-field"><span>Credit Days</span><input name="creditDays" type="number" value="' + esc(l?.creditDays || '') + '"></label>'
        + '<label class="rco-field"><span>Credit Limit ₹</span><input name="creditLimit" type="number" step=".01" value="' + (l?.creditLimit || 0) + '"></label>'
        + '<label class="rco-field wide"><span>Remarks</span><textarea name="remarks" rows="2">' + esc(l?.remarks || '') + '</textarea></label>'
        + '<div class="rco-field wide"><label><input name="disabled" type="checkbox" ' + (l?.disabled ? 'checked' : '') + '> Disable Ledger</label></div>'
        + '</div><div class="right" style="margin-top:12px"><button type="button" onclick="rgaState.ledShowForm=false;rgaState.ledEditId=\'\';render()">Cancel</button> <button type="submit" class="primary">Save Ledger</button></div></form></section>';
    }

    const q = rgaState.ledSearch.trim().toLowerCase();
    const combinedRows = [];
    list.forEach(l => {
      const b = rgaLedgerCurrentBalance(l);
      if (!rgaState.ledShowDisabled && l.disabled) return;
      if (!rgaState.ledShowZero && b.absAmt === 0 && b.absWt === 0 && n(l.openingAmount) === 0) return;
      if (rgaState.ledFilterGroup && l.parentGroup !== rgaState.ledFilterGroup) return;
      if (q && !(l.name.toLowerCase().includes(q) || (l.parentGroup || '').toLowerCase().includes(q) || (l.mobile || '').includes(q) || (l.gst || '').toLowerCase().includes(q))) return;
      combinedRows.push([
        '<b>' + esc(l.name) + '</b>',
        esc(l.printName || l.name),
        '<span class="rco-badge rco-badge-open">' + esc(l.parentGroup) + '</span>',
        esc(l.mobile || '—'),
        rateMoney(l.openingAmount) + ' ' + esc(l.openingSide || 'DR'),
        '<b>' + rateMoney(b.absAmt) + ' ' + b.side + '</b>',
        fmt(b.absWt) + ' g ' + b.wtSide,
        l.disabled ? '<span class="rco-badge rco-badge-cancel">Disabled</span>' : '<span class="rco-badge rco-badge-open">Active</span>',
        '<button type="button" onclick="rgaState.ledViewId=\'' + esc(l.id) + '\';render()">Statement</button> '
        + '<button type="button" onclick="rgaState.ledEditId=\'' + esc(l.id) + '\';rgaState.ledShowForm=true;render()">Edit</button> '
        + '<button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete ledger?\')){rgaDel(\'retail-ledger\',\'' + esc(l.id) + '\')}">Delete</button>'
      ]);
    });

    if (rgaState.ledIncludeParties) {
      (db.customers || []).forEach(c => {
        const grp = c.parentGroup || 'Sundry Debtors';
        const sales = (db.sales || []).filter(s => s.partyId === c.id && s.accountType === 'customer').reduce((a, s) => a + n(s.amount) - n(s.collectedAmount), 0);
        const paid = (db.payments || []).filter(p => p.partyId === c.id && p.accountType === 'customer').reduce((a, p) => a + n(p.amount), 0);
        const balVal = n(c.opening) + sales - paid;
        if (!rgaState.ledShowZero && Math.abs(balVal) < 0.005 && n(c.opening) === 0) return;
        if (rgaState.ledFilterGroup && grp !== rgaState.ledFilterGroup) return;
        if (q && !(String(c.name || '').toLowerCase().includes(q) || grp.toLowerCase().includes(q) || String(c.phone || '').includes(q))) return;
        combinedRows.push([
          '<b>' + esc(c.name) + '</b> <small class="muted">(Customer)</small>',
          esc(c.name),
          '<span class="pill">' + esc(grp) + '</span>',
          esc(c.phone || '—'),
          rateMoney(Math.abs(n(c.opening))) + ' ' + (n(c.opening) >= 0 ? 'DR' : 'CR'),
          '<b>' + rateMoney(Math.abs(balVal)) + ' ' + (balVal >= 0 ? 'DR' : 'CR') + '</b>',
          '—',
          '<span class="rco-badge rco-badge-open">Customer</span>',
          '<button type="button" onclick="rgaState.ledViewId=\'cust:' + esc(c.id) + '\';render()">Statement</button> <button type="button" onclick="go(\'Register\')">Customer</button>'
        ]);
      });
      (db.retailSuppliers || []).forEach(s => {
        const grp = s.parentGroup || 'Sundry Creditors';
        const pur = docs('retail-purchase').filter(p => p.supplierId === s.id).reduce((a, p) => a + n(p.netAmount || p.amount) - n(p.paidAmount), 0);
        const balVal = n(s.openingAmount) + pur;
        const wtVal = n(s.openingGold) + n(s.openingSilver);
        if (!rgaState.ledShowZero && Math.abs(balVal) < 0.005 && wtVal === 0) return;
        if (rgaState.ledFilterGroup && grp !== rgaState.ledFilterGroup) return;
        if (q && !(String(s.name || '').toLowerCase().includes(q) || grp.toLowerCase().includes(q) || String(s.phone || '').includes(q))) return;
        combinedRows.push([
          '<b>' + esc(s.name) + '</b> <small class="muted">(Supplier)</small>',
          esc(s.name),
          '<span class="pill">' + esc(grp) + '</span>',
          esc(s.phone || '—'),
          rateMoney(Math.abs(n(s.openingAmount))) + ' ' + (n(s.openingAmount) >= 0 ? 'CR' : 'DR'),
          '<b>' + rateMoney(Math.abs(balVal)) + ' ' + (balVal >= 0 ? 'CR' : 'DR') + '</b>',
          fmt(wtVal) + ' g',
          '<span class="rco-badge rco-badge-open">Supplier</span>',
          '<button type="button" onclick="rgaState.ledViewId=\'sup:' + esc(s.id) + '\';render()">Statement</button> <button type="button" onclick="go(\'Suppliers\')">Supplier</button>'
        ]);
      });
    }

    const seedBtn = !cashBank(list).length ? '<button type="button" onclick="rgaSeedStandardLedgers()" title="Create Cash in Hand, Bank A/c & Expense Ledgers">⚡ Setup Cash/Bank/Expense Ledgers</button>' : '';
    return '<div class="rco-toolbar"><div class="rco-toolbar-left"><h3>Ledger :: Lists (' + combinedRows.length + ')</h3><input class="rco-search" placeholder="Search Ledger, Mobile, GST or Group..." value="' + esc(rgaState.ledSearch) + '" oninput="rgaState.ledSearch=this.value;render()">'
      + '<select onchange="rgaState.ledFilterGroup=this.value;render()">' + window.rgaAccountingGroupOptions(rgaState.ledFilterGroup) + '</select>'
      + '<button type="button" onclick="rgaState.ledSearch=\'\';rgaState.ledFilterGroup=\'\';render()">Reset</button></div>'
      + '<div class="rco-toolbar-right">' + seedBtn + '<button type="button" onclick="rgaExportLedgers()">Export CSV</button><button type="button" onclick="window.print()">Print</button><button type="button" class="primary" onclick="rgaState.ledEditId=\'\';rgaState.ledShowForm=true;render()">＋ Create</button></div></div>'
      + '<div class="rco-check-row" style="margin-bottom:10px">'
      + '<label><input type="checkbox" ' + (rgaState.ledShowZero ? 'checked' : '') + ' onchange="rgaState.ledShowZero=this.checked;render()"> Inc. 0 Balance</label>'
      + '<label><input type="checkbox" ' + (rgaState.ledShowDisabled ? 'checked' : '') + ' onchange="rgaState.ledShowDisabled=this.checked;render()"> Show Disabled</label>'
      + '<label><input type="checkbox" ' + (rgaState.ledIncludeParties ? 'checked' : '') + ' onchange="rgaState.ledIncludeParties=this.checked;render()"> Include Customers &amp; Suppliers</label>'
      + '</div>'
      + (combinedRows.length ? table(['Ledger Name','Print Name','Parent Group','Mobile','Opening Balance','Current Balance','Pure Weight','Status','Actions'], combinedRows) : '<p class="empty">No matching ledgers. Click <b>＋ Create</b> or <b>⚡ Setup Cash/Bank/Expense Ledgers</b> to add ledgers.</p>');
  }

  // ======================== 4. OPENING BALANCE (INLINE BULK GRID) ========================
  window.rgaSaveSingleOB = function(btn) {
    const tr = btn.closest('tr[data-ob-row]');
    if (!tr) return;
    rgaApplyOBRow(tr);
    save();
    render();
    say('Opening balance saved.');
  };
  window.rgaSaveAllOpeningBalances = function() {
    const trs = [...document.querySelectorAll('tr[data-ob-row]')];
    if (!trs.length) return say('No rows to update.');
    trs.forEach(rgaApplyOBRow);
    save();
    render();
    say('Saved opening balances for ' + trs.length + ' account(s).');
  };
  function rgaApplyOBRow(tr) {
    const kind = tr.dataset.obKind, id = tr.dataset.obId;
    const amt = Math.max(0, n(tr.querySelector('[data-ob-amt]')?.value));
    const side = tr.querySelector('[data-ob-side]')?.value || 'DR';
    const wt = Math.max(0, n(tr.querySelector('[data-ob-wt]')?.value));
    const wtSide = tr.querySelector('[data-ob-wtside]')?.value || 'DR';
    const adv = !!tr.querySelector('[data-ob-adv]')?.checked;
    const effDate = tr.querySelector('[data-ob-date]')?.value || '';
    const orn = tr.querySelector('[data-ob-orn]')?.value || 'None';
    if (kind === 'ledger') {
      const l = retailLedgers().find(x => x.id === id);
      if (l) saveDoc('retail-ledger', Object.assign({}, l, { openingAmount: amt, openingSide: side, pureWeight: wt, pureSide: wtSide, openingIsAdvance: adv, openingEffectiveDate: effDate, ornamentsType: orn }));
    } else if (kind === 'customer') {
      const c = (db.customers || []).find(x => x.id === id);
      if (c) { c.opening = side === 'CR' ? -amt : amt; c.openingEffectiveDate = effDate; c.updatedAt = new Date().toISOString(); }
    } else if (kind === 'supplier') {
      const s = (db.retailSuppliers || []).find(x => x.id === id);
      if (s) { s.openingAmount = side === 'DR' ? -amt : amt; s.openingGold = wtSide === 'DR' ? -wt : wt; s.openingEffectiveDate = effDate; s.updatedAt = new Date().toISOString(); }
    }
  }
  window.rgaExportOpeningBalances = function() {
    const lines = [['Account Type','Ledger Name','Parent Group','Ornaments Type','OB Amount','Amt Cr/Dr','OB Weight g','Wt Cr/Dr','Is Advance','Effective Date']];
    retailLedgers().forEach(l => lines.push(['Ledger', l.name, l.parentGroup, l.ornamentsType || 'None', n(l.openingAmount).toFixed(2), l.openingSide || 'DR', n(l.pureWeight).toFixed(3), l.pureSide || 'DR', l.openingIsAdvance ? 'Yes' : 'No', l.openingEffectiveDate || '']));
    (db.customers || []).forEach(c => lines.push(['Customer', c.name, c.parentGroup || 'Sundry Debtors', 'GOLD', Math.abs(n(c.opening)).toFixed(2), n(c.opening) < 0 ? 'CR' : 'DR', '0.000', 'DR', n(c.opening) < 0 ? 'Yes' : 'No', c.openingEffectiveDate || '']));
    (db.retailSuppliers || []).forEach(s => lines.push(['Supplier', s.name, s.parentGroup || 'Sundry Creditors', 'GOLD', Math.abs(n(s.openingAmount)).toFixed(2), n(s.openingAmount) < 0 ? 'DR' : 'CR', Math.abs(n(s.openingGold)).toFixed(3), n(s.openingGold) < 0 ? 'DR' : 'CR', 'No', s.openingEffectiveDate || '']));
    csvDownload('opening-balances.csv', lines);
  };

  function openingBalancesView() {
    const q = (rgaState.obSearch || '').trim().toLowerCase();
    const grpFilter = rgaState.obFilterGroup || '';
    const scope = rgaState.obScope || 'All';
    const items = [];
    if (scope === 'All' || scope === 'General Ledgers') {
      retailLedgers().forEach(l => items.push({ kind: 'ledger', id: l.id, name: l.name, mobile: l.mobile || '', group: l.parentGroup, orn: l.ornamentsType || 'None', amt: Math.abs(n(l.openingAmount)), side: l.openingSide || 'DR', wt: Math.abs(n(l.pureWeight)), wtSide: l.pureSide || 'DR', adv: !!l.openingIsAdvance, date: l.openingEffectiveDate || '' }));
    }
    if (scope === 'All' || scope === 'Customers') {
      (db.customers || []).forEach(c => items.push({ kind: 'customer', id: c.id, name: c.name, mobile: c.phone || '', group: c.parentGroup || 'Sundry Debtors', orn: 'GOLD', amt: Math.abs(n(c.opening)), side: n(c.opening) < 0 ? 'CR' : 'DR', wt: 0, wtSide: 'DR', adv: n(c.opening) < 0, date: c.openingEffectiveDate || '' }));
    }
    if (scope === 'All' || scope === 'Suppliers') {
      (db.retailSuppliers || []).forEach(s => items.push({ kind: 'supplier', id: s.id, name: s.name, mobile: s.phone || '', group: s.parentGroup || 'Sundry Creditors', orn: 'GOLD', amt: Math.abs(n(s.openingAmount)), side: n(s.openingAmount) < 0 ? 'DR' : 'CR', wt: Math.abs(n(s.openingGold)), wtSide: n(s.openingGold) < 0 ? 'DR' : 'CR', adv: false, date: s.openingEffectiveDate || '' }));
    }
    const filtered = items.filter(it => {
      if (grpFilter && it.group !== grpFilter) return false;
      if (q && !(it.name.toLowerCase().includes(q) || it.group.toLowerCase().includes(q) || it.mobile.includes(q))) return false;
      return true;
    });

    const totDr = filtered.filter(i => i.side === 'DR').reduce((s, i) => s + i.amt, 0);
    const totCr = filtered.filter(i => i.side === 'CR').reduce((s, i) => s + i.amt, 0);

    const rowsHtml = filtered.map(it => '<tr data-ob-row data-ob-kind="' + esc(it.kind) + '" data-ob-id="' + esc(it.id) + '">'
      + '<td><b>' + esc(it.name) + '</b>' + (it.mobile ? '<br><small class="muted">' + esc(it.mobile) + '</small>' : '') + '</td>'
      + '<td><span class="pill">' + esc(it.group) + '</span></td>'
      + '<td><select data-ob-orn class="rga-ob-select" style="width:92px!important" ' + (it.kind !== 'ledger' ? 'disabled' : '') + '>' + opts(['None','GOLD','SILVER','DIAMOND'], it.orn) + '</select></td>'
      + '<td><input type="number" step=".01" min="0" data-ob-amt class="rga-ob-input" value="' + (it.amt || 0) + '"></td>'
      + '<td><select data-ob-side class="rga-ob-select">' + opts(['DR','CR'], it.side) + '</select></td>'
      + '<td><input type="number" step=".001" min="0" data-ob-wt class="rga-ob-input" value="' + (it.wt || 0) + '" ' + (it.kind === 'customer' ? 'disabled' : '') + '></td>'
      + '<td><select data-ob-wtside class="rga-ob-select" ' + (it.kind === 'customer' ? 'disabled' : '') + '>' + opts(['DR','CR'], it.wtSide) + '</select></td>'
      + '<td style="text-align:center"><input type="checkbox" data-ob-adv ' + (it.adv ? 'checked' : '') + '></td>'
      + '<td><input type="date" data-ob-date class="rga-ob-input" style="width:136px!important" value="' + esc(it.date) + '"></td>'
      + '<td><button type="button" onclick="rgaSaveSingleOB(this)">Save</button>' + (it.kind === 'ledger' ? ' <button type="button" onclick="rgaEditOpeningLedger(\'' + esc(it.id) + '\')">Edit</button>' : '') + '</td>'
      + '</tr>').join('');

    return '<div class="rco-toolbar"><div class="rco-toolbar-left"><h3>Ledger :: Opening Balance</h3>'
      + '<input class="rco-search" placeholder="Search by Ledger Name or Mobile..." value="' + esc(rgaState.obSearch) + '" oninput="rgaState.obSearch=this.value;render()">'
      + '<select onchange="rgaState.obFilterGroup=this.value;render()">' + window.rgaAccountingGroupOptions(rgaState.obFilterGroup) + '</select>'
      + '<select onchange="rgaState.obScope=this.value;render()">' + opts(['All','General Ledgers','Customers','Suppliers'], rgaState.obScope) + '</select>'
      + '<button type="button" onclick="rgaState.obSearch=\'\';rgaState.obFilterGroup=\'\';rgaState.obScope=\'All\';render()">Reset</button></div>'
      + '<div class="rco-toolbar-right"><button type="button" onclick="rgaExportOpeningBalances()">Export CSV</button><button type="button" onclick="rgaState.mainTab=\'Ledger\';rgaState.ledEditId=\'\';rgaState.ledShowForm=true;render()">＋ Create Ledger</button><button type="button" class="primary" onclick="rgaSaveAllOpeningBalances()">💾 Save All</button></div></div>'
      + '<div class="rga-kpis"><div class="rga-kpi"><small>Accounts Shown</small><b>' + filtered.length + '</b></div><div class="rga-kpi"><small>Total OB Debit</small><b>' + rateMoney(totDr) + '</b></div><div class="rga-kpi"><small>Total OB Credit</small><b>' + rateMoney(totCr) + '</b></div><div class="rga-kpi"><small>OB Difference</small><b>' + rateMoney(Math.abs(totDr - totCr)) + '</b></div></div>'
      + (filtered.length
        ? '<div class="table"><table><thead><tr><th>Ledger Name</th><th>Parent Group</th><th>Ornaments Type</th><th>OB Amount ₹</th><th>OB Amt Cr/Dr</th><th>OB Weight g</th><th>OB Wt Cr/Dr</th><th>Is Advance</th><th>Effective Date</th><th>Actions</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>'
        : '<p class="empty">No ledgers match. Click <b>＋ Create Ledger</b> to add a ledger.</p>')
      + (window.rcOpeningView ? '<details class="rco-section-card" style="margin-top:14px"><summary style="font-weight:750;cursor:pointer">Opening Cash &amp; Bank Direct Entries</summary>' + rcOpeningView('accounts') + '</details>' : '');
  }
  window.rgaEditOpeningLedger = id => {
    if (typeof rbCanLeave === 'function' && !rbCanLeave()) return;
    rgaState.mainTab = 'Ledger'; rgaState.ledShowForm = true; rgaState.ledEditId = id; render();
  };

  // ======================== 5. VOUCHERS: EXPENSES, JOURNAL, CONTRA & BILL ENTRY ========================
  function postingOptions(rows, value) {
    return '<option value="">Select ledger</option>' + rows.map(l => '<option value="' + esc(l.id) + '" ' + (l.id === value ? 'selected' : '') + '>' + esc(l.name) + ' · ' + esc(l.parentGroup) + '</option>').join('');
  }
  function postingField(label, content) {
    return '<label class="rco-field"><span>' + label + '</span>' + content + '</label>';
  }
  function postingInput(label, name, value, type = 'text', attrs = '') {
    return postingField(label, '<input name="' + name + '" type="' + type + '" value="' + esc(value ?? '') + '" ' + attrs + '>');
  }
  function postingLedger(label, name, rows, value) {
    return postingField(label, '<select name="' + name + '" required>' + postingOptions(rows, value) + '</select>');
  }
  function journalRow(row = {}) {
    const active = retailLedgers().filter(l => !l.disabled || l.id === row.ledgerId);
    return '<div class="rco-grid" data-journal-row oninput="rgaRecalcJournalTotals()">'
      + postingLedger('Ledger *', 'ledgerId', active, row.ledgerId)
      + postingInput('Debit', 'debit', row.debit, 'number', 'min="0" step=".001"')
      + postingInput('Credit', 'credit', row.credit, 'number', 'min="0" step=".001"')
      + postingInput('Remarks', 'lineRemarks', row.remarks)
      + postingField('Is advance', '<input type="checkbox" name="lineAdvance" ' + (row.advance ? 'checked' : '') + '>')
      + '<button type="button" class="rb-delete-btn" onclick="if(document.querySelectorAll(\'[data-journal-row]\').length>2){this.closest(\'[data-journal-row]\').remove();rgaRecalcJournalTotals();}">Remove</button></div>';
  }
  window.rgaAddJournalRow = button => { button.previousElementSibling.insertAdjacentHTML('beforeend', journalRow()); rgaRecalcJournalTotals(); };
  window.rgaRecalcJournalTotals = () => {
    const rows = [...document.querySelectorAll('[data-journal-row]')];
    const dr = rows.reduce((s, r) => s + n(r.querySelector('[name="debit"]')?.value), 0);
    const cr = rows.reduce((s, r) => s + n(r.querySelector('[name="credit"]')?.value), 0);
    const el = document.getElementById('rgaJournalLiveTotals');
    if (el) el.innerHTML = 'Total Debit: <b>' + fmt(dr) + '</b> · Total Credit: <b>' + fmt(cr) + '</b> · Difference: <b style="color:' + (Math.abs(dr - cr) < 0.001 ? '#15803d' : '#b91c1c') + '">' + fmt(Math.abs(dr - cr)) + '</b>';
  };

  function expenseLedgers(rows) {
    const groups = new Set(window.rgaAllAccountingGroups().flat.filter(group => group.type === 'EXPENSE').map(group => group.name));
    return rows.filter(ledger => groups.has(ledger.parentGroup));
  }
  function expenseRow(row = {}, ledgers = expenseLedgers(retailLedgers().filter(ledger => !ledger.disabled))) {
    const expTypes = docs('retail-master-item').filter(m => m.masterCat === 'Expense Types').map(m => m.name);
    return '<div class="rco-grid" data-expense-row>'
      + postingLedger('Expense ledger *', 'expenseLedger', ledgers, row.ledgerId)
      + postingField('Expense type *', '<input name="expenseDetail" list="rgaExpTypesDl" value="' + esc(row.detail ?? '') + '" required placeholder="e.g. Electricity, Tea, Courier"><datalist id="rgaExpTypesDl">' + expTypes.map(t => '<option value="' + esc(t) + '">').join('') + '</datalist>')
      + postingInput('Amount · ₹ *', 'expenseAmount', row.amount, 'number', 'min=".01" step=".01" required')
      + postingInput('Expense date *', 'expenseDate', row.date || rbNow().slice(0, 10), 'date', 'required')
      + '<button type="button" class="rb-delete-btn" onclick="rgaRemoveExpenseRow(this)">Remove</button></div>';
  }
  window.rgaAddExpenseRow = button => button.previousElementSibling.insertAdjacentHTML('beforeend', expenseRow());
  window.rgaRemoveExpenseRow = button => {
    const row = button.closest('[data-expense-row]');
    if (row.parentElement.children.length > 1) row.remove();
  };

  window.rgaEditPosting = id => {
    if (typeof rbCanLeave === 'function' && !rbCanLeave()) return;
    rgaState.postingEditId = id;
    rgaState.postingShowForm = !!id;
    render();
  };
  window.rgaDeletePosting = id => {
    const row = docs(postingKind).find(r => r.id === id);
    if (!row) return;
    if (!confirm('Delete ' + row.voucherType + ' ' + (row.billNumber || row.number || '') + '?')) return;
    delDoc(postingKind, id);
    if (rgaState.postingEditId === id) { rgaState.postingEditId = ''; rgaState.postingShowForm = false; }
    render();
    say(row.voucherType + ' deleted.');
  };
  window.rgaPrintPosting = id => {
    const row = docs(postingKind).find(r => r.id === id);
    if (!row) return;
    const ledMap = new Map(retailLedgers().map(l => [l.id, l.name]));
    const lines = (row.lines || []).map(l => [
      ledMap.get(l.ledgerId) || 'Ledger',
      l.remarks || row.description || row.detail || '—',
      row.measure === 'Amount' ? rateMoney(l.debit) : fmt(l.debit) + ' g',
      row.measure === 'Amount' ? rateMoney(l.credit) : fmt(l.credit) + ' g'
    ]);
    pdfPrintModel({
      kind: 'ledger', retail: true, title: (row.voucherType || 'ACCOUNTING VOUCHER').toUpperCase(),
      entityLabel: 'Voucher No', entityName: row.billNumber || row.number,
      entityDetails: [row.direction, row.paymentMode, row.attendedBy ? 'Attended: ' + row.attendedBy : '', row.billStatus ? 'Status: ' + row.billStatus : ''].filter(Boolean).join(' · '),
      reference: row.number, date: row.date,
      heads: ['Ledger Account','Narration / Detail','Debit','Credit'],
      rows: lines,
      totals: [['Total', row.measure === 'Amount' ? rateMoney(row.total) : fmt(row.total) + ' g', true]]
    }, 'retail', 'classic');
  };
  window.rgaExportPostings = tab => {
    const ledMap = new Map(retailLedgers().map(l => [l.id, l.name]));
    const rows = docs(postingKind).filter(r => r.voucherType === tab);
    const csv = [['Date','Voucher No','Type / Mode','Primary Ledger','Counter Ledger','Amount / Weight','Reference / Description']];
    rows.forEach(r => csv.push([r.date, r.billNumber || r.number, r.direction || r.paymentMode || r.measure || '', ledMap.get(r.destination) || '', ledMap.get(r.source) || '', r.total, r.description || (r.expenseItems || []).map(x => x.detail).join('; ')]));
    csvDownload(tab.toLowerCase().replace(/\s+/g, '-') + '.csv', csv);
  };

  function postingView(tab) {
    const allRows = docs(postingKind).filter(row => row.voucherType === tab).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const ledgers = retailLedgers();
    const ledMap = new Map(ledgers.map(l => [l.id, l.name]));
    const active = ledgers.filter(l => !l.disabled);
    const cash = cashBank(active);
    const expenses = expenseLedgers(active);
    const needSeedBanner = (!cash.length || (tab === 'Expenses' && !expenses.length))
      ? '<div class="rco-section-card" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><span><b>Quick Setup:</b> Standard Cash, Bank &amp; Expense ledgers help you record vouchers immediately.</span><button type="button" class="primary" onclick="rgaSeedStandardLedgers()">⚡ Create Standard Cash, Bank &amp; Expense Ledgers</button></div>'
      : '';

    if (rgaState.postingShowForm || rgaState.postingEditId) {
      const entry = allRows.find(row => row.id === rgaState.postingEditId) || {};
      const activeForEdit = ledgers.filter(l => !l.disabled || entry.lines?.some(row => row.ledgerId === l.id));
      const cashEdit = cashBank(activeForEdit);
      const expEdit = expenseLedgers(activeForEdit);
      const number = postingInput('Entry number', 'number', entry.number, 'text', 'maxlength="50" placeholder="Automatic"');
      let fields = '';
      if (tab === 'Journal Entry') {
        fields = postingField('Measure', '<select name="measure">' + opts(['Amount','Gold weight','Silver weight'], entry.measure || 'Amount') + '</select>')
          + '<div style="grid-column:1/-1" data-journal-lines>' + (entry.lines || [{}, {}]).map(journalRow).join('') + '</div>'
          + '<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><button type="button" onclick="rgaAddJournalRow(this)">＋ Add ledger row</button><span id="rgaJournalLiveTotals" class="muted">Enter matching Debit &amp; Credit rows</span></div>';
      } else if (tab === 'Expenses') {
        const expenseItems = entry.expenseItems || (entry.id ? [{ ledgerId: entry.destination, detail: entry.detail, amount: entry.amount, date: entry.date }] : [{}]);
        fields = '<div style="grid-column:1/-1" data-expense-lines>' + expenseItems.map(row => expenseRow(row, expEdit)).join('') + '</div>'
          + '<div style="grid-column:1/-1"><button type="button" onclick="rgaAddExpenseRow(this)">＋ Add expense line</button></div>'
          + postingLedger('Paid from (Cash / Bank) *', 'source', cashEdit, entry.source)
          + postingField('Payment mode', '<select name="paymentMode">' + opts(['Cash','Bank transfer','Cheque','UPI','Card'], entry.paymentMode || 'Cash') + '</select>');
      } else {
        const types = tab === 'Contra Entry' ? transferTypes : tab === 'Bill Entry' ? billEntryTypes : ['Expense'];
        fields = postingField('Transaction type', '<select name="direction">' + opts(types, billEntryDirection(entry.direction) || types[0]) + '</select>')
          + postingLedger(tab === 'Contra Entry' ? 'Withdraw from (Cr) *' : 'Cash / bank ledger *', 'source', cashEdit, entry.source)
          + postingLedger(tab === 'Contra Entry' ? 'Deposit to (Dr) *' : 'Billing ledger *', 'destination', tab === 'Contra Entry' ? cashEdit : activeForEdit, entry.destination)
          + postingInput('Amount · ₹ *', 'amount', entry.amount, 'number', 'min=".01" step=".01" required');
        if (tab === 'Bill Entry') {
          fields += postingInput('Due date', 'dueDate', entry.dueDate, 'date')
            + postingInput('Attended by', 'attendedBy', entry.attendedBy)
            + postingInput('Bill number', 'billNumber', entry.billNumber, 'text', 'maxlength="60"')
            + postingField('Bill status', '<select name="billStatus">' + opts(billEntryStatuses, entry.billStatus, 'Select status') + '</select>')
            + postingInput('Weight · g', 'billWeight', entry.billWeight, 'number', 'min="0" step=".001"')
            + postingField('Payment mode', '<select name="paymentMode">' + opts(['Cash','Bank transfer','Cheque','UPI','Card'], entry.paymentMode || 'Cash') + '</select>');
        }
      }
      return needSeedBanner + '<section class="rco-section-card"><div class="rco-toolbar"><h3>' + esc(tab) + ' :: ' + (entry.id ? 'Edit (' + esc(entry.number) + ')' : 'Create') + '</h3>'
        + '<div class="rco-toolbar-right"><button type="button" onclick="rgaState.postingShowForm=false;rgaState.postingEditId=\'\';render()">← Back to Lists</button></div></div>'
        + '<form onsubmit="rgaSavePosting(event)" data-entry-type="' + esc(tab) + '"><div class="rco-grid">'
        + number + postingInput('Date *', 'date', entry.date || rbNow().slice(0, 10), 'date', 'required') + postingInput('Reference / description', 'description', entry.description) + fields
        + '</div><div class="right" style="margin-top:12px"><button type="button" onclick="rgaState.postingShowForm=false;rgaState.postingEditId=\'\';render()">Cancel</button> <button type="submit" class="primary">Save ' + esc(tab) + '</button></div></form></section>';
    }

    // LIST VIEW
    const q = (rgaState.postingSearch || '').trim().toLowerCase();
    const from = rgaState.postingFrom || '', to = rgaState.postingTo || '', subFilter = rgaState.postingFilter || '';
    const rows = allRows.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (subFilter) {
        if (tab === 'Journal Entry' && r.measure !== subFilter) return false;
        if (tab === 'Contra Entry' && r.direction !== subFilter) return false;
        if (tab === 'Bill Entry' && billEntryDirection(r.direction) !== subFilter && r.billStatus !== subFilter) return false;
        if (tab === 'Expenses' && r.paymentMode !== subFilter) return false;
      }
      if (q) {
        const hay = [r.number, r.billNumber, r.description, r.detail, r.attendedBy, ledMap.get(r.source), ledMap.get(r.destination), ...(r.expenseItems || []).map(x => x.detail + ' ' + (ledMap.get(x.ledgerId) || '')), ...(r.lines || []).map(x => (ledMap.get(x.ledgerId) || '') + ' ' + (x.remarks || ''))].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const totalAmt = rows.filter(r => (r.measure || 'Amount') === 'Amount').reduce((s, r) => s + n(r.total), 0);
    const filterOpts = tab === 'Journal Entry' ? ['Amount','Gold weight','Silver weight']
      : tab === 'Contra Entry' ? transferTypes
      : tab === 'Bill Entry' ? [...billEntryTypes, ...billEntryStatuses]
      : ['Cash','Bank transfer','Cheque','UPI','Card'];

    const actionBtns = row => '<button type="button" data-id="' + esc(row.id) + '" onclick="rgaEditPosting(this.dataset.id)">Edit</button> '
      + '<button type="button" onclick="rgaPrintPosting(\'' + esc(row.id) + '\')">Print</button> '
      + '<button type="button" class="rb-delete-btn" onclick="rgaDeletePosting(\'' + esc(row.id) + '\')">Delete</button>';

    let listTable = '<p class="empty">No ' + esc(tab.toLowerCase()) + ' records match. Click <b>＋ Create</b> to add one.</p>';
    if (rows.length) {
      if (tab === 'Expenses') {
        listTable = table(['Expense Date','Voucher No.','Expense Type(s)','Expense Ledger','Paid From','Mode','Amount ₹','Description','Actions'], rows.map(r => {
          const items = r.expenseItems || [];
          const types = items.length ? items.map(x => x.detail).join(', ') : (r.detail || '—');
          const expLeds = items.length ? [...new Set(items.map(x => ledMap.get(x.ledgerId) || '—'))].join(', ') : (ledMap.get(r.destination) || '—');
          return [esc(r.date), '<b>' + esc(r.number) + '</b>', esc(types), esc(expLeds), esc(ledMap.get(r.source) || '—'), esc(r.paymentMode || 'Cash'), '<b>' + rateMoney(r.total) + '</b>', esc(r.description || '—'), actionBtns(r)];
        }));
      } else if (tab === 'Journal Entry') {
        listTable = table(['Date','Entry No.','Measure','Particulars (Dr / Cr)','Total Debit','Total Credit','Description','Actions'], rows.map(r => {
          const parts = (r.lines || []).map(l => (ledMap.get(l.ledgerId) || 'Ledger') + (n(l.debit) > 0 ? ' (Dr)' : ' (Cr)')).join(' · ');
          const valTxt = r.measure === 'Amount' ? rateMoney(r.total) : fmt(r.total) + ' g';
          return [esc(r.date), '<b>' + esc(r.number) + '</b>', esc(r.measure || 'Amount'), esc(parts), '<b>' + valTxt + '</b>', '<b>' + valTxt + '</b>', esc(r.description || '—'), actionBtns(r)];
        }));
      } else if (tab === 'Contra Entry') {
        listTable = table(['Date','Entry No.','Transfer Type','Withdraw From (Cr)','Deposit To (Dr)','Amount ₹','Reference','Actions'], rows.map(r => [
          esc(r.date), '<b>' + esc(r.number) + '</b>', esc(r.direction || 'Transfer'), esc(ledMap.get(r.source) || '—'), esc(ledMap.get(r.destination) || '—'), '<b>' + rateMoney(r.total) + '</b>', esc(r.description || '—'), actionBtns(r)
        ]));
      } else {
        listTable = table(['Bill No.','Date','Billing Ledger','Type','Debit ₹','Credit ₹','Weight g','Attended By','Due Date','Status','Actions'], rows.map(row => {
          const billing = (row.lines || []).find(line => line.ledgerId === row.destination) || {};
          return ['<b>' + esc(row.billNumber || row.number) + '</b>', esc(row.date), esc(ledMap.get(row.destination) || '—'), esc(billEntryDirection(row.direction)),
            rateMoney(n(billing.debit)), rateMoney(n(billing.credit)), row.billWeight ? fmt(row.billWeight) + ' g' : '—',
            esc(row.attendedBy || '—'), esc(row.dueDate || '—'), esc(row.billStatus || '—'), actionBtns(row)];
        }));
      }
    }

    return needSeedBanner
      + '<div class="rco-toolbar"><div class="rco-toolbar-left"><h3>' + esc(tab === 'Expenses' ? 'Expense' : tab) + ' :: Lists (' + rows.length + ')</h3>'
      + '<input class="rco-search" placeholder="Search voucher, ledger, remarks..." value="' + esc(rgaState.postingSearch) + '" onchange="rgaState.postingSearch=this.value;render()">'
      + '<input type="date" value="' + esc(from) + '" onchange="rgaState.postingFrom=this.value;render()" title="From date">'
      + '<input type="date" value="' + esc(to) + '" onchange="rgaState.postingTo=this.value;render()" title="To date">'
      + '<select onchange="rgaState.postingFilter=this.value;render()">' + opts(filterOpts, subFilter, 'All Types') + '</select>'
      + '<button type="button" onclick="rgaState.postingSearch=rgaState.postingFrom=rgaState.postingTo=rgaState.postingFilter=\'\';render()">Reset</button></div>'
      + '<div class="rco-toolbar-right"><button type="button" onclick="rgaExportPostings(\'' + esc(tab) + '\')">Export CSV</button><button type="button" onclick="window.print()">Print</button><button type="button" class="primary" onclick="rgaState.postingEditId=\'\';rgaState.postingShowForm=true;render()">＋ Create</button></div></div>'
      + '<div class="rga-kpis"><div class="rga-kpi"><small>Entries</small><b>' + rows.length + '</b></div><div class="rga-kpi"><small>Total Value</small><b>' + rateMoney(totalAmt) + '</b></div></div>'
      + listTable;
  }

  window.rgaSavePosting = function(event) {
    event.preventDefault();
    if (!session || !goldleafContext?.has_access || workspaceMode !== 'retail') return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const voucherType = form.dataset.entryType;
    if (!postingTabs.includes(voucherType)) return;
    const v = Object.fromEntries(new FormData(form)), measure = voucherType === 'Journal Entry' ? v.measure : 'Amount';
    if (!['Amount','Gold weight','Silver weight'].includes(measure)) return;
    const scale = measure === 'Amount' ? 100 : 1000;
    const unit = x => Math.round(n(x) * scale);
    const ledgers = retailLedgers(), byId = id => ledgers.find(l => l.id === id);
    let lines = [], expenseItems;
    if (voucherType === 'Journal Entry') {
      lines = [...form.querySelectorAll('[data-journal-row]')].map(row => {
        const field = name => row.querySelector('[name="' + name + '"]');
        return { ledgerId: field('ledgerId').value, debit: unit(field('debit').value), credit: unit(field('credit').value), remarks: field('lineRemarks').value.trim(), advance: field('lineAdvance').checked };
      });
    } else if (voucherType === 'Expenses') {
      const source = byId(v.source);
      if (!source || !cashBank([source]).length) return say('Choose a cash or bank payment ledger.');
      const allowed = new Set(expenseLedgers(ledgers).map(ledger => ledger.id));
      expenseItems = [...form.querySelectorAll('[data-expense-row]')].map(row => {
        const field = name => row.querySelector('[name="' + name + '"]').value;
        return { ledgerId: field('expenseLedger'), detail: field('expenseDetail').trim(), amount: unit(field('expenseAmount')) / scale, date: field('expenseDate') };
      });
      if (!expenseItems.length || expenseItems.some(row => !allowed.has(row.ledgerId) || row.amount <= 0 || !row.date || !row.detail)) return say('Complete the ledger, type, date and amount on every expense row.');
      lines = expenseItems.flatMap(row => [
        { ledgerId: row.ledgerId, debit: unit(row.amount), credit: 0, date: row.date, remarks: row.detail },
        { ledgerId: source.id, debit: 0, credit: unit(row.amount), date: row.date, remarks: row.detail }
      ]);
    } else {
      const source = byId(v.source), destination = byId(v.destination);
      const amount = unit(v.amount);
      if (!source || !destination || source.id === destination.id || amount <= 0) return say('Select two different ledgers and enter a positive amount.');
      if (!cashBank([source]).length) return say('Select a cash or bank ledger.');
      if (voucherType === 'Contra Entry') {
        const sides = [[bankGroup,bankGroup],[cashGroup,cashGroup],[cashGroup,bankGroup],[bankGroup,cashGroup]][transferTypes.indexOf(v.direction)];
        if (!sides || source.parentGroup !== sides[0] || destination.parentGroup !== sides[1]) return say('Choose cash and bank ledgers that match the transfer type.');
      }
      const billDirection = billEntryDirection(v.direction);
      if (voucherType === 'Bill Entry' && (!billEntryTypes.includes(billDirection) || n(v.billWeight) < 0 || v.billStatus && !billEntryStatuses.includes(v.billStatus))) return say('Check transaction type, bill status and weight.');
      const receipt = voucherType === 'Bill Entry' && ['Credit','Advance'].includes(billDirection);
      lines = [{ ledgerId: receipt ? source.id : destination.id, debit: amount, credit: 0 }, { ledgerId: receipt ? destination.id : source.id, debit: 0, credit: amount, advance: voucherType === 'Bill Entry' && billDirection === 'Advance' }];
    }
    const debit = lines.reduce((sum, row) => sum + row.debit, 0), credit = lines.reduce((sum, row) => sum + row.credit, 0);
    if (lines.length < 2 || debit <= 0 || debit !== credit || lines.some(row => !byId(row.ledgerId) || row.debit < 0 || row.credit < 0 || !!row.debit === !!row.credit)) return say('Each row needs one side. Total debits and credits must match.');
    const old = docs(postingKind).find(row => row.id === rgaState.postingEditId && row.voucherType === voucherType);
    if (lines.some(row => byId(row.ledgerId).disabled && !old?.lines?.some(line => line.ledgerId === row.ledgerId))) return say('Choose active ledgers.');
    const now = new Date().toISOString(), id = old?.id || crypto.randomUUID();
    const number = v.number.trim() || 'AC-' + id.slice(0, 8).toUpperCase();
    if (docs(postingKind).some(row => row.id !== id && row.number.toLowerCase() === number.toLowerCase())) return say('That entry number already exists.');
    const saved = {
      id, kind: postingKind, accountType: 'customer', voucherType, measure, total: debit / scale, date: v.date, number,
      source: v.source, destination: v.destination, amount: n(v.amount), direction: voucherType === 'Bill Entry' ? billEntryDirection(v.direction) : v.direction, description: v.description.trim(), detail: v.detail,
      dueDate: v.dueDate, attendedBy: v.attendedBy, paymentMode: v.paymentMode, expenseItems,
      billNumber: v.billNumber?.trim() || '', billStatus: v.billStatus || '', billWeight: n(v.billWeight),
      lines: lines.map(row => ({ ...row, debit: row.debit / scale, credit: row.credit / scale })), createdAt: old?.createdAt || now, updatedAt: now
    };
    if (old) db.retailDocuments[db.retailDocuments.indexOf(old)] = saved;
    else db.retailDocuments.push(saved);
    rgaState.postingEditId = '';
    rgaState.postingShowForm = false;
    let saving;
    try { saving = save(); } catch (error) { saving = Promise.reject(error); }
    render();
    if (typeof rcSaveStatus === 'function') rcSaveStatus(saving, voucherType);
    else Promise.resolve(saving).then(() => say(voucherType + ' saved.')).catch(() => say('Saved on this device. Cloud sync needs attention.'));
  };

  // ======================== 6. CASHBOOK / BANKBOOK / DAYBOOK QUICK BOOKS ========================
  function rgaBooksView() {
    const bTab = rgaState.bookTab || 'Cashbook';
    const from = rgaState.bookFrom || '', to = rgaState.bookTo || '', q = (rgaState.bookSearch || '').trim().toLowerCase();
    const ledMap = new Map(retailLedgers().map(l => [l.id, l]));
    const entries = [];
    const pushTx = (date, ref, voucher, party, mode, dr, cr) => {
      const d = String(date || '').slice(0, 10);
      if (from && d < from) return;
      if (to && d > to) return;
      if (q && ![ref, voucher, party, mode].join(' ').toLowerCase().includes(q)) return;
      entries.push({ date: d, ref, voucher, party, mode, dr: n(dr), cr: n(cr) });
    };

    const isCashMode = m => /cash/i.test(String(m || 'Cash'));
    (db.sales || []).filter(s => s.accountType === 'customer').forEach(s => {
      const cols = s.collections?.length ? s.collections : (n(s.collectedAmount) > 0 ? [{ method: s.collectedMethod || 'Cash', amount: s.collectedAmount }] : []);
      if (bTab === 'DayBook') pushTx(s.when, s.documentNo || s.id.slice(0, 8), 'Sales Bill', accountName(s.partyId, 'customer'), s.collectedMethod || 'Bill', s.amount, s.collectedAmount);
      cols.forEach(c => {
        if (bTab === 'Cashbook' && isCashMode(c.method)) pushTx(s.when, s.documentNo || s.id.slice(0, 8), 'Bill Receipt', accountName(s.partyId, 'customer'), c.method, c.amount, 0);
        if (bTab === 'Bankbook' && !isCashMode(c.method)) pushTx(s.when, s.documentNo || s.id.slice(0, 8), 'Bill Receipt', accountName(s.partyId, 'customer'), c.method, c.amount, 0);
      });
    });
    (db.payments || []).filter(p => p.accountType === 'customer' && p.retailKind !== 'metal' && p.retailKind !== 'return').forEach(p => {
      const m = p.method || p.kind || 'Cash';
      if (bTab === 'DayBook' || (bTab === 'Cashbook' && isCashMode(m)) || (bTab === 'Bankbook' && !isCashMode(m))) {
        pushTx(p.when || p.date, p.documentNo || p.id.slice(0, 8), p.kind || 'Receipt', accountName(p.partyId, 'customer'), m, p.amount, 0);
      }
    });
    docs(postingKind).filter(v => (v.measure || 'Amount') === 'Amount').forEach(v => {
      if (bTab === 'DayBook') {
        pushTx(v.date, v.billNumber || v.number, v.voucherType, v.description || v.detail || v.voucherType, v.paymentMode || v.direction || 'Journal', v.total, v.total);
      } else {
        (v.lines || []).forEach(l => {
          const led = ledMap.get(l.ledgerId);
          if (!led) return;
          if ((bTab === 'Cashbook' && led.parentGroup === cashGroup) || (bTab === 'Bankbook' && led.parentGroup === bankGroup)) {
            pushTx(l.date || v.date, v.billNumber || v.number, v.voucherType, led.name + (l.remarks ? ' · ' + l.remarks : ''), v.paymentMode || v.direction || 'Voucher', l.debit, l.credit);
          }
        });
      }
    });

    entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let run = 0;
    const totDr = entries.reduce((s, e) => s + e.dr, 0), totCr = entries.reduce((s, e) => s + e.cr, 0);
    const rows = entries.map(e => {
      run += (e.dr - e.cr);
      return [esc(e.date), '<b>' + esc(e.ref) + '</b>', esc(e.voucher), esc(e.party), esc(e.mode), rateMoney(e.dr), rateMoney(e.cr), '<b>' + rateMoney(Math.abs(run)) + ' ' + (run >= 0 ? 'DR' : 'CR') + '</b>'];
    });

    return '<div class="rco-tabs" style="margin-bottom:10px">'
      + ['Cashbook','Bankbook','DayBook'].map(t => '<button type="button" class="' + (bTab === t ? 'active' : '') + '" onclick="rgaState.bookTab=\'' + t + '\';render()">' + t + '</button>').join('')
      + '<button type="button" onclick="go(\'Reports\');if(window.rarOpen)rarOpen(\'DayBook Report\',\'V2\')">📊 Open Full DayBook (V1–V4 &amp; Abstract)</button>'
      + '</div>'
      + '<div class="rco-toolbar"><div class="rco-toolbar-left"><h3>' + esc(bTab) + '</h3><input class="rco-search" placeholder="Search ref, ledger, mode..." value="' + esc(rgaState.bookSearch) + '" onchange="rgaState.bookSearch=this.value;render()"><input type="date" value="' + esc(from) + '" onchange="rgaState.bookFrom=this.value;render()"><input type="date" value="' + esc(to) + '" onchange="rgaState.bookTo=this.value;render()"><button type="button" onclick="rgaState.bookSearch=rgaState.bookFrom=rgaState.bookTo=\'\';render()">Reset</button></div>'
      + '<div class="rco-toolbar-right"><button type="button" onclick="window.print()">Print</button></div></div>'
      + '<div class="rga-kpis"><div class="rga-kpi"><small>Receipts / Debit</small><b>' + rateMoney(totDr) + '</b></div><div class="rga-kpi"><small>Payments / Credit</small><b>' + rateMoney(totCr) + '</b></div><div class="rga-kpi"><small>Net Closing</small><b>' + rateMoney(Math.abs(totDr - totCr)) + ' ' + (totDr >= totCr ? 'DR' : 'CR') + '</b></div></div>'
      + (rows.length ? table(['Date','Ref / Voucher No','Voucher Type','Particulars / Party','Mode','Receipt / Dr ₹','Payment / Cr ₹','Running Balance'], rows) : '<p class="empty">No ' + esc(bTab.toLowerCase()) + ' transactions in this date range.</p>');
  }

  // ======================== 7. FINANCIAL & GROUP REPORTS ========================
  function rgaComputeAccountLines(asOfDate) {
    const { flat } = window.rgaAllAccountingGroups();
    const grpTypeMap = {};
    flat.forEach(g => grpTypeMap[g.name] = g.type);

    const lines = [];
    const addLine = (ledgerName, parentGroup, debit, credit, grossWt = 0, pureWt = 0) => {
      if (debit === 0 && credit === 0 && grossWt === 0 && pureWt === 0) return;
      lines.push({ ledgerName, parentGroup, groupType: grpTypeMap[parentGroup] || 'ASSET', debit: n(debit), credit: n(credit), grossWt: n(grossWt), pureWt: n(pureWt) });
    };

    const asOf = asOfDate || rbNow().slice(0, 10);
    docs('retail-ledger').filter(l => !l.disabled && (!l.openingEffectiveDate || l.openingEffectiveDate <= asOf)).forEach(l => {
      const amt = n(l.openingAmount);
      addLine(l.name, l.parentGroup, l.openingSide === 'DR' ? amt : 0, l.openingSide === 'CR' ? amt : 0, 0, (l.pureSide === 'CR' ? -1 : 1) * n(l.pureWeight));
    });

    for (const row of docs('retail-shop-opening')) {
      if (row.when > asOf || !['Cash in hand','Bank'].includes(row.category)) continue;
      addLine(row.description, row.category === 'Bank' ? bankGroup : cashGroup, n(row.amount), 0);
    }
    const postingLedgers = retailLedgers();
    docs(postingKind).forEach(row => {
      for (const entry of row.lines || []) {
        if ((entry.date || row.date) > asOf) continue;
        const ledger = postingLedgers.find(item => item.id === entry.ledgerId);
        if (!ledger) continue;
        if (row.measure === 'Amount') addLine(ledger.name, ledger.parentGroup, entry.debit, entry.credit);
      }
    });
    (db.customers || []).forEach(c => {
      const open = n(c.opening);
      const sales = (db.sales || []).filter(s => s.partyId === c.id && s.accountType === 'customer').reduce((a, s) => a + n(s.amount), 0);
      const paid = (db.payments || []).filter(p => p.partyId === c.id && p.accountType === 'customer').reduce((a, p) => a + n(p.amount), 0);
      const bal = open + sales - paid;
      addLine(c.name, c.parentGroup || 'Sundry Debtors', bal > 0 ? bal : 0, bal < 0 ? Math.abs(bal) : 0);
    });
    (db.retailSuppliers || []).forEach(s => {
      const open = n(s.openingAmount);
      const pur = docs('retail-purchase').filter(p => p.supplierId === s.id).reduce((a, p) => a + n(p.netAmount || p.amount), 0);
      const bal = open + pur;
      addLine(s.name, s.parentGroup || 'Sundry Creditors', bal < 0 ? Math.abs(bal) : 0, bal > 0 ? bal : 0, n(s.openingGold) + n(s.openingSilver), n(s.openingGold) + n(s.openingSilver));
    });
    const totalSales = (db.sales || []).filter(s => s.accountType === 'customer').reduce((a, s) => a + n(s.amount), 0);
    if (totalSales > 0) addLine('Retail Jewellery Sales', 'Sales Accounts', 0, totalSales);

    const totalCollected = (db.payments || []).filter(p => p.accountType === 'customer').reduce((a, p) => a + n(p.amount), 0)
      + (db.sales || []).filter(s => s.accountType === 'customer').reduce((a, s) => a + n(s.collectedAmount), 0);
    if (totalCollected > 0) addLine('Retail Cash & Bank Receipts', 'Cash in hand', totalCollected, 0);

    const totalPur = docs('retail-purchase').filter(p => String(p.when || p.date || p.createdAt || '').slice(0, 10) <= asOf).reduce((a, p) => a + n(p.netAmount || p.totalAmount || p.amount), 0)
      + docs('purchase').filter(p => String(p.when || p.date || p.createdAt || '').slice(0, 10) <= asOf).reduce((a, p) => a + n(p.totalAmount || p.netAmount || p.amount), 0);
    if (totalPur > 0) addLine('Retail Jewellery Purchases', 'Purchase Accounts', totalPur, 0);

    return lines;
  }
  window.rgaComputeAccountLines = rgaComputeAccountLines;

  function rgaMetalLines(metal, asOf) {
    const ledgers = retailLedgers(), byId = new Map(ledgers.map(ledger => [ledger.id, ledger]));
    const totals = new Map();
    function add(ledger, debit, credit) {
      const row = totals.get(ledger.id) || { name: ledger.name, group: ledger.parentGroup, debit: 0, credit: 0 };
      row.debit += Math.round(n(debit) * 1000);
      row.credit += Math.round(n(credit) * 1000);
      totals.set(ledger.id, row);
    }
    for (const ledger of ledgers) {
      if (!ledger.pureWeight || String(ledger.ornamentsType).toLowerCase() !== metal.toLowerCase()) continue;
      if (ledger.openingEffectiveDate && ledger.openingEffectiveDate > asOf) continue;
      const weight = Math.abs(n(ledger.pureWeight));
      const credit = (ledger.pureSide === 'CR') !== (n(ledger.pureWeight) < 0);
      add(ledger, credit ? 0 : weight, credit ? weight : 0);
    }
    for (const voucher of docs(postingKind)) {
      if (voucher.measure !== metal + ' weight' || voucher.date > asOf) continue;
      for (const line of voucher.lines || []) {
        const ledger = byId.get(line.ledgerId);
        if (ledger) add(ledger, line.debit, line.credit);
      }
    }
    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  const metalHeads = ['Ledger','Parent group','Debit g','Credit g','Balance g'];
  function rgaMetalReport() {
    const metal = rgaState.metalReportType || 'Gold';
    const asOf = rgaState.metalReportAsOf || rbNow().slice(0, 10);
    const lines = rgaMetalLines(metal, asOf);
    const grams = value => fmt(value / 1000);
    const rows = lines.map(line => [line.name, line.group, grams(line.debit), grams(line.credit), grams(line.debit - line.credit)]);
    const debit = lines.reduce((sum, line) => sum + line.debit, 0), credit = lines.reduce((sum, line) => sum + line.credit, 0);
    return { metal, asOf, rows, total: ['TOTAL','',grams(debit),grams(credit),grams(debit - credit)] };
  }
  function rgaMetalReportView() {
    const report = rgaMetalReport();
    return '<div class="rco-toolbar">'
      + postingField('Metal', '<select onchange="rgaState.metalReportType=this.value;render()">' + opts(['Gold','Silver'], report.metal) + '</select>')
      + postingField('As of', '<input type="date" value="' + esc(report.asOf) + '" onchange="rgaState.metalReportAsOf=this.value;render()">')
      + '<button type="button" onclick="rgaPrintMetalReport()">Print PDF</button></div>'
      + (report.rows.length ? table(metalHeads, [...report.rows.map(row => row.map(esc)), report.total]) : '<p class="muted">No opening weight or journal entries for this metal and date.</p>');
  }
  window.rgaPrintMetalReport = () => {
    const report = rgaMetalReport();
    pdfPrintModel({
      kind: 'ledger', retail: true, title: report.metal + ' Metal Ledger', entityLabel: 'Shop',
      entityName: db.shopName || goldleafContext?.shop_name || 'Goldleaf Jewellery', reference: 'Metal Ledger', date: report.asOf,
      heads: metalHeads, rows: report.rows, totals: [['Debit', report.total[2] + ' g'],['Credit', report.total[3] + ' g'],['Balance', report.total[4] + ' g']]
    }, 'retail', 'classic');
  };

  const looseOpeningTypes = ['Loose gold','Loose silver','Old gold','Old silver'];
  function looseOpeningReport(asOf) {
    const totals = new Map();
    const rows = docs('retail-shop-opening').filter(row => looseOpeningTypes.includes(row.category) && row.when <= asOf).sort((a, b) => a.when.localeCompare(b.when));
    for (const row of rows) {
      const total = totals.get(row.category) || { weight: 0, pure: 0, unknown: 0, value: 0 };
      const weight = Math.round(n(row.weight) * 1000), purity = n(row.purity);
      total.weight += weight;
      if (purity > 0) total.pure += Math.round(weight * purity / 100);
      else total.unknown += weight;
      total.value += Math.round(n(row.amount) * 100);
      totals.set(row.category, total);
    }
    return { rows, totals };
  }
  const looseOpeningHeads = ['Effective date','Category','Item','Weight g','Purity %','Pure g','Opening value ₹'];
  function looseOpeningRows(rows) {
    return rows.map(row => [row.when, row.category, row.description, fmt(n(row.weight)), n(row.purity) > 0 ? String(n(row.purity)) : '—',
      n(row.purity) > 0 ? fmt(n(row.weight) * n(row.purity) / 100) : '—', rateMoney(n(row.amount))]);
  }
  function looseOpeningTotals(totals) {
    return [...totals].flatMap(([type, total]) => [
      [type + ' opening weight', fmt(total.weight / 1000) + ' g'],
      [type + ' known pure weight', fmt(total.pure / 1000) + ' g'],
      ...(total.unknown ? [[type + ' weight without purity', fmt(total.unknown / 1000) + ' g']] : []),
      [type + ' opening value', rateMoney(total.value / 100)]
    ]);
  }
  window.rgaLooseOpeningView = function() {
    if (workspaceMode !== 'retail' || !session || !goldleafContext?.has_access) return '';
    const asOf = rgaState.looseOpeningAsOf || rbNow().slice(0, 10);
    const report = looseOpeningReport(asOf);
    return '<section class="rco-section-card"><div class="rco-toolbar"><h3>Loose metal &amp; old jewel opening stock</h3>'
      + '<label>As of <input type="date" value="' + esc(asOf) + '" onchange="rgaState.looseOpeningAsOf=this.value;render()"></label>'
      + '<button type="button" onclick="rgaPrintLooseOpening()">Print PDF</button></div>'
      + '<p class="muted">Opening weights only. Tagged stock and later metal movements are tracked separately.</p>'
      + (report.rows.length ? table(looseOpeningHeads, looseOpeningRows(report.rows).map(row => row.map(esc)))
        + table(['Category total','Value'], looseOpeningTotals(report.totals).map(row => row.map(esc)))
        : '<p class="muted">No loose metal or old jewel opening stock on this date.</p>') + '</section>';
  };
  window.rgaPrintLooseOpening = function() {
    const asOf = rgaState.looseOpeningAsOf || rbNow().slice(0, 10);
    const report = looseOpeningReport(asOf);
    if (!report.rows.length) return say('No opening stock to print.');
    pdfPrintModel({
      kind: 'ledger', retail: true, title: 'Loose Metal & Old Jewel Opening Stock', entityLabel: 'Shop',
      entityName: db.shopName || goldleafContext?.shop_name || 'Goldleaf Jewellery', reference: 'Retail opening stock', date: asOf,
      heads: looseOpeningHeads, rows: looseOpeningRows(report.rows), totals: looseOpeningTotals(report.totals)
    }, 'retail', 'classic');
  };

  function rgaReportsView() {
    const lines = rgaComputeAccountLines();
    const groupRollup = {};
    lines.forEach(l => {
      if (!groupRollup[l.parentGroup]) groupRollup[l.parentGroup] = { name: l.parentGroup, type: l.groupType, debit: 0, credit: 0, grossWt: 0, pureWt: 0, items: [] };
      groupRollup[l.parentGroup].debit += l.debit;
      groupRollup[l.parentGroup].credit += l.credit;
      groupRollup[l.parentGroup].grossWt += l.grossWt;
      groupRollup[l.parentGroup].pureWt += l.pureWt;
      groupRollup[l.parentGroup].items.push(l);
    });
    const groups = Object.values(groupRollup).sort((a, b) => a.name.localeCompare(b.name));

    let body = '';
    if (rgaState.repTab === 'Trial Balance') {
      let totDr = 0, totCr = 0, rowsHtml = '';
      groups.forEach(g => {
        totDr += g.debit; totCr += g.credit;
        rowsHtml += '<tr style="background:var(--paper,#f6f4ef);font-weight:750"><td>' + esc(g.name) + ' <small class="muted">(' + esc(g.type) + ')</small></td><td style="text-align:right">' + rateMoney(g.debit) + '</td><td style="text-align:right">' + rateMoney(g.credit) + '</td></tr>';
        if (rgaState.repShowDetail) {
          g.items.forEach(it => {
            rowsHtml += '<tr><td style="padding-left:28px">↳ ' + esc(it.ledgerName) + '</td><td style="text-align:right">' + rateMoney(it.debit) + '</td><td style="text-align:right">' + rateMoney(it.credit) + '</td></tr>';
          });
        }
      });
      body = '<div class="rco-toolbar"><label style="display:flex;align-items:center;gap:6px;font-weight:700"><input type="checkbox" ' + (rgaState.repShowDetail ? 'checked' : '') + ' onchange="rgaState.repShowDetail=this.checked;render()"> Show Detail (Expand Ledgers)</label><button type="button" class="primary" onclick="rgaPrintReport(\'TRIAL BALANCE\')">🖨️ Print PDF</button></div>'
        + '<div class="table"><table><thead><tr><th>Particulars (Parent Group / Ledger)</th><th style="text-align:right">Debit ₹</th><th style="text-align:right">Credit ₹</th></tr></thead><tbody>' + rowsHtml
        + '<tr class="gl-history-total"><td>GRAND TOTAL (Diff: ' + rateMoney(Math.abs(totDr - totCr)) + ')</td><td style="text-align:right">' + rateMoney(totDr) + '</td><td style="text-align:right">' + rateMoney(totCr) + '</td></tr></tbody></table></div>';
    } else if (rgaState.repTab === 'Balance Sheet') {
      const liabGroups = groups.filter(g => g.type === 'LIABILITY' || g.type === 'EQUITY');
      const assetGroups = groups.filter(g => g.type === 'ASSET');
      const incTotal = groups.filter(g => g.type === 'INCOME').reduce((s, g) => s + (g.credit - g.debit), 0);
      const expTotal = groups.filter(g => g.type === 'EXPENSE').reduce((s, g) => s + (g.debit - g.credit), 0);
      const netProfit = incTotal - expTotal;
      const totLiab = liabGroups.reduce((s, g) => s + (g.credit - g.debit), 0) + (netProfit > 0 ? netProfit : 0);
      const totAsset = assetGroups.reduce((s, g) => s + (g.debit - g.credit), 0) + (netProfit < 0 ? Math.abs(netProfit) : 0);
      body = '<div class="rco-toolbar"><span>Balance Sheet by Group Type</span><button type="button" class="primary" onclick="rgaPrintReport(\'BALANCE SHEET\')">🖨️ Print PDF</button></div>'
        + '<div class="rco-grid-2">'
        + '<section class="rco-section-card"><h3>Liabilities &amp; Equity</h3>' + table(['Group','Amount ₹'], [...liabGroups.map(g => ['<b>' + esc(g.name) + '</b>', rateMoney(g.credit - g.debit)]), ...(netProfit > 0 ? [['<b>Net Profit</b>', rateMoney(netProfit)]] : []), ['<b>TOTAL LIABILITIES</b>', '<b>' + rateMoney(totLiab) + '</b>']]) + '</section>'
        + '<section class="rco-section-card"><h3>Assets</h3>' + table(['Group','Amount ₹'], [...assetGroups.map(g => ['<b>' + esc(g.name) + '</b>', rateMoney(g.debit - g.credit)]), ...(netProfit < 0 ? [['<b>Net Loss</b>', rateMoney(Math.abs(netProfit))]] : []), ['<b>TOTAL ASSETS</b>', '<b>' + rateMoney(totAsset) + '</b>']]) + '</section>'
        + '</div>';
    } else if (rgaState.repTab === 'Profit & Loss') {
      const expGroups = groups.filter(g => g.type === 'EXPENSE');
      const incGroups = groups.filter(g => g.type === 'INCOME');
      const totExp = expGroups.reduce((s, g) => s + (g.debit - g.credit), 0);
      const totInc = incGroups.reduce((s, g) => s + (g.credit - g.debit), 0);
      const net = totInc - totExp;
      body = '<div class="rco-toolbar"><span>Profit &amp; Loss (Expense vs Income Groups)</span><button type="button" class="primary" onclick="rgaPrintReport(\'PROFIT & LOSS\')">🖨️ Print PDF</button></div>'
        + '<div class="cards" style="margin-bottom:12px"><div class="card"><label>TOTAL INCOME</label><b>' + rateMoney(totInc) + '</b></div><div class="card"><label>TOTAL EXPENSE</label><b>' + rateMoney(totExp) + '</b></div><div class="card"><label>' + (net >= 0 ? 'NET PROFIT' : 'NET LOSS') + '</label><b>' + rateMoney(Math.abs(net)) + '</b></div></div>'
        + '<div class="rco-grid-2">'
        + '<section class="rco-section-card"><h3>Expenses (Dr)</h3>' + table(['Group','Amount ₹'], [...expGroups.map(g => [esc(g.name), rateMoney(g.debit - g.credit)]), ['<b>TOTAL EXPENSE</b>','<b>' + rateMoney(totExp) + '</b>']]) + '</section>'
        + '<section class="rco-section-card"><h3>Income (Cr)</h3>' + table(['Group','Amount ₹'], [...incGroups.map(g => [esc(g.name), rateMoney(g.credit - g.debit)]), ['<b>TOTAL INCOME</b>','<b>' + rateMoney(totInc) + '</b>']]) + '</section>'
        + '</div>';
    } else if (rgaState.repTab === 'Metal Ledger') {
      body = rgaMetalReportView();
    } else if (rgaState.repTab === 'By Ledger Group') {
      const filtered = groups.filter(g => (!rgaState.repPayGroup || g.name === rgaState.repPayGroup));
      let rowsHtml = '';
      filtered.forEach(g => {
        const exp = rgaState.repExpanded.has(g.name);
        rowsHtml += '<tr><td><button type="button" onclick="if(rgaState.repExpanded.has(\'' + esc(g.name) + '\'))rgaState.repExpanded.delete(\'' + esc(g.name) + '\');else rgaState.repExpanded.add(\'' + esc(g.name) + '\');render()">' + (exp ? '−' : '+') + '</button> <b>' + esc(g.name) + '</b> (' + g.items.length + ')</td><td>' + fmt(g.grossWt) + ' g</td><td>' + fmt(g.pureWt) + ' g</td><td><b>' + rateMoney(Math.abs(g.debit - g.credit)) + '</b></td></tr>';
        if (exp) {
          g.items.forEach(it => {
            rowsHtml += '<tr style="background:var(--paper,#faf8f4)"><td style="padding-left:34px">↳ ' + esc(it.ledgerName) + '</td><td>' + fmt(it.grossWt) + ' g</td><td>' + fmt(it.pureWt) + ' g</td><td>' + rateMoney(Math.abs(it.debit - it.credit)) + '</td></tr>';
          });
        }
      });
      body = '<div class="rco-toolbar"><select onchange="rgaState.repPayGroup=this.value;render()">' + window.rgaAccountingGroupOptions(rgaState.repPayGroup) + '</select></div>'
        + '<div class="table"><table><thead><tr><th>Group Name</th><th>Gross Wt</th><th>Pure Wt</th><th>Net Amount ₹</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
    } else if (rgaState.repTab === 'By Product Group') {
      const pGroups = docs('retail-product-group');
      const prods = docs('retail-product');
      const sales = (db.sales || []).filter(s => s.accountType === 'customer');
      const prodStats = (pName) => {
        const p = prods.find(x => x.name.toLowerCase() === String(pName || '').toLowerCase());
        const sRows = sales.filter(s => String(s.product || '').toLowerCase() === String(pName || '').toLowerCase());
        return { stockWt: n(p?.openingNet), salesWt: sRows.reduce((a, s) => a + n(s.weight), 0), salesAmt: sRows.reduce((a, s) => a + n(s.amount), 0), qty: sRows.reduce((a, s) => a + (n(s.pieces) || 1), 0) };
      };
      if (rgaState.repStockGroupBy === 'Product') {
        body = '<div class="rco-toolbar"><div class="rco-toolbar-left"><button type="button" onclick="rgaState.repStockGroupBy=\'Product Group\';render()">Group by: Product Group</button><button type="button" class="primary">Group by: Product</button></div></div>'
          + (prods.length ? table(['Product','Product Group','Stock Net g','Sales Qty','Sales Wt g','Sales Amt ₹'], prods.map(p => { const st = prodStats(p.name); return ['<b>' + esc(p.name) + '</b>', esc(p.group || '—'), fmt(st.stockWt) + ' g', st.qty, fmt(st.salesWt) + ' g', rateMoney(st.salesAmt)]; })) : '<p class="empty">No products yet.</p>');
      } else {
        const parents = pGroups.filter(g => g.isParent !== false);
        let rowsHtml = '';
        parents.forEach(pg => {
          const kids = pGroups.filter(k => k.parentId === pg.id);
          const groupNames = [pg.name, ...kids.map(k => k.name)];
          const linked = prods.filter(p => groupNames.some(gn => gn.toLowerCase() === String(p.group || '').toLowerCase()));
          const agg = linked.reduce((acc, p) => { const st = prodStats(p.name); acc.stockWt += st.stockWt; acc.salesWt += st.salesWt; acc.salesAmt += st.salesAmt; acc.qty += st.qty; return acc; }, { stockWt: 0, salesWt: 0, salesAmt: 0, qty: 0 });
          const exp = rgaState.repStockExpanded.has(pg.id);
          rowsHtml += '<tr><td><button type="button" onclick="if(rgaState.repStockExpanded.has(\'' + esc(pg.id) + '\'))rgaState.repStockExpanded.delete(\'' + esc(pg.id) + '\');else rgaState.repStockExpanded.add(\'' + esc(pg.id) + '\');render()">' + (exp ? '−' : '+') + '</button> <b>' + esc(pg.name) + '</b></td><td>' + kids.length + ' sub-groups · ' + linked.length + ' products</td><td>' + fmt(agg.stockWt) + ' g</td><td>' + agg.qty + '</td><td>' + fmt(agg.salesWt) + ' g</td><td><b>' + rateMoney(agg.salesAmt) + '</b></td></tr>';
          if (exp) {
            linked.forEach(p => { const st = prodStats(p.name); rowsHtml += '<tr style="background:var(--paper,#faf8f4)"><td style="padding-left:34px">↳ ' + esc(p.name) + '</td><td>' + esc(p.group) + '</td><td>' + fmt(st.stockWt) + ' g</td><td>' + st.qty + '</td><td>' + fmt(st.salesWt) + ' g</td><td>' + rateMoney(st.salesAmt) + '</td></tr>'; });
          }
        });
        body = '<div class="rco-toolbar"><div class="rco-toolbar-left"><button type="button" class="primary">Group by: Product Group</button><button type="button" onclick="rgaState.repStockGroupBy=\'Product\';render()">Group by: Product</button></div></div>'
          + (parents.length ? '<div class="table"><table><thead><tr><th>Product Group</th><th>Hierarchy</th><th>Stock Net g</th><th>Sales Qty</th><th>Sales Wt g</th><th>Sales Amt ₹</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' : '<p class="empty">Create Product Groups to view group-wise stock &amp; sales rollups.</p>');
      }
      body += rgaLooseOpeningView();
    }

    return '<div class="rco-tabs">' + ['Trial Balance','Balance Sheet','Profit & Loss','By Ledger Group','By Product Group','Metal Ledger'].map(t => '<button type="button" class="' + (rgaState.repTab === t ? 'active' : '') + '" onclick="rgaState.repTab=\'' + t + '\';render()">' + esc(t) + '</button>').join('') + '</div>' + body;
  }

  window.rgaPrintReport = (title) => {
    const lines = rgaComputeAccountLines();
    pdfPrintModel({
      kind: 'ledger', retail: true, title, entityLabel: 'Shop', entityName: db.shopName || goldleafContext?.shop_name || 'Goldleaf Jewellery',
      reference: rgaState.repTab, date: new Date().toLocaleDateString('en-IN'),
      heads: ['Ledger','Parent Group','Type','Debit ₹','Credit ₹'],
      rows: lines.map(l => [l.ledgerName, l.parentGroup, l.groupType, rateMoney(l.debit), rateMoney(l.credit)]),
      totals: [['Total Debit', rateMoney(lines.reduce((s, l) => s + l.debit, 0))], ['Total Credit', rateMoney(lines.reduce((s, l) => s + l.credit, 0))]]
    }, 'retail', 'classic');
  };

  window.rgaDel = (t, id) => { delDoc(t, id); render(); };

  // ======================== 8. SHOP MASTERS ========================
  const RGA_MASTER_TABS = ['Ornament Purity','Tax Groups','Other Charges','Expense Types','Branches & Counters','Employees & Teams','Lock Dates'];
  window.rgaSaveMasterItem = (e) => {
    e.preventDefault(); const f = e.target;
    const cat = rgaState.masterCat || 'Ornament Purity';
    const name = f.name.value.trim(); if (!name) return say('Name is required.');
    saveDoc('retail-master-item', {
      id: rgaState.masterEditId || undefined,
      masterCat: cat, name,
      code: f.code?.value?.trim() || '',
      metalType: f.metalType?.value || 'Gold',
      valueNum: f.valueNum ? n(f.valueNum.value) : 0,
      extraText: f.extraText?.value?.trim() || '',
      status: f.status?.value || 'Active'
    });
    rgaState.masterEditId = '';
    e.target.reset();
    say(cat + ' saved.'); render();
  };
  function rgaMastersView() {
    const cat = rgaState.masterCat || 'Ornament Purity';
    const items = docs('retail-master-item').filter(x => x.masterCat === cat);
    const ed = rgaState.masterEditId ? items.find(x => x.id === rgaState.masterEditId) : null;
    const tabsHtml = '<div class="rco-tabs" style="margin-bottom:12px">' + RGA_MASTER_TABS.map(t => '<button type="button" class="' + (cat === t ? 'active' : '') + '" onclick="rgaState.masterCat=\'' + t + '\';rgaState.masterEditId=\'\';render()">' + esc(t) + '</button>').join('') + '</div>';
    let fieldsHtml = '';
    if (cat === 'Ornament Purity') {
      fieldsHtml = '<label class="rco-field"><span>Purity Name *</span><input name="name" required placeholder="e.g. 22K 916 Hallmark" value="' + esc(ed?.name || '') + '"></label>'
        + '<label class="rco-field"><span>Metal</span><select name="metalType">' + opts(['Gold','Silver','Platinum','Diamond'], ed?.metalType || 'Gold') + '</select></label>'
        + '<label class="rco-field"><span>Touch / Fineness %</span><input name="valueNum" type="number" step=".01" placeholder="91.60" value="' + esc(ed?.valueNum || 91.6) + '"></label>'
        + '<label class="rco-field"><span>Display Code</span><input name="code" placeholder="916 / 750 / 925" value="' + esc(ed?.code || '') + '"></label>';
    } else if (cat === 'Tax Groups') {
      fieldsHtml = '<label class="rco-field"><span>Tax Group Name *</span><input name="name" required placeholder="e.g. GST 3% Jewellery" value="' + esc(ed?.name || '') + '"></label>'
        + '<label class="rco-field"><span>Total Tax %</span><input name="valueNum" type="number" step=".01" value="' + esc(ed?.valueNum ?? 3) + '"></label>'
        + '<label class="rco-field"><span>Default HSN / SAC</span><input name="code" placeholder="7113 / 7114 / 9988" value="' + esc(ed?.code || '7113') + '"></label>'
        + '<label class="rco-field"><span>Split Note (CGST+SGST)</span><input name="extraText" placeholder="1.5% CGST + 1.5% SGST" value="' + esc(ed?.extraText || '1.5% + 1.5%') + '"></label>';
    } else if (cat === 'Other Charges' || cat === 'Expense Types') {
      fieldsHtml = '<label class="rco-field"><span>' + esc(cat.slice(0, -1)) + ' Name *</span><input name="name" required placeholder="e.g. Hallmark / Cert / EB Bill" value="' + esc(ed?.name || '') + '"></label>'
        + '<label class="rco-field"><span>Default Amount ₹</span><input name="valueNum" type="number" step=".01" value="' + esc(ed?.valueNum || 0) + '"></label>'
        + '<label class="rco-field"><span>Ledger Group</span><input name="extraText" placeholder="Direct / Indirect Expenses" value="' + esc(ed?.extraText || 'Indirect Expenses') + '"></label>'
        + '<label class="rco-field"><span>Code</span><input name="code" placeholder="Optional code" value="' + esc(ed?.code || '') + '"></label>';
    } else if (cat === 'Branches & Counters') {
      fieldsHtml = '<label class="rco-field"><span>Branch / Counter Name *</span><input name="name" required placeholder="e.g. Ground Floor Gold Counter" value="' + esc(ed?.name || '') + '"></label>'
        + '<label class="rco-field"><span>Counter Code</span><input name="code" placeholder="CTR-01" value="' + esc(ed?.code || '') + '"></label>'
        + '<label class="rco-field"><span>City / Location</span><input name="extraText" placeholder="Main Showroom" value="' + esc(ed?.extraText || '') + '"></label>'
        + '<label class="rco-field"><span>Metal Focus</span><select name="metalType">' + opts(['All','Gold','Silver','Diamond','Cash Desk'], ed?.metalType || 'All') + '</select></label>';
    } else if (cat === 'Employees & Teams') {
      fieldsHtml = '<label class="rco-field"><span>Employee / Staff Name *</span><input name="name" required placeholder="e.g. Ravi Kumar" value="' + esc(ed?.name || '') + '"></label>'
        + '<label class="rco-field"><span>Staff Code</span><input name="code" placeholder="EMP-01" value="' + esc(ed?.code || '') + '"></label>'
        + '<label class="rco-field"><span>Role / Counter</span><input name="extraText" placeholder="Sales Executive · Counter 1" value="' + esc(ed?.extraText || '') + '"></label>'
        + '<label class="rco-field"><span>Monthly Target (g)</span><input name="valueNum" type="number" step=".1" value="' + esc(ed?.valueNum || 0) + '"></label>';
    } else {
      fieldsHtml = '<label class="rco-field"><span>Module / Voucher Scope *</span><input name="name" required placeholder="e.g. All Accounting & Sales" value="' + esc(ed?.name || 'All Vouchers') + '"></label>'
        + '<label class="rco-field"><span>Lock Up To Date *</span><input name="code" type="date" required value="' + esc(ed?.code || '') + '"></label>'
        + '<label class="rco-field wide"><span>Reason / Audit Note</span><input name="extraText" placeholder="GST Filed / Monthly Audit Closed" value="' + esc(ed?.extraText || '') + '"></label>';
    }
    const rows = items.map(it => [
      '<b>' + esc(it.name) + '</b>', esc(it.code || '—'), esc(it.metalType || '—'),
      it.valueNum ? esc(it.valueNum) : '—', esc(it.extraText || '—'),
      '<span class="rco-badge rco-badge-open">' + esc(it.status || 'Active') + '</span>',
      '<button type="button" onclick="rgaState.masterEditId=\'' + esc(it.id) + '\';render()">Edit</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete master record?\'))rgaDel(\'retail-master-item\',\'' + esc(it.id) + '\')">Delete</button>'
    ]);
    return tabsHtml
      + '<form onsubmit="rgaSaveMasterItem(event)" class="rco-section-card" style="margin-bottom:14px"><h3>' + (ed ? 'Edit ' : 'Add ') + esc(cat) + '</h3><div class="rco-grid">' + fieldsHtml
      + '<label class="rco-field"><span>Status</span><select name="status">' + opts(['Active','Inactive'], ed?.status || 'Active') + '</select></label></div>'
      + '<div class="right" style="margin-top:10px">' + (ed ? '<button type="button" onclick="rgaState.masterEditId=\'\';render()">Cancel</button> ' : '') + '<button type="submit" class="primary">' + (ed ? 'Update' : '＋ Save') + '</button></div></form>'
      + (rows.length ? table(['Name','Code / Date','Metal','Rate / Value','Details / Group','Status','Actions'], rows) : '<p class="empty">No custom ' + esc(cat) + ' entries yet. Add your first record above.</p>');
  }

  // ======================== 9. UNIFIED ACCOUNTS WORKSPACE & SIDEBAR ========================
  window.rgaParentGroupPage = () => {
    const cur = normalizeTab(rgaState.mainTab);
    rgaState.mainTab = cur;
    let inner = '';
    if (cur === 'Ledger') inner = rgaLedgersView();
    else if (cur === 'Opening Balance') inner = openingBalancesView();
    else if (cur === 'Accounting Groups') inner = rgaAccountingGroupsView();
    else if (postingTabs.includes(cur)) inner = postingView(cur);
    else if (cur === 'Books & DayBook') inner = rgaBooksView();
    else if (cur === 'Product Groups') inner = rgaProductGroupsView();
    else if (cur === 'Shop Masters') inner = rgaMastersView();
    else inner = rgaReportsView();

    const roofHtml = '<div class="rga-roof-bar" role="navigation" aria-label="Accounts module navigation">'
      + RGA_NAV_SECTIONS.map(sec => '<div class="rga-roof-group"><div class="rga-roof-group-title"><span>' + esc(sec.heading) + '</span></div><div class="rga-roof-pills">'
        + sec.items.map(([key, label]) => '<button type="button" class="' + (cur === key ? 'active' : '') + '" onclick="rgaOpen(\'' + esc(key) + '\')">' + esc(label) + '</button>').join('')
        + '</div></div>').join('')
      + '</div>';

    return header('Accounts · ' + (cur === 'Accounting Groups' ? 'Ledger Groups' : cur === 'Accounts & Reports' ? 'Financial Statements' : cur), 'Ledgers, Opening Balance, Expenses, Journal, Contra, Bill Entry & Financial Statements')
      + roofHtml
      + '<section class="panel">' + inner + '</section>';
  };
  window.rgaAccountsPage = window.rgaParentGroupPage;

  function rgaNavigation() {
    const nav = document.getElementById('nav'); if (!nav) return;
    nav.querySelectorAll('[data-rga-sidebar],[data-rga-sub]').forEach(b => b.remove());
    const more = document.getElementById('moreMenu');
    if (more) more.querySelectorAll('[data-rga-nav]').forEach(b => b.remove());
    if (!session || !goldleafContext?.has_access || workspaceMode !== 'retail') return;

    const anchor = nav.querySelector('[data-rco-sidebar="Suppliers"]') || nav.querySelector('[data-rc-sidebar="Products"]') || nav.firstElementChild;
    const activeAccounts = isAccountsPage();
    if (activeAccounts) rgaState.sidebarOpen = true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.rgaSidebar = 'Parent Group';
    btn.setAttribute('aria-label', 'Accounts');
    btn.setAttribute('aria-expanded', String(!!rgaState.sidebarOpen));
    btn.title = 'Accounts';
    btn.classList.toggle('active', activeAccounts);
    if (activeAccounts) btn.setAttribute('aria-current', 'page');
    btn.onclick = () => {
      if (activeAccounts) {
        rgaState.sidebarOpen = !rgaState.sidebarOpen;
        rgaNavigation();
      } else {
        rgaState.sidebarOpen = true;
        window.rgaOpen(rgaState.mainTab || 'Ledger');
      }
    };
    btn.innerHTML = '<span class="nav-icon">' + erpIcon('ledger') + '</span><span class="erp-nav-label" style="display:flex;align-items:center;justify-content:space-between;width:100%"><span>Accounts</span><small style="opacity:.75;font-size:10px">' + (rgaState.sidebarOpen ? '▾' : '▸') + '</small></span>';

    const frag = document.createDocumentFragment();
    frag.append(btn);

    if (rgaState.sidebarOpen) {
      const sub = document.createElement('div');
      sub.className = 'rga-sidebar-sub';
      sub.dataset.rgaSub = '1';
      const cur = normalizeTab(rgaState.mainTab);
      sub.innerHTML = RGA_NAV_SECTIONS.map(sec => '<div class="rga-sidebar-sub-head">' + esc(sec.heading) + '</div>'
        + sec.items.map(([key, label]) => '<button type="button" class="' + (activeAccounts && cur === key ? 'active' : '') + '" onclick="rgaOpen(\'' + esc(key) + '\')"><span>' + esc(label) + '</span></button>').join('')
      ).join('');
      frag.append(sub);
    }

    if (anchor) anchor.after(frag); else nav.append(frag);

    if (more) {
      const mb = document.createElement('button'); mb.type = 'button'; mb.dataset.rgaNav = 'Parent Group';
      mb.textContent = 'Accounts';
      mb.onclick = () => { more.classList.remove('open'); window.rgaOpen('Ledger'); };
      more.append(mb);
    }
    if (typeof erpFilterNavigation === 'function') erpFilterNavigation(window.erpNavQuery || '');
  }

  const rgaPrevRender = window.render;
  window.render = function() {
    const res = rgaPrevRender.apply(this, arguments);
    if (session && typeof goldleafContext !== 'undefined' && goldleafContext?.has_access && workspaceMode === 'retail') {
      if (isAccountsPage()) {
        const appEl = document.getElementById('app');
        if (appEl) appEl.innerHTML = window.rgaParentGroupPage();
      }
      const prodGroupInput = document.querySelector('#app form[onsubmit*="rcSaveProduct"] input[name="group"]');
      if (prodGroupInput && !prodGroupInput.getAttribute('list')) {
        let dl = document.getElementById('rgaProductGroupDatalist');
        if (!dl) { dl = document.createElement('datalist'); dl.id = 'rgaProductGroupDatalist'; document.body.append(dl); }
        dl.innerHTML = docs('retail-product-group').map(g => '<option value="' + esc(g.name) + '">' + (g.parentName ? 'Under ' + esc(g.parentName) : 'Parent Group') + '</option>').join('');
        prodGroupInput.setAttribute('list', 'rgaProductGroupDatalist');
      }
    }
    rgaNavigation();
    return res;
  };
  render();
})();
