(function () {
  "use strict";
  const n = (v) => Number(v || 0);
  const g = (v) => n(v).toFixed(3);
  const x = (v) => esc(String(v ?? ""));
  const uid = () => crypto.randomUUID();

  function ensure() {
    db.wholesaleLots = Array.isArray(db.wholesaleLots) ? db.wholesaleLots : [];
    db.wholesalePacketSales = Array.isArray(db.wholesalePacketSales) ? db.wholesalePacketSales : [];
    db.wholesalePacketReturns = Array.isArray(db.wholesalePacketReturns) ? db.wholesalePacketReturns : [];
    db.sales = Array.isArray(db.sales) ? db.sales : [];
    db.parties = Array.isArray(db.parties) ? db.parties : [];
    db.deletedWholesaleSaleIds = Array.isArray(db.deletedWholesaleSaleIds) ? db.deletedWholesaleSaleIds : [];
    db.deletedSaleIds = Array.isArray(db.deletedSaleIds) ? db.deletedSaleIds : [];
    if (db.deletedWholesaleSaleIds.length) {
      const delSet = new Set(db.deletedWholesaleSaleIds.map(String));
      db.wholesalePacketSales = db.wholesalePacketSales.filter(s => !delSet.has(String(s.id)));
    }
    if (db.deletedSaleIds.length) {
      const delSet = new Set(db.deletedSaleIds.map(String));
      db.sales = db.sales.filter(s => !delSet.has(String(s.id)));
    }
    // Safely migrate any legacy wholesale records out of retailDocuments
    if (Array.isArray(db.retailDocuments)) {
      const legacyLots = db.retailDocuments.filter(d => d && d.kind === 'wholesale-lot');
      const legacySales = db.retailDocuments.filter(d => d && d.kind === 'wholesale-packet-sale');
      const legacyReturns = db.retailDocuments.filter(d => d && d.kind === 'wholesale-packet-return');
      if (legacyLots.length) {
        const lotMap = new Map(db.wholesaleLots.map(l => [l.id, l]));
        legacyLots.forEach(l => lotMap.set(l.id, l));
        db.wholesaleLots = [...lotMap.values()];
      }
      if (legacySales.length) {
        const saleMap = new Map(db.wholesalePacketSales.map(s => [s.id, s]));
        legacySales.forEach(s => saleMap.set(s.id, s));
        db.wholesalePacketSales = [...saleMap.values()];
      }
      if (legacyReturns.length) {
        const retMap = new Map(db.wholesalePacketReturns.map(r => [r.id, r]));
        legacyReturns.forEach(r => retMap.set(r.id, r));
        db.wholesalePacketReturns = [...retMap.values()];
      }
      db.retailDocuments = db.retailDocuments.filter(d => !d || !['wholesale-lot','wholesale-packet-sale','wholesale-packet-return'].includes(d.kind));
    }
  }
  function addCloudDocument(record, kind) { record.kind = kind; record.updatedAt = new Date().toISOString(); }
  function lotById(id) { ensure(); return db.wholesaleLots.find((v) => v.id === id); }
  function lotByTag(tag) {
    ensure();
    const q = String(tag || '').trim().toLowerCase();
    if (!q) return null;
    return db.wholesaleLots.find((v) => (v.packetTag && String(v.packetTag).trim().toLowerCase() === q) || (v.lotNo && String(v.lotNo).trim().toLowerCase() === q));
  }
  function balance(lot) {
    const sold = db.wholesalePacketSales.filter((v) => v.lotId === lot.id);
    const soldPcs = sold.reduce((a, v) => a + n(v.pieces), 0);
    const soldWt = sold.reduce((a, v) => a + n(v.weight), 0);
    return {
      openingPieces: n(lot.pieces),
      openingWeight: n(lot.netWeight),
      soldPieces: soldPcs,
      soldWeight: soldWt,
      pieces: Math.max(0, n(lot.pieces) - soldPcs),
      weight: Math.max(0, n(lot.netWeight) - soldWt),
    };
  }
  function partyOptions() {
    return '<option value="">Select party</option>' + (db.parties || []).map((p) => '<option value="' + x(p.id) + '">' + x(p.name + (p.city ? ' · ' + p.city : '')) + '</option>').join("");
  }
  function lotOptions() {
    return '<option value="">Select packet tag</option>' + (db.wholesaleLots || []).map((l) => {
      const b = balance(l);
      const isExhausted = b.pieces <= 0 || b.weight <= 0.0001;
      const status = isExhausted ? ' [Sold out]' : b.soldPieces > 0 ? ' [Partial: ' + b.pieces + ' pcs left]' : '';
      return '<option value="' + x(l.id) + '">' + x(l.packetTag || l.lotNo) + ' · ' + x(l.product || 'Item') + ' · ' + g(b.weight) + ' g (' + b.pieces + ' pcs left)' + status + '</option>';
    }).join("");
  }
  function title(sub) { return header(sub, '<span class="wl-pill">Wholesale only</span>'); }

  window.wholesaleLotView = function () {
    ensure();
    const rows = db.wholesaleLots.slice().reverse().map((l) => {
      const b = balance(l);
      return '<tr><td>' + x(l.lotNo) + '</td><td>' + x(l.supplier) + '</td><td>' + x(l.product) + '</td><td><b>' + x(l.packetTag) + '</b></td><td>' + l.pieces + '</td><td>' + g(l.netWeight) + '</td><td>' + g(l.touch) + '</td><td>' + g(l.pureWeight) + '</td><td><b>' + b.pieces + ' pcs · ' + g(b.weight) + ' g</b></td></tr>';
    }).join("");
    const totalLotNet = db.wholesaleLots.reduce((s, l) => s + n(l.netWeight), 0);
    const totalLotPieces = db.wholesaleLots.reduce((s, l) => s + n(l.pieces), 0);
    const liveBalWeight = db.wholesaleLots.reduce((s, l) => s + balance(l).weight, 0);
    const liveBalPieces = db.wholesaleLots.reduce((s, l) => s + balance(l).pieces, 0);
    const lotCards = '<div class="cards">'
      + '<div class="card"><label>TOTAL LOTS RECEIVED</label><b>' + db.wholesaleLots.length + '</b></div>'
      + '<div class="card"><label>OPENING STOCK</label><b>' + g(totalLotNet) + ' g · ' + totalLotPieces + ' pcs</b></div>'
      + '<div class="card"><label>LIVE STOCK BALANCE</label><b>' + g(liveBalWeight) + ' g</b></div>'
      + '<div class="card"><label>REMAINING PIECES</label><b>' + liveBalPieces + ' pcs</b></div>'
      + '</div>';
    return title('Supplier lot, packet tag and live stock in one connected page.')
      + lotCards
      + '<section class="panel wl-panel"><h2>Supplier lot received</h2><form onsubmit="wlSaveLot(event)"><div class="grid">'
      + '<label class="field"><span>Lot no.</span><input name="lotNo" required value="WL-' + Date.now().toString().slice(-6) + '"></label>'
      + '<label class="field"><span>Date & time</span><input name="when" type="datetime-local" required value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) + '"></label>'
      + '<label class="field"><span>Supplier *</span><input name="supplier" required></label><label class="field"><span>Product *</span><input name="product" required></label>'
      + '<label class="field"><span>Total pieces *</span><input name="pieces" type="number" min="1" step="1" required></label><label class="field"><span>Gross weight · g *</span><input name="gross" type="number" min=".001" step=".001" required oninput="wlLotCalc(this.form)"></label>'
      + '<label class="field"><span>Stone · g</span><input name="stone" type="number" min="0" step=".001" value="0" oninput="wlLotCalc(this.form)"></label><label class="field"><span>Enamel / other less · g</span><input name="less" type="number" min="0" step=".001" value="0" oninput="wlLotCalc(this.form)"></label>'
      + '<label class="field"><span>Net gold · g</span><input name="net" readonly></label><label class="field"><span>Touch % *</span><input name="touch" type="number" min="1" max="100" step=".001" required oninput="wlLotCalc(this.form)"></label><label class="field"><span>Pure weight · g</span><input name="pure" readonly></label>'
      + '<label class="field"><span>Pure rate · ₹/g</span><input name="rate" type="number" min="0" step=".01"></label><label class="field"><span>Settlement</span><select name="settlement"><option>Gold</option><option>Cash converted to gold</option></select></label>'
      + '<label class="field"><span>Packet tag *</span><input name="tag" required placeholder="PKT-0001"></label><label class="field wide"><span>Lot / packet photos</span><input name="photos" type="file" accept="image/*" capture="environment" multiple></label>'
      + '</div><div class="right"><button class="primary">Save lot & create packet tag</button></div></form></section>'
      + '<section class="panel"><h2>Wholesale lot stock</h2><div class="table"><table><thead><tr><th>Lot</th><th>Supplier</th><th>Product</th><th>Packet</th><th>Opening pcs</th><th>Net g</th><th>Touch</th><th>Pure g</th><th>Live balance</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">No wholesale lots yet.</td></tr>') + '</tbody></table></div></section>';
  };
  window.wlLotCalc = function (f) { const net = Math.max(0, n(f.gross.value) - n(f.stone.value) - n(f.less.value)); f.net.value = g(net); f.pure.value = g(net * n(f.touch.value) / 100); };
  window.wlSaveLot = function (ev) {
    ev.preventDefault(); ensure(); const f = ev.target; const d = new FormData(f); const tag = String(d.get("tag")).trim();
    if (lotByTag(tag)) return say('This packet tag already exists.');
    const net = Math.max(0, n(d.get("gross")) - n(d.get("stone")) - n(d.get("less"))); const touch = n(d.get("touch"));
    if (!tag || net <= 0 || touch < 1 || touch > 100) return say('Enter a unique tag, valid weight and touch from 1 to 100.');
    const record={ id: uid(), lotNo: d.get("lotNo"), when: d.get("when"), supplier: d.get("supplier"), product: d.get("product"), pieces: n(d.get("pieces")), grossWeight: n(d.get("gross")), stoneWeight: n(d.get("stone")), lessWeight: n(d.get("less")), netWeight: net, touch, pureWeight: net * touch / 100, pureRate: n(d.get("rate")), settlement: d.get("settlement"), packetTag: tag, photoNames: [...f.photos.files].map((v) => v.name), updatedAt: new Date().toISOString() }; db.wholesaleLots.push(record);
    save(); render(); say('Wholesale lot and packet tag saved.');
  };

  window.wholesalePartySaleView = function () {
    ensure();
    const rows = db.wholesalePacketSales.slice().reverse().map((s) => {
      const l = lotById(s.lotId), p = db.parties.find((v) => v.id === s.partyId);
      return '<tr><td>' + x(s.when.replace('T', ' ')) + '</td><td>' + x(p?.name || 'Party') + '</td><td><b>' + x(l?.packetTag || s.packetTag || s.lotId) + '</b></td><td>' + x(l?.product || s.product || '—') + '</td><td>' + s.pieces + '</td><td>' + g(s.weight) + '</td><td>' + g(s.purePayable) + '</td><td>₹ ' + n(s.hallmarkTotal).toFixed(2) + '</td><td><button type="button" class="rb-delete-btn" onclick="wlDeleteSale(\'' + s.id + '\')">×</button></td></tr>';
    }).join("");
    const totalWeight = db.wholesalePacketSales.reduce((sum, s) => sum + n(s.weight), 0);
    const totalPieces = db.wholesalePacketSales.reduce((sum, s) => sum + n(s.pieces || 1), 0);
    const totalPure = db.wholesalePacketSales.reduce((sum, s) => sum + n(s.purePayable), 0);
    const totalHallmark = db.wholesalePacketSales.reduce((sum, s) => sum + n(s.hallmarkTotal), 0);
    const cards = '<div class="cards">'
      + '<div class="card"><label>TOTAL WEIGHT ISSUED</label><b>' + g(totalWeight) + ' g</b></div>'
      + '<div class="card"><label>TOTAL PIECES ISSUED</label><b>' + totalPieces + ' pcs</b></div>'
      + '<div class="card"><label>PURE GOLD PAYABLE</label><b>' + g(totalPure) + ' g</b></div>'
      + '<div class="card"><label>HALLMARK CHARGES</label><b>₹ ' + totalHallmark.toFixed(2) + '</b></div>'
      + '</div>';
    return title('Scan a wholesale packet and issue partial pieces and weight to a party.')
      + cards
      + '<section class="panel wl-panel"><div class="v2-section-head"><h2>Wholesale party sales entry</h2></div>'
      + '<form onsubmit="wlSaveSale(event)"><div class="grid">'
      + '<label class="field"><span>Party *</span><div style="display:flex;gap:6px"><select name="partyId" required style="flex:1">' + partyOptions() + '</select><button type="button" onclick="go(\'Party Register\')" style="white-space:nowrap;font-size:12px;padding:4px 8px">＋ Party</button></div></label>'
      + '<label class="field"><span>Date & time</span><input name="when" type="datetime-local" required value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) + '"></label>'
      + '<label class="field wl-scan-field"><span>Packet tag / Search *</span><div class="wl-scan-row"><input id="wlSaleTagInput" placeholder="Scan / type tag" oninput="wlOnTagInput(this)" onchange="wlOnTagChange(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();wlOnTagChange(this);}" style="max-width:140px"><select id="wlSaleLot" name="lotId" required onchange="wlLoadSalePacket(this.form)">' + lotOptions() + '</select><button type="button" class="gl-scan-btn" onclick="wlScanSale()">▣ Scan</button></div></label>'
      + '<label class="field"><span>Product *</span><input name="product" readonly placeholder="Auto from packet" style="font-weight:700;background:#fbfbfb"></label>'
      + '<label class="field"><span>Available stock</span><input name="available" readonly style="background:#fbfbfb"></label>'
      + '<div class="field wide wl-sale-mode-box"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><span style="font-size:11px;font-weight:750;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-right:6px">Sale Mode:</span><button type="button" class="gl-scan-btn" style="padding:4px 10px;font-size:12px" onclick="wlApplySaleMode(\'1pc\',this.form)">1 Pc partial</button><button type="button" class="gl-scan-btn" style="padding:4px 10px;font-size:12px" onclick="wlApplySaleMode(\'full\',this.form)">Full packet</button></div><span id="wlRemainingBadge" style="font-size:12px;font-weight:750;color:#18392a;background:#edf7f0;padding:4px 8px;border-radius:6px;border:1px solid #cce5d4">Select packet for stock balance</span></div></div>'
      + '<label class="field"><span>Issued pieces *</span><input name="pieces" type="number" min="1" step="1" required oninput="wlOnPiecesInput(this.form)"></label>'
      + '<label class="field"><span>Issued weight · g *</span><input name="weight" type="number" min=".001" step=".001" required oninput="wlSaleCalc(this.form)"></label>'
      + '<label class="field"><span>Touch %</span><input name="touch" type="number" min="1" max="100" step=".001" required oninput="wlSaleCalc(this.form)"></label>'
      + '<label class="field"><span>Wastage %</span><input name="wastage" type="number" min="0" step=".001" value="0" oninput="wlSaleCalc(this.form)"></label>'
      + '<label class="field"><span>Pure payable · g</span><input name="pure" readonly style="font-weight:700;color:var(--green,#194735);background:#f2f7f3"></label>'
      + '<label class="field"><span>Hallmark type</span><select name="hallmark"><option>None</option><option>HUID</option><option>Non-HUID</option></select></label>'
      + '<label class="field"><span>Hallmark ₹ / piece</span><input name="hallmarkRate" type="number" min="0" step=".01" value="0" oninput="wlSaleCalc(this.form)"></label>'
      + '<label class="field"><span>Hallmark total</span><input name="hallmarkTotal" readonly style="font-weight:700;background:#fbfbfb"></label>'
      + '<label class="field wide"><span>Delivery photos</span><input name="photos" type="file" accept="image/*" capture="environment" multiple></label>'
      + '</div><div class="right" style="margin-top:18px"><button class="primary" style="min-width:160px;font-weight:700">Save party sale</button></div></form></section>'
      + '<section class="panel"><h2>Live party sales</h2><div class="table"><table><thead><tr><th>Date</th><th>Party</th><th>Packet</th><th>Product</th><th>Pcs</th><th>Weight g</th><th>Pure payable</th><th>Hallmark</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">No packet sales yet.</td></tr>') + '</tbody></table></div></section>';
  };
  window.wlOnTagInput = function (inp) {
    const raw = String(inp.value || '').trim().toLowerCase();
    if (!raw) return;
    const l = db.wholesaleLots.find(v => (v.packetTag && String(v.packetTag).trim().toLowerCase() === raw) || (v.lotNo && String(v.lotNo).trim().toLowerCase() === raw));
    if (l) {
      const sel = document.getElementById('wlSaleLot');
      if (sel) { sel.value = l.id; wlLoadSalePacket(sel.form); }
    }
  };
  window.wlOnTagChange = function (inp) {
    const raw = String(inp.value || '').trim().toLowerCase();
    if (!raw) return;
    const l = db.wholesaleLots.find(v => (v.packetTag && String(v.packetTag).trim().toLowerCase() === raw) || (v.lotNo && String(v.lotNo).trim().toLowerCase() === raw));
    if (l) {
      const sel = document.getElementById('wlSaleLot');
      if (sel) { sel.value = l.id; wlLoadSalePacket(sel.form); }
    } else {
      say('Packet tag "' + inp.value.trim() + '" not found in wholesale lots.');
    }
  };
  window.wlApplySaleMode = function(mode, f) {
    if (!f) return;
    const lotId = f.lotId ? f.lotId.value : (f.elements && f.elements.lotId ? f.elements.lotId.value : '');
    const l = lotById(lotId);
    if (!l) return say('Select a packet first.');
    const b = balance(l);
    if (b.pieces <= 0 || b.weight <= 0.0001) return say('This packet is already fully sold out.');
    if (mode === 'full') {
      f.pieces.value = b.pieces;
      f.weight.value = g(b.weight);
    } else if (mode === '1pc') {
      f.pieces.value = 1;
      const avg = b.pieces > 0 ? (b.weight / b.pieces) : b.weight;
      f.weight.value = g(avg);
    }
    wlSaleCalc(f);
  };
  window.wlOnPiecesInput = function(f) {
    if (!f) return;
    const lotId = f.lotId ? f.lotId.value : (f.elements && f.elements.lotId ? f.elements.lotId.value : '');
    const l = lotById(lotId);
    if (!l) { wlSaleCalc(f); return; }
    const b = balance(l);
    const pcs = n(f.pieces.value);
    if (pcs > b.pieces) {
      say('Packet only has ' + b.pieces + ' pieces available.');
      f.pieces.value = b.pieces;
    }
    if (b.pieces > 0 && n(f.pieces.value) > 0) {
      if (n(f.pieces.value) === b.pieces) {
        f.weight.value = g(b.weight);
      } else {
        const avg = b.weight / b.pieces;
        f.weight.value = g(avg * n(f.pieces.value));
      }
    }
    wlSaleCalc(f);
  };
  window.wlLoadSalePacket = function (f) {
    if (!f) return;
    const lotId = f.lotId ? f.lotId.value : (f.elements && f.elements.lotId ? f.elements.lotId.value : '');
    const l = lotById(lotId);
    if (!l) {
      if (f.product) f.product.value = '';
      if (f.available) f.available.value = '';
      const badge = document.getElementById('wlRemainingBadge');
      if (badge) badge.textContent = 'Select packet for stock balance';
      return;
    }
    const b = balance(l);
    if (f.product) f.product.value = l.product || '';
    if (f.available) f.available.value = b.pieces + ' pcs · ' + g(b.weight) + ' g available (Opening: ' + b.openingPieces + ' pcs · ' + g(b.openingWeight) + ' g)';
    const defPieces = b.pieces > 0 ? 1 : 0;
    if (f.pieces) f.pieces.value = defPieces;
    const avg = b.pieces > 0 ? (b.weight / b.pieces) : b.weight;
    if (f.weight) f.weight.value = defPieces === b.pieces ? g(b.weight) : g(avg * defPieces);
    if (f.touch) f.touch.value = l.touch || '';
    const tagIn = document.getElementById('wlSaleTagInput');
    if (tagIn && l.packetTag) tagIn.value = l.packetTag;
    wlSaleCalc(f);
  };
  window.wlSaleCalc = function (f) {
    if (!f) return;
    const lotId = f.lotId ? f.lotId.value : (f.elements && f.elements.lotId ? f.elements.lotId.value : '');
    const l = lotById(lotId);
    const b = l ? balance(l) : null;
    const weight = n(f.weight ? f.weight.value : 0);
    const touch = n(f.touch ? f.touch.value : 0);
    const wastage = n(f.wastage ? f.wastage.value : 0);
    const pieces = n(f.pieces ? f.pieces.value : 0);
    const hallmarkRate = n(f.hallmarkRate ? f.hallmarkRate.value : 0);
    if (f.pure) f.pure.value = g(weight * (touch + wastage) / 100);
    if (f.hallmarkTotal) f.hallmarkTotal.value = (pieces * hallmarkRate).toFixed(2);
    const badge = document.getElementById('wlRemainingBadge');
    if (badge && b) {
      const remPcs = Math.max(0, b.pieces - pieces);
      const remWt = Math.max(0, b.weight - weight);
      badge.textContent = 'Packet after sale: ' + remPcs + ' pcs · ' + g(remWt) + ' g';
      badge.style.color = (remPcs === 0 || remWt <= 0.001) ? '#b45309' : '#18392a';
      badge.style.background = (remPcs === 0 || remWt <= 0.001) ? '#fffbeb' : '#edf7f0';
    }
  };
  window.wlDeleteSale = function (id) {
    if (!confirm('Delete this party sale and restore packet balance?')) return;
    ensure();
    const strId = String(id);
    db.deletedWholesaleSaleIds = Array.isArray(db.deletedWholesaleSaleIds) ? db.deletedWholesaleSaleIds : [];
    if (!db.deletedWholesaleSaleIds.includes(strId)) db.deletedWholesaleSaleIds.push(strId);
    db.deletedSaleIds = Array.isArray(db.deletedSaleIds) ? db.deletedSaleIds : [];
    if (!db.deletedSaleIds.includes(strId)) db.deletedSaleIds.push(strId);

    db.wholesalePacketSales = (db.wholesalePacketSales || []).filter(s => String(s.id) !== strId);
    db.sales = (db.sales || []).filter(s => String(s.id) !== strId);
    save();
    render();
    say('Party sale deleted and packet balance restored.');
  };
  window.wlSaveSale = function (ev) {
    ev.preventDefault(); ensure(); const f = ev.target, d = new FormData(f), l = lotById(d.get("lotId"));
    if (!l) return say('Scan or select a packet.');
    const b = balance(l), pieces = n(d.get("pieces")), weight = n(d.get("weight"));
    if (pieces < 1 || weight <= 0 || pieces > b.pieces || weight > b.weight + .0001) return say('Issued quantity is above packet stock.');
    const touch = n(d.get("touch")), wastage = n(d.get("wastage"));
    const pure = weight * (touch + wastage) / 100;
    const hallmarkRate = n(d.get("hallmarkRate"));
    const hallmarkTotal = pieces * hallmarkRate;
    const saleId = uid();
    const record = { id: saleId, lotId: l.id, partyId: d.get("partyId"), when: d.get("when"), product: l.product || '', packetTag: l.packetTag || '', pieces, weight, touch, wastage, purePayable: pure, hallmarkType: d.get("hallmark"), hallmarkRate, hallmarkTotal, photoNames: [...f.photos.files].map((v) => v.name), updatedAt: new Date().toISOString() };
    db.wholesalePacketSales.push(record);
    const saleRecord = { id: saleId, partyId: record.partyId, accountType: 'party', when: record.when, product: l.product || 'Jewellery', weight: record.weight, pieces: record.pieces, purity: record.touch, wastage: record.wastage, hallmarkType: record.hallmarkType, hallmarkChargePerPiece: record.hallmarkRate, hallmarkChargeAmount: record.hallmarkTotal, partyNetGrams: record.purePayable, packetTag: l.packetTag, lotId: l.id, source: 'wholesale-packet-sale' };
    const sIdx = db.sales.findIndex(s => s.id === saleId);
    if (sIdx >= 0) db.sales[sIdx] = saleRecord; else db.sales.push(saleRecord);
    save(); render(); say('Party sale saved and live packet balance updated.');
  };

  window.wholesalePacketVerificationView = function () {
    ensure();
    const rows = db.wholesalePacketReturns.slice().reverse().map((r) => '<tr><td>' + x(r.when.replace('T', ' ')) + '</td><td>' + x(r.packetTag) + '</td><td>' + x(r.salesperson) + '</td><td>' + g(r.expectedWeight) + '</td><td>' + g(r.physicalWeight) + '</td><td><b>✓ OK to stock</b></td></tr>').join("");
    return title('Scan the returned salesperson packet and confirm its expected weight.')
      + '<section class="panel"><form onsubmit="wlSaveReturn(event)"><div class="grid"><label class="field wl-scan-field"><span>Packet tag *</span><div class="wl-scan-row"><input id="wlReturnTag" name="tag" required onchange="wlLoadReturn(this.form)"><button type="button" class="gl-scan-btn" onclick="wlScanReturn()">▣ Scan</button></div></label><label class="field"><span>Salesperson</span><input name="salesperson" required></label>'
      + '<label class="field"><span>Original packet</span><input name="original" readonly></label><label class="field"><span>Live sales posted</span><input name="sold" readonly></label><label class="field"><span>Expected return weight · g</span><input name="expected" readonly></label><label class="field"><span>Physical weight check · g *</span><input name="physical" type="number" min="0" step=".001" required oninput="wlCompareReturn(this.form)"></label><label class="field"><span>Verification</span><output name="result" class="wl-result">Waiting for weight</output></label><input name="lotId" type="hidden"></div><div class="right"><button class="primary">OK · Return to stock</button></div></form></section>'
      + '<section class="panel"><h2>Verified returns</h2><div class="table"><table><thead><tr><th>Date</th><th>Packet</th><th>Salesperson</th><th>Expected g</th><th>Physical g</th><th>Status</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="empty">No verified returns yet.</td></tr>') + '</tbody></table></div></section>';
  };
  window.wlLoadReturn = function (f) { const l = lotByTag(f.tag.value); if (!l) { f.lotId.value = ''; return say('Packet tag not found.'); } const b = balance(l); f.lotId.value = l.id; f.original.value = l.pieces + ' pcs · ' + g(l.netWeight) + ' g'; f.sold.value = (l.pieces - b.pieces) + ' pcs · ' + g(l.netWeight - b.weight) + ' g'; f.expected.value = g(b.weight); wlCompareReturn(f); };
  window.wlCompareReturn = function (f) { const ok = f.physical.value !== '' && Math.abs(n(f.physical.value) - n(f.expected.value)) < .0005; f.result.textContent = f.physical.value === '' ? 'Waiting for weight' : ok ? '✓ Weight matched' : 'Weight does not match'; f.result.className = 'wl-result ' + (ok ? 'ok' : 'warn'); };
  window.wlSaveReturn = function (ev) { ev.preventDefault(); ensure(); const f = ev.target; if (!f.lotId.value) return say('Scan a valid packet.'); if (Math.abs(n(f.physical.value) - n(f.expected.value)) >= .0005) return say('Physical weight must match expected weight.'); const record={ id: uid(), lotId: f.lotId.value, packetTag: f.tag.value, salesperson: f.salesperson.value, expectedWeight: n(f.expected.value), physicalWeight: n(f.physical.value), when: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), updatedAt: new Date().toISOString() }; db.wholesalePacketReturns.push(record); save(); render(); say('Packet verified and returned to stock.'); };

  function scan(target) { if (typeof openQrScanner === 'function') return openQrScanner({ title: 'Scan wholesale packet', onScan: target }); const code = prompt('Enter packet tag'); if (code) target(code); }
  window.wlScanSale = function () {
    scan((code) => {
      const l = lotByTag(code);
      if (!l) return say('Packet tag "' + code + '" not found in wholesale lots.');
      const sel = document.getElementById('wlSaleLot');
      if (sel) {
        sel.value = l.id;
        const tagIn = document.getElementById('wlSaleTagInput');
        if (tagIn) tagIn.value = l.packetTag || code;
        wlLoadSalePacket(sel.form);
      }
    });
  };
  window.wlScanReturn = function () { scan((code) => { const input = document.getElementById('wlReturnTag'); input.value = code; wlLoadReturn(input.form); }); };
  window.wholesalePacketLedgerRows = function (partyId) { ensure(); return db.wholesalePacketSales.filter((s) => s.partyId === partyId).map((s) => { const l = lotById(s.lotId); return { when: s.when, reference: l?.packetTag || '', product: l?.product || '', pieces: s.pieces, weight: s.weight, pure: s.purePayable, hallmark: s.hallmarkTotal }; }); };
  const originalLedgerView = window.ledgerView;
  window.ledgerView = function () {
    const base = originalLedgerView();
    if (workspaceMode !== 'wholesale' || !filter.party) return base;
    const rows = wholesalePacketLedgerRows(filter.party);
    if (!rows.length) return base;
    const pure = rows.reduce((sum, v) => sum + n(v.pure), 0), hallmark = rows.reduce((sum, v) => sum + n(v.hallmark), 0);
    const history = rows.map((v) => [whenShow(v), x(v.reference), x(v.product), v.pieces, g(v.weight) + ' g', g(v.pure) + ' g', '₹ ' + n(v.hallmark).toFixed(2)]);
    return base + '<section class="panel wl-ledger-packets"><h2>Wholesale packet sales</h2><div class="cards"><div class="card"><label>PACKET PURE PAYABLE</label><b>' + g(pure) + ' g</b></div><div class="card"><label>PACKET HALLMARK</label><b>₹ ' + hallmark.toFixed(2) + '</b></div><div class="card"><label>OVERALL GOLD BALANCE</label><b>' + g(bal(filter.party, 'party')) + ' g</b></div></div>' + table(['Date','Packet tag','Product','Pieces','Weight','Pure payable','Hallmark'], history) + '</section>';
  };
  ensure();
})();

