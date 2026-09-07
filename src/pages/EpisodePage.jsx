import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const EpisodePage = () => {
  const { id } = useParams();
  const [episodeData, setEpisodeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        const q = query(collection(db, "episodes"), where("detectedLink", "==", `/episode-${id}`));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setEpisodeData(querySnapshot.docs[0].data());
        }
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchEpisode();
  }, [id]);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Episode Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          We couldn't find the data for Episode {id}. It may have been removed or the link is incorrect.
        </p>
        <Link to="/" className="px-6 py-2.5 bg-brand text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Episode {id}
          </h1>

          <div className="w-full bg-black rounded-2xl overflow-hidden shadow-lg aspect-video relative border border-gray-200 dark:border-white/10">
            {episodeData.youtubeId ? (
              <iframe 
                src={`https://www.youtube.com/embed/${episodeData.youtubeId}`} 
                title={`Episode ${id} Video Player`}
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

          {episodeData.csvFileName && (
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl p-5 shadow-sm overflow-hidden">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText size={20} className="text-brand" /> Attached Data: {episodeData.csvFileName}
              </h3>
              
              {episodeData.csvContent ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
                    <tbody>
                      {episodeData.csvContent.split('\n').filter(row => row.trim()).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-200 dark:border-white/10 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5">
                          {row.split(',').map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-3 whitespace-nowrap">
                              {cell.trim()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  No CSV content found.
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default EpisodePage;
