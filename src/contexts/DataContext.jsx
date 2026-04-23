// src/contexts/DataContext.jsx
'use client';
import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [pickData, setPickData] = useState([]);
  const [deliveriesData, setDeliveriesData] = useState([]);
  const [warehouseData, setWarehouseData] = useState({ lx03: [], lt10: [] });
  const [marmData, setMarmData] = useState([]);
  const [manualMaster, setManualMaster] = useState([]);
  const [queueData, setQueueData] = useState([]);
  const [vekpData, setVekpData] = useState([]);
  const [vepoData, setVepoData] = useState([]);
  const [oeTimesData, setOeTimesData] = useState([]);
  const [categoriesData, setCategoriesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [importLog, setImportLog] = useState([]);

  const supabase = getSupabase();

  const fetchAllData = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const tables = [
        { name: 'pick_data', setter: setPickData, limit: 100000, orderCol: 'created_at' },
        { name: 'deliveries', setter: setDeliveriesData, limit: 100000, orderCol: 'created_at' },
        { name: 'queue_data', setter: setQueueData, limit: 20000, orderCol: 'created_at' },
        { name: 'marm_data', setter: setMarmData, limit: 30000, orderCol: 'created_at' },
        { name: 'manual_master', setter: setManualMaster, limit: 5000, orderCol: 'created_at' },
        { name: 'vekp_data', setter: setVekpData, limit: 100000, orderCol: 'created_at' },
        { name: 'vepo_data', setter: setVepoData, limit: 100000, orderCol: 'created_at' },
        { name: 'oe_times_data', setter: setOeTimesData, limit: 20000, orderCol: 'created_at' },
        { name: 'categories_data', setter: setCategoriesData, limit: 10000, orderCol: 'created_at' },
        { name: 'lx03_data', setter: (d) => setWarehouseData(prev => ({ ...prev, lx03: d })), limit: 50000, orderCol: 'created_at' },
        { name: 'lt10_data', setter: (d) => setWarehouseData(prev => ({ ...prev, lt10: d })), limit: 50000, orderCol: 'created_at' },
        // import_log má sloupec imported_at, nikoliv created_at!
        { name: 'import_log', setter: setImportLog, limit: 100, orderCol: 'imported_at' },
      ];

      const results = await Promise.allSettled(
        tables.map(async ({ name, limit, orderCol }) => {
          const { data, error } = await supabase
            .from(name)
            .select('*')
            .order(orderCol, { ascending: false })
            .limit(limit);
          if (error) throw { table: name, error };
          return { table: name, data: data || [] };
        })
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          tables[idx].setter(result.value.data);
        } else {
          tables[idx].setter([]);
        }
      });

    } catch (error) {
      console.error('Data fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const uploadData = useCallback(async (tableName, data, append = true) => {
    if (!supabase) {
      toast.error('Supabase není připojen.');
      return false;
    }

    try {
      if (!append) {
        // Delete existing data if replacing
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .neq('id', 0); // Delete all rows
        if (deleteError) throw deleteError;
      }

      // Batch insert in chunks of 1000 (standard insert bez upsertu a deduplikace)
      const BATCH_SIZE = 1000;
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const chunk = data.slice(i, i + BATCH_SIZE);
        
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(chunk);

        if (insertError) throw insertError;
      }

      // Log the import
      await supabase.from('import_log').insert([{
        table_name: tableName,
        row_count: data.length,
        imported_at: new Date().toISOString(),
        mode: append ? 'append' : 'replace'
      }]);

      return true;
    } catch (error) {
      console.error(`Upload error for ${tableName}:`, error);
      toast.error(`Chyba: ${error.message}`);
      return false;
    }
  }, [supabase]);

  const value = useMemo(() => ({
    pickData,
    deliveriesData,
    warehouseData,
    marmData,
    manualMaster,
    queueData,
    vekpData,
    vepoData,
    oeTimesData,
    categoriesData,
    importLog,
    isLoading,
    refetchData: fetchAllData,
    uploadData,
    supabase,
  }), [
    pickData, deliveriesData, warehouseData, marmData, manualMaster,
    queueData, vekpData, vepoData, oeTimesData, categoriesData,
    importLog, isLoading, fetchAllData, uploadData, supabase,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
