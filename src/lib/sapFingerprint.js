// src/lib/sapFingerprint.js
// Auto-detection of SAP report types based on column names (fingerprinting)
// Ported from CT 2.1 Python logic

/**
 * Detects the type of SAP report based on column headers.
 * Returns: { type: string, label: string } or null if not recognized.
 */
export function detectReportType(columns, fileName = '') {
  const cols = columns.map(c => String(c).toUpperCase().trim());
  const fname = fileName.toLowerCase();

  // Pick Report (LTAP/LTAK)
  const isPick = cols.some(c => c.includes('ACT.QTY') || c.includes('ISTMENGE') || c.includes('MNOŽSTVÍ (CÍL)'))
    && cols.some(c => c.includes('TRANSFER ORDER') || c.includes('TRANSPORTAUFTRAG'));
  if (isPick) return { type: 'pick', label: 'Pick Report (LTAP/LTAK)', table: 'pick_data' };

  // Queue (LTAK) — has Queue column but is NOT a pick report
  const isQueue = cols.some(c => c.includes('QUEUE')) && !isPick;
  if (isQueue) return { type: 'queue', label: 'Queue (LTAK)', table: 'queue_data' };

  // VEPO — Packed Quantity
  const isVepo = cols.some(c => c.includes('PACKED QUANTITY') || c.includes('VEMNG') || c.includes('BALENÉ MNOŽSTVÍ'));
  if (isVepo) return { type: 'vepo', label: 'VEPO (Packed Quantities)', table: 'vepo_data' };

  // VEKP — Handling Units hierarchy
  const isVekp = cols.some(c => c.includes('GENERATED DELIVERY') || c.includes('GENERIERTE LIEFERUNG') || c.includes('VYTVOŘENÁ DODÁVKA'))
    || (cols.some(c => c.includes('TOTAL WEIGHT') || c.includes('BRGEW'))
      && cols.some(c => c.includes('HANDLING UNIT') || c.includes('MANIPULAČNÍ'))
      && !isVepo);
  if (isVekp) return { type: 'vekp', label: 'VEKP (Handling Units)', table: 'vekp_data' };

  // Categories
  const isCats = cols.some(c => c.includes('KATEGORIE') || c.includes('CATEGORY'))
    && cols.some(c => c.includes('DELIVERY') || c.includes('LIEFERUNG') || c.includes('ZAKÁZKA'));
  if (isCats) return { type: 'categories', label: 'Kategorie zakázek', table: 'categories_data' };

  // LIKP — shipping point
  const isLikp = cols.some(c => c.includes('SHIPPING POINT') || c.includes('VERSANDSTELLE') || c.includes('RECEIVING PT') || c.includes('MÍSTO'))
    && !isVekp;
  if (isLikp) return { type: 'likp', label: 'LIKP (Shipping)', table: 'likp_data' };

  // MARM — Material master (alternative units)
  const isMarm = cols.some(c => c.includes('NUMERATOR') || c.includes('ČITATEL'))
    && cols.some(c => c.includes('ALTERNATIVE UNIT') || c.includes('ALTERNATIVNÍ'));
  if (isMarm) return { type: 'marm', label: 'MARM (Material Master)', table: 'marm_data' };

  // OE-Times
  const isOe = fname.includes('oe-times')
    || (cols.some(c => c.includes('PROCESS') || c.includes('PROCES'))
      && cols.some(c => c.includes('TIME') || c.includes('ČAS') || c.includes('CAS')));
  if (isOe) return { type: 'oe_times', label: 'OE-Times (Časy balení)', table: 'oe_times_data' };

  // LT10 — Stock (Available Stock + Last Movement)
  const isLt10 = cols.some(c => c.includes('AVAILABLE STOCK') || c.includes('ZÁSOBA K DISP.'))
    && cols.some(c => c.includes('LAST MOVEMENT') || c.includes('POSLEDNÍ POHYB'));
  if (isLt10) return { type: 'lt10', label: 'LT10 (Zásoby)', table: 'lt10_data' };

  // LX03 — Bin Master (Storage Bin Type)
  const isLx03 = cols.some(c => c.includes('STORAGE BIN TYPE') || c.includes('TYP SKLAD.MÍSTA') || c.includes('TYP SKLAD MISTA'))
    && !isLt10;
  if (isLx03) return { type: 'lx03', label: 'LX03 (Kapacita skladu)', table: 'lx03_data' };

  // Deliveries (Orders) — has Delivery No + Status
  const isDeliveries = cols.some(c => c.includes('DELIVERY NO') || c.includes('DELIVERY'))
    && cols.some(c => c === 'STATUS');
  if (isDeliveries) return { type: 'deliveries', label: 'Deliveries (Zakázky)', table: 'deliveries' };

  // Manual Master Data — has Material + some packaging info
  const isManual = columns.length >= 2
    && cols.some(c => c.includes('MATERIAL') || c.includes('MATERIÁL'));
  if (isManual) return { type: 'manual', label: 'Ruční Master Data', table: 'manual_master' };

  // Auswertung — multi-sheet Excel
  if (fname.includes('auswertung')) {
    return { type: 'auswertung', label: 'Auswertung (Multi-Sheet)', table: null };
  }

  return null;
}

