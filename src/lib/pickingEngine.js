// src/lib/pickingEngine.js
// Ergonomic Picking Model — ported from CT 2.1 Python (fast_compute_moves)
// Simulates physical workload of warehouse pickers

/**
 * Box units that represent alternative packaging in MARM
 */
export const BOX_UNITS = new Set(['AEK', 'KAR', 'KART', 'PAK', 'VPE', 'CAR', 'BLO', 'ASK', 'BAG', 'PAC']);

/**
 * Queue descriptions for display
 */
export const QUEUE_DESC = {
  'PI_PL (Single)': 'Single SKU Pal',
  'PI_PL (Total)': 'Single SKU Pal + Mix Pal',
  'PI_PL_OE (Single)': 'OE Single SKU Pal',
  'PI_PL_OE (Total)': 'OE Single SKU Pal + Mix Pal',
  'PI_PA_OE': 'OE Parcel',
  'PI_PL (Mix)': 'Mix Pal',
  'PI_PA': 'Parcel',
  'PI_PL_OE (Mix)': 'OE Mix Pal',
  'PI_PA_RU': 'Parcel Express',
  'PI_PL_FU': 'Full Pall',
  'PI_PL_FUOE': 'OE Full Pal'
};

/**
 * Normalize material key for matching (strip leading zeros, trailing decimal zeros)
 */
export function getMatchKey(val) {
  let v = String(val).trim().toUpperCase();
  if (v.includes('.') && v.replace(/\./g, '').match(/^\d+$/)) {
    v = v.replace(/0+$/, '').replace(/\.$/, '');
  }
  if (/^\d+$/.test(v)) {
    v = v.replace(/^0+/, '') || '0';
  }
  return v;
}

/**
 * Vectorized version for arrays of material values
 */
export function getMatchKeyArray(materials) {
  return materials.map(getMatchKey);
}

/**
 * Parse packing time from various formats (decimal, HH:MM:SS, Excel fraction)
 */
export function parsePackingTime(val) {
  const v = String(val).trim();
  if (!v || v === 'nan' || v === 'None' || v === 'NaN') return 0.0;

  // Try as number
  const num = parseFloat(v);
  if (!isNaN(num)) {
    // Excel stores time as fraction of day
    if (num < 1.0) return num * 24 * 60;
    return num;
  }

  // Try as HH:MM:SS
  const parts = v.split(':');
  try {
    if (parts.length === 3) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseFloat(parts[2]) / 60.0;
    }
    if (parts.length === 2) {
      return parseInt(parts[0]) + parseFloat(parts[1]) / 60.0;
    }
  } catch { /* ignore */ }

  return 0.0;
}

/**
 * Parse box sizes from manual packaging description
 * E.g. "K-24ks" -> [24], "krabice po 12, 6" -> [12, 6]
 */
export function parseManualBoxSizes(pkg) {
  const regex = /\bK-(\d+)ks?\b|(\d+)\s*ks\b|balen[íi]\s+po\s+(\d+)|krabice\s+(?:po\s+)?(\d+)|(?:role|pytl[íi]k|pytel)[^\d]*(\d+)/gi;
  const nums = new Set();
  let match;
  while ((match = regex.exec(pkg)) !== null) {
    for (let i = 1; i < match.length; i++) {
      if (match[i]) nums.add(parseInt(match[i]));
    }
  }

  if (nums.size === 0 && /po\s*kusech/i.test(pkg)) {
    return [1];
  }

  return [...nums].sort((a, b) => b - a);
}

/**
 * Core ergonomic picking model.
 * Calculates physical hand movements for each pick line.
 *
 * @param {Object} row - Pick data row
 * @param {Object} config - { weightLimit, dimLimit, grabLimit }
 * @returns {{ total: number, exact: number, miss: number }}
 */
export function computeMoves(qty, queue, removalSU, boxSizes, pieceWeight, pieceDim, config) {
  const { weightLimit = 2.0, dimLimit = 15.0, grabLimit = 1 } = config;

  if (!qty || qty <= 0) return { total: 0, exact: 0, miss: 0 };

  // Full pallet — single move
  const q = String(queue).toUpperCase();
  const su = String(removalSU).trim().toUpperCase();
  if ((q === 'PI_PL_FU' || q === 'PI_PL_FUOE') && su === 'X') {
    return { total: 1, exact: 1, miss: 0 };
  }

  // Ensure boxSizes is an array of valid numbers > 1
  const realBoxes = Array.isArray(boxSizes)
    ? boxSizes.filter(b => b != null && !isNaN(b) && b > 1).sort((a, b) => b - a)
    : [];

  const safeWeight = (pieceWeight != null && !isNaN(pieceWeight)) ? parseFloat(pieceWeight) : 0;
  const safeDim = (pieceDim != null && !isNaN(pieceDim)) ? parseFloat(pieceDim) : 0;
  const safeGrab = Math.max(1, parseInt(grabLimit) || 1);

  let boxMoves = 0;
  let exactLoose = 0;
  let missLoose = 0;
  let remainder = parseFloat(qty);

  // Decompose into full boxes (from largest)
  for (const b of realBoxes) {
    if (remainder >= b) {
      const m = Math.floor(remainder / b);
      boxMoves += m;
      remainder = remainder % b;
    }
  }

  // Remaining loose pieces
  if (remainder > 0) {
    let looseMoves;
    if (safeWeight >= weightLimit || safeDim >= dimLimit) {
      // Heavy/large item: 1 move per piece
      looseMoves = Math.ceil(remainder);
    } else {
      // Light items: grab multiple
      looseMoves = Math.ceil(remainder / safeGrab);
    }

    if (realBoxes.length > 0) {
      exactLoose += looseMoves;
    } else {
      missLoose += looseMoves;
    }
  }

  return {
    total: boxMoves + exactLoose + missLoose,
    exact: boxMoves + exactLoose,
    miss: missLoose
  };
}

/**
 * Process an entire pick dataset — compute moves for all rows.
 * Returns the rows with added move columns.
 */
export function processPickData(pickRows, config) {
  return pickRows.map(row => {
    const result = computeMoves(
      row.qty,
      row.queue,
      row.removal_su,
      row.box_sizes || [],
      row.piece_weight,
      row.piece_dim,
      config
    );

    return {
      ...row,
      moves_total: result.total,
      moves_exact: result.exact,
      moves_miss: result.miss,
      total_weight: (row.qty || 0) * (row.piece_weight || 0),
    };
  });
}

/**
 * Split queue into Single/Mix variants for PI_PL and PI_PL_OE
 */
export function splitQueue(queue, materialCount) {
  const q = String(queue).trim();
  if (q === 'PI_PL' || q === 'PI_PL_OE') {
    return materialCount <= 1 ? `${q} (Single)` : `${q} (Mix)`;
  }
  return q;
}
