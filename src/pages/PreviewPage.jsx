import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../context/LanguageContext';
import MinimalPlayer from '../components/common/MinimalPlayer';

const NOT_FOUND_TEXT = {
  bn: 'এই ভিডিওতে রিসোর্স নেই',
  en: 'This video has no resource',
  ja: 'この動画にはリソースがありません',
};

const getSlug = (link) => {
  if (!link) return '';
  const clean = String(link).split('?')[0].split('#')[0].trim().replace(/\/+$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1].toLowerCase();
};

const PreviewPage = () => {
  const { id } = useParams();
  const [episodeData, setEpisodeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parsedCsv, setParsedCsv] = useState({ headers: [], rows: [] });
  const [copiedStates, setCopiedStates] = useState({});
  const { language } = useLanguage();

  useEffect(() => {
    // 1. Purge any lingering legacy local storage caches
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('j4b_public_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      // ignore
    }

    setLoading(true);
    const targetSlug = getSlug(id);

    // 2. Real-time subscription to Firestore episodes collection
    const unsubscribe = onSnapshot(collection(db, "episodes"), (querySnapshot) => {
      const matchedItems = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docSlug = getSlug(data.detectedLink);
        const docId = String(data.id || '').trim().toLowerCase();

        // Exact slug or ID match only (no loose partial includes)
        if (
          targetSlug &&
          (docSlug === targetSlug || docId === targetSlug)
        ) {
          matchedItems.push(data);
        }
      });

      // Sort by newest timestamp first
      matchedItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const match = matchedItems.length > 0 ? matchedItems[0] : null;

      if (match) {
        setEpisodeData(match);
        if (match.csvContent) {
          parseCSV(match.csvContent);
        } else {
          setParsedCsv({ headers: [], rows: [] });
        }
      } else {
        setEpisodeData(null);
        setParsedCsv({ headers: [], rows: [] });
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setEpisodeData(null);
      setParsedCsv({ headers: [], rows: [] });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const parseCSV = (csvText) => {
    if (!csvText) return;
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase());
    const rawRows = lines.slice(1).map(parseCSVLine);

    const isIdHeader = (h) => {
      if (!h) return false;
      const s = h.trim().toLowerCase();
      return ['id', 'sl', 'sl.', 'sl no', 'sl. no', 'sl. no.', 'no', 'no.', 'num', 'number', 'index', 'page', 'page no', 'page no.'].includes(s);
    };

    const hasIdColumn = isIdHeader(headers[0]) || (rawRows.length > 0 && rawRows.every(r => r.length > 1 && /^\d+$/.test(r[0])));

    const seen = new Set();
    const uniqueRows = [];

    for (const row of rawRows) {
      if (!row || row.every(cell => !cell || !cell.trim())) continue;
      const contentCols = hasIdColumn ? row.slice(1) : row;
      const contentKey = contentCols.map(c => (c || '').trim().toLowerCase()).join('|||');

      if (seen.has(contentKey)) {
        continue; // Skip duplicate card
      }
      seen.add(contentKey);

      const newRow = [...row];
      if (hasIdColumn) {
        newRow[0] = String(uniqueRows.length + 1); // Renumber ID in card
      }
      uniqueRows.push(newRow);
    }

    setParsedCsv({ headers, rows: uniqueRows });
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedStates({ ...copiedStates, [key]: true });
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!episodeData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
        <AlertCircle size={48} className="text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
          {NOT_FOUND_TEXT[language] || NOT_FOUND_TEXT.en}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f3f4f6] dark:bg-black pb-20 flex flex-col items-center">
      {/* Sticky Wide Theater Video Section (Full Area) */}
      <div className="sticky top-16 z-20 w-full bg-black sm:bg-[#f3f4f6]/95 dark:sm:bg-black/95 backdrop-blur-md pt-0 sm:pt-2 pb-0 sm:pb-4 shadow-sm border-b border-gray-200/50 dark:border-white/5 flex justify-center">
        <div className="w-full max-w-5xl px-0 sm:px-4">
          {episodeData.youtubeId ? (
            <MinimalPlayer 
              youtubeId={episodeData.youtubeId} 
              title={episodeData.videoTitle || 'Preview Video'} 
            />
          ) : (
            <div className="w-full bg-black rounded-none sm:rounded-2xl overflow-hidden shadow-lg aspect-video relative border-y sm:border border-gray-200 dark:border-white/10 flex items-center justify-center text-white/50">
              No video preview available
            </div>
          )}
        </div>
      </div>

      {/* Centered Scrollable CSV Cards List */}
      <div className="w-full max-w-2xl px-4 pt-6">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3.5"
        >
          {parsedCsv.rows.map((row, rowIndex) => (
                <div 
                  key={rowIndex} 
                  className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden"
                >
                  {/* Card Number in Scheme Color */}
                  <div className="px-5 pt-3.5 pb-2 flex items-center justify-between">
                    <span 
                      className="text-base font-extrabold tracking-tight"
                      style={{ color: 'var(--brand-color, #f97316)' }}
                    >
                      {rowIndex + 1}
                    </span>
                  </div>
                  
                  {/* Card Values (No Labels) */}
                  <div className="flex flex-col pb-1">
                    {parsedCsv.headers.map((header, cellIndex) => {
                      const h = (header || '').trim().toLowerCase();
                      if (cellIndex === 0 && ['id', 'sl', 'sl.', 'no', 'num', 'index', 'page'].includes(h)) {
                        return null;
                      }

                      const value = row[cellIndex] || '';
                      if (!value) return null;
                      const copyKey = `${rowIndex}-${cellIndex}`;
                      const isCopied = copiedStates[copyKey];

                      return (
                        <div 
                          key={cellIndex} 
                          className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group"
                        >
                          <div className="flex-1 pr-3">
                            <span className="text-[15px] text-gray-800 dark:text-gray-200 select-text leading-relaxed">
                              {value}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleCopy(value, copyKey)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 dark:hover:text-white transition-colors shrink-0"
                            title="Copy to clipboard"
                          >
                            {isCopied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {parsedCsv.rows.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                  No CSV data available for this preview.
                </div>
              )}
          </motion.div>
        </div>
    </div>
  );
};

export default PreviewPage;