/**
 * Find the first column in `cols` (original names) that matches any of `keywords` (case-insensitive).
 */
function findCol(cols, keywords) {
  return cols.find(c => {
    const u = String(c).toUpperCase().trim();
    return keywords.some(k => u.includes(k));
  }) || null;
}

/**
 * Maps raw Excel rows to database-compatible rows based on detected report type.
 * Only includes columns that exist in our schema — ignores everything else.
 */
export function mapRowsForTable(type, rawRows) {
  if (!rawRows || rawRows.length === 0) return [];
  const cols = Object.keys(rawRows[0]);

  const mappings = {
    pick: () => {
      const cTO = findCol(cols, ['TRANSFER ORDER', 'TRANSPORTAUFTRAG', 'PŘEPRAVNÍ PŘÍKAZ']);
      const cMat = findCol(cols, ['MATERIAL', 'MATERIÁL']);
      const cDel = findCol(cols, ['DELIVERY', 'LIEFERUNG', 'DODÁVKA']);
      const cQty = findCol(cols, ['ACT.QTY', 'ISTMENGE', 'MNOŽSTVÍ']);
      const cBin = findCol(cols, ['SOURCE STORAGE BIN', 'ZDROJ.SKLAD.MÍSTO', 'QUELL-LAGERPLATZ', 'ZDROJ']);
      const cQueue = findCol(cols, ['QUEUE']);
      const cRemoval = findCol(cols, ['REMOVAL SU', 'ODBĚR SU', 'ENTNAHME']);
      const cDate = findCol(cols, ['CONFIRMATION DATE', 'DATUM POTVRZENÍ', 'BESTÄTIGUNGSDATUM', 'CONF.DATE']);
      const cTime = findCol(cols, ['CONFIRMATION TIME', 'ČAS POTVRZENÍ', 'BESTÄTIGUNGSZEIT', 'CONF.TIME']);
      const cUser = findCol(cols, ['USER', 'UŽIVATEL', 'BENUTZER']);
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
        user: cUser ? String(r[cUser] ?? '') : '',
      }));
    },
    queue: () => {
      const cTO = findCol(cols, ['TRANSFER ORDER', 'TRANSPORTAUFTRAG']);
      const cQ = findCol(cols, ['QUEUE']);
      const cSD = findCol(cols, ['SD DOCUMENT', 'SD-BELEG']);
      const cDate = findCol(cols, ['CONFIRMATION DATE', 'DATUM']);
      return rawRows.map(r => ({
        transfer_order: cTO ? String(r[cTO] ?? '') : '',
        queue: cQ ? String(r[cQ] ?? '') : '',
        sd_document: cSD ? String(r[cSD] ?? '') : '',
        confirmation_date: cDate ? r[cDate] : null,
      }));
    },
    vekp: () => {
      const cIHU = findCol(cols, ['INTERNAL', 'INTERNE', 'INTERNÍ']);
      const cEHU = findCol(cols, ['EXTERNAL', 'EXTERNE', 'EXTERNÍ', 'HANDLING UNIT']);
      const cPHU = findCol(cols, ['PARENT', 'ÜBERGEORD', 'NADŘAZENÁ']);
      const cDel = findCol(cols, ['GENERATED DELIVERY', 'GENERIERTE', 'VYTVOŘENÁ DODÁVKA']);
      const cPkg = findCol(cols, ['PACKAGING MATERIAL', 'VERPACKUNGSMATERIAL', 'OBALOVÝ MATERIÁL']);
      const cW = findCol(cols, ['TOTAL WEIGHT', 'BRGEW', 'CELKOVÁ HMOTNOST']);
      return rawRows.map(r => ({
        internal_hu: cIHU ? String(r[cIHU] ?? '') : '',
        external_hu: cEHU ? String(r[cEHU] ?? '') : '',
        parent_hu: cPHU ? String(r[cPHU] ?? '') : '',
        generated_delivery: cDel ? String(r[cDel] ?? '') : '',
        packaging_material: cPkg ? String(r[cPkg] ?? '') : '',
        total_weight: cW ? parseFloat(r[cW]) || 0 : 0,
      }));
    },
    vepo: () => {
      const cHU = findCol(cols, ['INTERNAL', 'INTERNE', 'INTERNÍ']);
      const cMat = findCol(cols, ['MATERIAL', 'MATERIÁL']);
      const cQty = findCol(cols, ['PACKED QUANTITY', 'VEMNG', 'BALENÉ MNOŽSTVÍ']);
      return rawRows.map(r => ({
        internal_hu: cHU ? String(r[cHU] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
        packed_qty: cQty ? parseFloat(r[cQty]) || 0 : 0,
      }));
    },
    marm: () => {
      const cMat = findCol(cols, ['MATERIAL', 'MATERIÁL']);
      const cUnit = findCol(cols, ['ALTERNATIVE UNIT', 'ALTERNATIVNÍ', 'ALT.EINHEIT']);
      const cNum = findCol(cols, ['NUMERATOR', 'ČITATEL', 'ZÄHLER']);
      const cW = findCol(cols, ['GROSS WEIGHT', 'BRUTTOGEWICHT', 'HRUBÁ HMOTNOST']);
      const cWU = findCol(cols, ['WEIGHT UNIT', 'GEWICHTSEINHEIT', 'JEDNOTKA HMOTNOSTI']);
      const cL = findCol(cols, ['LENGTH', 'LÄNGE', 'DÉLKA']);
      const cWi = findCol(cols, ['WIDTH', 'BREITE', 'ŠÍŘKA']);
      const cH = findCol(cols, ['HEIGHT', 'HÖHE', 'VÝŠKA']);
      const cDU = findCol(cols, ['DIMENSION UNIT', 'DIMENSIONSEINHeit', 'JEDNOTKA ROZMĚRU']);
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
      }));
    },
    lx03: () => {
      const cBin = findCol(cols, ['STORAGE BIN', 'SKLADOVÉ MÍSTO', 'LAGERPLATZ']);
      const cType = findCol(cols, ['STORAGE TYPE', 'TYP SKLAD', 'LAGERTYP', 'LGTYP']);
      const cBT = findCol(cols, ['BIN TYPE', 'TYP MÍST', 'PLATZTYP', 'STORAGE BIN TYPE', 'TYP SKLAD.MÍSTA']);
      const cMat = findCol(cols, ['MATERIAL', 'MATERIÁL']);
      return rawRows.map(r => ({
        storage_bin: cBin ? String(r[cBin] ?? '') : '',
        storage_type: cType ? String(r[cType] ?? '') : '',
        bin_type: cBT ? String(r[cBT] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
      }));
    },
    lt10: () => {
      const cBin = findCol(cols, ['STORAGE BIN', 'SKLADOVÉ MÍSTO', 'LAGERPLATZ']);
      const cBT = findCol(cols, ['BIN TYPE', 'TYP MÍST', 'PLATZTYP']);
      const cMat = findCol(cols, ['MATERIAL', 'MATERIÁL']);
      const cStock = findCol(cols, ['AVAILABLE STOCK', 'ZÁSOBA K DISP', 'VERFÜGBARER BESTAND']);
      const cDate = findCol(cols, ['LAST MOVEMENT', 'POSLEDNÍ POHYB', 'LETZTE BEWEGUNG']);
      const cType = findCol(cols, ['STORAGE TYPE', 'TYP SKLAD', 'LAGERTYP']);
      return rawRows.map(r => ({
        storage_bin: cBin ? String(r[cBin] ?? '') : '',
        bin_type: cBT ? String(r[cBT] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
        available_stock: cStock ? parseFloat(r[cStock]) || 0 : 0,
        last_movement: cDate ? r[cDate] : null,
        storage_type: cType ? String(r[cType] ?? '') : '',
      }));
    },
    oe_times: () => {
      const cDN = findCol(cols, ['DN', 'DELIVERY', 'DODÁVKA']);
      const cTime = findCol(cols, ['PROCESS', 'TIME', 'ČAS']);
      const cCust = findCol(cols, ['CUSTOMER', 'ZÁKAZNÍK', 'KUNDE']);
      const cMat = findCol(cols, ['MATERIAL', 'MATERIÁL']);
      const cKLT = findCol(cols, ['KLT']);
      const cPal = findCol(cols, ['PALET', 'PALETY']);
      const cCart = findCol(cols, ['CARTON', 'KARTON']);
      const cShift = findCol(cols, ['SHIFT', 'SMĚNA', 'SCHICHT']);
      return rawRows.map(r => ({
        dn_number: cDN ? String(r[cDN] ?? '') : '',
        process_time: cTime ? String(r[cTime] ?? '') : '',
        customer: cCust ? String(r[cCust] ?? '') : '',
        material: cMat ? String(r[cMat] ?? '') : '',
        klt: cKLT ? String(r[cKLT] ?? '') : '',
        palety: cPal ? String(r[cPal] ?? '') : '',
        cartons: cCart ? String(r[cCart] ?? '') : '',
        shift: cShift ? String(r[cShift] ?? '') : '',
      }));
    },
    categories: () => {
      const cDel = findCol(cols, ['DELIVERY', 'LIEFERUNG', 'ZAKÁZKA', 'DODÁVKA']);
      const cKat = findCol(cols, ['KATEGORIE', 'CATEGORY']);
      const cArt = findCol(cols, ['ART', 'TYPE', 'TYP']);
      return rawRows.map(r => ({
        delivery: cDel ? String(r[cDel] ?? '') : '',
        kategorie: cKat ? String(r[cKat] ?? '') : '',
        art: cArt ? String(r[cArt] ?? '') : '',
      }));
    },
    likp: () => {
      const cDel = findCol(cols, ['DELIVERY', 'LIEFERUNG', 'DODÁVKA']);
      const cShip = findCol(cols, ['SHIPPING POINT', 'VERSANDSTELLE', 'MÍSTO EXPEDICE']);
      const cRecv = findCol(cols, ['RECEIVING', 'EMPFANGS', 'PŘIJÍMACÍ']);
      return rawRows.map(r => ({
        delivery: cDel ? String(r[cDel] ?? '') : '',
        shipping_point: cShip ? String(r[cShip] ?? '') : '',
        receiving_point: cRecv ? String(r[cRecv] ?? '') : '',
      }));
    },
    deliveries: () => {
      const cDel = findCol(cols, ['DELIVERY NO', 'DELIVERY', 'DODÁVKA']);
      const cSt = findCol(cols, ['STATUS']);
      const cType = findCol(cols, ['DEL TYPE', 'DELIVERY TYPE', 'TYP']);
      const cLoad = findCol(cols, ['LOADING DATE', 'DATUM NAKLÁDKY']);
      const cFwd = findCol(cols, ['FORWARDING', 'SPEDITÉR', 'AGENT']);
      const cShip = findCol(cols, ['SHIP-TO', 'PŘÍJEMCE']);
      const cW = findCol(cols, ['WEIGHT', 'HMOTNOST']);
      const cBOL = findCol(cols, ['BILL OF LADING', 'PŘEPRAVNÍ DOKLAD']);
      const cCountry = findCol(cols, ['COUNTRY', 'ZEMĚ']);
      return rawRows.map(r => ({
        delivery_no: cDel ? String(r[cDel] ?? '') : '',
        status: cSt ? parseInt(r[cSt]) || 10 : 10,
        del_type: cType ? String(r[cType] ?? '') : '',
        loading_date: cLoad ? r[cLoad] : null,
        forwarding_agent: cFwd ? String(r[cFwd] ?? '') : '',
        ship_to_party: cShip ? String(r[cShip] ?? '') : '',
        total_weight: cW ? parseFloat(r[cW]) || 0 : 0,
        bill_of_lading: cBOL ? String(r[cBOL] ?? '') : '',
        country: cCountry ? String(r[cCountry] ?? '') : '',
      }));
    },
    manual: () => {
      const cMat = findCol(cols, ['MATERIAL', 'MATERIÁL']);
      const cPkg = findCol(cols, ['PACKAGING', 'BALENÍ', 'POPIS']);
      const cBox = findCol(cols, ['BOX', 'KRABICE', 'SIZES']);
      return rawRows.map(r => ({
        material: cMat ? String(r[cMat] ?? '') : '',
        packaging_desc: cPkg ? String(r[cPkg] ?? '') : '',
        box_sizes: cBox ? String(r[cBox] ?? '') : null,
      }));
    },
  };

  const mapper = mappings[type];
  if (!mapper) return rawRows; // fallback: return raw
  return mapper();
}

