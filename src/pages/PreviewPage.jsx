import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../context/LanguageContext';

const NOT_FOUND_TEXT = {
  bn: 'এই ভিডিওতে রিসোর্স নেই',
  en: 'This video has no resource',
  ja: 'この動画にはリソースがありません',
};

const ENGLISH_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

const getSlug = (link) => {
  if (!link) return '';
  const clean = String(link).split('?')[0].split('#')[0].trim().replace(/\/+$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1].toLowerCase();
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const PreviewPage = () => {
  const { id } = useParams();
  const [episodeData, setEpisodeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz' | 'vocabulary'
  const [parsedCsv, setParsedCsv] = useState({ headers: [], rows: [], orderedColIndices: [], colRanks: {} });
  const [quizzes, setQuizzes] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [copiedStates, setCopiedStates] = useState({});
  const { language } = useLanguage();

  useEffect(() => {
    // Purge legacy public caches
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

    // Real-time subscription to Firestore episodes collection
    const unsubscribe = onSnapshot(collection(db, "episodes"), (querySnapshot) => {
      const matchedItems = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docSlug = getSlug(data.detectedLink);
        const docId = String(data.id || '').trim().toLowerCase();

        if (
          targetSlug &&
          (docSlug === targetSlug || docId === targetSlug)
        ) {
          matchedItems.push(data);
        }
      });

      matchedItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const match = matchedItems.length > 0 ? matchedItems[0] : null;

      if (match) {
        setEpisodeData(match);

        // Parse CSV
        if (match.csvContent) {
          parseCSV(match.csvContent);
        } else {
          setParsedCsv({ headers: [], rows: [], orderedColIndices: [], colRanks: {} });
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
        setParsedCsv({ headers: [], rows: [], orderedColIndices: [], colRanks: {} });
        setQuizzes([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setEpisodeData(null);
      setParsedCsv({ headers: [], rows: [], orderedColIndices: [], colRanks: {} });
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

    const colRanks = {};
    contentIndices.forEach((colIdx) => {
      colRanks[colIdx] = getColRank(colIdx);
    });

    setParsedCsv({ headers, rows: uniqueRows, orderedColIndices: contentIndices, colRanks });
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

  const totalQuestions = quizzes.length;
  const rightCount = quizzes.reduce((acc, q, idx) => {
    const correct = q.correct_answer || q.answer || q.correctAnswer;
    return acc + (quizAnswers[idx] === correct ? 1 : 0);
  }, 0);

  const wrongCount = quizzes.reduce((acc, q, idx) => {
    const answered = quizAnswers[idx];
    if (!answered) return acc;
    const correct = q.correct_answer || q.answer || q.correctAnswer;
    return acc + (answered !== correct ? 1 : 0);
  }, 0);

  // Score calculated out of 100
  const scoreOutOf100 = totalQuestions > 0 ? Math.round((rightCount / totalQuestions) * 100) : 0;

  // Grade & Status badge logic (pure text labels, no icons inside labels):
  // < 50: দুর্বল
  // 50 - 79: ভালো
  // 80 - 99: মনোযোগী
  // 100: জিনিয়াস
  const getGradeInfo = (pct) => {
    if (pct === 100) {
      return {
        label: 'জিনিয়াস',
        badgeColor: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 dark:border-amber-500/30 ring-1 ring-amber-500/15',
        barGradient: 'from-amber-500/70 via-orange-400/80 to-amber-400/80',
      };
    }
    if (pct >= 80) {
      return {
        label: 'মনোযোগী',
        badgeColor: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/30 ring-1 ring-emerald-500/15',
        barGradient: 'from-emerald-500/70 to-teal-400/80',
      };
    }
    if (pct >= 50) {
      return {
        label: 'ভালো',
        badgeColor: 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25 dark:border-blue-500/30 ring-1 ring-blue-500/15',
        barGradient: 'from-blue-500/70 to-indigo-400/80',
      };
    }
    return {
      label: 'দুর্বল',
      badgeColor: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25 dark:border-rose-500/30 ring-1 ring-rose-500/15',
      barGradient: 'from-rose-500/70 to-rose-400/80',
    };
  };

  const gradeInfo = getGradeInfo(scoreOutOf100);

  // Helper for vocabulary column styling & metadata with curated opacities
  const getColMeta = (colIdx) => {
    const rank = parsedCsv.colRanks[colIdx] || 1;
    if (rank === 1) {
      return {
        label: 'অর্থ',
        containerClass: 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07] dark:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.10] border-emerald-500/15',
        labelBadgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
        textClass: 'text-[15px] font-semibold text-gray-900 dark:text-gray-100',
        copyBtnClass: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
      };
    }
    if (rank === 2) {
      return {
        label: 'জাপানি',
        containerClass: 'bg-blue-500/[0.04] hover:bg-blue-500/[0.07] dark:bg-blue-500/[0.06] dark:hover:bg-blue-500/[0.10] border-blue-500/15',
        labelBadgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
        textClass: 'text-lg font-bold text-gray-900 dark:text-white tracking-wide',
        copyBtnClass: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300',
      };
    }
    if (rank === 3) {
      return {
        label: 'উচ্চারণ',
        containerClass: 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07] dark:bg-amber-500/[0.05] dark:hover:bg-amber-500/[0.09] border-amber-500/15',
        labelBadgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
        textClass: 'text-[14px] font-medium text-gray-800 dark:text-gray-200 italic',
        copyBtnClass: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300',
      };
    }
    return {
      label: parsedCsv.headers[colIdx] || '',
      containerClass: 'bg-purple-500/[0.04] hover:bg-purple-500/[0.07] dark:bg-purple-500/[0.05] dark:hover:bg-purple-500/[0.09] border-purple-500/15',
      labelBadgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
      textClass: 'text-[15px] font-medium text-gray-800 dark:text-gray-200',
      copyBtnClass: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300',
    };
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
    <div 
      className="w-full min-h-screen bg-slate-50/70 dark:bg-[#09090b] pb-24 flex flex-col items-center selection:bg-brand/20 selection:text-brand"
      style={{ fontFamily: ENGLISH_FONT_FAMILY }}
    >
      {/* Top Sticky Header: Toggle + Fixed Score Card (Below Toggle) */}
      <div className="sticky top-16 z-20 w-full bg-slate-50/85 dark:bg-[#09090b]/85 backdrop-blur-xl pt-3 pb-3 px-4 shadow-xs border-b border-gray-200/50 dark:border-white/[0.06] flex flex-col items-center gap-2.5">
        
        {/* Toggle with Smooth Sliding Background Pill (No Icons in Labels) */}
        <div className="w-full max-w-sm bg-gray-200/60 dark:bg-zinc-800/70 p-1.5 rounded-2xl flex items-center border border-gray-200/50 dark:border-white/5 relative">
          <button
            onClick={() => setActiveTab('quiz')}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-colors duration-200 z-10 cursor-pointer ${
              activeTab === 'quiz'
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {activeTab === 'quiz' && (
              <motion.div
                layoutId="activeTabPill"
                className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-black/5 dark:border-white/10"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span>Quiz</span>
              {quizzes.length > 0 && (
                <span className={`text-[11px] px-2 py-0.2 rounded-full font-bold transition-colors ${
                  activeTab === 'quiz' 
                    ? 'bg-brand/15 text-brand' 
                    : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                }`}>
                  {quizzes.length}
                </span>
              )}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-colors duration-200 z-10 cursor-pointer ${
              activeTab === 'vocabulary'
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {activeTab === 'vocabulary' && (
              <motion.div
                layoutId="activeTabPill"
                className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-black/5 dark:border-white/10"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span>Vocabulary</span>
              {parsedCsv.rows.length > 0 && (
                <span className={`text-[11px] px-2 py-0.2 rounded-full font-bold transition-colors ${
                  activeTab === 'vocabulary' 
                    ? 'bg-brand/15 text-brand' 
                    : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                }`}>
                  {parsedCsv.rows.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Fixed Score Card: Shows on Quiz tab, Hides on Vocabulary tab */}
        {activeTab === 'quiz' && totalQuestions > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-gray-200/80 dark:border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col gap-2.5 transition-all"
          >
            {/* Top Row: Score + Status Badge + Right/Wrong Soft Capsules */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              {/* Score and Grade Status */}
              <div className="flex items-center gap-2.5">
                <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight">
                  Score: <span className="tabular-nums" style={{ color: 'var(--brand-color, #f97316)' }}>{scoreOutOf100}</span>/100
                </span>
                
                {/* Grade Badge (Pure text, No Icon inside label) */}
                <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${gradeInfo.badgeColor}`}>
                  <span>{gradeInfo.label}</span>
                </div>
              </div>

              {/* Right and Wrong Soft Minimal Bubbles (Eye-friendly, no harsh neon colors) */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Right Count Bubble (Soft Minimal Green) */}
                <div 
                  className="min-w-[34px] h-7 px-2.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center select-none tabular-nums"
                  title="সঠিক উত্তরের সংখ্যা"
                >
                  {rightCount}
                </div>

                {/* Wrong Count Bubble (Soft Minimal Red) */}
                <div 
                  className="min-w-[34px] h-7 px-2.5 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center select-none tabular-nums"
                  title="ভুল উত্তরের সংখ্যা"
                >
                  {wrongCount}
                </div>
              </div>
            </div>

            {/* Bottom Row: Animated Smooth Progress Bar */}
            <div className="w-full bg-gray-100 dark:bg-zinc-800/80 h-2 rounded-full overflow-hidden relative">
              <div 
                className={`h-full rounded-full bg-gradient-to-r ${gradeInfo.barGradient} transition-all duration-500 ease-out`}
                style={{ width: `${scoreOutOf100}%` }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-2xl px-4 pt-5">
        {/* VIEW 1: QUIZ */}
        {activeTab === 'quiz' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
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
              const userWasWrong = isAnswered && userAnswer !== correctAnswer;

              return (
                <div 
                  key={qIdx}
                  className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl shadow-xs border border-gray-200/80 dark:border-white/10 p-4 sm:p-5 flex flex-col gap-3.5 transition-all hover:border-gray-300 dark:hover:border-white/20"
                >
                  {/* Question Header */}
                  <div className="flex items-start gap-3">
                    <span 
                      className="w-7 h-7 rounded-xl bg-brand/10 dark:bg-brand/15 text-brand font-black text-xs sm:text-sm flex items-center justify-center shrink-0 border border-brand/20 mt-0.5"
                    >
                      {qNum}
                    </span>
                    <h3 className="text-[15px] sm:text-base font-bold text-gray-900 dark:text-white leading-relaxed">
                      {questionText}
                    </h3>
                  </div>

                  {/* Options (Clean letter badges, balanced color opacities, no harsh neon colors) */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {options.map((option, optIdx) => {
                      const isSelected = userAnswer === option;
                      const isCorrect = option === correctAnswer;
                      const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);

                      let optionClass = "border-gray-200/70 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-gray-800 dark:text-gray-200 hover:bg-brand/[0.03] hover:border-brand/40 dark:hover:bg-white/[0.05]";
                      let badgeClass = "bg-gray-200/60 dark:bg-white/10 text-gray-600 dark:text-gray-300";

                      if (isAnswered) {
                        if (isSelected && isCorrect) {
                          // User selected correct answer: Standard soft green
                          optionClass = "border-emerald-500/40 dark:border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/20";
                          badgeClass = "bg-emerald-500/20 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold";
                        } else if (isSelected && !isCorrect) {
                          // User selected wrong answer: Soft minimal rose/red
                          optionClass = "border-rose-500/40 dark:border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/15 text-rose-900 dark:text-rose-200 font-semibold ring-1 ring-rose-500/20";
                          badgeClass = "bg-rose-500/20 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold";
                        } else if (userWasWrong && isCorrect) {
                          // Correct answer revealed when user was wrong: Lower green opacity so user's pick stands out
                          optionClass = "border-emerald-500/25 dark:border-emerald-500/20 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] text-emerald-800/80 dark:text-emerald-300/80 font-medium";
                          badgeClass = "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600/80 dark:text-emerald-400/80 border border-emerald-500/20 font-semibold";
                        } else {
                          // Other unselected options: Faded minimal
                          optionClass = "opacity-35 border-gray-200/40 dark:border-white/5 text-gray-400 dark:text-gray-500 bg-transparent";
                          badgeClass = "bg-gray-200/30 dark:bg-white/5 text-gray-400";
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isAnswered}
                          onClick={() => handleSelectOption(qIdx, option)}
                          className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border text-left text-sm transition-all duration-150 cursor-pointer ${optionClass}`}
                        >
                          <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center shrink-0 transition-colors ${badgeClass}`}>
                            {letter}
                          </span>
                          <span className="flex-1 leading-relaxed select-text font-medium">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {quizzes.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:border-white/10 shadow-xs flex flex-col items-center gap-3">
                <p className="text-base font-medium text-gray-700 dark:text-gray-300">
                  এই এপিসোডে কোনো কুইজ যুক্ত করা হয়নি
                </p>
                {parsedCsv.rows.length > 0 && (
                  <button
                    onClick={() => setActiveTab('vocabulary')}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            {parsedCsv.rows.map((row, rowIndex) => (
              <div 
                key={rowIndex} 
                className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl shadow-xs border border-gray-200/80 dark:border-white/10 p-4 sm:p-5 flex flex-col gap-2.5 transition-all hover:border-gray-300 dark:hover:border-white/20"
              >
                {/* Card Top Row: Word Number Capsule & Subtle Label */}
                <div className="flex items-center justify-between pb-1">
                  <span 
                    className="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand/10 dark:bg-brand/15 text-brand border border-brand/20 tabular-nums"
                  >
                    {rowIndex + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider uppercase">
                    Word #{rowIndex + 1}
                  </span>
                </div>
                
                {/* Content Rows with Balanced Opacity & Colors (1st Means, 2nd Japanese, 3rd Pronounce) */}
                <div className="flex flex-col gap-2">
                  {(parsedCsv.orderedColIndices || []).map((cellIndex) => {
                    const value = row[cellIndex] || '';
                    if (!value) return null;
                    const copyKey = `${rowIndex}-${cellIndex}`;
                    const isCopied = copiedStates[copyKey];
                    const meta = getColMeta(cellIndex);

                    return (
                      <div 
                        key={cellIndex} 
                        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-colors ${meta.containerClass}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Clean Micro Label Tag (No icon) */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shrink-0 border ${meta.labelBadgeClass}`}>
                            {meta.label}
                          </span>
                          
                          {/* Cell Text */}
                          <span className={`truncate select-text leading-relaxed ${meta.textClass}`}>
                            {value}
                          </span>
                        </div>
                        
                        {/* Functional Copy Button */}
                        <button
                          onClick={() => handleCopy(value, copyKey)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 cursor-pointer ${meta.copyBtnClass}`}
                          title="Copy to clipboard"
                        >
                          {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {parsedCsv.rows.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/70 dark:border-white/10 shadow-xs flex flex-col items-center gap-3">
                <p className="text-base font-medium text-gray-700 dark:text-gray-300">
                  এই এপিসোডে কোনো Vocabulary যুক্ত করা হয়নি
                </p>
                {quizzes.length > 0 && (
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
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


