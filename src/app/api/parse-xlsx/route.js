// src/app/api/parse-xlsx/route.js
// Server-side XLSX parsing for large files (>15MB)
// Parses, maps, and uploads directly to Supabase to avoid transferring huge JSON payloads

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120; // Allow up to 120s for large files
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const append = formData.get('append') !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Init Supabase server-side
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const XLSX = await import('xlsx');
    const { detectReportType, mapRowsForTable } = await import('@/lib/sapFingerprint');

    console.log(`[parse-xlsx] Processing ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)...`);

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    const wb = XLSX.read(data, { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

    console.log(`[parse-xlsx] Parsed ${jsonData.length} rows`);

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'Prázdný soubor — žádná data.', rows: 0 }, { status: 400 });
    }

    const columns = Object.keys(jsonData[0]);
    const detected = detectReportType(columns, file.name);

    if (!detected) {
      return NextResponse.json({
        error: `Nerozpoznaný report. Sloupce: ${columns.slice(0, 10).join(', ')}`,
      }, { status: 400 });
    }

    const mappedData = mapRowsForTable(detected.type, jsonData);
    console.log(`[parse-xlsx] Mapped to ${detected.table}: ${mappedData.length} rows`);

    // Delete existing data if not appending
    if (!append) {
      const { error: delErr } = await supabase.from(detected.table).delete().neq('id', 0);
      if (delErr) console.error('[parse-xlsx] Delete error:', delErr);
    }

    // Batch insert in chunks of 500
    const BATCH_SIZE = 500;
    let insertedCount = 0;
    let errors = [];

    for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
      const chunk = mappedData.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from(detected.table).insert(chunk);
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        console.error(`[parse-xlsx] Batch error at ${i}:`, error.message);
      } else {
        insertedCount += chunk.length;
      }
    }

    // Log the import
    await supabase.from('import_log').insert([{
      table_name: detected.table,
      row_count: insertedCount,
      imported_at: new Date().toISOString(),
      mode: append ? 'append' : 'replace',
    }]);

    console.log(`[parse-xlsx] Done: ${insertedCount}/${mappedData.length} rows inserted`);

    return NextResponse.json({
      type: detected.type,
      label: detected.label,
      table: detected.table,
      rows: mappedData.length,
      inserted: insertedCount,
      errors: errors.length > 0 ? errors : undefined,
      uploadedDirectly: true,
    });
  } catch (error) {
    console.error('[parse-xlsx] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