/**
 * SAP report guide — which reports are needed for which section
 */
export const SAP_REPORT_GUIDE = [
  { report: 'Pick Report (LTAP/LTAK)', section: 'Pickování, Dashboard', desc: 'Hlavní export z transakce LTAK/LTAP. Obsahuje Transfer Order, Material, Qty, Source Bin.', required: true },
  { report: 'Queue (LTAK)', section: 'Pickování (Queue analýza)', desc: 'Mapování Queue typů na Transfer Order Numbers.', required: false },
  { report: 'VEKP', section: 'Balení (Billing, Vollpaletten)', desc: 'Handling Unit hierarchie — Internal HU, External HU, Parent HU.', required: false },
  { report: 'VEPO', section: 'Balení (Billing, Vollpaletten)', desc: 'Packed quantities per HU — propojeno s VEKP.', required: false },
  { report: 'MARM', section: 'Pickování (krabice, váhy)', desc: 'Materiálový master — alternativní balení, Numerator, váhy, rozměry.', required: false },
  { report: 'LX03', section: 'Sklad (kapacita, layout)', desc: 'Bin Master — seznam všech skladových pozic s typy a materiály.', required: false },
  { report: 'LT10', section: 'Sklad (zásoby, dead stock)', desc: 'Aktuální zásoby — Available Stock, Last Movement date.', required: false },
  { report: 'OE-Times', section: 'Balení (časy balení)', desc: 'Časy balení — DN Number, Process Time per delivery.', required: false },
  { report: 'Kategorie', section: 'Dashboard (typ zakázky)', desc: 'Kategorie zakázek — Delivery + Kategorie + Art.', required: false },
  { report: 'Deliveries Excel', section: 'Dashboard (zakázky)', desc: 'Export zakázek — Delivery No, Status, Loading Date, Forwarding Agent.', required: false },
  { report: 'LIKP', section: 'Admin analýza', desc: 'Shipping point data pro cross-referencing.', required: false },
  { report: 'Ruční Master Data', section: 'Pickování', desc: 'Ruční přepisy balicích informací pro materiály bez MARM dat.', required: false },
];
