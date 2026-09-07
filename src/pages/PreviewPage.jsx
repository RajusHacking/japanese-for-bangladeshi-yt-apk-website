import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const PreviewPage = () => {
  const { id } = useParams();
  const [episodeData, setEpisodeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parsedCsv, setParsedCsv] = useState({ headers: [], rows: [] });
  const [copiedStates, setCopiedStates] = useState({});

  useEffect(() => {
    const fetchPreview = async () => {
      // 1. Check local storage first
      const cacheKey = `j4b_public_cache_${id}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setEpisodeData(parsed);
          if (parsed.csvContent) {
            parseCSV(parsed.csvContent);
          }
          setLoading(false);
          return; // Exit early if we have cached data
        } catch (e) {
          console.error("Failed to parse cached data", e);
        }
      }

      // 2. If not in cache, fetch from Firestore
      try {
        const q = query(collection(db, "episodes"), where("detectedLink", "==", `/${id}`));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const match = querySnapshot.docs[0].data();
          setEpisodeData(match);
          if (match.csvContent) {
            parseCSV(match.csvContent);
          }
          // 3. Save to local storage for next time
          localStorage.setItem(cacheKey, JSON.stringify(match));
        }
      } catch (e) {
        console.error("Failed to load data from Firebase", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Item Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          We couldn't find the data for this item. It may have been removed.
        </p>
        <Link to="/control" className="px-6 py-2.5 bg-brand text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
          Return to Control Panel
        </Link>
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
