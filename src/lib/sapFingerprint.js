// src/lib/sapFingerprint.js
// Auto-detection of SAP report types based on column names (fingerprinting)
// Ported from CT 2.1 Python logic — updated after real data audit

/**
 * Detects the type of SAP report based on column headers.
 */
export function detectReportType(columns, fileName = '') {
  const cols = columns.map(c => String(c).toUpperCase().trim());
  const fname = fileName.toLowerCase();

  // LTAK/Queue — has Queue + Transfer Order but NOT Act.Qty (distinguishes from Pick)
  const hasQueue = cols.some(c => c.includes('QUEUE'));
  const hasTO = cols.some(c => c.includes('TRANSFER ORDER'));
  const hasActQty = cols.some(c => c.includes('ACT.QTY') || c.includes('ACT QTY') || c.includes('ISTMENGE') || c.includes('MNOŽSTVÍ'));
  const hasSDDoc = cols.some(c => c.includes('SD DOCUMENT') || c.includes('SD-BELEG'));

  // Pick Report (LTAP/LTAK) — has Act.Qty + Transfer Order + Source Storage Bin
  const hasSourceBin = cols.some(c => c.includes('SOURCE STORAGE BIN') || c.includes('SOURCE STOR'));
  if (hasActQty && hasTO && hasSourceBin) {
    return { type: 'pick', label: 'Pick Report (LTAP/LTAK)', table: 'pick_data' };
  }

  // Queue (LTAK) — has Queue + SD Document + Transfer Order but NO Act.Qty
  if (hasQueue && hasTO && hasSDDoc && !hasActQty) {
    return { type: 'queue', label: 'Queue (LTAK)', table: 'queue_data' };
  }

  // VEPO — Packed Quantity (check before VEKP to avoid confusion)
  const hasPackedQty = cols.some(c => c.includes('PACKED QUANTITY') || c.includes('VEMNG'));
  const hasHuItem = cols.some(c => c.includes('HANDLING UNIT ITEM') || c.includes('HU ITEM'));
  if (hasPackedQty) return { type: 'vepo', label: 'VEPO (Packed Quantities)', table: 'vepo_data' };

  // VEKP — Handling Units hierarchy
  const hasGenDelivery = cols.some(c => c.includes('GENERATED DELIVERY') || c.includes('GENERIERTE'));
  const hasHigherHU = cols.some(c => c.includes('HIGHER-LEVEL HU') || c.includes('HIGHER LEVEL'));
  const hasPackMat = cols.some(c => c.includes('PACKAGING MAT') || c.includes('VERPACKUNGSMATERIAL'));
  if (hasGenDelivery || (hasHigherHU && hasPackMat)) {
    return { type: 'vekp', label: 'VEKP (Handling Units)', table: 'vekp_data' };
  }

  // Shipping / Deliveries — has Status + Delivery + Forwarding agent
  const hasForwarding = cols.some(c => c.includes('FORWARDING AGENT') || c.includes('FORWARDING'));
  const hasShipTo = cols.some(c => c.includes('SHIP-TO PARTY') || c.includes('SHIP TO'));
  const hasStatus = cols.some(c => c === 'STATUS');
  const hasDelivery = cols.some(c => c === 'DELIVERY' || c.includes('DELIVERY NO'));
  if (hasStatus && hasDelivery && (hasForwarding || hasShipTo)) {
    return { type: 'shipping', label: 'Shipping / Deliveries', table: 'deliveries' };
  }

  // MARM — Material master
  const hasNumerator = cols.some(c => c.includes('NUMERATOR') || c.includes('ČITATEL'));
  const hasAltUnit = cols.some(c => c.includes('ALTERNATIVE UNIT') || c.includes('ALTERNATIVNÍ'));
  if (hasNumerator && hasAltUnit) return { type: 'marm', label: 'MARM (Material Master)', table: 'marm_data' };

  // LT10 — Stock (has unique 'Selection' column, check BEFORE LX03)
  const hasAvailStock = cols.some(c => c.includes('AVAILABLE STOCK') || c.includes('ZÁSOBA K DISP'));
  const hasSelection = cols.some(c => c === 'SELECTION');
  if (hasAvailStock && hasSelection) return { type: 'lt10', label: 'LT10 (Zásoby)', table: 'lt10_data' };

  // LX03 — Bin Master (has Zone column, many columns, no Selection)
  const hasBinType = cols.some(c => c.includes('STORAGE BIN TYPE') || c.includes('BIN TYPE') || c.includes('TYP SKLAD'));
  const hasStorBin = cols.some(c => c.includes('STORAGE BIN') || c.includes('SKLADOVÉ MÍSTO'));
  const hasZone = cols.some(c => c === 'ZONE');
  if (hasBinType && hasStorBin && !hasSelection) {
    return { type: 'lx03', label: 'LX03 (Kapacita skladu)', table: 'lx03_data' };
  }

  // LIKP — Delivery header (massive, has Shipping Point + Delivery Type + Loading Date)
  const hasShipPoint = cols.some(c => c.includes('SHIPPING POINT') || c.includes('VERSANDSTELLE'));
  const hasDelType = cols.some(c => c.includes('DELIVERY TYPE') || c.includes('LIEFERART'));
  if (hasShipPoint && hasDelType) return { type: 'likp', label: 'LIKP (Delivery Headers)', table: 'likp_data' };

  // OE-Times
  const hasProcessTime = cols.some(c => c.includes('PROCESS TIME') || c.includes('PROCESS'));
  const hasDN = cols.some(c => c.includes('DN NUMBER') || c.includes('DN '));
  if (fname.includes('oe') || (hasProcessTime && hasDN)) {
    return { type: 'oe_times', label: 'OE-Times (Časy balení)', table: 'oe_times_data' };
  }

  // Categories
  const hasKategorie = cols.some(c => c.includes('KATEGORIE') || c.includes('CATEGORY'));
  if (hasKategorie && hasDelivery) return { type: 'categories', label: 'Kategorie zakázek', table: 'categories_data' };

  // Auswertung
  if (fname.includes('auswertung')) return { type: 'auswertung', label: 'Auswertung', table: null };

  // Manual / TOP materials — has Material + Storage Bin (few columns)
  const hasMaterial = cols.some(c => c.includes('MATERIAL'));
  if (hasMaterial && columns.length <= 5) return { type: 'manual', label: 'Ruční Master / TOP materiály', table: 'manual_master' };

  return null;
}

