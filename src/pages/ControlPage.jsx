import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Video, FileText, Check, Trash2, Edit2, Upload, AlertCircle, Save, XCircle, Link as LinkIcon, Eye, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ALLOWED_UIDS = ['nCwPYIH14zY3CPALYq6OmRWcOJX2', 'ee8dlkU8ZcN4jjHI79uU6IKYxE62'];

const ControlPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Dashboard Form State
  const [videoInput, setVideoInput] = useState('');
  const [detectedLink, setDetectedLink] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [editId, setEditId] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && ALLOWED_UIDS.includes(user.uid)) {
        setIsAuthenticated(true);
      } else {
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
            // Detect link like https://j4b.vercel.app/628468348
            const linkMatch = description.match(/https?:\/\/j4b\.vercel\.app\/([a-zA-Z0-9-]+)/i);
            if (linkMatch && linkMatch[1]) {
              setDetectedLink('/' + linkMatch[1]);
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

    const timeoutId = setTimeout(fetchYoutubeDescription, 800); // Debounce
    return () => clearTimeout(timeoutId);
  }, [videoInput]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleClear = () => {
    setVideoInput('');
    setDetectedLink('');
    setVideoTitle('');
    setCsvFile(null);
    setCsvContent(null);
    setEditId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!videoInput) {
      alert("Please enter a video link");
      return;
    }
    if (!detectedLink) {
      alert("Detected link is empty. Please provide one (e.g. /628468348)");
      return;
    }

    const newItem = {
      id: editId || Date.now().toString(),
      videoInput,
      detectedLink,
      youtubeId,
      videoTitle,
      csvFileName: csvFile ? csvFile.name : (editId ? savedItems.find(i => i.id === editId)?.csvFileName || null : null),
      csvContent: csvContent !== null ? csvContent : (editId ? savedItems.find(i => i.id === editId)?.csvContent || null : null),
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
      alert("Failed to save to Firebase");
    }
  };

  const handleEdit = (item) => {
    setVideoInput(item.videoInput || '');
    setDetectedLink(item.detectedLink || '');
    setVideoTitle(item.videoTitle || '');
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control Panel</h1>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors font-medium flex items-center gap-2"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Control Panel Form */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Video size={16} /> Video Link
            </label>
            <input 
              type="text"
              placeholder="Paste YouTube Link"
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LinkIcon size={16} /> Auto Detected Link
              </span>
              {isDetecting && (
                <span className="text-xs text-brand flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                  Detecting...
                </span>
              )}
            </label>
            <input 
              type="text"
              placeholder="e.g. /628468348"
              value={detectedLink}
              onChange={(e) => setDetectedLink(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Upload size={16} /> CSV File Upload
            </label>
            <label className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <Upload size={18} className="text-gray-400" />
              <span className="text-sm text-gray-500 font-medium truncate">
                {csvFile ? csvFile.name : 'Choose a .csv file'}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button 
              type="button"
              onClick={handleClear}
              className="flex-1 py-2.5 bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300 font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <XCircle size={18} /> Clear
            </button>
            <button 
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 bg-brand text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Save size={18} /> {editId ? 'Update' : 'Save'}
            </button>
          </div>
        </motion.div>

        {/* Center Column: Saved Data List */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={selectedItems.length === savedItems.length && savedItems.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded border-gray-300 text-brand focus:ring-brand"
              />
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Saved Items ({savedItems.length})
              </span>
            </label>
            
            {selectedItems.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors flex items-center gap-1.5 text-sm"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
            {savedItems.map((item) => (
              <div 
                key={item.id} 
                className={`flex flex-col gap-3 p-4 rounded-xl border transition-colors ${
                  selectedItems.includes(item.id) 
                    ? 'bg-brand/5 border-brand/30 dark:bg-brand/10 dark:border-brand/30' 
                    : 'bg-white border-gray-200 dark:bg-zinc-900 dark:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-5 h-5 mt-0.5 rounded border-gray-300 text-brand focus:ring-brand shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {item.videoTitle || 'YouTube Video'}
                      </h3>
                      <a href={item.videoInput} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline truncate block">
                        {item.videoInput}
                      </a>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-brand/10 text-brand text-xs rounded font-medium">
                          {item.detectedLink || 'No link detected'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <Link 
                      to={item.detectedLink || '#'} 
                      target="_blank"
                      className="p-2 text-gray-400 hover:text-brand hover:bg-brand/10 rounded transition-colors"
                      title="Preview Page"
                    >
                      <Eye size={16} />
                    </Link>
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-8">
                  {item.csvFileName ? (
                    <span className="flex items-center gap-1 bg-gray-100 dark:bg-black px-2 py-0.5 rounded text-xs text-gray-600 dark:text-gray-300">
                      <FileText size={12} className="text-brand" /> 
                      {item.csvFileName}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-500">
                      <AlertCircle size={12} /> No CSV
                    </span>
                  )}
                  {item.youtubeId && (
                    <span className="flex items-center gap-1 bg-gray-100 dark:bg-black px-2 py-0.5 rounded text-xs text-gray-600 dark:text-gray-300">
                      <Check size={12} className="text-green-500" /> ID: {item.youtubeId}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {savedItems.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                No saved items yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-black border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm aspect-video flex flex-col items-center justify-center relative">
          {youtubeId ? (
            <iframe 
              src={`https://www.youtube.com/embed/${youtubeId}`} 
              title="YouTube video player" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            ></iframe>
          ) : (
            <div className="flex flex-col items-center text-gray-500 p-6 text-center gap-3">
              <Video size={48} className="opacity-50" />
              <p className="text-sm font-medium">Paste a valid YouTube link to see preview</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ControlPage;
