(function () {
  "use strict";
  const n = (v) => Number(v || 0);
  const g = (v) => n(v).toFixed(3);
  const x = (v) => esc(String(v ?? ""));
  const uid = () => crypto.randomUUID();

  function ensure() {
    db.retailDocuments = Array.isArray(db.retailDocuments) ? db.retailDocuments : [];
    db.wholesaleLots = Array.isArray(db.wholesaleLots) ? db.wholesaleLots : [];
    db.wholesalePacketSales = Array.isArray(db.wholesalePacketSales) ? db.wholesalePacketSales : [];
    db.wholesalePacketReturns = Array.isArray(db.wholesalePacketReturns) ? db.wholesalePacketReturns : [];
    const sync = (kind, list) => {
      const map = new Map(list.map((v) => [v.id, v]));
      db.retailDocuments.filter((v) => v.kind === kind).forEach((v) => map.set(v.id, v));
      return [...map.values()];
    };
    db.wholesaleLots = sync('wholesale-lot', db.wholesaleLots);
    db.wholesalePacketSales = sync('wholesale-packet-sale', db.wholesalePacketSales);
    db.wholesalePacketReturns = sync('wholesale-packet-return', db.wholesalePacketReturns);
  }
  function addCloudDocument(record, kind) { record.kind = kind; record.updatedAt = new Date().toISOString(); db.retailDocuments.push(record); }
  function lotById(id) { ensure(); return db.wholesaleLots.find((v) => v.id === id); }
  function lotByTag(tag) { ensure(); return db.wholesaleLots.find((v) => v.packetTag.toLowerCase() === String(tag).trim().toLowerCase()); }
  function balance(lot) {
    const sold = db.wholesalePacketSales.filter((v) => v.lotId === lot.id);
    return {
      pieces: Math.max(0, n(lot.pieces) - sold.reduce((a, v) => a + n(v.pieces), 0)),
      weight: Math.max(0, n(lot.netWeight) - sold.reduce((a, v) => a + n(v.weight), 0)),
    };
  }
  function partyOptions() {
    return '<option value="">Select party</option>' + db.parties.map((p) => '<option value="' + x(p.id) + '">' + x(p.name) + '</option>').join("");
  }
  function lotOptions() {
    return '<option value="">Select packet tag</option>' + db.wholesaleLots.map((l) => {
      const b = balance(l);
      return '<option value="' + x(l.id) + '">' + x(l.packetTag) + ' · ' + x(l.product) + ' · ' + g(b.weight) + ' g</option>';
    }).join("");
  }
  function title(sub) { return header(sub, '<span class="wl-pill">Wholesale only</span>'); }

  window.wholesaleLotView = function () {
    ensure();
    const rows = db.wholesaleLots.slice().reverse().map((l) => {
      const b = balance(l);
      return '<tr><td>' + x(l.lotNo) + '</td><td>' + x(l.supplier) + '</td><td>' + x(l.product) + '</td><td><b>' + x(l.packetTag) + '</b></td><td>' + l.pieces + '</td><td>' + g(l.netWeight) + '</td><td>' + g(l.touch) + '</td><td>' + g(l.pureWeight) + '</td><td><b>' + b.pieces + ' pcs · ' + g(b.weight) + ' g</b></td></tr>';
    }).join("");
    return title('Supplier lot, packet tag and live stock in one connected page.')
      + '<section class="panel wl-panel"><h2>Supplier lot received</h2><form onsubmit="wlSaveLot(event)"><div class="grid">'
      + '<label class="field"><span>Lot no.</span><input name="lotNo" required value="WL-' + Date.now().toString().slice(-6) + '"></label>'
      + '<label class="field"><span>Date & time</span><input name="when" type="datetime-local" required value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) + '"></label>'
      + '<label class="field"><span>Supplier *</span><input name="supplier" required></label><label class="field"><span>Product *</span><input name="product" required></label>'
      + '<label class="field"><span>Total pieces *</span><input name="pieces" type="number" min="1" step="1" required></label><label class="field"><span>Gross weight · g *</span><input name="gross" type="number" min=".001" step=".001" required oninput="wlLotCalc(this.form)"></label>'
      + '<label class="field"><span>Stone · g</span><input name="stone" type="number" min="0" step=".001" value="0" oninput="wlLotCalc(this.form)"></label><label class="field"><span>Enamel / other less · g</span><input name="less" type="number" min="0" step=".001" value="0" oninput="wlLotCalc(this.form)"></label>'
      + '<label class="field"><span>Net gold · g</span><input name="net" readonly></label><label class="field"><span>Touch % *</span><input name="touch" type="number" min="1" max="100" step=".001" required oninput="wlLotCalc(this.form)"></label><label class="field"><span>Pure weight · g</span><input name="pure" readonly></label>'
      + '<label class="field"><span>Pure rate · ₹/g</span><input name="rate" type="number" min="0" step=".01"></label><label class="field"><span>Settlement</span><select name="settlement"><option>Gold</option><option>Cash converted to gold</option></select></label>'
      + '<label class="field"><span>Packet tag *</span><input name="tag" required placeholder="PKT-0001"></label><label class="field"><span>Lot / packet photos</span><input name="photos" type="file" accept="image/*" capture="environment" multiple></label>'
      + '</div><div class="right"><button class="primary">Save lot & create packet tag</button></div></form></section>'
      + '<section class="panel"><h2>Wholesale lot stock</h2><div class="table"><table><thead><tr><th>Lot</th><th>Supplier</th><th>Product</th><th>Packet</th><th>Opening pcs</th><th>Net g</th><th>Touch</th><th>Pure g</th><th>Live balance</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">No wholesale lots yet.</td></tr>') + '</tbody></table></div></section>';
  };
  window.wlLotCalc = function (f) { const net = Math.max(0, n(f.gross.value) - n(f.stone.value) - n(f.less.value)); f.net.value = g(net); f.pure.value = g(net * n(f.touch.value) / 100); };
  window.wlSaveLot = function (ev) {
    ev.preventDefault(); ensure(); const f = ev.target; const d = new FormData(f); const tag = String(d.get("tag")).trim();
    if (lotByTag(tag)) return say('This packet tag already exists.');
    const net = Math.max(0, n(d.get("gross")) - n(d.get("stone")) - n(d.get("less"))); const touch = n(d.get("touch"));
    if (!tag || net <= 0 || touch < 1 || touch > 100) return say('Enter a unique tag, valid weight and touch from 1 to 100.');
    const record={ id: uid(), lotNo: d.get("lotNo"), when: d.get("when"), supplier: d.get("supplier"), product: d.get("product"), pieces: n(d.get("pieces")), grossWeight: n(d.get("gross")), stoneWeight: n(d.get("stone")), lessWeight: n(d.get("less")), netWeight: net, touch, pureWeight: net * touch / 100, pureRate: n(d.get("rate")), settlement: d.get("settlement"), packetTag: tag, photoNames: [...f.photos.files].map((v) => v.name) }; db.wholesaleLots.push(record); addCloudDocument(record,'wholesale-lot');
    save(); render(); say('Wholesale lot and packet tag saved.');
  };

  window.wholesalePartySaleView = function () {
    ensure();
    const rows = db.wholesalePacketSales.slice().reverse().map((s) => { const l = lotById(s.lotId), p = db.parties.find((v) => v.id === s.partyId); return '<tr><td>' + x(s.when.replace('T', ' ')) + '</td><td>' + x(p?.name) + '</td><td>' + x(l?.packetTag) + '</td><td>' + x(l?.product) + '</td><td>' + s.pieces + '</td><td>' + g(s.weight) + '</td><td>' + g(s.purePayable) + '</td><td>₹ ' + n(s.hallmarkTotal).toFixed(2) + '</td></tr>'; }).join("");
    return title('Scan a wholesale packet and issue partial pieces and weight to a party.')
      + '<section class="panel"><form onsubmit="wlSaveSale(event)"><div class="grid"><label class="field"><span>Party *</span><select name="partyId" required>' + partyOptions() + '</select></label>'
      + '<label class="field"><span>Date & time</span><input name="when" type="datetime-local" required value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) + '"></label>'
      + '<label class="field wl-scan-field"><span>Packet tag *</span><div class="wl-scan-row"><select id="wlSaleLot" name="lotId" required onchange="wlLoadSalePacket(this.form)">' + lotOptions() + '</select><button type="button" class="gl-scan-btn" onclick="wlScanSale()">▣ Scan</button></div></label>'
      + '<label class="field"><span>Available stock</span><input name="available" readonly></label><label class="field"><span>Issued pieces *</span><input name="pieces" type="number" min="1" step="1" required oninput="wlSaleCalc(this.form)"></label><label class="field"><span>Issued weight · g *</span><input name="weight" type="number" min=".001" step=".001" required oninput="wlSaleCalc(this.form)"></label>'
      + '<label class="field"><span>Touch %</span><input name="touch" type="number" min="1" max="100" step=".001" required oninput="wlSaleCalc(this.form)"></label><label class="field"><span>Wastage %</span><input name="wastage" type="number" min="0" step=".001" value="0" oninput="wlSaleCalc(this.form)"></label><label class="field"><span>Pure payable · g</span><input name="pure" readonly></label>'
      + '<label class="field"><span>Hallmark type</span><select name="hallmark"><option>None</option><option>HUID</option><option>Non-HUID</option></select></label><label class="field"><span>Hallmark ₹ / piece</span><input name="hallmarkRate" type="number" min="0" step=".01" value="0" oninput="wlSaleCalc(this.form)"></label><label class="field"><span>Hallmark total</span><input name="hallmarkTotal" readonly></label><label class="field"><span>Delivery photos</span><input name="photos" type="file" accept="image/*" capture="environment" multiple></label>'
      + '</div><div class="right"><button class="primary">Save party sale</button></div></form></section><section class="panel"><h2>Live party sales</h2><div class="table"><table><thead><tr><th>Date</th><th>Party</th><th>Packet</th><th>Product</th><th>Pcs</th><th>Weight g</th><th>Pure payable</th><th>Hallmark</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8" class="empty">No packet sales yet.</td></tr>') + '</tbody></table></div></section>';
  };
  window.wlLoadSalePacket = function (f) { const l = lotById(f.lotId.value); if (!l) return; const b = balance(l); f.available.value = b.pieces + ' pcs · ' + g(b.weight) + ' g'; f.touch.value = l.touch; wlSaleCalc(f); };
  window.wlSaleCalc = function (f) { f.pure.value = g(n(f.weight.value) * (n(f.touch.value) + n(f.wastage.value)) / 100); f.hallmarkTotal.value = (n(f.pieces.value) * n(f.hallmarkRate.value)).toFixed(2); };
  window.wlSaveSale = function (ev) { ev.preventDefault(); ensure(); const f = ev.target, d = new FormData(f), l = lotById(d.get("lotId")); if (!l) return say('Scan or select a packet.'); const b = balance(l), pieces = n(d.get("pieces")), weight = n(d.get("weight")); if (pieces < 1 || weight <= 0 || pieces > b.pieces || weight > b.weight + .0001) return say('Issued quantity is above packet stock.'); const touch = n(d.get("touch")), wastage = n(d.get("wastage")); const record={ id: uid(), lotId: l.id, partyId: d.get("partyId"), when: d.get("when"), pieces, weight, touch, wastage, purePayable: weight * (touch + wastage) / 100, hallmarkType: d.get("hallmark"), hallmarkRate: n(d.get("hallmarkRate")), hallmarkTotal: pieces * n(d.get("hallmarkRate")), photoNames: [...f.photos.files].map((v) => v.name) }; db.wholesalePacketSales.push(record); addCloudDocument(record,'wholesale-packet-sale'); save(); render(); say('Party sale saved and live packet balance updated.'); };

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
  window.wlSaveReturn = function (ev) { ev.preventDefault(); ensure(); const f = ev.target; if (!f.lotId.value) return say('Scan a valid packet.'); if (Math.abs(n(f.physical.value) - n(f.expected.value)) >= .0005) return say('Physical weight must match expected weight.'); const record={ id: uid(), lotId: f.lotId.value, packetTag: f.tag.value, salesperson: f.salesperson.value, expectedWeight: n(f.expected.value), physicalWeight: n(f.physical.value), when: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) }; db.wholesalePacketReturns.push(record); addCloudDocument(record,'wholesale-packet-return'); save(); render(); say('Packet verified and returned to stock.'); };

  function scan(target) { if (typeof openQrScanner === 'function') return openQrScanner({ title: 'Scan wholesale packet', onScan: target }); const code = prompt('Enter packet tag'); if (code) target(code); }
  window.wlScanSale = function () { scan((code) => { const l = lotByTag(code); if (!l) return say('Packet tag not found.'); const f = document.getElementById('wlSaleLot').form; f.lotId.value = l.id; wlLoadSalePacket(f); }); };
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

