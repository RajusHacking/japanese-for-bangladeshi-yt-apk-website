import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../context/LanguageContext';

const NO_DATA_TEXT = {
  bn: 'এই পেজে কোনো তথ্য নেই',
  en: 'No data available on this page',
  ja: 'このページにはデータがありません',
};

const ENGLISH_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

const getSlug = (link) => {
  if (!link) return '';
  const clean = String(link).split('?')[0].split('#')[0].trim().replace(/\/+$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1].toLowerCase();
};


const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Randomize option positions while guaranteeing that consecutive questions
// never place the correct answer in the same position.
const shuffleQuizOptions = (quizList) => {
  let previousCorrectIndex = -1;

  return quizList.map((quiz) => {
    const options = Array.isArray(quiz.options) ? [...quiz.options] : [];
    if (options.length < 2) return { ...quiz, options };

    const rawCorrect = quiz.correct_answer ?? quiz.answer ?? quiz.correctAnswer ?? '';

    // Support both "the correct option text" and letter answers such as A/B/C/D.
    let correctOriginalIndex = options.findIndex((option) => option === rawCorrect);
    if (correctOriginalIndex === -1 && typeof rawCorrect === 'string') {
      const answerLetter = rawCorrect.trim().toUpperCase();
      const letterIndex = OPTION_LETTERS.indexOf(answerLetter);
      if (letterIndex >= 0 && letterIndex < options.length) {
        correctOriginalIndex = letterIndex;
      }
    }

    // If the source doesn't identify a matching option, still randomize the options.
    if (correctOriginalIndex === -1) {
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      previousCorrectIndex = -1;
      return { ...quiz, options };
    }

    // Pick a new correct position that differs from the previous question.
    const allowedPositions = Array.from(
      { length: options.length },
      (_, index) => index
    ).filter((index) => index !== previousCorrectIndex);

    const targetCorrectIndex =
      allowedPositions[Math.floor(Math.random() * allowedPositions.length)];

    const shuffled = new Array(options.length);
    shuffled[targetCorrectIndex] = options[correctOriginalIndex];

    const wrongOptions = options.filter((_, index) => index !== correctOriginalIndex);

    // Fisher-Yates shuffle the wrong options independently.
    for (let i = wrongOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrongOptions[i], wrongOptions[j]] = [wrongOptions[j], wrongOptions[i]];
    }

    let wrongIndex = 0;
    for (let i = 0; i < shuffled.length; i++) {
      if (i !== targetCorrectIndex) {
        shuffled[i] = wrongOptions[wrongIndex++];
      }
    }

    previousCorrectIndex = targetCorrectIndex;
    return { ...quiz, options: shuffled };
  });
};


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

  const scrollPositions = useRef({ quiz: 0, vocabulary: 0 });
  const isSwitchingTab = useRef(false);

  // Reset scroll positions when the episode id changes
  useEffect(() => {
    scrollPositions.current = { quiz: 0, vocabulary: 0 };
    isSwitchingTab.current = false;
    window.scrollTo(0, 0);
  }, [id]);

  // Track scroll position of the currently active tab
  useEffect(() => {
    const handleScroll = () => {
      if (isSwitchingTab.current) return;
      scrollPositions.current[activeTab] = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    if (!isSwitchingTab.current) {
      scrollPositions.current[activeTab] = window.scrollY;
    }
    isSwitchingTab.current = true;
    setActiveTab(newTab);
  };

  // Restore the target tab's scroll position synchronously before paint
  useLayoutEffect(() => {
    if (!isSwitchingTab.current) return;

    const targetY = scrollPositions.current[activeTab] || 0;
    window.scrollTo(0, targetY);

    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, targetY);
      setTimeout(() => {
        isSwitchingTab.current = false;
      }, 50);
    });

    return () => cancelAnimationFrame(rafId);
  }, [activeTab]);

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
              setQuizzes(shuffleQuizOptions(parsed));
            } else if (parsed && Array.isArray(parsed.quizzes)) {
              setQuizzes(shuffleQuizOptions(parsed.quizzes));
            } else if (parsed && Array.isArray(parsed.quiz)) {
              setQuizzes(shuffleQuizOptions(parsed.quiz));
            } else if (parsed && Array.isArray(parsed.questions)) {
              setQuizzes(shuffleQuizOptions(parsed.questions));
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

  const isCorrectQuizAnswer = (quiz, selectedOption) => {
    const correct = quiz.correct_answer ?? quiz.answer ?? quiz.correctAnswer ?? '';
    if (selectedOption === correct) return true;

    if (typeof correct === 'string') {
      const answerLetter = correct.trim().toUpperCase();
      const selectedIndex = Array.isArray(quiz.options)
        ? quiz.options.findIndex((option) => option === selectedOption)
        : -1;
      return (
        selectedIndex >= 0 &&
        OPTION_LETTERS[selectedIndex] === answerLetter
      );
    }

    return false;
  };

  const rightCount = quizzes.reduce((acc, q, idx) => {
    return acc + (isCorrectQuizAnswer(q, quizAnswers[idx]) ? 1 : 0);
  }, 0);

  // Score calculated out of 100
  const scoreOutOf100 = totalQuestions > 0 ? Math.round((rightCount / totalQuestions) * 100) : 0;

  // Grade labels (English): ≤20 Very weak · <50 Weak · 50–79 Good · 80–99 Focused · 100 Genius
  const getGradeInfo = (pct) => {
    if (pct === 100) {
      return {
        label: 'Genius',
        badgeColor: 'text-amber-600 dark:text-amber-400',
      };
    }
    if (pct >= 80) {
      return {
        label: 'Focused',
        badgeColor: 'text-emerald-600 dark:text-emerald-400',
      };
    }
    if (pct >= 50) {
      return {
        label: 'Good',
        badgeColor: 'text-[#3f6212] dark:text-[#84cc16]',
      };
    }
    if (pct > 20) {
      return {
        label: 'Weak',
        badgeColor: 'text-rose-600 dark:text-rose-400',
      };
    }
    return {
      label: 'Very weak',
      badgeColor: 'text-rose-700 dark:text-rose-500',
    };
  };

  const gradeInfo = getGradeInfo(scoreOutOf100);

  // Vocabulary column typography hierarchy (minimal, no colored boxes)
  const getColMeta = (colIdx) => {
    const rank = parsedCsv.colRanks[colIdx] || 1;
    if (rank === 1) {
      return {
        textClass: 'text-[15px] font-medium text-zinc-800 dark:text-zinc-100',
      };
    }
    if (rank === 2) {
      return {
        textClass: 'text-base font-semibold text-zinc-900 dark:text-white tracking-wide',
      };
    }
    if (rank === 3) {
      return {
        textClass: 'text-[14px] font-normal text-zinc-600 dark:text-zinc-300 tracking-normal',
      };
    }
    return {
      textClass: 'text-[14px] font-normal text-zinc-700 dark:text-zinc-300',
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

        {/* Toggle with Smooth Sliding Background Pill */}
        <div className="w-full max-w-sm bg-zinc-200/70 dark:bg-zinc-800/70 p-1 rounded-xl grid grid-cols-2 border border-zinc-200/60 dark:border-white/5 relative">
          <motion.div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-zinc-900 shadow-sm border border-black/[0.04] dark:border-white/[0.08] pointer-events-none"
            initial={false}
            animate={{ left: activeTab === 'quiz' ? 4 : 'calc(50%)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
          />

          <button
            type="button"
            onClick={() => handleTabChange('quiz')}
            className={`relative flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-colors duration-200 z-10 cursor-pointer ${activeTab === 'quiz'
              ? 'text-zinc-900 dark:text-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
          >
            <span>Quiz</span>
            {quizzes.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold tabular-nums transition-colors ${activeTab === 'quiz'
                ? 'bg-brand/15 text-brand'
                : 'bg-black/5 dark:bg-white/10 text-zinc-500 dark:text-zinc-400'
                }`}>
                {quizzes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('vocabulary')}
            className={`relative flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-colors duration-200 z-10 cursor-pointer ${activeTab === 'vocabulary'
              ? 'text-zinc-900 dark:text-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
          >
            <span>Vocabulary</span>
            {parsedCsv.rows.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold tabular-nums transition-colors ${activeTab === 'vocabulary'
                ? 'bg-brand/15 text-brand'
                : 'bg-black/5 dark:bg-white/10 text-zinc-500 dark:text-zinc-400'
                }`}>
                {parsedCsv.rows.length}
              </span>
            )}
          </button>
        </div>

        {/* Fixed Score Card: Shows on Quiz tab, Hides on Vocabulary tab */}
        {activeTab === 'quiz' && totalQuestions > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.08] rounded-xl px-4 py-3 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight">
                Score <span className="tabular-nums text-zinc-500 dark:text-zinc-400 font-medium">{scoreOutOf100}</span>
                <span className="text-zinc-400 dark:text-zinc-500 font-normal">/100</span>
              </span>
              <span className={`text-xs font-semibold tracking-wide ${gradeInfo.badgeColor}`}>
                {gradeInfo.label}
              </span>
            </div>

            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${scoreOutOf100}%`,
                  backgroundColor: 'var(--brand-color, #f97316)',
                }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-2xl px-4 pt-5">
        {/* VIEW 1: QUIZ */}
        <div
          style={{ display: activeTab === 'quiz' ? 'flex' : 'none' }}
          className="flex-col gap-4"
        >
          {/* Quiz Questions List */}
          {quizzes.map((quiz, qIdx) => {
            const qNum = quiz.id !== undefined ? quiz.id : qIdx + 1;
            const questionText = quiz.question || '';
            const options = Array.isArray(quiz.options) ? quiz.options : [];
            const correctAnswer = quiz.correct_answer || quiz.answer || quiz.correctAnswer || '';
            const userAnswer = quizAnswers[qIdx];
            const isAnswered = userAnswer !== undefined;
            const userWasWrong = isAnswered && !isCorrectQuizAnswer(quiz, userAnswer);

            return (
              <div
                key={qIdx}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-white/[0.08] p-4 sm:p-5 flex flex-col gap-3"
              >
                {/* Question Header */}
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 tabular-nums mt-1 shrink-0 w-5 text-right">
                    {qNum}.
                  </span>
                  <h3 className="text-[15px] sm:text-[15px] font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                    {questionText}
                  </h3>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 gap-1.5 pl-0 sm:pl-7">
                  {options.map((option, optIdx) => {
                    const isSelected = userAnswer === option;
                    const isCorrect = isCorrectQuizAnswer(quiz, option);
                    const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);

                    let optionClass = "border-zinc-200/90 dark:border-white/[0.08] bg-transparent text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-white/15 hover:bg-zinc-50 dark:hover:bg-white/[0.03]";
                    let badgeClass = "text-zinc-400 dark:text-zinc-500";
                    let optionStyle = undefined;
                    let badgeStyle = undefined;

                    if (isAnswered) {
                      if (isSelected) {
                        // Selected option uses scheme/brand color
                        optionClass = "text-zinc-900 dark:text-white font-medium";
                        badgeClass = "font-semibold";
                        optionStyle = {
                          borderColor: 'color-mix(in srgb, var(--brand-color, #f97316) 45%, transparent)',
                          backgroundColor: 'color-mix(in srgb, var(--brand-color, #f97316) 12%, transparent)',
                        };
                        badgeStyle = { color: 'var(--brand-color, #f97316)' };
                      } else if (userWasWrong && isCorrect) {
                        // Reveal correct answer lightly when user picked wrong
                        optionClass = "text-zinc-700 dark:text-zinc-300";
                        badgeClass = "";
                        optionStyle = {
                          borderColor: 'color-mix(in srgb, var(--brand-color, #f97316) 25%, transparent)',
                          backgroundColor: 'color-mix(in srgb, var(--brand-color, #f97316) 5%, transparent)',
                        };
                        badgeStyle = {
                          color: 'color-mix(in srgb, var(--brand-color, #f97316) 80%, transparent)',
                        };
                      } else {
                        optionClass = "border-transparent text-zinc-400/50 dark:text-zinc-500/40 bg-transparent";
                        badgeClass = "text-zinc-300 dark:text-zinc-600";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        disabled={isAnswered}
                        onClick={() => handleSelectOption(qIdx, option)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors duration-150 cursor-pointer disabled:cursor-default ${optionClass}`}
                        style={optionStyle}
                      >
                        <span
                          className={`w-5 text-[11px] font-medium shrink-0 tabular-nums ${badgeClass}`}
                          style={badgeStyle}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 leading-snug select-text">{option}</span>
                        {isAnswered && isCorrect && (
                          <Check
                            size={14}
                            strokeWidth={2.5}
                            className="shrink-0"
                            style={{ color: 'var(--brand-color, #f97316)' }}
                            aria-label="Correct"
                          />
                        )}
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
                  onClick={() => handleTabChange('vocabulary')}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
                  style={{ backgroundColor: 'var(--brand-color, #f97316)' }}
                >
                  Vocabulary দেখুন
                </button>
              )}
            </div>
          )}
        </div>

        {/* VIEW 2: VOCABULARY */}
        <div
          style={{ display: activeTab === 'vocabulary' ? 'flex' : 'none' }}
          className="flex-col gap-4"
        >
          {parsedCsv.rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-white/[0.08] p-4 sm:p-5 flex flex-col gap-2"
            >
              {/* Content Rows */}
              <div className="flex flex-col">
                {(() => {
                  const cells = (parsedCsv.orderedColIndices || [])
                    .map((cellIndex) => ({ cellIndex, value: row[cellIndex] || '' }))
                    .filter((c) => c.value);
                  return cells.map(({ cellIndex, value }, lineIdx) => {
                    const copyKey = `${rowIndex}-${cellIndex}`;
                    const isCopied = copiedStates[copyKey];
                    const meta = getColMeta(cellIndex);

                    return (
                      <div
                        key={cellIndex}
                        className={`flex items-start justify-between gap-2.5 group py-2.5 first:pt-0 last:pb-0 ${
                          lineIdx > 0 ? 'border-t border-zinc-200/60 dark:border-white/[0.06]' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {lineIdx === 0 ? (
                            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 tabular-nums mt-1 shrink-0 w-5 text-right">
                              {rowIndex + 1}.
                            </span>
                          ) : (
                            <span className="w-5 shrink-0" aria-hidden="true" />
                          )}
                          <span className={`flex-1 min-w-0 break-words whitespace-pre-wrap select-text leading-snug ${meta.textClass}`}>
                            {value}
                          </span>
                        </div>

                        <button
                          onClick={() => handleCopy(value, copyKey)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer opacity-60 group-hover:opacity-100"
                          title="Copy to clipboard"
                        >
                          {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    );
                  });
                })()}
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
                    onClick={() => handleTabChange('quiz')}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
                    style={{ backgroundColor: 'var(--brand-color, #f97316)' }}
                  >
                    Quiz দিন
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;


