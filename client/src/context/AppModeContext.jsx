import { useStream, StreamModeProvider } from './ExamStreamContext';

/**
 * Backward compatibility shim. Kept so pre-existing components that call
 * `useAppMode()` (like BottomNav, Duel modals, etc.) continue to work untouched.
 */
export function useAppMode() {
  const {
    subMode,
    toggleSubMode,
    selectedStream,
    isCivil,
    streamQuery,
  } = useStream();

  return {
    mode: subMode,
    setMode: (m) => toggleSubMode(m),
    toggleMode: () => toggleSubMode(),
    isTech: subMode === 'tech',
    isGs: subMode === 'gs',
    stream: selectedStream,
    isCivil,
    streamQuery,
  };
}

export const AppModeProvider = StreamModeProvider;
export default AppModeProvider;