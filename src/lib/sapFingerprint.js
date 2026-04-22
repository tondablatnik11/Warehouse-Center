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
