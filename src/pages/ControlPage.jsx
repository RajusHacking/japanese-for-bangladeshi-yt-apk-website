import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Video, FileText, Check, Trash2, Edit2, Upload, AlertCircle, Save, XCircle, Link as LinkIcon, Eye, LogOut, FileCode } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ALLOWED_EMAILS = ['work.alirejaraju@gmail.com', 'info.alirejaraju@gmail.com'];

const ControlPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Dashboard Form State
  const [videoInput, setVideoInput] = useState('');
  const [detectedLink, setDetectedLink] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [quizFile, setQuizFile] = useState(null);
  const [quizContent, setQuizContent] = useState(null);
  const [editId, setEditId] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const fileInputRef = useRef(null);
  const quizFileInputRef = useRef(null);

  // Computed YouTube ID and Title for preview
  const [youtubeId, setYoutubeId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  // Saved Data
  const [savedItems, setSavedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load from Firestore
  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "episodes"));
        const items = [];
        querySnapshot.forEach((doc) => {
          items.push(doc.data());
        });
        items.sort((a, b) => b.timestamp - a.timestamp);
        setSavedItems(items);
      } catch (e) {
        console.error("Failed to fetch episodes", e);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchEpisodes();
  }, []);

  // Auth State Listener — redirect to /login if not authenticated
  useEffect(() => {
    const savedAuth = localStorage.getItem('j4b_admin_auth');
    if (savedAuth) {
      setIsAuthenticated(true);
      setCheckingAuth(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email && ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
        setIsAuthenticated(true);
      } else if (!savedAuth) {
        // Not authenticated or not an allowed UID — redirect to login
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('j4b_admin_auth');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-detect link logic by fetching YouTube data via API
  useEffect(() => {
    let timeoutId;
    let intervalId;

    const fetchYoutubeDescription = async () => {
      if (!videoInput) {
        setYoutubeId('');
        setVideoTitle('');
        return;
      }

      // Extract YouTube video ID
      let id = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = videoInput.match(regExp);
      if (match && match[2].length === 11) {
        id = match[2];
      } else {
        if (videoInput.length === 11) id = videoInput;
      }
      setYoutubeId(id);

      if (id) {
        setIsDetecting(true);
        try {
          const API_KEY = "AIzaSyDEnsBoim5hZsrnXJ0hIY9DaJZ4CoOdsok";
          const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${API_KEY}`;
          const response = await fetch(apiUrl);
          const data = await response.json();

          if (data.items && data.items.length > 0) {
            const description = data.items[0].snippet.description;
            setVideoTitle(data.items[0].snippet.title);
            // Detect link like https://j4b.vercel.app/Episode-10
            const linkMatch = description.match(/https?:\/\/j4b\.vercel\.app\/[a-zA-Z0-9-]+/i);
            if (linkMatch && linkMatch[0]) {
              setDetectedLink(linkMatch[0]);
              clearInterval(intervalId); // Stop polling once found
            } else {
              setDetectedLink(''); // Reset if no link found in new video
            }
          }
        } catch (error) {
          console.error("Failed to fetch youtube data", error);
        }
        setIsDetecting(false);
      }
    };

    if (videoInput) {
      timeoutId = setTimeout(() => {
        fetchYoutubeDescription();
        intervalId = setInterval(fetchYoutubeDescription, 3000); // Recheck every 3 seconds
      }, 800);
    } else {
      setDetectedLink('');
      setYoutubeId('');
      setVideoTitle('');
    }

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [videoInput]);

  const readTextFile = (file, type) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      // Remove a possible UTF-8 BOM before JSON validation.
      const rawContent = typeof event.target.result === 'string'
        ? event.target.result
        : '';
      const content = rawContent.replace(/^\uFEFF/, '');

      if (type === 'quiz') {
        try {
          JSON.parse(content);
        } catch (err) {
          console.error('Invalid quiz JSON:', err);
          alert("Invalid quiz file. The .json or .txt file must contain valid JSON.");
          setQuizFile(null);
          setQuizContent(null);
          if (quizFileInputRef.current) {
            quizFileInputRef.current.value = '';
          }
          return;
        }

        // Keep BOTH values in React state. handleSave will persist these
        // exact values to Firestore as jsonFileName/jsonContent.
        setQuizFile(file);
        setQuizContent(content);
        return;
      }

      setCsvFile(file);
      setCsvContent(content);
    };

    reader.onerror = () => {
      alert("Could not read the selected file.");
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) readTextFile(file, 'csv');
  };

  const handleQuizFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) readTextFile(file, 'quiz');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (type === 'csv') {
      if (!/\.csv$/i.test(file.name)) {
        alert("Please drop a .csv file.");
        return;
      }
      readTextFile(file, 'csv');
      return;
    }

    if (!/\.(json|txt)$/i.test(file.name)) {
      alert("Please drop a .json or .txt file.");
      return;
    }
    readTextFile(file, 'quiz');
  };

  const handleClear = () => {
    setVideoInput('');
    setDetectedLink('');
    setVideoTitle('');
    setCsvFile(null);
    setCsvContent(null);
    setQuizFile(null);
    setQuizContent(null);
    setEditId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (quizFileInputRef.current) {
      quizFileInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!videoInput) {
      alert("Please enter a video link");
      return;
    }
    if (!detectedLink) {
      alert("Resource link is empty. Please provide one (e.g. https://j4b.vercel.app/Episode-10)");
      return;
    }

    const processCSV = (csvStr) => {
      if (!csvStr) return null;
      const lines = csvStr.split(/\r?\n/).filter(line => line.trim());
      if (lines.length <= 1) return csvStr;

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

      const headers = parseCSVLine(lines[0]);
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
          continue; // Skip duplicate row/card
        }
        seen.add(contentKey);

        const newRow = [...row];
        if (hasIdColumn) {
          newRow[0] = String(uniqueRows.length + 1); // Renumber ID
        }
        uniqueRows.push(newRow);
      }

      const formatCSVCell = (val) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const outputLines = [
        headers.map(formatCSVCell).join(','),
        ...uniqueRows.map(row => row.map(formatCSVCell).join(','))
      ];

      return outputLines.join('\n');
    };

    const newCsvContent = csvContent !== null ? processCSV(csvContent) : (editId ? savedItems.find(i => i.id === editId)?.csvContent || null : null);

    let newCsvName = csvFile ? csvFile.name : (editId ? savedItems.find(i => i.id === editId)?.csvFileName || null : null);
    if (newCsvContent && detectedLink) {
      const match = detectedLink.match(/https?:\/\/j4b\.vercel\.app\/([a-zA-Z0-9-]+)/i);
      if (match && match[1]) {
        newCsvName = `${match[1]}.csv`;
      }
    }

    const existingItem = editId
      ? savedItems.find(i => i.id === editId)
      : null;

    const hasNewQuizUpload = quizFile !== null && quizContent !== null;

    const newQuizContent = hasNewQuizUpload
      ? quizContent
      : (existingItem?.jsonContent ?? null);

    let newQuizName = hasNewQuizUpload
      ? quizFile.name
      : (existingItem?.jsonFileName ?? null);

    if (newQuizContent && detectedLink) {
      const match = detectedLink.match(/https?:\/\/j4b\.vercel\.app\/([a-zA-Z0-9-]+)/i);
      if (match && match[1]) {
        const extension =
          (hasNewQuizUpload && quizFile?.name?.match(/\.(json|txt)$/i)?.[1]?.toLowerCase()) ||
          newQuizName?.match(/\.(json|txt)$/i)?.[1]?.toLowerCase() ||
          'json';
        newQuizName = `${match[1]}.${extension}`;
      }
    }

    const newItem = {
      id: editId || Date.now().toString(),
      videoInput,
      detectedLink,
      youtubeId,
      videoTitle,
      csvFileName: newCsvName,
      csvContent: newCsvContent,
      jsonFileName: newQuizName,
      jsonContent: newQuizContent,
      timestamp: Date.now()
    };

    try {
      await setDoc(doc(db, "episodes", newItem.id), newItem);

      if (editId) {
        setSavedItems(savedItems.map(item => item.id === editId ? newItem : item).sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setSavedItems([newItem, ...savedItems].sort((a, b) => b.timestamp - a.timestamp));
      }
      handleClear();
    } catch (error) {
      console.error("Error saving document: ", error);

      const message = String(error?.message || '');
      if (/maximum size|too large|1\s*MiB|document.*size/i.test(message)) {
        alert("Quiz file is too large for a Firestore document. Please use a smaller JSON/TXT quiz file.");
      } else if (/permission|insufficient/i.test(message)) {
        alert("Firebase permission denied while saving the quiz file.");
      } else {
        alert(`Failed to save to Firebase: ${message || 'Unknown error'}`);
      }
    }
  };

  const handleEdit = (item) => {
    setVideoInput(item.videoInput || '');
    setDetectedLink(item.detectedLink || '');
    setVideoTitle(item.videoTitle || '');
    setCsvContent(item.csvContent || null);
    setCsvFile(null);
    setQuizContent(item.jsonContent || null);
    setQuizFile(null);
    setEditId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteDoc(doc(db, "episodes", id));
        setSavedItems(savedItems.filter(item => item.id !== id));
        setSelectedItems(selectedItems.filter(itemId => itemId !== id));
      } catch (e) {
        console.error("Error deleting document: ", e);
        alert("Failed to delete from Firebase");
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) {
      try {
        for (const id of selectedItems) {
          await deleteDoc(doc(db, "episodes", id));
        }
        setSavedItems(savedItems.filter(item => !selectedItems.includes(item.id)));
        setSelectedItems([]);
      } catch (e) {
        console.error("Error deleting documents: ", e);
        alert("Failed to delete from Firebase");
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === savedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(savedItems.map(item => item.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(itemId => itemId !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="w-full flex-1 flex items-center justify-center min-h-[calc(100vh-160px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-200 dark:border-zinc-700 border-t-[var(--brand-color,#f97316)]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  const currentCsvName = csvFile ? csvFile.name : (editId ? savedItems.find(i => i.id === editId)?.csvFileName : null);
  const currentQuizName = quizFile ? quizFile.name : (editId ? (savedItems.find(i => i.id === editId)?.jsonFileName || (savedItems.find(i => i.id === editId)?.jsonContent ? 'Quiz.json' : null)) : null);

  const fieldClass =
    'w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.08] rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20 transition-shadow';

  const labelClass = 'text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-wide';

  return (
    <div className="w-full min-h-[calc(100dvh-108px)] lg:h-[calc(95dvh-108px)] lg:min-h-0 overflow-visible lg:overflow-hidden bg-slate-50/70 dark:bg-[#09090b] pb-2 flex flex-col">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 sm:pt-4 min-h-0 lg:h-full flex flex-col w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">
              Control
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Manage episode resources
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors font-medium flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start lg:flex-1 lg:min-h-0 lg:overflow-hidden">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.08] rounded-xl p-5 sm:p-6 flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden"
          >
            {editId && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20">
                <span className="text-xs font-medium text-brand">
                  Editing episode
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className={`${labelClass} flex items-center gap-1.5`}>
                <Video size={13} /> Video link
              </label>
              <input
                type="text"
                placeholder="Paste YouTube URL"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                className={fieldClass}
              />
              {videoTitle && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate pt-0.5">
                  {videoTitle}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`${labelClass} flex items-center justify-between`}>
                <span className="flex items-center gap-1.5">
                  <LinkIcon size={13} /> Resource link
                </span>
                {isDetecting && (
                  <span className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--brand-color, #f97316)' }}>
                    <span className="w-2.5 h-2.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
                    Detecting
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="link will appear here"
                value={detectedLink}
                onChange={(e) => setDetectedLink(e.target.value)}
                className={fieldClass}
              />
            </div>

            {/* CSV Upload */}
            <div className="flex flex-col gap-1.5">
              <label className={`${labelClass} flex items-center gap-1.5`}>
                <Upload size={13} /> Vocabulary CSV
              </label>
              <label
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'csv')}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg border cursor-pointer transition-colors ${currentCsvName
                    ? 'border-brand/40 bg-brand/[0.06]'
                    : 'border-dashed border-zinc-300 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${currentCsvName
                      ? 'text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                    }`}
                    style={currentCsvName ? { backgroundColor: 'var(--brand-color, #f97316)' } : undefined}
                  >
                    {currentCsvName ? <Check size={15} strokeWidth={2.5} /> : <Upload size={15} />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm truncate ${currentCsvName
                        ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                      {currentCsvName || 'Drop .csv here, or choose a file'}
                    </span>
                  </div>
                </div>
                {currentCsvName && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCsvFile(null);
                      setCsvContent(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-md transition-colors shrink-0 cursor-pointer"
                    title="Remove CSV"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </label>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Drag & drop a .csv file here</span>
            </div>

            {/* Quiz JSON/TXT Upload */}
            <div className="flex flex-col gap-1.5">
              <label className={`${labelClass} flex items-center gap-1.5`}>
                <FileCode size={13} /> Quiz JSON / TXT
              </label>
              <label
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'quiz')}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg border cursor-pointer transition-colors ${currentQuizName
                    ? 'border-brand/40 bg-brand/[0.06]'
                    : 'border-dashed border-zinc-300 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    ref={quizFileInputRef}
                    type="file"
                    accept=".json,.txt,text/plain,application/json"
                    onChange={handleQuizFileChange}
                    className="hidden"
                  />
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${currentQuizName
                      ? 'text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                    }`}
                    style={currentQuizName ? { backgroundColor: 'var(--brand-color, #f97316)' } : undefined}
                  >
                    {currentQuizName ? <Check size={15} strokeWidth={2.5} /> : <FileCode size={15} />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm truncate ${currentQuizName
                        ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                      {currentQuizName || 'Drop .json or .txt here, or choose a file'}
                    </span>
                  </div>
                </div>
                {currentQuizName && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setQuizFile(null);
                      setQuizContent(null);
                      if (quizFileInputRef.current) quizFileInputRef.current.value = '';
                    }}
                    className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-md transition-colors shrink-0 cursor-pointer"
                    title="Remove quiz file"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </label>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Drag & drop a .json or .txt file here</span>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 py-2.5 bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-200/80 dark:hover:bg-white/[0.1] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: 'var(--brand-color, #f97316)' }}
              >
                <Save size={15} />
                {editId ? 'Update' : 'Save'}
              </button>
            </div>
          </motion.div>

          {/* Saved list */}
          <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2.5 cursor-pointer select-none group"
              >
                <span
                  className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors shrink-0 ${selectedItems.length === savedItems.length && savedItems.length > 0
                      ? 'border-transparent text-white'
                      : 'border-zinc-300 dark:border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  style={
                    selectedItems.length === savedItems.length && savedItems.length > 0
                      ? { backgroundColor: 'var(--brand-color, #f97316)' }
                      : undefined
                  }
                >
                  {selectedItems.length === savedItems.length && savedItems.length > 0 && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Saved
                  <span className="ml-1.5 text-zinc-400 dark:text-zinc-500 font-normal tabular-nums">
                    {savedItems.length}
                  </span>
                </span>
              </button>

              {selectedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-medium rounded-lg transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Trash2 size={13} /> Delete ({selectedItems.length})
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 lg:h-[680px] lg:max-h-[calc(100%-48px)] lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden overflow-visible pr-1 custom-scrollbar overscroll-contain snap-y snap-mandatory">
              {isLoadingData ? (
                <div className="py-16 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-200 dark:border-zinc-700 border-t-[var(--brand-color,#f97316)]" />
                </div>
              ) : (
                <>
                  {savedItems.map((item) => {
                    const selected = selectedItems.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`group/card shrink-0 h-[90px] rounded-xl border transition-colors overflow-hidden snap-start ${selected
                            ? 'bg-brand/[0.05] border-brand/35'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.12]'
                          }`}
                      >
                        <div className="flex items-stretch">
                          {/* Select */}
                          <button
                            type="button"
                            onClick={() => toggleSelect(item.id)}
                            className={`w-11 shrink-0 flex items-center justify-center border-r transition-colors cursor-pointer ${selected
                                ? 'border-brand/20 bg-brand/[0.08]'
                                : 'border-zinc-100 dark:border-white/[0.06] hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                              }`}
                            title={selected ? 'Deselect' : 'Select'}
                            aria-pressed={selected}
                          >
                            <span
                              className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${selected
                                  ? 'border-transparent text-white'
                                  : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900'
                                }`}
                              style={
                                selected
                                  ? { backgroundColor: 'var(--brand-color, #f97316)' }
                                  : undefined
                              }
                            >
                              {selected && <Check size={12} strokeWidth={3} />}
                            </span>
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate leading-snug">
                                  {item.videoTitle || 'YouTube Video'}
                                </h3>
                                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                  {item.detectedLink || 'No resource link'}
                                </p>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-0.5">
                                <Link
                                  to={item.detectedLink || '#'}
                                  target="_blank"
                                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded-md transition-colors"
                                  title="Preview"
                                >
                                  <Eye size={15} />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.csvFileName ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-white/[0.05]">
                                  <FileText size={11} />
                                  {item.csvFileName}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                                  <AlertCircle size={11} /> No CSV
                                </span>
                              )}
                              {item.jsonFileName || item.jsonContent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-white/[0.05]">
                                  <FileCode size={11} />
                                  {item.jsonFileName || 'Quiz JSON'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                                  <AlertCircle size={11} /> No Quiz
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {savedItems.length === 0 && (
                    <div className="py-14 text-center rounded-xl border border-dashed border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-zinc-900/40">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No saved episodes yet</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPage;