// ========== Column mapping ==========

function findCol(cols, keywords) {
  return cols.find(c => {
    const u = String(c).toUpperCase().trim();
    return keywords.some(k => u.includes(k));
  }) || null;
}

/**
 * Maps raw Excel rows to database-compatible rows.
 */
export function mapRowsForTable(type, rawRows) {
  if (!rawRows || rawRows.length === 0) return [];
  const cols = Object.keys(rawRows[0]);

  const mappings = {
    pick: () => {
      const cTO = findCol(cols, ['TRANSFER ORDER']);
      const cMat = findCol(cols, ['MATERIAL']);
      const cDel = findCol(cols, ['DELIVERY']);
      const cQty = findCol(cols, ['ACT.QTY', 'ACT QTY', 'ISTMENGE', 'MNOŽSTVÍ']);
      const cBin = findCol(cols, ['SOURCE STORAGE BIN']);
      const cQueue = findCol(cols, ['QUEUE']);
      const cRemoval = findCol(cols, ['REMOVAL OF TOTAL', 'REMOVAL']);
      const cDate = findCol(cols, ['CONFIRMATION DATE']);
      const cTime = findCol(cols, ['CONFIRMATION TIME']);
      const cUser = findCol(cols, ['USER']);
      const cWeight = findCol(cols, ['WEIGHT']);
      const cSrcType = findCol(cols, ['SOURCE STORAGE TYPE']);
      const cSUType = findCol(cols, ['STORAGE UNIT TYPE']);
      const cHU = findCol(cols, ['HANDLING UNIT']);
      const cDestBin = findCol(cols, ['DEST.STORAGE BIN', 'DEST STORAGE BIN']);
      return rawRows.map(r => ({
        transfer_order: cTO ? String(r[cTO] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
        delivery: cDel ? String(r[cDel] ?? '') : '',
        qty: cQty ? parseFloat(r[cQty]) || 0 : 0,
        source_bin: cBin ? String(r[cBin] ?? '') : '',
        queue: cQueue ? String(r[cQueue] ?? 'N/A') : 'N/A',
        removal_su: cRemoval ? String(r[cRemoval] ?? '') : '',
        confirmation_date: cDate ? r[cDate] : null,
        confirmation_time: cTime ? String(r[cTime] ?? '') : '',
        "user": cUser ? String(r[cUser] ?? '') : '',
        weight: cWeight ? parseFloat(r[cWeight]) || 0 : 0,
        source_storage_type: cSrcType ? String(r[cSrcType] ?? '') : '',
        storage_unit_type: cSUType ? String(r[cSUType] ?? '') : '',
        handling_unit: cHU ? String(r[cHU] ?? '') : '',
        dest_bin: cDestBin ? String(r[cDestBin] ?? '') : '',
      }));
    },
    queue: () => {
      const cTO = findCol(cols, ['TRANSFER ORDER']);
      const cQ = findCol(cols, ['QUEUE']);
      const cSD = findCol(cols, ['SD DOCUMENT']);
      const cConfDate = findCol(cols, ['CONFIRMATION DATE']);
      const cCreDate = findCol(cols, ['CREATION DATE']);
      const cDelDate = findCol(cols, ['DELIVERY DATE']);
      const cTOType = findCol(cols, ['TRANSFER ORDER TYPE']);
      return rawRows.map(r => ({
        transfer_order: cTO ? String(r[cTO] ?? '') : '',
        queue: cQ ? String(r[cQ] ?? '') : '',
        sd_document: cSD ? String(r[cSD] ?? '') : '',
        confirmation_date: cConfDate ? r[cConfDate] : null,
        creation_date: cCreDate ? r[cCreDate] : null,
        delivery_date: cDelDate ? r[cDelDate] : null,
        to_type: cTOType ? String(r[cTOType] ?? '') : '',
      }));
    },
    vekp: () => {
      const cIHU = findCol(cols, ['INTERNAL HU']);
      const cEHU = findCol(cols, ['HANDLING UNIT']);
      const cPHU = findCol(cols, ['HIGHER-LEVEL HU', 'HIGHER LEVEL']);
      const cDel = findCol(cols, ['GENERATED DELIVERY']);
      const cPkg = findCol(cols, ['PACKAGING MAT']);
      const cW = findCol(cols, ['TOTAL WEIGHT']);
      const cShipPt = findCol(cols, ['SHIPPING POINT']);
      const cCreated = findCol(cols, ['CREATED ON']);
      const cFwd = findCol(cols, ['FORWARDING AGENT']);
      return rawRows.map(r => ({
        internal_hu: cIHU ? String(r[cIHU] ?? '') : '',
        external_hu: cEHU ? String(r[cEHU] ?? '') : '',
        parent_hu: cPHU ? String(r[cPHU] ?? '') : '',
        generated_delivery: cDel ? String(r[cDel] ?? '') : '',
        packaging_material: cPkg ? String(r[cPkg] ?? '') : '',
        total_weight: cW ? parseFloat(r[cW]) || 0 : 0,
        shipping_point: cShipPt ? String(r[cShipPt] ?? '') : '',
        created_on: cCreated ? r[cCreated] : null,
        forwarding_agent: cFwd ? String(r[cFwd] ?? '') : '',
      }));
    },
    vepo: () => {
      const cHU = findCol(cols, ['INTERNAL HU']);
      const cMat = findCol(cols, ['MATERIAL']);
      const cQty = findCol(cols, ['PACKED QUANTITY']);
      const cDel = findCol(cols, ['DELIVERY']);
      const cItem = findCol(cols, ['ITEM']);
      return rawRows.map(r => ({
        internal_hu: cHU ? String(r[cHU] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
        packed_qty: cQty ? parseFloat(r[cQty]) || 0 : 0,
        delivery: cDel ? String(r[cDel] ?? '') : '',
        item: cItem ? String(r[cItem] ?? '') : '',
      }));
    },
    marm: () => {
      const cMat = findCol(cols, ['MATERIAL']);
      const cUnit = findCol(cols, ['ALTERNATIVE UNIT']);
      const cNum = findCol(cols, ['NUMERATOR']);
      const cW = findCol(cols, ['GROSS WEIGHT']);
      const cWU = findCol(cols, ['UNIT OF WEIGHT']);
      const cL = findCol(cols, ['LENGTH']);
      const cWi = findCol(cols, ['WIDTH']);
      const cH = findCol(cols, ['HEIGHT']);
      const cDU = findCol(cols, ['UNIT OF DIMENSION']);
      const cLower = findCol(cols, ['LOWER-LEVEL']);
      const cEAN = findCol(cols, ['EAN NUMBER', 'EAN/UPC']);
      return rawRows.map(r => ({
        material: cMat ? String(r[cMat] ?? '') : '',
        alt_unit: cUnit ? String(r[cUnit] ?? '') : '',
        numerator: cNum ? parseFloat(r[cNum]) || 0 : 0,
        gross_weight: cW ? parseFloat(r[cW]) || 0 : 0,
        weight_unit: cWU ? String(r[cWU] ?? 'KG') : 'KG',
        length: cL ? parseFloat(r[cL]) || 0 : 0,
        width: cWi ? parseFloat(r[cWi]) || 0 : 0,
        height: cH ? parseFloat(r[cH]) || 0 : 0,
        dimension_unit: cDU ? String(r[cDU] ?? 'CM') : 'CM',
        lower_unit: cLower ? String(r[cLower] ?? '') : '',
        ean: cEAN ? String(r[cEAN] ?? '') : '',
      }));
    },
    lx03: () => {
      const cBin = findCol(cols, ['STORAGE BIN']);
      const cType = findCol(cols, ['STORAGE TYPE']);
      const cBT = findCol(cols, ['STORAGE BIN TYPE', 'BIN TYPE']);
      const cMat = findCol(cols, ['MATERIAL']);
      const cStock = findCol(cols, ['AVAILABLE STOCK', 'TOTAL STOCK']);
      const cEmpty = findCol(cols, ['EMPTY INDICATOR']);
      const cSUType = findCol(cols, ['STORAGE UNIT TYPE']);
      const cLastMov = findCol(cols, ['LAST MOVEMENT']);
      const cPickArea = findCol(cols, ['PICKING AREA']);
      const cZone = findCol(cols, ['ZONE']);
      return rawRows.map(r => ({
        storage_bin: cBin ? String(r[cBin] ?? '') : '',
        storage_type: cType ? String(r[cType] ?? '') : '',
        bin_type: cBT ? String(r[cBT] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
        available_stock: cStock ? parseFloat(r[cStock]) || 0 : 0,
        empty_indicator: cEmpty ? String(r[cEmpty] ?? '') : '',
        su_type: cSUType ? String(r[cSUType] ?? '') : '',
        last_movement: cLastMov ? r[cLastMov] : null,
        picking_area: cPickArea ? String(r[cPickArea] ?? '') : '',
        zone: cZone ? String(r[cZone] ?? '') : '',
      }));
    },
    lt10: () => {
      const cBin = findCol(cols, ['STORAGE BIN']);
      const cBT = findCol(cols, ['STORAGE BIN TYPE', 'BIN TYPE']);
      const cMat = findCol(cols, ['MATERIAL']);
      const cStock = findCol(cols, ['AVAILABLE STOCK']);
      const cDate = findCol(cols, ['LAST MOVEMENT']);
      const cType = findCol(cols, ['STORAGE TYPE']);
      const cSU = findCol(cols, ['STORAGE UNIT']);
      return rawRows.map(r => ({
        storage_bin: cBin ? String(r[cBin] ?? '') : '',
        bin_type: cBT ? String(r[cBT] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
        available_stock: cStock ? parseFloat(r[cStock]) || 0 : 0,
        last_movement: cDate ? r[cDate] : null,
        storage_type: cType ? String(r[cType] ?? '') : '',
      }));
    },
    shipping: () => {
      const cStatus = findCol(cols, ['STATUS']);
      // Exact match for 'Delivery' — avoid matching 'Creation date delivery' etc.
      const cDel = cols.find(c => c.toUpperCase().trim() === 'DELIVERY') || null;
      const cDelDate = findCol(cols, ['DELIVERY DATE']);
      const cLoadDate = findCol(cols, ['PLAND GDS MVMNT', 'LOADING DATE']);
      const cFwd = findCol(cols, ['FORWARDING AGENT NAME', 'FORWARDING AGENT']);
      const cShipTo = findCol(cols, ['SHIP-TO PARTY', 'SHIP TO']);
      const cShipToName = findCol(cols, ['NAME OF SHIP-TO', 'NAME OF SHIP']);
      const cCountry = findCol(cols, ['COUNTRY SHIP', 'COUNTRY']);
      const cWeight = findCol(cols, ['TOTAL WEIGHT']);
      const cPkgs = findCol(cols, ['NUMBER OF PACKAGES']);
      const cDelType = findCol(cols, ['DEL.TYPE', 'DEL TYPE']);
      const cBilling = findCol(cols, ['BILLING DOCUMENT']);
      const cNetVal = findCol(cols, ['NET VALUE']);
      const cCurrency = findCol(cols, ['CURRENCY']);
      const cBOL = findCol(cols, ['BILL OF LADING']);
      const cOrdType = findCol(cols, ['ORDER TYPE']);
      const cShipType = findCol(cols, ['SHIPPING TYPE']);
      const cShipCond = findCol(cols, ['SHIPPING CONDITION']);
      const cCreDate = findCol(cols, ['CREATION DATE']);
      const cItems = findCol(cols, ['NO. RELEVANT ITEMS', 'RELEVANT ITEMS']);
      return rawRows.map(r => ({
        delivery_no: cDel ? String(r[cDel] ?? '') : '',
        status: cStatus ? parseInt(r[cStatus]) || 0 : 0,
        delivery_date: cDelDate ? r[cDelDate] : null,
        loading_date: cLoadDate ? r[cLoadDate] : null,
        forwarding_agent: cFwd ? String(r[cFwd] ?? '') : '',
        ship_to_party: cShipTo ? String(r[cShipTo] ?? '') : '',
        ship_to_name: cShipToName ? String(r[cShipToName] ?? '') : '',
        country: cCountry ? String(r[cCountry] ?? '') : '',
        total_weight: cWeight ? parseFloat(r[cWeight]) || 0 : 0,
        num_packages: cPkgs ? parseInt(r[cPkgs]) || 0 : 0,
        del_type: cDelType ? String(r[cDelType] ?? '') : '',
        billing_doc: cBilling ? String(r[cBilling] ?? '') : '',
        net_value: cNetVal ? parseFloat(r[cNetVal]) || 0 : 0,
        currency: cCurrency ? String(r[cCurrency] ?? 'EUR') : 'EUR',
        bill_of_lading: cBOL ? String(r[cBOL] ?? '') : '',
        order_type: cOrdType ? String(r[cOrdType] ?? '') : '',
        shipping_type: cShipType ? String(r[cShipType] ?? '') : '',
        creation_date: cCreDate ? r[cCreDate] : null,
        num_items: cItems ? parseInt(r[cItems]) || 0 : 0,
      }));
    },
    oe_times: () => {
      const cDN = findCol(cols, ['DN NUMBER', 'DN ']);
      const cCust = findCol(cols, ['CUSTOMER']);
      const cStart = findCol(cols, ['START']);
      const cEnd = findCol(cols, ['END']);
      const cDate = findCol(cols, ['DATE']);
      const cProcTime = findCol(cols, ['PROCESS TIME']);
      const cEffort = findCol(cols, ['EFFORT TIME']);
      const cShift = findCol(cols, ['SHIFT']);
      const cItems = findCol(cols, ['NUMBER OF ITEM TYPES', 'ITEM TYPES']);
      const cPieces = findCol(cols, ['NUMBER OF PIECES', 'PIECES']);
      const cPallets = findCol(cols, ['NUMBER OF PALLETS', 'PALLETS']);
      const cKLT = findCol(cols, ['NUMBER OF KLTS', 'KLT']);
      const cCartons = findCol(cols, ['NUMBER OF CARTONS', 'CARTONS']);
      const cWeight = findCol(cols, ['WEIGHT']);
      const cOeNoe = findCol(cols, ['OE/NOE', 'OE']);
      const cOrdType = findCol(cols, ['ORDER TYPE']);
      const cDelType = findCol(cols, ['DEL.TYPE', 'DEL TYPE']);
      return rawRows.map(r => ({
        dn_number: cDN ? String(r[cDN] ?? '') : '',
        customer: cCust ? String(r[cCust] ?? '') : '',
        start_time: cStart ? r[cStart] : null,
        end_time: cEnd ? r[cEnd] : null,
        date: cDate ? r[cDate] : null,
        process_time: cProcTime ? String(r[cProcTime] ?? '') : '',
        effort_time: cEffort ? String(r[cEffort] ?? '') : '',
        shift: cShift ? String(r[cShift] ?? '') : '',
        num_item_types: cItems ? parseInt(r[cItems]) || 0 : 0,
        num_pieces: cPieces ? parseInt(r[cPieces]) || 0 : 0,
        num_pallets: cPallets ? parseInt(r[cPallets]) || 0 : 0,
        num_klts: cKLT ? parseInt(r[cKLT]) || 0 : 0,
        num_cartons: cCartons ? parseInt(r[cCartons]) || 0 : 0,
        weight_kg: cWeight ? parseFloat(r[cWeight]) || 0 : 0,
        oe_noe: cOeNoe ? String(r[cOeNoe] ?? '') : '',
        order_type: cOrdType ? String(r[cOrdType] ?? '') : '',
        del_type: cDelType ? String(r[cDelType] ?? '') : '',
      }));
    },
    categories: () => {
      const cDel = findCol(cols, ['DELIVERY']);
      const cKat = findCol(cols, ['KATEGORIE', 'CATEGORY']);
      const cArt = findCol(cols, ['ART', 'TYPE']);
      return rawRows.map(r => ({
        delivery: cDel ? String(r[cDel] ?? '') : '',
        kategorie: cKat ? String(r[cKat] ?? '') : '',
        art: cArt ? String(r[cArt] ?? '') : '',
      }));
    },
    likp: () => {
      const cDel = findCol(cols, ['DELIVERY']);
      const cShip = findCol(cols, ['SHIPPING POINT']);
      const cDelType = findCol(cols, ['DELIVERY TYPE']);
      const cLoadDate = findCol(cols, ['LOADING DATE']);
      const cDelDate = findCol(cols, ['DELIVERY DATE']);
      const cShipTo = findCol(cols, ['SHIP-TO PARTY']);
      const cSoldTo = findCol(cols, ['SOLD-TO PARTY']);
      const cWeight = findCol(cols, ['TOTAL WEIGHT']);
      const cBOL = findCol(cols, ['BILL OF LADING']);
      const cShipType = findCol(cols, ['SHIPPING TYPE']);
      const cActDate = findCol(cols, ['ACT. GDS MVMNT']);
      return rawRows.map(r => ({
        delivery: cDel ? String(r[cDel] ?? '') : '',
        shipping_point: cShip ? String(r[cShip] ?? '') : '',
        delivery_type: cDelType ? String(r[cDelType] ?? '') : '',
        loading_date: cLoadDate ? r[cLoadDate] : null,
        delivery_date: cDelDate ? r[cDelDate] : null,
        ship_to_party: cShipTo ? String(r[cShipTo] ?? '') : '',
        sold_to_party: cSoldTo ? String(r[cSoldTo] ?? '') : '',
        total_weight: cWeight ? parseFloat(r[cWeight]) || 0 : 0,
        bill_of_lading: cBOL ? String(r[cBOL] ?? '') : '',
        shipping_type: cShipType ? String(r[cShipType] ?? '') : '',
        actual_gi_date: cActDate ? r[cActDate] : null,
      }));
    },
    manual: () => {
      const cMat = findCol(cols, ['MATERIAL']);
      const cBin = findCol(cols, ['STORAGE BIN']);
      return rawRows.map(r => ({
        material: cMat ? String(r[cMat] ?? '') : '',
        packaging_desc: cBin ? String(r[cBin] ?? '') : '',
      }));
    },
  };

  const mapper = mappings[type];
  if (!mapper) return rawRows;
  return mapper();
}

/**
 * SAP report guide
 */
export const SAP_REPORT_GUIDE = [
  { report: 'Pick_all (LTAP)', section: 'Pickování, Dashboard', desc: 'Hlavní export picků — Transfer Order, Material, Qty, Source Bin, Weight, HU.', required: true },
  { report: 'LTAK_TOs (Queue)', section: 'Pickování (Queue analýza)', desc: 'Queue mapování — Transfer Order → Queue, SD Document, Creation/Delivery Date.', required: true },
  { report: 'shipping_all', section: 'Dashboard (zakázky)', desc: 'Přehled všech zakázek — Status, Delivery Date, Speditér, Země, Váha, Hodnota.', required: true },
  { report: 'MARM_report', section: 'Pickování (ergonomie)', desc: 'Materiálový master — alternativní balení, rozměry, váhy, EAN.', required: true },
  { report: 'LX03', section: 'Sklad (kapacita)', desc: 'Bin Master — všechny skladové pozice, typy, zóny, stock.', required: false },
  { report: 'LT10', section: 'Sklad (zásoby)', desc: 'Aktuální zásoby — Available Stock, Last Movement, Bin Type.', required: false },
  { report: 'VEKP', section: 'Balení (Billing)', desc: 'Handling Unit hierarchie — Internal/External/Parent HU, Generated Delivery.', required: false },
  { report: 'VEPO', section: 'Balení (Billing)', desc: 'Packed quantities per HU — Material, Delivery, Qty.', required: false },
  { report: 'OE-Times', section: 'Balení (časy)', desc: 'Časy balení — DN, Customer, Process/Effort Time, Palety/KLT/Kartony.', required: false },
  { report: 'LIKP', section: 'Admin (cross-ref)', desc: 'Delivery headers — Shipping Point, Delivery Type, Loading/Delivery Date.', required: false },
  { report: 'top100 / Manual', section: 'Pickování', desc: 'TOP materiály bez MARM dat — manuální doplnění.', required: false },
];
