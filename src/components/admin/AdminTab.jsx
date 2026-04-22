// src/components/admin/AdminTab.jsx
'use client';
import React, { useState, useCallback, useRef } from 'react';
import { useUI } from '@/hooks/useUI';
import { useData } from '@/hooks/useData';
import SectionHeader from '@/components/shared/SectionHeader';
import { detectReportType, SAP_REPORT_GUIDE } from '@/lib/sapFingerprint';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  Info, ChevronDown, Loader2, HardDrive, BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminTab() {
  const { t } = useUI();
  const { uploadData, refetchData, importLog } = useData();
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [appendMode, setAppendMode] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    const XLSX = await import('xlsx');
    const fname = file.name.toLowerCase();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: 'array', cellDates: true });

          // Handle Auswertung (multi-sheet)
          if (fname.includes('auswertung')) {
            const sheetResults = [];
            for (const sheetName of wb.SheetNames) {
              const ws = wb.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });
              if (jsonData.length > 0) {
                const tableName = `aus_${sheetName.toLowerCase()}`;
                sheetResults.push({
                  file: `${file.name} → ${sheetName}`,
                  type: 'auswertung',
                  label: `Auswertung (${sheetName})`,
                  table: tableName,
                  rows: jsonData.length,
                  status: 'pending',
                  data: jsonData,
                });
              }
            }
            resolve(sheetResults);
            return;
          }

          // Single sheet
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

          if (jsonData.length === 0) {
            resolve([{ file: file.name, status: 'error', message: 'Prázdný soubor' }]);
            return;
          }

          const columns = Object.keys(jsonData[0]);
          const detected = detectReportType(columns, file.name);

          if (!detected) {
            resolve([{
              file: file.name,
              status: 'error',
              message: t.notRecognized,
              columns: columns.slice(0, 10).join(', '),
            }]);
            return;
          }

          // Normalize column names for database
          const normalizedData = jsonData.map(row => {
            const normalized = {};
            Object.entries(row).forEach(([key, val]) => {
              // Convert column names to snake_case
              const snakeKey = key
                .replace(/[()]/g, '')
                .replace(/[.\s-]+/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_|_$/g, '')
                .toLowerCase();
              normalized[snakeKey] = val;
            });
            return normalized;
          });

          resolve([{
            file: file.name,
            type: detected.type,
            label: detected.label,
            table: detected.table,
            rows: normalizedData.length,
            status: 'pending',
            data: normalizedData,
          }]);
        } catch (error) {
          resolve([{ file: file.name, status: 'error', message: error.message }]);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, [t]);

  const handleFiles = useCallback(async (files) => {
    setIsProcessing(true);
    setResults([]);
    const allResults = [];

    for (const file of files) {
      const fileResults = await processFile(file);
      allResults.push(...fileResults);
    }

    // Upload each detected dataset
    for (const result of allResults) {
      if (result.status === 'pending' && result.table && result.data) {
        const success = await uploadData(result.table, result.data, appendMode);
        result.status = success ? 'success' : 'error';
        if (!success) result.message = 'Chyba při ukládání do databáze';
      }
    }

    setResults(allResults);
    setIsProcessing(false);

    const successCount = allResults.filter(r => r.status === 'success').length;
    const errorCount = allResults.filter(r => r.status === 'error').length;

    if (successCount > 0) {
      toast.success(`✅ Úspěšně nahráno: ${successCount} dataset(ů)`);
      refetchData();
    }
    if (errorCount > 0) {
      toast.error(`❌ Chyby: ${errorCount} soubor(ů)`);
    }
  }, [processFile, uploadData, appendMode, refetchData]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const onFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t.adminTitle}
        description={t.adminDesc}
        icon={HardDrive}
      />

      {/* Upload Mode Toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={appendMode}
            onChange={() => setAppendMode(true)}
            className="accent-blue-500"
          />
          <span className="text-sm text-slate-300">{t.appendMode}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!appendMode}
            onChange={() => setAppendMode(false)}
            className="accent-amber-500"
          />
          <span className="text-sm text-slate-300">{t.replaceMode}</span>
        </label>
      </div>

      {/* Upload Zone */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          onChange={onFileSelect}
          className="hidden"
        />
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <p className="text-blue-400 font-semibold">{t.processing}</p>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 text-blue-400/50 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-300 mb-1">{t.uploadTitle}</p>
            <p className="text-sm text-slate-500">{t.uploadDesc}</p>
            <p className="text-xs text-slate-600 mt-2">CSV, XLSX, XLS</p>
          </>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`glass-card p-4 flex items-center gap-3 ${r.status === 'error' ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
              {r.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              <FileSpreadsheet className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{r.file}</p>
                {r.label && (
                  <p className="text-xs text-blue-400">{t.detectedAs}: {r.label}</p>
                )}
                {r.message && (
                  <p className="text-xs text-red-400">{r.message}</p>
                )}
                {r.columns && (
                  <p className="text-xs text-slate-600 truncate">Sloupce: {r.columns}</p>
                )}
              </div>
              {r.rows && (
                <span className="badge bg-slate-700 text-slate-300">{r.rows.toLocaleString()} řádků</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SAP Report Guide */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-slate-300">{t.sapGuide}</span>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${showGuide ? 'rotate-180' : ''}`} />
        </button>

        {showGuide && (
          <div className="border-t border-white/[0.06]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SAP Report</th>
                  <th>Sekce aplikace</th>
                  <th>Popis</th>
                  <th className="text-center">Povinný</th>
                </tr>
              </thead>
              <tbody>
                {SAP_REPORT_GUIDE.map((g, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-blue-400">{g.report}</td>
                    <td className="text-slate-400">{g.section}</td>
                    <td className="text-slate-500 text-xs">{g.desc}</td>
                    <td className="text-center">
                      {g.required ? (
                        <span className="badge bg-red-500/20 text-red-400">Ano</span>
                      ) : (
                        <span className="badge bg-slate-700 text-slate-500">Ne</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Log */}
      {importLog && importLog.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Historie importů</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {importLog.slice(0, 20).map((log, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-slate-600">{new Date(log.imported_at).toLocaleString('cs-CZ')}</span>
                <span className="badge bg-blue-500/10 text-blue-400">{log.table_name}</span>
                <span className="text-slate-500">{log.row_count} řádků</span>
                <span className="badge bg-slate-700 text-slate-500">{log.mode}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
