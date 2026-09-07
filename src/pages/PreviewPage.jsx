import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Copy, Check, HelpCircle, BookOpen, RotateCcw, CheckCircle2, XCircle, Award } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz' | 'vocabulary'
  const [parsedCsv, setParsedCsv] = useState({ headers: [], rows: [], orderedColIndices: [] });
  const [quizzes, setQuizzes] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
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

        // Parse CSV
        if (match.csvContent) {
          parseCSV(match.csvContent);
        } else {
          setParsedCsv({ headers: [], rows: [], orderedColIndices: [] });
        }

        // Parse Quiz JSON
        if (match.jsonContent) {
          try {
            const parsed = typeof match.jsonContent === 'string' ? JSON.parse(match.jsonContent) : match.jsonContent;
            if (Array.isArray(parsed)) {
              setQuizzes(parsed);
            } else if (parsed && Array.isArray(parsed.quizzes)) {
              setQuizzes(parsed.quizzes);
            } else if (parsed && Array.isArray(parsed.quiz)) {
              setQuizzes(parsed.quiz);
            } else if (parsed && Array.isArray(parsed.questions)) {
              setQuizzes(parsed.questions);
            } else {
              setQuizzes([]);
            }
          } catch (e) {
            console.error("Error parsing quiz JSON:", e);
            setQuizzes([]);
          }
        } else {
          setQuizzes([]);
        }
      } else {
        setEpisodeData(null);
        setParsedCsv({ headers: [], rows: [], orderedColIndices: [] });
        setQuizzes([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setEpisodeData(null);
      setParsedCsv({ headers: [], rows: [], orderedColIndices: [] });
      setQuizzes([]);
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

    // Determine ordered column indices:
    // 1st: Means / Ba (Bengali meaning)
    // 2nd: Japanese (Japanese text)
    // 3rd: Pronounce / Latin / Romaji
    const contentIndices = [];
    const startIndex = hasIdColumn ? 1 : 0;
    for (let i = startIndex; i < headers.length; i++) {
      contentIndices.push(i);
    }

    const getColRank = (colIdx) => {
      const h = (headers[colIdx] || '').trim().toLowerCase();
      if (['means', 'meaning', 'meanings', 'ba', 'bangla', 'bengali', 'bn', 'artho', 'অর্থ', 'মানে'].includes(h)) return 1;
      if (['japanese', 'japan', 'ja', 'jp', 'kanji', 'kana', 'nihongo', 'sentence'].includes(h)) return 2;
      if (['pronounce', 'pronunciation', 'pronounce/latin', 'latin', 'romaji', 'reading', 'sound', 'uchharon', 'উচ্চারণ'].includes(h)) return 3;

      // Detect by sample character content
      let bnCount = 0;
      let jaCount = 0;
      let latCount = 0;
      for (let r = 0; r < Math.min(uniqueRows.length, 10); r++) {
        const val = uniqueRows[r]?.[colIdx] || '';
        if (/[\u0980-\u09FF]/.test(val)) bnCount++;
        if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(val)) jaCount++;
        if (/[a-zA-Z]/.test(val) && !/[\u0980-\u09FF]/.test(val) && !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(val)) latCount++;
      }

      if (bnCount > 0 && bnCount >= jaCount) return 1;
      if (jaCount > 0) return 2;
      if (latCount > 0) return 3;

      return 4 + colIdx;
    };

    contentIndices.sort((a, b) => getColRank(a) - getColRank(b));

    setParsedCsv({ headers, rows: uniqueRows, orderedColIndices: contentIndices });
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedStates({ ...copiedStates, [key]: true });
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleSelectOption = (qIdx, option) => {
    if (quizAnswers[qIdx] !== undefined) return;
    setQuizAnswers(prev => ({
      ...prev,
      [qIdx]: option
    }));
  };

  const handleResetQuiz = () => {
    setQuizAnswers({});
  };

  const totalAnswered = Object.keys(quizAnswers).length;
  const score = quizzes.reduce((acc, q, idx) => {
    const correct = q.correct_answer || q.answer || q.correctAnswer;
    return acc + (quizAnswers[idx] === correct ? 1 : 0);
  }, 0);

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
      {/* Top Sticky Header: Toggle + Fixed Score Card (Below Toggle) */}
      <div className="sticky top-16 z-20 w-full bg-[#f3f4f6]/95 dark:bg-black/95 backdrop-blur-md pt-3 pb-3 px-4 shadow-sm border-b border-gray-200/60 dark:border-white/10 flex flex-col items-center gap-2.5">
        <div className="w-full max-w-sm bg-gray-200/80 dark:bg-zinc-800/90 p-1 rounded-2xl flex items-center shadow-inner">
          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <HelpCircle size={17} style={{ color: activeTab === 'quiz' ? 'var(--brand-color, #f97316)' : undefined }} />
            <span>Quiz</span>
            {quizzes.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'quiz' 
                  ? 'bg-brand/10 text-brand' 
                  : 'bg-black/10 dark:bg-white/10 text-gray-500'
              }`}>
                {quizzes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === 'vocabulary'
                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BookOpen size={17} style={{ color: activeTab === 'vocabulary' ? 'var(--brand-color, #f97316)' : undefined }} />
            <span>Vocabulary</span>
            {parsedCsv.rows.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'vocabulary' 
                  ? 'bg-brand/10 text-brand' 
                  : 'bg-black/10 dark:bg-white/10 text-gray-500'
              }`}>
                {parsedCsv.rows.length}
              </span>
            )}
          </button>
        </div>

        {/* Fixed Score Card: Shows on Quiz tab, Hides on Vocabulary tab */}
        {activeTab === 'quiz' && quizzes.length > 0 && (
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={18} style={{ color: 'var(--brand-color, #f97316)' }} />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Score: {score} / {quizzes.length}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({totalAnswered} of {quizzes.length} answered)
              </span>
            </div>
            {totalAnswered > 0 && (
              <button
                onClick={handleResetQuiz}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand dark:text-gray-400 dark:hover:text-brand transition-colors cursor-pointer"
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-2xl px-4 pt-6">
        {/* VIEW 1: QUIZ */}
        {activeTab === 'quiz' && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >

            {/* Quiz Questions List */}
            {quizzes.map((quiz, qIdx) => {
              const qNum = quiz.id !== undefined ? quiz.id : qIdx + 1;
              const questionText = quiz.question || '';
              const options = Array.isArray(quiz.options) ? quiz.options : [];
              const correctAnswer = quiz.correct_answer || quiz.answer || quiz.correctAnswer || '';
              const userAnswer = quizAnswers[qIdx];
              const isAnswered = userAnswer !== undefined;

              return (
                <div 
                  key={qIdx}
                  className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-gray-200 dark:border-white/10 p-4 sm:p-5 flex flex-col gap-3.5"
                >
                  {/* Question Title */}
                  <div className="flex items-start gap-3">
                    <span 
                      className="text-base font-extrabold tracking-tight shrink-0 mt-0.5"
                      style={{ color: 'var(--brand-color, #f97316)' }}
                    >
                      {qNum}
                    </span>
                    <h3 className="text-[15px] sm:text-base font-bold text-gray-900 dark:text-white leading-relaxed">
                      {questionText}
                    </h3>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {options.map((option, optIdx) => {
                      const isSelected = userAnswer === option;
                      const isCorrect = option === correctAnswer;

                      let optionClass = "border-gray-200 dark:border-white/10 hover:border-brand/60 dark:hover:border-brand/60 bg-gray-50/60 dark:bg-white/[0.02] text-gray-800 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/[0.05]";
                      let icon = null;

                      if (isAnswered) {
                        if (isCorrect) {
                          optionClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold shadow-xs ring-1 ring-emerald-500/20";
                          icon = <CheckCircle2 size={18} className="text-emerald-500 shrink-0 ml-2" />;
                        } else if (isSelected && !isCorrect) {
                          optionClass = "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-semibold shadow-xs ring-1 ring-rose-500/20";
                          icon = <XCircle size={18} className="text-rose-500 shrink-0 ml-2" />;
                        } else {
                          optionClass = "opacity-45 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 bg-transparent";
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isAnswered}
                          onClick={() => handleSelectOption(qIdx, option)}
                          className={`w-full flex items-center justify-between p-3 sm:p-3.5 rounded-xl border text-left text-sm transition-all duration-150 cursor-pointer ${optionClass}`}
                        >
                          <span className="flex-1 leading-relaxed select-text">{option}</span>
                          {icon}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {quizzes.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 shadow-xs flex flex-col items-center gap-3">
                <HelpCircle size={40} className="text-gray-400" />
                <p className="text-base font-medium text-gray-700 dark:text-gray-300">
                  এই এপিসোডে কোনো কুইজ যুক্ত করা হয়নি
                </p>
                {parsedCsv.rows.length > 0 && (
                  <button
                    onClick={() => setActiveTab('vocabulary')}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand-color, #f97316)' }}
                  >
                    Vocabulary দেখুন
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 2: VOCABULARY */}
        {activeTab === 'vocabulary' && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3.5"
          >
            {parsedCsv.rows.map((row, rowIndex) => (
              <div 
                key={rowIndex} 
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-gray-200 dark:border-white/10 overflow-hidden"
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
                
                {/* Card Values (Ordered: 1st Means/Ba, 2nd Japanese, 3rd Pronounce) */}
                <div className="flex flex-col pb-1">
                  {(parsedCsv.orderedColIndices || []).map((cellIndex) => {
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
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
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
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 shadow-xs flex flex-col items-center gap-3">
                <BookOpen size={40} className="text-gray-400" />
                <p className="text-base font-medium text-gray-700 dark:text-gray-300">
                  এই এপিসোডে কোনো Vocabulary যুক্ত করা হয়নি
                </p>
                {quizzes.length > 0 && (
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand-color, #f97316)' }}
                  >
                    Quiz দিন
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PreviewPage;

