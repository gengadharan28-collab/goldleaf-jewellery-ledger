// Retail-only Parent Group (Accounting Groups & Product Groups), Ledgers, and Group-wise / List-wise Accounts & Reports.
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

  window.rgaState = window.rgaState || {
    mainTab: 'Accounting Groups',
    grpSearch: '', grpViewMode: 'group', grpExpanded: new Set(['pg-curr-assets','pg-curr-liab','pg-loans-liab','pg-capital']),
    pgSearch: '', pgViewMode: 'group', pgShowForm: false, pgEditId: '', pgViewId: '', pgViewTab: 'Details', pgFilterOpen: false,
    pgFilter: { parentId:'', ornament:'', isParent:'All', isEcom:'All' }, pgExpanded: new Set(),
    ledSearch: '', ledShowForm: false, ledEditId: '', ledViewId: '', ledFilterGroup: '', ledShowZero: true, ledShowDisabled: false, ledShowOB: true,
    repTab: 'Trial Balance', repShowDetail: false, repExpanded: new Set(['Current Assets','Current Liabilities']),
    repPayGroup: '', repPaySearch: '', repStockGroupBy: 'Product Group', repStockMetal: 'All', repStockZero: false, repStockExpanded: new Set()
  };

  const docs = (t) => (window.rcDocs ? window.rcDocs(t) : (db.retailDocuments||[]).filter(d=>d.type===t));
  const saveDoc = (t, d) => {
    if(window.rcSaveDoc) return window.rcSaveDoc(t, d);
    if(!Array.isArray(db.retailDocuments)) db.retailDocuments=[];
    const now = new Date().toISOString();
    const row = Object.assign({ id: d.id || crypto.randomUUID(), type: t, createdAt: d.createdAt || now, updatedAt: now }, d);
    const i = db.retailDocuments.findIndex(x=>x.id===row.id);
    if(i<0) db.retailDocuments.unshift(row); else db.retailDocuments[i]=row;
    save(); pushCloud(); return row;
  };
  const delDoc = (t, id) => {
    if(window.rcDeleteDoc) return window.rcDeleteDoc(t, id);
    db.retailDocuments = (db.retailDocuments||[]).filter(x=>x.id!==id);
    save(); pushCloud();
  };
  const opts = (arr, cur, empty) => (empty!==undefined?'<option value="">'+esc(empty)+'</option>':'') + arr.map(v=>'<option value="'+esc(v)+'" '+(String(cur||'')===String(v)?'selected':'')+'>'+esc(v)+'</option>').join('');

  // Build full accounting group hierarchy (16 primary + built-in children + custom sub-groups)
  window.rgaAllAccountingGroups = () => {
    const custom = docs('retail-ledger-group');
    const tree = RGA_PRIMARY_GROUPS.map(p => {
      const childCustom = custom.filter(c=>c.parentId===p.id).map(c=>({ id:c.id, name:c.name, type:c.groupType||p.type, parentId:p.id, parentName:p.name, system:false }));
      const childBuiltIn = (p.children||[]).map(c=>({ id:c.id, name:c.name, type:c.type, parentId:p.id, parentName:p.name, system:true }));
      return { id:p.id, name:p.name, type:p.type, system:true, children:[...childBuiltIn, ...childCustom] };
    });
    const flat = [];
    tree.forEach(p => {
      flat.push({ id:p.id, name:p.name, type:p.type, parentId:'', parentName:'', system:true });
      p.children.forEach(c => flat.push(c));
    });
    flat.sort((a,b)=>a.name.localeCompare(b.name));
    return { tree, flat };
  };

  window.rgaAccountingGroupOptions = (selected='') => {
    const { flat } = window.rgaAllAccountingGroups();
    return '<option value="">-- Select Parent Group --</option>' + flat.map(g=>'<option value="'+esc(g.name)+'" '+(g.name===selected?'selected':'')+'>'+esc(g.name)+' ('+esc(g.type)+')</option>').join('');
  };

  window.rgaProductGroupOptions = (selected='', onlyParents=false) => {
    const list = docs('retail-product-group').filter(g=>!onlyParents || g.isParent!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    return '<option value="">-- Select Product Group --</option>' + list.map(g=>'<option value="'+esc(g.name)+'" '+(g.name===selected?'selected':'')+'>'+esc(g.name)+(g.parentName?' ('+esc(g.parentName)+')':'')+'</option>').join('');
  };

  // ======================== 1. ACCOUNTING / LEDGER GROUPS ========================
  window.rgaOpenGroupModal = (parentId, editId='') => {
    const { tree } = window.rgaAllAccountingGroups();
    const parent = tree.find(p=>p.id===parentId);
    const custom = editId ? docs('retail-ledger-group').find(c=>c.id===editId) : null;
    const grpType = custom?.groupType || parent?.type || 'ASSET';
    const parentName = parent?.name || custom?.parentName || '';
    document.getElementById('rgaGroupModal')?.remove();
    const html = '<div id="rgaGroupModal" class="retail-modal-backdrop" role="dialog" aria-modal="true"><section class="retail-modal" style="max-width:460px">'
      + '<div class="retail-modal-head"><div><h2>'+(custom?'Group :: Edit':'Group :: Add')+'</h2><p>Under: <b>'+esc(parentName)+'</b></p></div><button type="button" onclick="document.getElementById(\'rgaGroupModal\').remove()">Close</button></div>'
      + '<form onsubmit="rgaSaveAccountingGroup(event)">'
      + '<input type="hidden" name="id" value="'+esc(custom?.id||'')+'">'
      + '<input type="hidden" name="parentId" value="'+esc(parentId||custom?.parentId||'')+'">'
      + '<input type="hidden" name="parentName" value="'+esc(parentName)+'">'
      + '<input type="hidden" name="groupType" value="'+esc(grpType)+'">'
      + '<div class="rco-grid-2">'
      + '<label class="rco-field wide"><span>Group Name *</span><input name="name" required placeholder="Enter Group Name" value="'+esc(custom?.name||'')+'"></label>'
      + '<label class="rco-field wide"><span>Group Type</span><select disabled>'+opts(['ASSET','EQUITY','LIABILITY','EXPENSE','INCOME'], grpType)+'</select></label>'
      + '</div><div class="retail-modal-actions"><button type="button" onclick="document.getElementById(\'rgaGroupModal\').remove()">Cancel</button><button type="submit" class="primary">Save</button></div></form></section></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  window.rgaSaveAccountingGroup = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(); if(!name) return say('Group Name is required.');
    saveDoc('retail-ledger-group', { id: f.id.value||undefined, name, parentId: f.parentId.value, parentName: f.parentName.value, groupType: f.groupType.value });
    document.getElementById('rgaGroupModal')?.remove();
    say('Accounting group saved.'); render();
  };

  function rgaAccountingGroupsView(){
    const { tree, flat } = window.rgaAllAccountingGroups();
    const q = rgaState.grpSearch.trim().toLowerCase();
    let html = '<div class="rco-toolbar"><div class="rco-toolbar-left"><input class="rco-search" placeholder="Search By Group Name..." value="'+esc(rgaState.grpSearch)+'" oninput="rgaState.grpSearch=this.value;render()"></div>'
      + '<div class="rco-toolbar-right"><button type="button" class="'+(rgaState.grpViewMode==='group'?'primary':'')+'" onclick="rgaState.grpViewMode=\'group\';render()">Group-wise</button><button type="button" class="'+(rgaState.grpViewMode==='list'?'primary':'')+'" onclick="rgaState.grpViewMode=\'list\';render()">List-wise</button>'
      + (rgaState.grpViewMode==='group'?'<button type="button" onclick="rgaToggleAllAcctExpand()">'+(rgaState.grpExpanded.size?'Collapse All':'Expand All')+'</button>':'')
      + '</div></div>';

    if(rgaState.grpViewMode === 'list'){
      const rows = flat.filter(g=>!q || g.name.toLowerCase().includes(q) || g.parentName.toLowerCase().includes(q));
      html += table(['Group Name','Parent Group','Type','Origin','Action'], rows.map(g=>[
        '<b>'+esc(g.name)+'</b>', esc(g.parentName||'Primary Group'),
        '<span class="rco-badge rco-badge-open">'+esc(g.type)+'</span>',
        g.system ? 'System' : 'Custom',
        !g.parentId ? '<button type="button" onclick="rgaOpenGroupModal(\''+esc(g.id)+'\')">＋ Sub-Group</button>' : (!g.system ? '<button type="button" onclick="rgaOpenGroupModal(\''+esc(g.parentId)+'\',\''+esc(g.id)+'\')">Edit</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-ledger-group\',\''+esc(g.id)+'\')}">×</button>' : '—')
      ]));
    } else {
      let body = '';
      tree.forEach(p => {
        const matchP = !q || p.name.toLowerCase().includes(q) || p.children.some(c=>c.name.toLowerCase().includes(q));
        if(!matchP) return;
        const exp = q ? true : rgaState.grpExpanded.has(p.id);
        body += '<tr>'
          + '<td><button type="button" onclick="rgaToggleAcct(\''+esc(p.id)+'\')">'+(p.children.length?(exp?'−':'+'):'·')+'</button> <b>'+esc(p.name)+'</b> <small class="muted">('+(p.children.length)+')</small></td>'
          + '<td><span class="rco-badge rco-badge-open">'+esc(p.type)+'</span></td>'
          + '<td><button type="button" onclick="rgaOpenGroupModal(\''+esc(p.id)+'\')" title="Add Sub-Group">＋ Add Sub-Group</button></td>'
          + '</tr>';
        if(exp){
          p.children.forEach(c => {
            if(q && !c.name.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return;
            body += '<tr style="background:var(--paper,#faf8f4)">'
              + '<td style="padding-left:34px">↳ '+esc(c.name)+'</td>'
              + '<td><span class="pill">'+esc(c.type)+'</span></td>'
              + '<td>'+(c.system?'<span class="muted">System</span>':'<button type="button" onclick="rgaOpenGroupModal(\''+esc(p.id)+'\',\''+esc(c.id)+'\')">Edit</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete sub-group?\')){rgaDel(\'retail-ledger-group\',\''+esc(c.id)+'\')}">×</button>')+'</td>'
              + '</tr>';
          });
        }
      });
      html += '<div class="table"><table><thead><tr><th>Groups</th><th>Type</th><th>Action</th></tr></thead><tbody>'+body+'</tbody></table></div>';
    }
    return html;
  }
  window.rgaToggleAcct = (id) => { if(rgaState.grpExpanded.has(id)) rgaState.grpExpanded.delete(id); else rgaState.grpExpanded.add(id); render(); };
  window.rgaToggleAllAcctExpand = () => { if(rgaState.grpExpanded.size) rgaState.grpExpanded.clear(); else RGA_PRIMARY_GROUPS.forEach(p=>rgaState.grpExpanded.add(p.id)); render(); };

  // ======================== 2. PRODUCT GROUPS ========================
  window.rgaSaveProductGroup = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(); if(!name) return say('Group Name is required.');
    const isParent = !!f.isParent.checked;
    const parentId = isParent ? '' : f.parentId.value;
    if(!isParent && !parentId) return say('Select a Parent Group when Is Parent is unchecked.');
    const parentObj = parentId ? docs('retail-product-group').find(g=>g.id===parentId) : null;
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

  function rgaProductGroupsView(){
    const all = docs('retail-product-group');
    const prods = docs('retail-product');
    const prodCount = (gName) => prods.filter(p=>String(p.group||'').toLowerCase()===String(gName||'').toLowerCase()).length;

    if(rgaState.pgViewId){
      const g = all.find(x=>x.id===rgaState.pgViewId);
      if(!g) rgaState.pgViewId = '';
      else {
        const children = all.filter(c=>c.parentId===g.id);
        const linkedProds = prods.filter(p=>String(p.group||'').toLowerCase()===g.name.toLowerCase());
        return '<div class="rco-toolbar"><h3>Product Group · '+esc(g.name)+'</h3><div class="rco-toolbar-right"><button type="button" onclick="rgaState.pgEditId=\''+esc(g.id)+'\';rgaState.pgShowForm=true;rgaState.pgViewId=\'\';render()">Edit</button><button type="button" onclick="rgaState.pgViewId=\'\';render()">← Back</button></div></div>'
          + '<div class="rco-tabs">'+['Details','Child Groups ('+children.length+')','Products ('+linkedProds.length+')','History'].map((t,i)=>{const k=['Details','Child','Products','History'][i];return '<button type="button" class="'+(rgaState.pgViewTab===k?'active':'')+'" onclick="rgaState.pgViewTab=\''+k+'\';render()">'+esc(t)+'</button>';}).join('')+'</div>'
          + (rgaState.pgViewTab==='Details'
            ? '<div class="rco-section-card"><p><b>Group Name:</b> '+esc(g.name)+'</p><p><b>Is Parent:</b> '+(g.isParent!==false?'Yes':'No')+'</p><p><b>Parent Group:</b> '+esc(g.parentName||'—')+'</p><p><b>Ornament Type:</b> '+esc(g.ornamentType||'None')+'</p><p><b>Base Group:</b> '+esc(g.baseGroup||'—')+'</p><p><b>Sizes:</b> '+esc(g.sizes||'—')+'</p><p><b>Ecommerce:</b> '+(g.isEcommerce?'Yes':'No')+'</p><p><b>Description:</b> '+esc(g.description||'—')+'</p></div>'
            : rgaState.pgViewTab==='Child'
            ? (children.length ? table(['Child Group','Ornament Type','Products','Actions'], children.map(c=>['<b>'+esc(c.name)+'</b>', esc(c.ornamentType||'—'), prodCount(c.name), '<button type="button" onclick="rgaState.pgViewId=\''+esc(c.id)+'\';render()">View</button>'])) : '<p class="empty">No child product groups.</p>')
            : rgaState.pgViewTab==='Products'
            ? (linkedProds.length ? table(['Product','Purity','Wastage','Making','Stock Net g'], linkedProds.map(p=>['<b>'+esc(p.name)+'</b>', n(p.purity)+'%', n(p.wastage)+(p.wastageMode==='grams'?' g':'%'), rateMoney(p.makingRate), fmt(p.openingNet)+' g'])) : '<p class="empty">No products assigned to this group.</p>')
            : '<div class="rco-section-card"><p><b>Created:</b> '+esc(g.createdAt||'—')+'</p><p><b>Updated:</b> '+esc(g.updatedAt||'—')+'</p></div>');
      }
    }

    if(rgaState.pgShowForm){
      const g = rgaState.pgEditId ? all.find(x=>x.id===rgaState.pgEditId) : null;
      const isPar = g ? g.isParent!==false : true;
      const parentOpts = '<option value="">-- Select Parent Group --</option>' + all.filter(x=>x.id!==g?.id && x.isParent!==false).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===g?.parentId?'selected':'')+'>'+esc(x.name)+'</option>').join('');
      return '<section class="rco-section-card"><h3>'+(g?'Edit Product Group':'Create Product Group')+' <button type="button" onclick="rgaState.pgShowForm=false;rgaState.pgEditId=\'\';render()">← Back</button></h3>'
        + '<form onsubmit="rgaSaveProductGroup(event)"><div class="rco-grid">'
        + '<div class="rco-field wide"><div class="rco-check-row"><label><input name="isParent" type="checkbox" '+(isPar?'checked':'')+' onchange="document.getElementById(\'rgaPgParentWrap\').classList.toggle(\'hidden\', this.checked)"> Is Parent Group</label><label><input name="isEcommerce" type="checkbox" '+(g?.isEcommerce!==false?'checked':'')+'> Is Ecommerce</label></div></div>'
        + '<label id="rgaPgParentWrap" class="rco-field '+(isPar?'hidden':'')+'"><span>Parent Group *</span><select name="parentId">'+parentOpts+'</select></label>'
        + '<label class="rco-field"><span>Group Name *</span><input name="name" required placeholder="e.g. CHAINS, 12G Chain" value="'+esc(g?.name||'')+'"></label>'
        + '<label class="rco-field"><span>Ornaments Type</span><select name="ornamentType">'+opts(['None','Gold','Silver','Diamond','Alloy','Stone','Platinum','Gift Item'], g?.ornamentType||'None')+'</select></label>'
        + '<label class="rco-field"><span>Base Group (optional)</span><input name="baseGroup" placeholder="e.g. 92.5 JEWELLERY, ORD" value="'+esc(g?.baseGroup||'')+'"></label>'
        + '<label class="rco-field"><span>Product Sizes</span><input name="sizes" placeholder="e.g. 16 In, 18 In, 20 In" value="'+esc(g?.sizes||'')+'"></label>'
        + '<label class="rco-field wide"><span>Description</span><textarea name="description" rows="2">'+esc(g?.description||'')+'</textarea></label>'
        + '</div><div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Product Group</button></div></form></section>';
    }

    const q = rgaState.pgSearch.trim().toLowerCase();
    const filtered = all.filter(g => {
      if(q && !(g.name||'').toLowerCase().includes(q) && !(g.parentName||'').toLowerCase().includes(q)) return false;
      if(rgaState.pgFilter.parentId && g.parentId !== rgaState.pgFilter.parentId) return false;
      if(rgaState.pgFilter.ornament && g.ornamentType !== rgaState.pgFilter.ornament) return false;
      if(rgaState.pgFilter.isParent==='Yes' && g.isParent===false) return false;
      if(rgaState.pgFilter.isParent==='No' && g.isParent!==false) return false;
      return true;
    });

    let content = '';
    if(rgaState.pgViewMode === 'group' && !q && !rgaState.pgFilter.parentId && rgaState.pgFilter.isParent==='All'){
      const parents = filtered.filter(g=>g.isParent!==false);
      let rowsHtml = '';
      parents.forEach(p => {
        const kids = filtered.filter(c=>c.parentId===p.id);
        const exp = rgaState.pgExpanded.has(p.id);
        rowsHtml += '<tr><td>'+(kids.length?'<button type="button" onclick="if(rgaState.pgExpanded.has(\''+esc(p.id)+'\'))rgaState.pgExpanded.delete(\''+esc(p.id)+'\');else rgaState.pgExpanded.add(\''+esc(p.id)+'\');render()">'+(exp?'−':'+')+'</button> ':'')+'<b>'+esc(p.name)+'</b></td><td>—</td><td>'+prodCount(p.name)+'</td><td><span class="rco-badge rco-badge-open">Yes</span></td><td>'+esc(p.ornamentType||'—')+'</td><td>'+(p.isEcommerce?'Yes':'No')+'</td><td>'+esc(p.description||'—')+'</td><td><button type="button" onclick="rgaState.pgEditId=\''+esc(p.id)+'\';rgaState.pgShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rgaState.pgViewId=\''+esc(p.id)+'\';render()">View</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-product-group\',\''+esc(p.id)+'\')}">×</button></td></tr>';
        if(exp){
          kids.forEach(c => {
            rowsHtml += '<tr style="background:var(--paper,#faf8f4)"><td style="padding-left:32px">↳ <b>'+esc(c.name)+'</b></td><td>'+esc(p.name)+'</td><td>'+prodCount(c.name)+'</td><td><span class="pill">No</span></td><td>'+esc(c.ornamentType||'—')+'</td><td>'+(c.isEcommerce?'Yes':'No')+'</td><td>'+esc(c.description||'—')+'</td><td><button type="button" onclick="rgaState.pgEditId=\''+esc(c.id)+'\';rgaState.pgShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rgaState.pgViewId=\''+esc(c.id)+'\';render()">View</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-product-group\',\''+esc(c.id)+'\')}">×</button></td></tr>';
          });
        }
      });
      content = parents.length ? '<div class="table"><table><thead><tr><th>Group Name</th><th>Parent Group</th><th>Products</th><th>Parent</th><th>Ornament Type</th><th>Ecommerce</th><th>Description</th><th>Actions</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div>' : '<p class="empty">No product groups yet. Click ＋ Create Product Group.</p>';
    } else {
      content = filtered.length ? table(['Group Name','Parent Group','Products','Parent','Ornament Type','Ecommerce','Description','Actions'], filtered.map(g=>['<b>'+esc(g.name)+'</b>', esc(g.parentName||'—'), prodCount(g.name), g.isParent!==false?'Yes':'No', esc(g.ornamentType||'—'), g.isEcommerce?'Yes':'No', esc(g.description||'—'), '<button type="button" onclick="rgaState.pgEditId=\''+esc(g.id)+'\';rgaState.pgShowForm=true;render()">Edit</button> <button type="button" class="primary" onclick="rgaState.pgViewId=\''+esc(g.id)+'\';render()">View</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete group?\')){rgaDel(\'retail-product-group\',\''+esc(g.id)+'\')}">×</button>'])) : '<p class="empty">No product groups match.</p>';
    }

    return '<div class="rco-toolbar"><div class="rco-toolbar-left"><input class="rco-search" placeholder="Search By Group Name..." value="'+esc(rgaState.pgSearch)+'" oninput="rgaState.pgSearch=this.value;render()"></div>'
      + '<div class="rco-toolbar-right"><button type="button" class="'+(rgaState.pgViewMode==='group'?'primary':'')+'" onclick="rgaState.pgViewMode=\'group\';render()">Group-wise</button><button type="button" class="'+(rgaState.pgViewMode==='list'?'primary':'')+'" onclick="rgaState.pgViewMode=\'list\';render()">List-wise</button><button type="button" onclick="rgaState.pgFilterOpen=!rgaState.pgFilterOpen;render()">🔍 Filter</button><button type="button" class="primary" onclick="rgaState.pgEditId=\'\';rgaState.pgShowForm=true;render()">＋ Create Product Group</button></div></div>'
      + (rgaState.pgFilterOpen ? '<div class="rco-filter-box"><label class="rco-field"><span>Ornament Type</span><select onchange="rgaState.pgFilter.ornament=this.value;render()">'+opts(['','Gold','Silver','Diamond','Alloy','Stone','Platinum','Gift Item'], rgaState.pgFilter.ornament)+'</select></label><label class="rco-field"><span>Parent</span><select onchange="rgaState.pgFilter.isParent=this.value;render()">'+opts(['All','Yes','No'], rgaState.pgFilter.isParent)+'</select></label></div>' : '')
      + content;
  }

  // ======================== 3. LEDGERS (ACCOUNTS) ========================
  window.rgaSaveLedger = (e) => {
    e.preventDefault(); const f = e.target;
    const name = f.name.value.trim(), parentGroup = f.parentGroup.value;
    if(!name || !parentGroup) return say('Ledger Name and Parent Group are required.');
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

  function rgaLedgersView(){
    const list = docs('retail-ledger');
    if(rgaState.ledShowForm){
      const l = rgaState.ledEditId ? list.find(x=>x.id===rgaState.ledEditId) : null;
      return '<section class="rco-section-card"><h3>'+(l?'Edit Ledger · '+esc(l.name):'Create Ledger')+' <button type="button" onclick="rgaState.ledShowForm=false;rgaState.ledEditId=\'\';render()">← Back</button></h3>'
        + '<form onsubmit="rgaSaveLedger(event)"><div class="rco-grid">'
        + '<label class="rco-field"><span>Parent Group *</span><select name="parentGroup" required>'+window.rgaAccountingGroupOptions(l?.parentGroup||'')+'</select></label>'
        + '<label class="rco-field"><span>Salutation</span><select name="salutation">'+opts(['','MR.','MRS.','Ms','M/S'], l?.salutation||'')+'</select></label>'
        + '<label class="rco-field"><span>Ledger Name *</span><input name="name" required value="'+esc(l?.name||'')+'"></label>'
        + '<label class="rco-field"><span>Print Name</span><input name="printName" value="'+esc(l?.printName||'')+'"></label>'
        + '<label class="rco-field"><span>Team</span><select name="team">'+opts(['','AK','Arjeeth','SSJ','SSN','VKL'], l?.team||'')+'</select></label>'
        + '<label class="rco-field"><span>Mobile</span><input name="mobile" type="tel" value="'+esc(l?.mobile||'')+'"></label>'
        + '<label class="rco-field"><span>Landline</span><input name="landline" value="'+esc(l?.landline||'')+'"></label>'
        + '<label class="rco-field"><span>Business Type</span><select name="businessType">'+opts(['','LARGE','MEDIUM','SMALL'], l?.businessType||'')+'</select></label>'
        + '<label class="rco-field"><span>GST Reg Type</span><select name="gstRegType">'+opts(['Un Registered','Regular'], l?.gstRegType||'Un Registered')+'</select></label>'
        + '<label class="rco-field"><span>GST No</span><input name="gst" maxlength="15" value="'+esc(l?.gst||'')+'"></label>'
        + '<label class="rco-field"><span>PAN Number</span><input name="pan" maxlength="10" value="'+esc(l?.pan||'')+'"></label>'
        + '<label class="rco-field"><span>TCS / TDS</span><select name="tcsTds">'+opts(['','TCS @ 0.01%'], l?.tcsTds||'')+'</select></label>'
        + '<label class="rco-field"><span>Ornaments Type</span><select name="ornamentsType">'+opts(['None','GOLD','SILVER','DIAMOND'], l?.ornamentsType||'None')+'</select></label>'
        + '<label class="rco-field"><span>Opening effective date</span><input type="date" name="openingEffectiveDate" value="'+esc(l?.openingEffectiveDate||'')+'"></label>'
        + '<label class="rco-field"><span>Opening balance is an advance</span><input type="checkbox" name="openingIsAdvance" '+(l?.openingIsAdvance?'checked':'')+'></label>'
        + '<label class="rco-field"><span>Opening Balance (₹)</span><input name="openingAmount" type="number" step=".01" value="'+(l?.openingAmount||0)+'"></label>'
        + '<label class="rco-field"><span>Balance Type</span><select name="openingSide">'+opts(['DR','CR'], l?.openingSide||'DR')+'</select></label>'
        + '<label class="rco-field"><span>Pure Weight (g)</span><input name="pureWeight" type="number" step=".001" value="'+(l?.pureWeight||0)+'"></label>'
        + '<label class="rco-field"><span>Pure Side</span><select name="pureSide">'+opts(['DR','CR'], l?.pureSide||'DR')+'</select></label>'
        + '<label class="rco-field"><span>Address</span><input name="address" value="'+esc(l?.address||'')+'"></label>'
        + '<label class="rco-field"><span>City</span><input name="city" value="'+esc(l?.city||'')+'"></label>'
        + '<label class="rco-field"><span>Pin Code</span><input name="pinCode" value="'+esc(l?.pinCode||'')+'"></label>'
        + '<label class="rco-field"><span>District</span><input name="district" value="'+esc(l?.district||'')+'"></label>'
        + '<label class="rco-field"><span>State</span><input name="state" value="'+esc(l?.state||'TAMIL NADU')+'"></label>'
        + '<label class="rco-field"><span>Credit Days</span><input name="creditDays" type="number" value="'+esc(l?.creditDays||'')+'"></label>'
        + '<label class="rco-field"><span>Credit Limit ₹</span><input name="creditLimit" type="number" step=".01" value="'+(l?.creditLimit||0)+'"></label>'
        + '<label class="rco-field wide"><span>Remarks</span><textarea name="remarks" rows="2">'+esc(l?.remarks||'')+'</textarea></label>'
        + '<div class="rco-field wide"><label><input name="disabled" type="checkbox" '+(l?.disabled?'checked':'')+'> Disable Ledger</label></div>'
        + '</div><div class="right" style="margin-top:12px"><button type="submit" class="primary">Save Ledger</button></div></form></section>';
    }

    const q = rgaState.ledSearch.trim().toLowerCase();
    const filtered = list.filter(l => {
      if(!rgaState.ledShowDisabled && l.disabled) return false;
      if(!rgaState.ledShowZero && n(l.openingAmount)===0 && n(l.pureWeight)===0) return false;
      if(rgaState.ledFilterGroup && l.parentGroup !== rgaState.ledFilterGroup) return false;
      if(q && !(l.name.toLowerCase().includes(q) || (l.parentGroup||'').toLowerCase().includes(q) || (l.mobile||'').includes(q))) return false;
      return true;
    });
    return (window.rcOpeningView?'<details class="rco-section-card" open><summary>Opening cash and bank</summary>'+rcOpeningView('accounts')+'</details>':'')+'<div class="rco-toolbar"><div class="rco-toolbar-left"><input class="rco-search" placeholder="Search Ledger or Parent Group..." value="'+esc(rgaState.ledSearch)+'" oninput="rgaState.ledSearch=this.value;render()">'
      + '<select onchange="rgaState.ledFilterGroup=this.value;render()">'+window.rgaAccountingGroupOptions(rgaState.ledFilterGroup)+'</select></div>'
      + '<div class="rco-toolbar-right"><button type="button" class="primary" onclick="rgaState.ledEditId=\'\';rgaState.ledShowForm=true;render()">＋ Create Ledger</button></div></div>'
      + '<div class="rco-check-row" style="margin-bottom:10px"><label><input type="checkbox" '+(rgaState.ledShowZero?'checked':'')+' onchange="rgaState.ledShowZero=this.checked;render()"> Inc. 0 Balance</label><label><input type="checkbox" '+(rgaState.ledShowDisabled?'checked':'')+' onchange="rgaState.ledShowDisabled=this.checked;render()"> Show Disabled</label></div>'
      + (filtered.length ? table(['Ledger','Print Name','Parent Group','Team','Mobile','Amount','Pure g','Status','Actions'], filtered.map(l=>[
        '<b>'+esc(l.name)+'</b>', esc(l.printName||l.name), '<span class="rco-badge rco-badge-open">'+esc(l.parentGroup)+'</span>',
        esc(l.team||'—'), esc(l.mobile||'—'),
        rateMoney(l.openingAmount)+' '+esc(l.openingSide||'DR'), fmt(l.pureWeight)+' g '+esc(l.pureSide||'DR'),
        l.disabled?'<span class="rco-badge rco-badge-cancel">Disabled</span>':'<span class="rco-badge rco-badge-open">Active</span>',
        '<button type="button" onclick="rgaState.ledEditId=\''+esc(l.id)+'\';rgaState.ledShowForm=true;render()">Edit</button> <button type="button" class="rb-delete-btn" onclick="if(confirm(\'Delete ledger?\')){rgaDel(\'retail-ledger\',\''+esc(l.id)+'\')}">×</button>'
      ])) : '<p class="empty">No custom ledgers yet. Customers & Suppliers auto-link to Sundry Debtors / Sundry Creditors; click ＋ Create Ledger for Bank, Cash, Expense, or Capital ledgers.</p>');
  }

  // ======================== 4. FINANCIAL & GROUP REPORTS ========================
  function rgaComputeAccountLines(){
    const { flat } = window.rgaAllAccountingGroups();
    const grpTypeMap = {};
    flat.forEach(g => grpTypeMap[g.name] = g.type);

    const lines = [];
    const addLine = (ledgerName, parentGroup, debit, credit, grossWt=0, pureWt=0) => {
      if(debit===0 && credit===0 && grossWt===0 && pureWt===0) return;
      lines.push({ ledgerName, parentGroup, groupType: grpTypeMap[parentGroup]||'ASSET', debit: n(debit), credit: n(credit), grossWt: n(grossWt), pureWt: n(pureWt) });
    };

    // Custom ledgers
    docs('retail-ledger').filter(l=>!l.disabled).forEach(l => {
      const amt = n(l.openingAmount);
      addLine(l.name, l.parentGroup, l.openingSide==='DR'?amt:0, l.openingSide==='CR'?amt:0, 0, n(l.pureWeight));
    });

    // Retail Customers -> Sundry Debtors (or custom parentGroup)
    (db.customers||[]).forEach(c => {
      const open = n(c.opening);
      const sales = (db.sales||[]).filter(s=>s.partyId===c.id && s.accountType==='customer').reduce((a,s)=>a+n(s.amount)-n(s.exchangeAmount),0);
      const paid = (db.payments||[]).filter(p=>p.partyId===c.id && p.accountType==='customer').reduce((a,p)=>a+n(p.amount),0);
      const bal = open + sales - paid;
      addLine(c.name, c.parentGroup||'Sundry Debtors', bal>0?bal:0, bal<0?Math.abs(bal):0);
    });

    // Retail Suppliers -> Sundry Creditors (or custom parentGroup)
    (db.retailSuppliers||[]).forEach(s => {
      const open = n(s.openingAmount);
      const pur = docs('retail-purchase').filter(p=>p.supplierId===s.id).reduce((a,p)=>a+n(p.netAmount||p.amount),0);
      const bal = open + pur;
      addLine(s.name, s.parentGroup||'Sundry Creditors', bal<0?Math.abs(bal):0, bal>0?bal:0, n(s.openingGold)+n(s.openingSilver), n(s.openingGold)+n(s.openingSilver));
    });

    // Retail Sales -> Sales Accounts
    const totalSales = (db.sales||[]).filter(s=>s.accountType==='customer').reduce((a,s)=>a+n(s.amount),0);
    if(totalSales>0) addLine('Retail Jewellery Sales', 'Sales Accounts', 0, totalSales);

    // Cash / Collections -> Cash in hand / Bank Accounts
    const totalCollected = (db.payments||[]).filter(p=>p.accountType==='customer').reduce((a,p)=>a+n(p.amount),0)
      + (db.sales||[]).filter(s=>s.accountType==='customer').reduce((a,s)=>a+n(s.collectedAmount),0);
    if(totalCollected>0) addLine('Retail Cash & Bank Receipts', 'Cash in hand', totalCollected, 0);

    // Retail Purchases -> Purchase Accounts
    const totalPur = docs('retail-purchase').reduce((a,p)=>a+n(p.netAmount||p.amount),0);
    if(totalPur>0) addLine('Retail Jewellery Purchases', 'Purchase Accounts', totalPur, 0);

    return lines;
  }

  function rgaReportsView(){
    const lines = rgaComputeAccountLines();
    const groupRollup = {};
    lines.forEach(l => {
      if(!groupRollup[l.parentGroup]) groupRollup[l.parentGroup] = { name:l.parentGroup, type:l.groupType, debit:0, credit:0, grossWt:0, pureWt:0, items:[] };
      groupRollup[l.parentGroup].debit += l.debit;
      groupRollup[l.parentGroup].credit += l.credit;
      groupRollup[l.parentGroup].grossWt += l.grossWt;
      groupRollup[l.parentGroup].pureWt += l.pureWt;
      groupRollup[l.parentGroup].items.push(l);
    });
    const groups = Object.values(groupRollup).sort((a,b)=>a.name.localeCompare(b.name));

    let body = '';
    if(rgaState.repTab === 'Trial Balance'){
      let totDr = 0, totCr = 0, rowsHtml = '';
      groups.forEach(g => {
        totDr += g.debit; totCr += g.credit;
        rowsHtml += '<tr style="background:var(--paper,#f6f4ef);font-weight:750"><td>'+esc(g.name)+' <small class="muted">('+esc(g.type)+')</small></td><td style="text-align:right">'+rateMoney(g.debit)+'</td><td style="text-align:right">'+rateMoney(g.credit)+'</td></tr>';
        if(rgaState.repShowDetail){
          g.items.forEach(it => {
            rowsHtml += '<tr><td style="padding-left:28px">↳ '+esc(it.ledgerName)+'</td><td style="text-align:right">'+rateMoney(it.debit)+'</td><td style="text-align:right">'+rateMoney(it.credit)+'</td></tr>';
          });
        }
      });
      body = '<div class="rco-toolbar"><label style="display:flex;align-items:center;gap:6px;font-weight:700"><input type="checkbox" '+(rgaState.repShowDetail?'checked':'')+' onchange="rgaState.repShowDetail=this.checked;render()"> Show Detail (Expand Ledgers)</label><button type="button" class="primary" onclick="rgaPrintReport(\'TRIAL BALANCE\')">🖨️ Print PDF</button></div>'
        + '<div class="table"><table><thead><tr><th>Particulars (Parent Group / Ledger)</th><th style="text-align:right">Debit ₹</th><th style="text-align:right">Credit ₹</th></tr></thead><tbody>'+rowsHtml
        + '<tr class="gl-history-total"><td>GRAND TOTAL (Diff: '+rateMoney(Math.abs(totDr-totCr))+')</td><td style="text-align:right">'+rateMoney(totDr)+'</td><td style="text-align:right">'+rateMoney(totCr)+'</td></tr></tbody></table></div>';
    }
    else if(rgaState.repTab === 'Balance Sheet'){
      const liabGroups = groups.filter(g=>g.type==='LIABILITY'||g.type==='EQUITY');
      const assetGroups = groups.filter(g=>g.type==='ASSET');
      const incTotal = groups.filter(g=>g.type==='INCOME').reduce((s,g)=>s+(g.credit-g.debit),0);
      const expTotal = groups.filter(g=>g.type==='EXPENSE').reduce((s,g)=>s+(g.debit-g.credit),0);
      const netProfit = incTotal - expTotal;
      const totLiab = liabGroups.reduce((s,g)=>s+(g.credit-g.debit),0) + (netProfit>0?netProfit:0);
      const totAsset = assetGroups.reduce((s,g)=>s+(g.debit-g.credit),0) + (netProfit<0?Math.abs(netProfit):0);

      body = '<div class="rco-toolbar"><span>Balance Sheet by Group Type</span><button type="button" class="primary" onclick="rgaPrintReport(\'BALANCE SHEET\')">🖨️ Print PDF</button></div>'
        + '<div class="rco-grid-2">'
        + '<section class="rco-section-card"><h3>Liabilities & Equity</h3>'+table(['Group','Amount ₹'], [...liabGroups.map(g=>['<b>'+esc(g.name)+'</b>', rateMoney(g.credit-g.debit)]), ...(netProfit>0?[['<b>Net Profit</b>', rateMoney(netProfit)]]:[]), ['<b>TOTAL LIABILITIES</b>', '<b>'+rateMoney(totLiab)+'</b>']])+'</section>'
        + '<section class="rco-section-card"><h3>Assets</h3>'+table(['Group','Amount ₹'], [...assetGroups.map(g=>['<b>'+esc(g.name)+'</b>', rateMoney(g.debit-g.credit)]), ...(netProfit<0?[['<b>Net Loss</b>', rateMoney(Math.abs(netProfit))]]:[]), ['<b>TOTAL ASSETS</b>', '<b>'+rateMoney(totAsset)+'</b>']])+'</section>'
        + '</div>';
    }
    else if(rgaState.repTab === 'Profit & Loss'){
      const expGroups = groups.filter(g=>g.type==='EXPENSE');
      const incGroups = groups.filter(g=>g.type==='INCOME');
      const totExp = expGroups.reduce((s,g)=>s+(g.debit-g.credit),0);
      const totInc = incGroups.reduce((s,g)=>s+(g.credit-g.debit),0);
      const net = totInc - totExp;
      body = '<div class="rco-toolbar"><span>Profit & Loss (Expense vs Income Groups)</span><button type="button" class="primary" onclick="rgaPrintReport(\'PROFIT & LOSS\')">🖨️ Print PDF</button></div>'
        + '<div class="cards" style="margin-bottom:12px"><div class="card"><label>TOTAL INCOME</label><b>'+rateMoney(totInc)+'</b></div><div class="card"><label>TOTAL EXPENSE</label><b>'+rateMoney(totExp)+'</b></div><div class="card"><label>'+(net>=0?'NET PROFIT':'NET LOSS')+'</label><b>'+rateMoney(Math.abs(net))+'</b></div></div>'
        + '<div class="rco-grid-2">'
        + '<section class="rco-section-card"><h3>Expenses (Dr)</h3>'+table(['Group','Amount ₹'], [...expGroups.map(g=>[esc(g.name), rateMoney(g.debit-g.credit)]), ['<b>TOTAL EXPENSE</b>','<b>'+rateMoney(totExp)+'</b>']])+'</section>'
        + '<section class="rco-section-card"><h3>Income (Cr)</h3>'+table(['Group','Amount ₹'], [...incGroups.map(g=>[esc(g.name), rateMoney(g.credit-g.debit)]), ['<b>TOTAL INCOME</b>','<b>'+rateMoney(totInc)+'</b>']])+'</section>'
        + '</div>';
    }
    else if(rgaState.repTab === 'By Ledger Group'){
      const filtered = groups.filter(g=>(!rgaState.repPayGroup || g.name===rgaState.repPayGroup));
      let rowsHtml = '';
      filtered.forEach(g => {
        const exp = rgaState.repExpanded.has(g.name);
        rowsHtml += '<tr><td><button type="button" onclick="if(rgaState.repExpanded.has(\''+esc(g.name)+'\'))rgaState.repExpanded.delete(\''+esc(g.name)+'\');else rgaState.repExpanded.add(\''+esc(g.name)+'\');render()">'+(exp?'−':'+')+'</button> <b>'+esc(g.name)+'</b> ('+g.items.length+')</td><td>'+fmt(g.grossWt)+' g</td><td>'+fmt(g.pureWt)+' g</td><td><b>'+rateMoney(Math.abs(g.debit-g.credit))+'</b></td></tr>';
        if(exp){
          g.items.forEach(it => {
            rowsHtml += '<tr style="background:var(--paper,#faf8f4)"><td style="padding-left:34px">↳ '+esc(it.ledgerName)+'</td><td>'+fmt(it.grossWt)+' g</td><td>'+fmt(it.pureWt)+' g</td><td>'+rateMoney(Math.abs(it.debit-it.credit))+'</td></tr>';
          });
        }
      });
      body = '<div class="rco-toolbar"><select onchange="rgaState.repPayGroup=this.value;render()">'+window.rgaAccountingGroupOptions(rgaState.repPayGroup)+'</select></div>'
        + '<div class="table"><table><thead><tr><th>Group Name</th><th>Gross Wt</th><th>Pure Wt</th><th>Net Amount ₹</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div>';
    }
    else if(rgaState.repTab === 'By Product Group'){
      const pGroups = docs('retail-product-group');
      const prods = docs('retail-product');
      const sales = (db.sales||[]).filter(s=>s.accountType==='customer');
      const prodStats = (pName) => {
        const p = prods.find(x=>x.name.toLowerCase()===String(pName||'').toLowerCase());
        const sRows = sales.filter(s=>String(s.product||'').toLowerCase()===String(pName||'').toLowerCase());
        return { stockWt: n(p?.openingNet), salesWt: sRows.reduce((a,s)=>a+n(s.weight),0), salesAmt: sRows.reduce((a,s)=>a+n(s.amount),0), qty: sRows.reduce((a,s)=>a+(n(s.pieces)||1),0) };
      };
      if(rgaState.repStockGroupBy === 'Product'){
        body = '<div class="rco-toolbar"><div class="rco-toolbar-left"><button type="button" onclick="rgaState.repStockGroupBy=\'Product Group\';render()">Group by: Product Group</button><button type="button" class="primary">Group by: Product</button></div></div>'
          + (prods.length ? table(['Product','Product Group','Stock Net g','Sales Qty','Sales Wt g','Sales Amt ₹'], prods.map(p=>{const st=prodStats(p.name);return ['<b>'+esc(p.name)+'</b>', esc(p.group||'—'), fmt(st.stockWt)+' g', st.qty, fmt(st.salesWt)+' g', rateMoney(st.salesAmt)];})) : '<p class="empty">No products yet.</p>');
      } else {
        const parents = pGroups.filter(g=>g.isParent!==false);
        let rowsHtml = '';
        parents.forEach(pg => {
          const kids = pGroups.filter(k=>k.parentId===pg.id);
          const groupNames = [pg.name, ...kids.map(k=>k.name)];
          const linked = prods.filter(p=>groupNames.some(gn=>gn.toLowerCase()===String(p.group||'').toLowerCase()));
          const agg = linked.reduce((acc, p)=>{ const st=prodStats(p.name); acc.stockWt+=st.stockWt; acc.salesWt+=st.salesWt; acc.salesAmt+=st.salesAmt; acc.qty+=st.qty; return acc; }, {stockWt:0,salesWt:0,salesAmt:0,qty:0});
          const exp = rgaState.repStockExpanded.has(pg.id);
          rowsHtml += '<tr><td><button type="button" onclick="if(rgaState.repStockExpanded.has(\''+esc(pg.id)+'\'))rgaState.repStockExpanded.delete(\''+esc(pg.id)+'\');else rgaState.repStockExpanded.add(\''+esc(pg.id)+'\');render()">'+(exp?'−':'+')+'</button> <b>'+esc(pg.name)+'</b></td><td>'+kids.length+' sub-groups · '+linked.length+' products</td><td>'+fmt(agg.stockWt)+' g</td><td>'+agg.qty+'</td><td>'+fmt(agg.salesWt)+' g</td><td><b>'+rateMoney(agg.salesAmt)+'</b></td></tr>';
          if(exp){
            linked.forEach(p=>{ const st=prodStats(p.name); rowsHtml += '<tr style="background:var(--paper,#faf8f4)"><td style="padding-left:34px">↳ '+esc(p.name)+'</td><td>'+esc(p.group)+'</td><td>'+fmt(st.stockWt)+' g</td><td>'+st.qty+'</td><td>'+fmt(st.salesWt)+' g</td><td>'+rateMoney(st.salesAmt)+'</td></tr>'; });
          }
        });
        body = '<div class="rco-toolbar"><div class="rco-toolbar-left"><button type="button" class="primary">Group by: Product Group</button><button type="button" onclick="rgaState.repStockGroupBy=\'Product\';render()">Group by: Product</button></div></div>'
          + (parents.length ? '<div class="table"><table><thead><tr><th>Product Group</th><th>Hierarchy</th><th>Stock Net g</th><th>Sales Qty</th><th>Sales Wt g</th><th>Sales Amt ₹</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div>' : '<p class="empty">Create Product Groups in the Product Groups tab to view group-wise stock & sales rollups.</p>');
      }
    }

    return '<div class="rco-tabs">' + ['Trial Balance','Balance Sheet','Profit & Loss','By Ledger Group','By Product Group'].map(t=>'<button type="button" class="'+(rgaState.repTab===t?'active':'')+'" onclick="rgaState.repTab=\''+t+'\';render()">'+esc(t)+'</button>').join('') + '</div>' + body;
  }

  window.rgaPrintReport = (title) => {
    const lines = rgaComputeAccountLines();
    pdfPrintModel({
      kind: 'ledger', retail: true, title, entityLabel: 'Shop', entityName: db.shopName || goldleafContext?.shop_name || 'Goldleaf Jewellery',
      reference: rgaState.repTab, date: new Date().toLocaleDateString('en-IN'),
      heads: ['Ledger','Parent Group','Type','Debit ₹','Credit ₹'],
      rows: lines.map(l=>[l.ledgerName, l.parentGroup, l.groupType, rateMoney(l.debit), rateMoney(l.credit)]),
      totals: [['Total Debit', rateMoney(lines.reduce((s,l)=>s+l.debit,0))], ['Total Credit', rateMoney(lines.reduce((s,l)=>s+l.credit,0))]]
    }, 'retail', 'classic');
  };

  window.rgaDel = (t, id) => { delDoc(t, id); render(); };

  window.rgaParentGroupPage = () => {
    const tabs = ['Accounting Groups','Product Groups','Ledgers','Accounts & Reports'];
    let inner = '';
    if(rgaState.mainTab === 'Accounting Groups') inner = rgaAccountingGroupsView();
    else if(rgaState.mainTab === 'Product Groups') inner = rgaProductGroupsView();
    else if(rgaState.mainTab === 'Ledgers') inner = rgaLedgersView();
    else inner = rgaReportsView();
    return header('Parent Groups, Ledgers & Financial Reports', '')
      + '<div class="rco-tabs">' + tabs.map(t=>'<button type="button" class="'+(rgaState.mainTab===t?'active':'')+'" onclick="rgaState.mainTab=\''+t+'\';render()">'+esc(t)+'</button>').join('') + '</div>'
      + '<section class="panel">' + inner + '</section>';
  };

  function rgaNavigation(){
    const nav = document.getElementById('nav'); if(!nav) return;
    nav.querySelectorAll('[data-rga-sidebar]').forEach(b=>b.remove());
    const more = document.getElementById('moreMenu');
    if(more) more.querySelectorAll('[data-rga-nav]').forEach(b=>b.remove());
    if(!session || !goldleafContext?.has_access || workspaceMode !== 'retail') return;
    const anchor = nav.querySelector('[data-rco-sidebar="Suppliers"]') || nav.querySelector('[data-rc-sidebar="Products"]') || nav.firstElementChild;
    const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.rgaSidebar = 'Parent Group';
    btn.setAttribute('aria-label', 'Parent Group'); btn.title = 'Parent Group';
    btn.classList.toggle('active', page === 'Parent Group');
    if(page === 'Parent Group') btn.setAttribute('aria-current', 'page');
    btn.onclick = () => { if(typeof window.go==='function') window.go('Parent Group'); };
    btn.innerHTML = '<span class="nav-icon">'+erpIcon('plans')+'</span><span class="erp-nav-label">Parent Group</span>';
    if(anchor) anchor.after(btn); else nav.append(btn);
    if(more){
      const mb = document.createElement('button'); mb.type = 'button'; mb.dataset.rgaNav = 'Parent Group';
      mb.textContent = 'Parent Group'; mb.onclick = () => { more.classList.remove('open'); if(typeof window.go==='function') window.go('Parent Group'); };
      more.append(mb);
    }
    if(typeof erpFilterNavigation==='function') erpFilterNavigation(window.erpNavQuery||'');
  }

  const rgaPrevRender = window.render;
  window.render = function(){
    const res = rgaPrevRender.apply(this, arguments);
    if(session && typeof goldleafContext !== 'undefined' && goldleafContext?.has_access && workspaceMode === 'retail'){
      if(page === 'Parent Group'){
        const appEl = document.getElementById('app');
        if(appEl) appEl.innerHTML = window.rgaParentGroupPage();
      }
      // Enhance Product Group input on Products page with live datalist of created Product Groups
      const prodGroupInput = document.querySelector('#app form[onsubmit*="rcSaveProduct"] input[name="group"]');
      if(prodGroupInput && !prodGroupInput.getAttribute('list')){
        let dl = document.getElementById('rgaProductGroupDatalist');
        if(!dl){ dl = document.createElement('datalist'); dl.id = 'rgaProductGroupDatalist'; document.body.append(dl); }
        dl.innerHTML = docs('retail-product-group').map(g=>'<option value="'+esc(g.name)+'">'+(g.parentName?'Under '+esc(g.parentName):'Parent Group')+'</option>').join('');
        prodGroupInput.setAttribute('list', 'rgaProductGroupDatalist');
      }
    }
    rgaNavigation();
    return res;
  };
  render();
})();
