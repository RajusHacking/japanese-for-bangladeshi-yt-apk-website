import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../context/LanguageContext';

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

        if (
          (docSlug && docSlug === targetSlug) ||
          (docId && docId === targetSlug) ||
          (data.detectedLink && data.detectedLink.toLowerCase().includes(targetSlug))
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
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      // Assuming first row is headers
      const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
      const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));
      setParsedCsv({ headers, rows });
    }
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
    <div className="w-full min-h-screen bg-[#f3f4f6] dark:bg-black py-8">
      <div className="container mx-auto px-4 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          <Link 
            to="/control" 
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Control Panel
          </Link>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8"
          >
            {/* YouTube Video Player */}
            <div className="w-full bg-black rounded-2xl overflow-hidden shadow-sm aspect-video relative border border-gray-200 dark:border-white/10">
              {episodeData.youtubeId ? (
                <iframe 
                  src={`https://www.youtube.com/embed/${episodeData.youtubeId}`} 
                  title={`Preview Video`}
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                ></iframe>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/50">
                  No video preview available
                </div>
              )}
            </div>

            {/* CSV Cards List */}
            <div className="flex flex-col gap-4">
              {parsedCsv.rows.map((row, rowIndex) => (
                <div 
                  key={rowIndex} 
                  className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden"
                >
                  <div className="px-5 pt-4 pb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      PAGE {rowIndex + 1}
                    </span>
                  </div>
                  
                  <div className="flex flex-col pb-3">
                    {parsedCsv.headers.map((header, cellIndex) => {
                      const value = row[cellIndex] || '';
                      const copyKey = `${rowIndex}-${cellIndex}`;
                      const isCopied = copiedStates[copyKey];

                      return (
                        <div 
                          key={cellIndex} 
                          className="flex items-center px-5 py-2.5 border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                        >
                          <div className="w-28 shrink-0">
                            <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400 tracking-wide">
                              {header}
                            </span>
                          </div>
                          
                          <div className="flex-1 pr-4">
                            <span className="text-[15px] text-gray-800 dark:text-gray-200">
                              {value}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleCopy(value, copyKey)}
                            className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 dark:hover:text-white transition-colors"
                            title="Copy to clipboard"
                          >
                            {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
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
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;
