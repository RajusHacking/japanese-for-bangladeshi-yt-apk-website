import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth, googleProvider } from '../firebase';
import { signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';

const ALLOWED_EMAILS = ['work.alirejaraju@gmail.com', 'info.alirejaraju@gmail.com'];

const LoginPage = () => {
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedAuth = localStorage.getItem('j4b_admin_auth');
    if (savedAuth) {
      navigate('/control', { replace: true });
      return;
    }

    // 1. Check if returning from a Google redirect (if fallback was used)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          const email = result.user.email?.toLowerCase();
          if (ALLOWED_EMAILS.includes(email)) {
            localStorage.setItem('j4b_admin_auth', JSON.stringify({
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
            }));
            navigate('/control', { replace: true });
          } else {
            await auth.signOut();
            setError('Unauthorized: Your email does not have admin access.');
          }
        }
      })
      .catch((err) => {
        console.error("Redirect Error:", err);
        setError('Failed to sign in with Google: ' + err.message);
      });

    // 2. Listen to normal Auth state (catches both popup and persistent state)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email?.toLowerCase();
        if (ALLOWED_EMAILS.includes(email)) {
          // Valid admin user
          localStorage.setItem('j4b_admin_auth', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          }));
          navigate('/control', { replace: true });
        } else {
          // Logged in but not admin
          await auth.signOut();
          setError('Unauthorized: Your email does not have admin access.');
          setChecking(false);
        }
      } else {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    setChecking(true);
    setError('');
    try {
      // Try popup first (works best on PC)
      import('firebase/auth').then(({ signInWithPopup }) => {
        signInWithPopup(auth, googleProvider).catch((err) => {
          // If popup is blocked (common on mobile), fallback to redirect
          if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
            signInWithRedirect(auth, googleProvider);
          } else {
            console.error(err);
            setError('Failed to sign in: ' + err.message);
            setChecking(false);
          }
        });
      });
    } catch (err) {
      console.error(err);
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-160px)] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand"></div>
        <p className="text-gray-500 text-sm">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-160px)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm px-4"
      >
        <div className="flex flex-col gap-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Admin</h2>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-full font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          {error && <p className="text-red-500 text-sm font-medium px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded">{error}</p>}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
