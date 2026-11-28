// Universal Data Table (Grouped Display Columns Modal, Customize Filters & Filter Bar, Search, Sort, CSV Export, Table Lines) & Hierarchy Drill-Down across all Goldleaf pages.
(function(){
  const style = document.createElement('style');
  style.textContent = `
    .gl-dt-wrap{display:flex;flex-direction:column;gap:8px;max-width:100%}
    .gl-dt-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--paper,#f8f6f1);border:1px solid var(--line,#e2ddd3);border-radius:10px;margin-bottom:8px}
    .gl-dt-left,.gl-dt-right{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .gl-dt-search{min-width:180px;max-width:280px;padding:6px 10px;border:1px solid var(--line,#d5d0c5);border-radius:8px;font-size:12.5px;background:var(--white,#fff);color:var(--ink,#222)}
    .gl-dt-pill{font-size:11px;font-weight:750;padding:4px 9px;border-radius:999px;background:#ede8dc;color:#5a4d34}
    .gl-dt-btn{padding:5px 10px;border-radius:7px;border:1px solid var(--line,#d5d0c5);background:var(--white,#fff);color:var(--ink,#222);font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap}
    .gl-dt-btn.active{background:var(--green,#18392a);color:#fff;border-color:var(--green,#18392a)}
    .gl-dt-filter-bar{display:none;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:10px;background:var(--paper,#faf8f4);border:1px solid var(--line,#e2ddd3);border-radius:10px;margin-bottom:8px}
    .gl-dt-filter-bar.open{display:flex}
    .gl-dt-fitem{display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:700;color:var(--muted,#555);min-width:130px;flex:1 1 130px;max-width:210px}
    .gl-dt-fitem input,.gl-dt-fitem select{padding:5px 8px;border:1px solid var(--line,#d5d0c5);border-radius:7px;font-size:12px;background:var(--white,#fff);color:var(--ink,#222);min-height:32px}
    /* Crisp Table Grid Lines across all pages */
    .table{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line,#ded8cc);border-radius:10px}
    .table table{border-collapse:collapse;width:100%}
    .table table th,.table table td{border:1px solid var(--line,#e4dfd4)!important}
    .table table thead th{background:var(--paper,#f4f0e6);font-weight:750;position:sticky;top:0;z-index:2}
    .table table tbody tr:nth-child(even):not(.gl-drill-row):not(.rco-subtable-row):not(.gl-history-total){background:rgba(0,0,0,.015)}
    .table table tbody tr:hover:not(.gl-drill-row):not(.rco-subtable-row){background:rgba(24,57,42,.04)}
    th.gl-dt-sort{cursor:pointer;user-select:none;position:relative}
    th.gl-dt-sort:hover{background:rgba(24,57,42,.07)}
    th.gl-dt-sort::after{content:' ⇅';opacity:.35;font-size:10px}
    th.gl-dt-sort.asc::after{content:' ▲';opacity:.85}
    th.gl-dt-sort.desc::after{content:' ▼';opacity:.85}
    .gl-drill-btn{width:24px;height:24px;min-width:24px;padding:0!important;border-radius:6px!important;border:1px solid var(--line,#cfc8ba)!important;background:var(--white,#fff)!important;font-weight:800!important;line-height:1!important;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--green,#18392a)!important}
    tr.gl-drill-row>td{background:#f7f5ef!important;padding:10px 14px!important;border-left:3px solid var(--green,#18392a)!important}
    .gl-drill-box{background:var(--white,#fff);border:1px solid var(--line,#e2ddd3);border-radius:9px;padding:10px;overflow-x:auto}
    .gl-drill-box h4{margin:0 0 6px;font-size:12px;font-weight:800;color:var(--green,#18392a)}
    .gl-drill-box table{width:100%;min-width:480px!important;border-collapse:collapse;font-size:11.5px}
    .gl-drill-box th,.gl-drill-box td{padding:5px 8px!important;border:1px solid var(--line,#e6e1d6)!important}
    html[data-theme="dark"] .gl-dt-bar,html[data-theme="dark"] .gl-dt-filter-bar,html[data-theme="dark"] tr.gl-drill-row>td,html[data-theme="dark"] .table table thead th{background:#1b221d!important;border-color:#354038!important}
    html[data-theme="dark"] .table,html[data-theme="dark"] .table table th,html[data-theme="dark"] .table table td,html[data-theme="dark"] .gl-drill-box th,html[data-theme="dark"] .gl-drill-box td{border-color:#354038!important}
    html[data-theme="dark"] .gl-dt-search,html[data-theme="dark"] .gl-dt-btn,html[data-theme="dark"] .gl-dt-fitem input,html[data-theme="dark"] .gl-dt-fitem select,html[data-theme="dark"] .gl-drill-box,html[data-theme="dark"] .gl-drill-btn{background:#222b25!important;border-color:#3b463e!important;color:#eee8da!important}
    html[data-theme="dark"] .gl-dt-pill{background:#2d362f;color:#e6d8bb}
    @media(max-width:760px){
      .gl-dt-bar{flex-direction:column;align-items:stretch}
      .gl-dt-search{max-width:100%;width:100%;font-size:15px}
      .gl-dt-fitem{max-width:100%}
    }
  `;
  document.head.append(style);

  function parseSortVal(txt){
    const s = String(txt||'').replace(/[₹,g%]/g,'').trim();
    const num = Number(s);
    if(s !== '' && !isNaN(num)) return num;
    return String(txt||'').toLowerCase();
  }

  function exportTableCsv(tbl){
    const rows = [];
    tbl.querySelectorAll('tr:not(.gl-drill-row)').forEach(tr => {
      if(tr.style.display === 'none') return;
      const cols = [];
      tr.querySelectorAll('th,td').forEach(cell => {
        if(cell.classList.contains('gl-drill-col') || cell.style.display === 'none') return;
        cols.push('"' + String(cell.innerText||'').replace(/\s+/g,' ').trim().replace(/"/g,'""') + '"');
      });
      if(cols.length) rows.push(cols.join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'goldleaf-' + (page||'export').toLowerCase().replace(/[^a-z0-9]+/g,'-') + '.csv';
    a.click();
  }

  function classifyColumnGroup(title){
    const t = title.toLowerCase();
    if(/date|created|updated|status|valid|from|to/.test(t)) return 'Dates & Status';
    if(/amt|amount|rate|total|bal|paid|disc|tax|gst|value|advance|credit|debit/.test(t)) return 'Amounts & Taxes';
    if(/wt|weight|gross|less|net|pure|qty|pcs|pieces|carat|ct/.test(t)) return 'Quantity & Weight';
    if(/mc|making|wst|wastage|stone|hallmark|charge/.test(t)) return 'Charges';
    if(/action/.test(t)) return 'Actions';
    return 'Details & Identity';
  }

  function applyColVisibility(tbl, hiddenSet){
    tbl.querySelectorAll('tr').forEach(tr => {
      if(tr.classList.contains('gl-drill-row') || tr.classList.contains('rco-subtable-row')) return;
      Array.from(tr.children).forEach((cell, ci) => {
        cell.style.display = hiddenSet.has(ci) ? 'none' : '';
      });
    });
  }

  function openDisplayColumnsModal(tbl, storeKey, titleLabel='Display Columns'){
    document.getElementById('glDtDispModal')?.remove();
    const headCells = Array.from(tbl.querySelectorAll('thead th'));
    const hidden = new Set(JSON.parse(localStorage.getItem(storeKey) || '[]'));
    const groups = {};
    headCells.forEach((th, i) => {
      const t = th.textContent.trim();
      if(!t || th.classList.contains('gl-drill-col')) return;
      const g = classifyColumnGroup(t);
      (groups[g] = groups[g] || []).push({ idx: i, label: t, checked: !hidden.has(i) });
    });

    let html = '<div id="glDtDispModal" class="retail-modal-backdrop" role="dialog" aria-modal="true"><section class="retail-modal" style="max-width:740px">'
      + '<div class="retail-modal-head"><div><h2>'+esc(titleLabel)+'</h2><p>Show or hide columns for ' + esc(page||'this table') + '</p></div><button type="button" onclick="document.getElementById(\'glDtDispModal\').remove()">Close</button></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px"><input type="search" id="glDispSearch" placeholder="Search columns…" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--line,#d5d0c5);border-radius:8px;font-size:13px"><button type="button" id="glDispAll">Select All</button><button type="button" id="glDispReset">Reset Defaults</button></div>'
      + '<div class="rco-display-cols">';
    for(const [grp, cols] of Object.entries(groups)){
      const allChk = cols.every(c=>c.checked);
      html += '<div class="rco-display-group"><h4><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="gl-grp-chk" '+(allChk?'checked':'')+'> <span>'+esc(grp)+' ('+cols.filter(c=>c.checked).length+'/'+cols.length+')</span></label></h4>';
      cols.forEach(c => {
        html += '<label class="gl-disp-item"><input type="checkbox" data-gl-col="'+c.idx+'" '+(c.checked?'checked':'')+'> <span>'+esc(c.label)+'</span></label>';
      });
      html += '</div>';
    }
    html += '</div><div class="retail-modal-actions"><button type="button" class="primary" id="glDispApply">Apply Columns</button></div></section></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    const modal = document.getElementById('glDtDispModal');
    modal.querySelector('#glDispSearch').oninput = (e) => {
      const q = e.target.value.trim().toLowerCase();
      modal.querySelectorAll('.gl-disp-item').forEach(lbl => {
        lbl.style.display = (!q || lbl.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
      });
    };
    modal.querySelectorAll('.gl-grp-chk').forEach(gcb => {
      gcb.onchange = () => {
        gcb.closest('.rco-display-group').querySelectorAll('[data-gl-col]').forEach(cb => { cb.checked = gcb.checked; });
      };
    });
    modal.querySelector('#glDispAll').onclick = () => modal.querySelectorAll('[data-gl-col], .gl-grp-chk').forEach(cb=>cb.checked=true);
    modal.querySelector('#glDispReset').onclick = () => {
      localStorage.removeItem(storeKey);
      modal.querySelectorAll('[data-gl-col]').forEach(cb=>cb.checked=true);
    };
    modal.querySelector('#glDispApply').onclick = () => {
      const nextHidden = [];
      modal.querySelectorAll('[data-gl-col]').forEach(cb => { if(!cb.checked) nextHidden.push(Number(cb.dataset.glCol)); });
      localStorage.setItem(storeKey, JSON.stringify(nextHidden));
      applyColVisibility(tbl, new Set(nextHidden));
      modal.remove();
    };
  }

  function buildFilterBar(tbl, dataRows, storeFilterKey, onFilterApplied){
    const headCells = Array.from(tbl.querySelectorAll('thead th'));
    // Auto-detect filterable categorical & date columns
    let dateColIdx = -1;
    const catCols = [];
    headCells.forEach((th, i) => {
      const t = th.textContent.trim();
      if(!t || th.classList.contains('gl-drill-col') || t.toLowerCase()==='actions') return;
      if(dateColIdx < 0 && /date|when/i.test(t)) dateColIdx = i;
      if(/group|status|type|ornament|metal|purity|city|team|segment|source|owner/i.test(t)){
        const vals = Array.from(new Set(dataRows.map(tr=>tr.children[i]?.innerText?.trim()).filter(v=>v && v!=='—'))).sort();
        if(vals.length >= 1 && vals.length <= 40) catCols.push({ idx: i, label: t, vals });
      }
    });

    let activeFilterKeys = new Set(JSON.parse(localStorage.getItem(storeFilterKey) || 'null') || ['date', ...catCols.slice(0,4).map(c=>String(c.idx))]);

    const bar = document.createElement('div');
    bar.className = 'gl-dt-filter-bar';

    const renderBar = () => {
      let inner = '';
      if(dateColIdx >= 0 && activeFilterKeys.has('date')){
        inner += '<label class="gl-dt-fitem"><span>From Date</span><input type="date" data-f-from></label>'
          + '<label class="gl-dt-fitem"><span>To Date</span><input type="date" data-f-to></label>';
      }
      catCols.forEach(c => {
        if(!activeFilterKeys.has(String(c.idx))) return;
        inner += '<label class="gl-dt-fitem"><span>'+esc(c.label)+'</span><select data-f-col="'+c.idx+'"><option value="">All</option>'+c.vals.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label>';
      });
      inner += '<div style="display:flex;gap:6px;align-items:center">'
        + '<button type="button" class="gl-dt-btn" data-f-cust>⚙️ Customize Filters</button>'
        + '<button type="button" class="gl-dt-btn" data-f-reset>Reset</button>'
        + '</div>';
      bar.innerHTML = inner;

      const apply = () => {
        const fromV = bar.querySelector('[data-f-from]')?.value || '';
        const toV = bar.querySelector('[data-f-to]')?.value || '';
        const sels = Array.from(bar.querySelectorAll('select[data-f-col]')).map(s=>({ idx:Number(s.dataset.fCol), val:s.value }));
        let vis = 0;
        dataRows.forEach(tr => {
          let ok = true;
          if(dateColIdx >= 0 && (fromV || toV)){
            const txt = (tr.children[dateColIdx]?.innerText || '').trim().slice(0,10);
            if(fromV && txt && txt < fromV) ok = false;
            if(toV && txt && txt > toV) ok = false;
          }
          for(const s of sels){
            if(s.val && (tr.children[s.idx]?.innerText?.trim() || '') !== s.val){ ok = false; break; }
          }
          tr.dataset.glFilterHide = ok ? '' : '1';
          const qHide = tr.dataset.glSearchHide === '1';
          tr.style.display = (ok && !qHide) ? '' : 'none';
          if(ok && !qHide) vis++;
        });
        onFilterApplied?.(vis);
      };

      bar.querySelectorAll('input,select').forEach(el => el.onchange = apply);
      bar.querySelector('[data-f-reset]').onclick = () => {
        bar.querySelectorAll('input').forEach(i=>i.value='');
        bar.querySelectorAll('select').forEach(s=>s.value='');
        apply();
      };
      bar.querySelector('[data-f-cust]').onclick = () => {
        document.getElementById('glCustFilterModal')?.remove();
        let mHtml = '<div id="glCustFilterModal" class="retail-modal-backdrop" role="dialog" aria-modal="true"><section class="retail-modal" style="max-width:440px">'
          + '<div class="retail-modal-head"><div><h2>Customize Filters</h2><p>Choose filter fields for this table</p></div><button type="button" onclick="document.getElementById(\'glCustFilterModal\').remove()">Close</button></div>'
          + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input type="search" id="glCfSearch" placeholder="Search filters…" style="flex:1;padding:6px 10px;border:1px solid var(--line,#d5d0c5);border-radius:8px;font-size:13px"><button type="button" id="glCfAll">Select All</button></div>'
          + '<div class="rco-check-row" style="flex-direction:column;align-items:flex-start;max-height:50vh;overflow:auto">'
          + (dateColIdx>=0 ? '<label class="gl-cf-item"><input type="checkbox" data-cf-key="date" '+(activeFilterKeys.has('date')?'checked':'')+'> Date Range (From / To)</label>' : '')
          + catCols.map(c=>'<label class="gl-cf-item"><input type="checkbox" data-cf-key="'+c.idx+'" '+(activeFilterKeys.has(String(c.idx))?'checked':'')+'> '+esc(c.label)+'</label>').join('')
          + '</div><div class="retail-modal-actions"><button type="button" class="primary" id="glCfApply">Apply</button></div></section></div>';
        document.body.insertAdjacentHTML('beforeend', mHtml);
        const cm = document.getElementById('glCustFilterModal');
        cm.querySelector('#glCfSearch').oninput = (e) => {
          const q = e.target.value.trim().toLowerCase();
          cm.querySelectorAll('.gl-cf-item').forEach(lbl => { lbl.style.display = (!q || lbl.textContent.toLowerCase().includes(q)) ? 'inline-flex' : 'none'; });
        };
        cm.querySelector('#glCfAll').onclick = () => cm.querySelectorAll('[data-cf-key]').forEach(cb=>cb.checked=true);
        cm.querySelector('#glCfApply').onclick = () => {
          const next = [];
          cm.querySelectorAll('[data-cf-key]').forEach(cb => { if(cb.checked) next.push(cb.dataset.cfKey); });
          activeFilterKeys = new Set(next);
          localStorage.setItem(storeFilterKey, JSON.stringify(next));
          cm.remove();
          renderBar();
        };
      };
    };
    renderBar();
    return { bar, hasAny: (dateColIdx >= 0 || catCols.length > 0) };
  }

  function findDrillHtml(tr){
    const billBtn = tr.querySelector('[data-bill-id]');
    if(billBtn){
      const id = billBtn.dataset.billId;
      const sale = (db.sales||[]).find(s=>s.id===id);
      if(sale){
        const items = Array.isArray(sale.invoiceItems) && sale.invoiceItems.length ? sale.invoiceItems : (Array.isArray(sale.items) && sale.items.length ? sale.items : [sale]);
        const rows = items.map((it, i) => '<tr><td>'+(i+1)+'</td><td><b>'+esc(it.product||sale.product||'—')+'</b></td><td>'+esc(it.tagCode||it.huid||'—')+'</td><td>'+(it.pieces||1)+'</td><td>'+fmt(it.grossWeight||it.weight||0)+' g</td><td>'+fmt(it.netWeight||it.weight||0)+' g</td><td>'+esc(it.purity?(n(it.purity)>24?n(it.purity)+'%':Math.round(n(it.purity))+'K'):(sale.purityLabel||'—'))+'</td><td>'+n(it.wastage||sale.wastage)+'%</td><td>'+rateMoney(it.makingTotal||it.making||0)+'</td><td><b>'+rateMoney(it.subtotal||sale.amount||0)+'</b></td></tr>').join('');
        return '<div class="gl-drill-box"><h4>Bill Breakdown · '+esc(sale.documentNo||id.slice(0,8))+' ('+items.length+' item'+(items.length>1?'s':'')+')</h4><table><thead><tr><th>#</th><th>Product</th><th>Tag / HUID</th><th>Pcs</th><th>Gross g</th><th>Net g</th><th>Purity</th><th>Wastage</th><th>Making</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'
          +(sale.exchangeAmount>0?'<p style="margin:6px 0 0;font-size:11px"><b>Old Gold Credit:</b> − '+rateMoney(sale.exchangeAmount)+' | <b>Collected:</b> '+rateMoney(sale.collectedAmount||0)+'</p>':'')+'</div>';
      }
    }
    const quoteBtn = tr.querySelector('[onclick*="rcEditEstimate("]');
    if(quoteBtn){
      const m = String(quoteBtn.getAttribute('onclick')||'').match(/rcEditEstimate\('([^']+)'\)/);
      if(m){
        const q = (db.retailDocuments||[]).find(x=>x.id===m[1]);
        if(q && Array.isArray(q.items)){
          const rows = q.items.map((it, i) => '<tr><td>'+(i+1)+'</td><td><b>'+esc(it.product||'—')+'</b></td><td>'+esc(it.purity||'—')+'</td><td>'+(it.pieces||1)+'</td><td>'+fmt(it.grossWeight||0)+' g</td><td>'+fmt(it.netWeight||0)+' g</td><td>'+rateMoney(it.rate||0)+'</td><td>'+rateMoney(it.makingTotal||0)+'</td><td><b>'+rateMoney(it.subtotal||0)+'</b></td></tr>').join('');
          return '<div class="gl-drill-box"><h4>Quotation Items · '+esc(q.documentNo)+'</h4><table><thead><tr><th>#</th><th>Product</th><th>Purity</th><th>Pcs</th><th>Gross g</th><th>Net g</th><th>Rate</th><th>Making</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
        }
      }
    }
    const prodBtn = tr.querySelector('[onclick*="rcEditProduct("]');
    if(prodBtn){
      const m = String(prodBtn.getAttribute('onclick')||'').match(/rcEditProduct\('([^']+)'\)/);
      if(m){
        const prod = (db.retailDocuments||[]).find(x=>x.id===m[1]);
        if(prod){
          const slabs = (db.retailDocuments||[]).filter(x=>x.type==='retail-cost-structure' && String(x.product||'').toLowerCase()===String(prod.name||'').toLowerCase());
          const tags = (db.retailDocuments||[]).filter(x=>x.type==='retail-tagging' && String(x.product||'').toLowerCase()===String(prod.name||'').toLowerCase());
          return '<div class="gl-drill-box"><h4>Product Drill-Down · '+esc(prod.name)+'</h4>'
            + '<p style="margin:0 0 6px;font-size:11.5px"><b>Description:</b> '+esc(prod.description||'—')+' | <b>Tags in Stock:</b> '+tags.filter(t=>t.status!=='Sold').length+' | <b>Cost Slabs:</b> '+slabs.length+'</p>'
            + (slabs.length ? '<table><thead><tr><th>From Wt</th><th>To Wt</th><th>MC</th><th>Wst</th><th>Rate</th></tr></thead><tbody>'+slabs.map(s=>'<tr><td>'+fmt(s.fromWeight)+' g</td><td>'+fmt(s.toWeight)+' g</td><td>'+rateMoney(s.mc)+' ('+esc(s.mcType)+')</td><td>'+n(s.wst)+' '+esc(s.wstType)+'</td><td>'+rateMoney(s.rate)+'</td></tr>').join('')+'</tbody></table>' : '')
            + '</div>';
        }
      }
    }
    const cells = tr.querySelectorAll('td');
    if(cells.length >= 9 && page === 'Wholesale Lot'){
      const tag = cells[3]?.textContent?.trim();
      const lot = (db.wholesaleLots||[]).find(l=>l.packetTag===tag);
      if(lot){
        const sales = (db.wholesalePacketSales||[]).filter(s=>s.lotId===lot.id);
        const rows = sales.map(s => '<tr><td>'+esc(String(s.when||'').replace('T',' '))+'</td><td>'+esc((db.parties||[]).find(p=>p.id===s.partyId)?.name||'Party')+'</td><td>'+s.pieces+'</td><td>'+fmt(s.weight)+' g</td><td>'+fmt(s.purePayable)+' g</td><td>'+rateMoney(s.hallmarkTotal)+'</td></tr>').join('');
        return '<div class="gl-drill-box"><h4>Packet Sales History · '+esc(tag)+'</h4>'+(sales.length?'<table><thead><tr><th>Date</th><th>Party</th><th>Pcs</th><th>Weight g</th><th>Pure g</th><th>Hallmark</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="muted" style="margin:0">No packet sales issued from this lot yet.</p>')+'</div>';
      }
    }
    if(page === 'Summary' && cells.length >= 4){
      const name = cells[0]?.textContent?.trim();
      const isRetail = workspaceMode === 'retail';
      const acc = (isRetail ? db.customers : db.parties)?.find(a=>a.name===name);
      if(acc && typeof tx === 'function'){
        const txs = tx(acc.id, isRetail?'customer':'party').slice(0,8);
        return '<div class="gl-drill-box"><h4>Recent Transactions · '+esc(acc.name)+'</h4>'+(txs.length?'<table><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Amount / Wt</th></tr></thead><tbody>'+txs.map(r=>'<tr><td>'+esc(String(r.when||r.date||'').slice(0,16).replace('T',' '))+'</td><td>'+esc(r.type)+'</td><td>'+esc(r.product||r.desc||'—')+'</td><td>'+(isRetail?rateMoney(r.amount):fmt(r.amount)+' g')+'</td></tr>').join('')+'</tbody></table>':'<p class="muted" style="margin:0">No transactions yet.</p>')+'</div>';
      }
    }
    return '';
  }

  function enhanceEntryFormTables(){
    [['rbItemsTable','.rb-section-head > div','Sales Bill Columns'],['rcQuoteTable','.rc-section-title','Quotation Item Columns']].forEach(([tblId, headSel, lbl])=>{
      const tbl = document.getElementById(tblId);
      if(!tbl || tbl.dataset.glEntryDisp) return;
      tbl.dataset.glEntryDisp = '1';
      const storeKey = 'goldleaf-dt-cols::entry::' + tblId;
      const hidden = new Set(JSON.parse(localStorage.getItem(storeKey) || '[]'));
      if(hidden.size) applyColVisibility(tbl, hidden);
      const sec = tbl.closest('section, .panel');
      const headSlot = sec?.querySelector(headSel);
      if(headSlot){
        const btn = document.createElement('button'); btn.type='button'; btn.className='gl-dt-btn'; btn.textContent='⚙️ Display';
        btn.onclick = () => openDisplayColumnsModal(tbl, storeKey, lbl);
        headSlot.prepend(btn);
      }
    });
  }

  function enhanceTables(){
    enhanceEntryFormTables();
    const app = document.getElementById('app'); if(!app) return;
    app.querySelectorAll('.table').forEach((wrap, idx) => {
      if(wrap.dataset.glDtDone) return;
      const tbl = wrap.querySelector('table'); if(!tbl) return;
      if(tbl.id==='rbItemsTable' || tbl.id==='rcQuoteTable' || tbl.closest('form')) return;
      const tbody = tbl.querySelector('tbody'); if(!tbody) return;
      const dataRows = Array.from(tbody.querySelectorAll(':scope > tr:not(.gl-history-total):not(.rco-subtable-row):not(.gl-drill-row)'));
      if(dataRows.length === 0) return;

      wrap.dataset.glDtDone = '1';

      const hasNativeExpand = !!tbl.querySelector('tbody button[onclick*="Toggle"], tbody button[onclick*="Expanded"]');
      if(!hasNativeExpand){
        const sampleHtml = findDrillHtml(dataRows[0]);
        if(sampleHtml){
          const headTr = tbl.querySelector('thead tr');
          if(headTr) headTr.insertAdjacentHTML('afterbegin', '<th class="gl-drill-col" style="width:32px"></th>');
          tbody.querySelectorAll(':scope > tr').forEach(tr => {
            if(tr.classList.contains('gl-history-total')){
              tr.insertAdjacentHTML('afterbegin', '<td class="gl-drill-col"></td>');
              return;
            }
            const drillHtml = findDrillHtml(tr);
            const td = document.createElement('td'); td.className = 'gl-drill-col';
            if(drillHtml){
              const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'gl-drill-btn'; btn.textContent = '+'; btn.title = 'Expand details';
              btn.onclick = () => {
                const next = tr.nextElementSibling;
                if(next && next.classList.contains('gl-drill-row')){
                  next.remove(); btn.textContent = '+';
                } else {
                  const dr = document.createElement('tr'); dr.className = 'gl-drill-row';
                  const colCount = tr.querySelectorAll('td').length;
                  dr.innerHTML = '<td colspan="'+colCount+'">'+drillHtml+'</td>';
                  tr.after(dr); btn.textContent = '−';
                }
              };
              td.append(btn);
            }
            tr.prepend(td);
          });
        }
      }

      const headCells = Array.from(tbl.querySelectorAll('thead th'));
      headCells.forEach((th, colIdx) => {
        if(th.classList.contains('gl-drill-col') || !th.textContent.trim() || th.textContent.trim().toLowerCase()==='actions') return;
        th.classList.add('gl-dt-sort');
        th.onclick = () => {
          const asc = !th.classList.contains('asc');
          headCells.forEach(h=>h.classList.remove('asc','desc'));
          th.classList.add(asc?'asc':'desc');
          tbody.querySelectorAll('.gl-drill-row').forEach(r=>r.remove());
          tbody.querySelectorAll('.gl-drill-btn').forEach(b=>b.textContent='+');
          const totalRows = Array.from(tbody.querySelectorAll(':scope > tr.gl-history-total'));
          const sortable = Array.from(tbody.querySelectorAll(':scope > tr:not(.gl-history-total):not(.rco-subtable-row)'));
          sortable.sort((a,b)=>{
            const av = parseSortVal(a.children[colIdx]?.innerText);
            const bv = parseSortVal(b.children[colIdx]?.innerText);
            if(typeof av==='number' && typeof bv==='number') return asc ? av-bv : bv-av;
            return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
          });
          sortable.forEach(r=>tbody.append(r));
          totalRows.forEach(r=>tbody.append(r));
        };
      });

      const storeKey = 'goldleaf-dt-cols::' + (page||'page') + '::' + idx;
      const storeFilterKey = 'goldleaf-dt-filters::' + (page||'page') + '::' + idx;
      const hidden = new Set(JSON.parse(localStorage.getItem(storeKey) || '[]'));
      if(hidden.size) applyColVisibility(tbl, hidden);

      const panel = wrap.closest('.panel, section');
      const rcoBarRight = panel?.querySelector(':scope > .rco-toolbar .rco-toolbar-right');

      if(rcoBarRight){
        if(!rcoBarRight.querySelector('.gl-dt-disp-trigger')){
          const dispBtn = document.createElement('button'); dispBtn.type='button'; dispBtn.className='gl-dt-btn gl-dt-disp-trigger'; dispBtn.textContent='⚙️ Display Columns';
          dispBtn.onclick = () => openDisplayColumnsModal(tbl, storeKey);
          rcoBarRight.append(dispBtn);
          const csvBtn = document.createElement('button'); csvBtn.type='button'; csvBtn.className='gl-dt-btn gl-dt-csv'; csvBtn.textContent='CSV';
          csvBtn.onclick = () => exportTableCsv(tbl);
          rcoBarRight.append(csvBtn);
        }
      } else if(dataRows.length >= 1 && !panel?.querySelector(':scope > .filters')){
        const dtBar = document.createElement('div'); dtBar.className = 'gl-dt-bar';
        dtBar.innerHTML = '<div class="gl-dt-left"><input type="search" class="gl-dt-search" placeholder="Search table rows…"><span class="gl-dt-pill">'+dataRows.length+' rows</span></div><div class="gl-dt-right"></div>';
        const dtRight = dtBar.querySelector('.gl-dt-right');
        const pill = dtBar.querySelector('.gl-dt-pill');

        const { bar: filterBar, hasAny } = buildFilterBar(tbl, dataRows, storeFilterKey, (vis) => {
          pill.textContent = vis + ' / ' + dataRows.length + ' rows';
        });
        if(hasAny){
          const fBtn = document.createElement('button'); fBtn.type='button'; fBtn.className='gl-dt-btn'; fBtn.textContent='🔍 Filter';
          fBtn.onclick = () => { fBtn.classList.toggle('active'); filterBar.classList.toggle('open'); };
          dtRight.append(fBtn);
        }

        const dispBtn = document.createElement('button'); dispBtn.type='button'; dispBtn.className='gl-dt-btn'; dispBtn.textContent='⚙️ Display Columns';
        dispBtn.onclick = () => openDisplayColumnsModal(tbl, storeKey);
        dtRight.append(dispBtn);

        const csvBtn = document.createElement('button'); csvBtn.type='button'; csvBtn.className='gl-dt-btn gl-dt-csv'; csvBtn.textContent='CSV';
        csvBtn.onclick = () => exportTableCsv(tbl);
        dtRight.append(csvBtn);

        const searchInp = dtBar.querySelector('.gl-dt-search');
        searchInp.oninput = () => {
          const q = searchInp.value.trim().toLowerCase();
          let vis = 0;
          tbody.querySelectorAll('.gl-drill-row').forEach(r=>r.remove());
          tbody.querySelectorAll('.gl-drill-btn').forEach(b=>b.textContent='+');
          dataRows.forEach(tr => {
            const match = !q || tr.innerText.toLowerCase().includes(q);
            tr.dataset.glSearchHide = match ? '' : '1';
            const fHide = tr.dataset.glFilterHide === '1';
            tr.style.display = (match && !fHide) ? '' : 'none';
            if(match && !fHide) vis++;
          });
          pill.textContent = vis + ' / ' + dataRows.length + ' rows';
        };
        wrap.parentNode.insertBefore(dtBar, wrap);
        if(hasAny) wrap.parentNode.insertBefore(filterBar, wrap);
      }
    });
  }

  const dtPrevRender = window.render;
  window.render = function(){
    const res = dtPrevRender.apply(this, arguments);
    requestAnimationFrame(enhanceTables);
    return res;
  };
  requestAnimationFrame(enhanceTables);
})();
