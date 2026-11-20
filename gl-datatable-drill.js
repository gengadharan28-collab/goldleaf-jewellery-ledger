// Universal Data Table (Search, Sort, Column Visibility, CSV Export, Table Lines) & Hierarchy Drill-Down across all Goldleaf histories and pages.
(function(){
  const style = document.createElement('style');
  style.textContent = `
    .gl-dt-wrap{display:flex;flex-direction:column;gap:8px;max-width:100%}
    .gl-dt-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--paper,#f8f6f1);border:1px solid var(--line,#e2ddd3);border-radius:10px;margin-bottom:8px}
    .gl-dt-left,.gl-dt-right{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .gl-dt-search{min-width:180px;max-width:280px;padding:6px 10px;border:1px solid var(--line,#d5d0c5);border-radius:8px;font-size:12.5px;background:var(--white,#fff);color:var(--ink,#222)}
    .gl-dt-pill{font-size:11px;font-weight:750;padding:4px 9px;border-radius:999px;background:#ede8dc;color:#5a4d34}
    .gl-dt-btn{padding:5px 10px;border-radius:7px;border:1px solid var(--line,#d5d0c5);background:var(--white,#fff);color:var(--ink,#222);font-size:11.5px;font-weight:700;cursor:pointer}
    .gl-dt-col-menu{position:relative;display:inline-block}
    .gl-dt-col-pop{position:absolute;right:0;top:100%;margin-top:4px;z-index:50;min-width:190px;max-height:240px;overflow:auto;background:var(--white,#fff);border:1px solid var(--line,#d5d0c5);border-radius:10px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.15);display:none}
    .gl-dt-col-pop.open{display:block}
    .gl-dt-col-pop label{display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 2px;cursor:pointer;white-space:nowrap}
    /* Crisp Table Grid Lines & Single-Line Straight Row Content across all pages */
    .table{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line,#ded8cc);border-radius:10px}
    .table table{border-collapse:collapse;width:max-content;min-width:100%}
    .table table th,.table table td{border:1px solid var(--line,#e4dfd4)!important;vertical-align:middle!important}
    .table table tr:not(.gl-drill-row):not(.rco-subtable-row) > th,.table table tr:not(.gl-drill-row):not(.rco-subtable-row) > td{white-space:nowrap!important}
    .gl-drill-box th,.gl-drill-box td{white-space:nowrap!important;vertical-align:middle!important}
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
    html[data-theme="dark"] .gl-dt-bar,html[data-theme="dark"] tr.gl-drill-row>td,html[data-theme="dark"] .table table thead th{background:#1b221d!important;border-color:#354038!important}
    html[data-theme="dark"] .table,html[data-theme="dark"] .table table th,html[data-theme="dark"] .table table td,html[data-theme="dark"] .gl-drill-box th,html[data-theme="dark"] .gl-drill-box td{border-color:#354038!important}
    html[data-theme="dark"] .gl-dt-search,html[data-theme="dark"] .gl-dt-btn,html[data-theme="dark"] .gl-dt-col-pop,html[data-theme="dark"] .gl-drill-box,html[data-theme="dark"] .gl-drill-btn{background:#222b25!important;border-color:#3b463e!important;color:#eee8da!important}
    html[data-theme="dark"] .gl-dt-pill{background:#2d362f;color:#e6d8bb}
    @media(max-width:760px){
      .gl-dt-bar{flex-direction:column;align-items:stretch}
      .gl-dt-search{max-width:100%;width:100%;font-size:15px}
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

  function findDrillHtml(tr){
    // 1. Retail Sales History row
    const billBtn = tr.querySelector('[data-bill-id]');
    if(billBtn){
      const id = billBtn.dataset.billId;
      const sale = (db.sales||[]).find(s=>s.id===id);
      if(sale){
        const items = Array.isArray(sale.items) && sale.items.length ? sale.items : [sale];
        const rows = items.map((it, i) => '<tr><td>'+(i+1)+'</td><td><b>'+esc(it.product||sale.product||'—')+'</b></td><td>'+esc(it.tagCode||it.huid||'—')+'</td><td>'+(it.pieces||1)+'</td><td>'+fmt(it.grossWeight||it.weight||0)+' g</td><td>'+fmt(it.netWeight||it.weight||0)+' g</td><td>'+esc(it.purity||sale.purity||'—')+'</td><td>'+n(it.wastage||sale.wastage)+'%</td><td>'+rateMoney(it.makingTotal||it.making||0)+'</td><td><b>'+rateMoney(it.subtotal||sale.amount||0)+'</b></td></tr>').join('');
        return '<div class="gl-drill-box"><h4>Bill Breakdown · '+esc(sale.documentNo||id.slice(0,8))+' ('+items.length+' item'+(items.length>1?'s':'')+')</h4><table><thead><tr><th>#</th><th>Product</th><th>Tag / HUID</th><th>Pcs</th><th>Gross g</th><th>Net g</th><th>Purity</th><th>Wastage</th><th>Making</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'
          +(sale.exchangeAmount>0?'<p style="margin:6px 0 0;font-size:11px"><b>Old Gold Credit:</b> − '+rateMoney(sale.exchangeAmount)+' | <b>Collected:</b> '+rateMoney(sale.collectedAmount||0)+'</p>':'')+'</div>';
      }
    }
    // 2. Retail Quotation History row
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
    // 3. Retail Product Master row (expand Cost Structure slabs + Tags)
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
    // 4. Wholesale Lot row
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
    // 5. Summary Page (Customer / Party Summary drill-down)
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

  function enhanceTables(){
    const app = document.getElementById('app'); if(!app) return;
    app.querySelectorAll('.table').forEach((wrap) => {
      if(wrap.dataset.glDtDone) return;
      const tbl = wrap.querySelector('table'); if(!tbl) return;
      if(tbl.id==='rbItemsTable' || tbl.id==='rcQuoteTable' || tbl.closest('form')) return;
      const tbody = tbl.querySelector('tbody'); if(!tbody) return;
      const dataRows = Array.from(tbody.querySelectorAll(':scope > tr:not(.gl-history-total):not(.rco-subtable-row):not(.gl-drill-row)'));
      if(dataRows.length === 0) return;

      wrap.dataset.glDtDone = '1';

      // Inject Hierarchy Drill-Down buttons if drillable rows exist and table doesn't already have expand buttons
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

      const panel = wrap.closest('.panel, section');
      const hasToolbar = panel && (panel.querySelector(':scope > .rco-toolbar') || panel.querySelector(':scope > .filters'));

      // Sortable headers
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

      if(dataRows.length >= 1 && !hasToolbar){
        const dtBar = document.createElement('div'); dtBar.className = 'gl-dt-bar';
        const colChecks = headCells.map((th, i) => {
          const t = th.textContent.trim();
          if(!t || th.classList.contains('gl-drill-col')) return '';
          return '<label><input type="checkbox" checked data-col-idx="'+i+'"> '+esc(t)+'</label>';
        }).filter(Boolean).join('');

        dtBar.innerHTML = '<div class="gl-dt-left"><input type="search" class="gl-dt-search" placeholder="Search table rows…"><span class="gl-dt-pill">'+dataRows.length+' rows</span></div>'
          + '<div class="gl-dt-right">'
          + (headCells.length >= 5 ? '<div class="gl-dt-col-menu"><button type="button" class="gl-dt-btn">Columns ▾</button><div class="gl-dt-col-pop">'+colChecks+'</div></div>' : '')
          + '<button type="button" class="gl-dt-btn gl-dt-csv">CSV</button>'
          + '</div>';

        const searchInp = dtBar.querySelector('.gl-dt-search');
        const pill = dtBar.querySelector('.gl-dt-pill');
        searchInp.oninput = () => {
          const q = searchInp.value.trim().toLowerCase();
          let vis = 0;
          tbody.querySelectorAll('.gl-drill-row').forEach(r=>r.remove());
          tbody.querySelectorAll('.gl-drill-btn').forEach(b=>b.textContent='+');
          dataRows.forEach(tr => {
            const match = !q || tr.innerText.toLowerCase().includes(q);
            tr.style.display = match ? '' : 'none';
            if(match) vis++;
          });
          pill.textContent = vis + ' / ' + dataRows.length + ' rows';
        };

        const colBtn = dtBar.querySelector('.gl-dt-col-menu > button');
        const colPop = dtBar.querySelector('.gl-dt-col-pop');
        if(colBtn && colPop){
          colBtn.onclick = (e) => { e.stopPropagation(); colPop.classList.toggle('open'); };
          colPop.querySelectorAll('input[data-col-idx]').forEach(cb => {
            cb.onchange = () => {
              const ci = Number(cb.dataset.colIdx);
              tbl.querySelectorAll('tr').forEach(tr => {
                if(tr.classList.contains('gl-drill-row')) return;
                const cell = tr.children[ci];
                if(cell) cell.style.display = cb.checked ? '' : 'none';
              });
            };
          });
        }
        dtBar.querySelector('.gl-dt-csv').onclick = () => exportTableCsv(tbl);
        wrap.parentNode.insertBefore(dtBar, wrap);
      }
    });
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.gl-dt-col-pop.open').forEach(p=>p.classList.remove('open'));
  });

  const dtPrevRender = window.render;
  window.render = function(){
    const res = dtPrevRender.apply(this, arguments);
    requestAnimationFrame(enhanceTables);
    return res;
  };
  requestAnimationFrame(enhanceTables);
})();
