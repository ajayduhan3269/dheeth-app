import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { DEFAULT_STREAM, STREAM_META, isValidStream, streamMeta } from '../config/streams';
import { AuthContext } from './AuthContext';
import api from '../api';

const STREAM_KEY = 'dheeth_stream';
const MODE_KEY = 'dheeth_mode';

const ExamStreamContext = createContext(null);

/**
 * Boot resolution order:
 * 1. dheeth_stream in localStorage -> trusted.
 * 2. Legacy dheeth_mode exists -> returning Civil user. Silently adopt 'civil' (zero modal).
 * 3. Fresh user -> null -> triggers Onboarding Stream Selection modal.
 */
function resolveInitialStream() {
  try {
    const saved = localStorage.getItem(STREAM_KEY);
    if (isValidStream(saved)) return saved;

    const legacyMode = localStorage.getItem(MODE_KEY);
    if (legacyMode === 'tech' || legacyMode === 'gs') {
      localStorage.setItem(STREAM_KEY, DEFAULT_STREAM);
      return DEFAULT_STREAM;
    }
  } catch {
    // LocalStorage inaccessible
  }
  return null;
}

function resolveInitialSubMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'tech' || m === 'gs') return m;
  } catch {
    // noop
  }
  return 'tech';
}

export function StreamModeProvider({ children }) {
  const { currentUser } = useContext(AuthContext) || {};
  const [selectedStream, setSelectedStream] = useState(resolveInitialStream);
  const [subMode, setSubMode] = useState(resolveInitialSubMode);
  const [isSwitching, setIsSwitching] = useState(false);
  const syncedForUser = useRef(null);

  /* ── Hydrate from server profile when user is authenticated ───────────── */
  useEffect(() => {
    if (!currentUser?._id && !currentUser?.id) return;
    const uid = currentUser._id || currentUser.id;
    if (syncedForUser.current === uid) return;
    syncedForUser.current = uid;

    const serverStream = isValidStream(currentUser.targetExam) ? currentUser.targetExam : null;

    if (!selectedStream && serverStream) {
      setSelectedStream(serverStream);
      try {
        localStorage.setItem(STREAM_KEY, serverStream);
      } catch {}
    } else if (selectedStream && serverStream && serverStream !== selectedStream) {
      // Local selection wins -> sync up to server
      api.patch('/api/user/stream', { targetExam: selectedStream }).catch(() => {});
    }
  }, [currentUser, selectedStream]);

  /* ── Setters ──────────────────────────────────────────────────────────── */
  const setStream = useCallback(async (next) => {
    if (!isValidStream(next)) return;
    setSelectedStream(next);
    try {
      localStorage.setItem(STREAM_KEY, next);
    } catch {}

    if (next === 'civil') {
      setSubMode(resolveInitialSubMode());
    }

    const uid = currentUser?._id || currentUser?.id;
    if (uid) {
      setIsSwitching(true);
      try {
        await api.patch('/api/user/stream', { targetExam: next });
      } catch (err) {
        console.warn('[stream] Remote sync failed, continuing locally:', err?.message);
      } finally {
        setIsSwitching(false);
      }
    }
  }, [currentUser]);

  const toggleSubMode = useCallback((next) => {
    const resolved =
      next === 'tech' || next === 'gs'
        ? next
        : subMode === 'tech'
        ? 'gs'
        : 'tech';
    setSubMode(resolved);
    try {
      localStorage.setItem(MODE_KEY, resolved);
    } catch {}
  }, [subMode]);

  const clearStream = useCallback(() => {
    setSelectedStream(null);
    try {
      localStorage.removeItem(STREAM_KEY);
    } catch {}
  }, []);

  /* ── Derived helpers ─────────────────────────────────────────────────── */
  const isCivil = (selectedStream || DEFAULT_STREAM) === 'civil';

  const streamQuery = useMemo(() => {
    const stream = selectedStream || DEFAULT_STREAM;
    return isCivil ? { stream, category: subMode } : { stream };
  }, [selectedStream, subMode, isCivil]);

  const buildQuizParams = useCallback(
    (extra = {}) => {
      const params = new URLSearchParams({ ...streamQuery, ...extra });
      return params.toString();
    },
    [streamQuery]
  );

  const value = useMemo(
    () => ({
      selectedStream: selectedStream || DEFAULT_STREAM,
      rawSelectedStream: selectedStream,
      setStream,
      clearStream,
      isSwitching,
      needsStreamSelection: selectedStream === null,
      meta: streamMeta(selectedStream || DEFAULT_STREAM),
      allStreams: Object.values(STREAM_META),
      subMode,
      toggleSubMode,
      isCivil,
      showSubModeToggle: isCivil,
      streamQuery,
      buildQuizParams,
    }),
    [
      selectedStream,
      setStream,
      clearStream,
      isSwitching,
      subMode,
      toggleSubMode,
      isCivil,
      streamQuery,
      buildQuizParams,
    ]
  );

  return (
    <ExamStreamContext.Provider value={value}>
      {children}
    </ExamStreamContext.Provider>
  );
}

export function useStream() {
  const ctx = useContext(ExamStreamContext);
  if (!ctx) {
    throw new Error('useStream must be used inside <StreamModeProvider>');
  }
  return ctx;
}

export { ExamStreamContext };
