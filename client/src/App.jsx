import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AuthPage from './pages/AuthPage';
import MatchScreen from './components/MatchScreen';
import SavedQuestions from './pages/SavedQuestions';
import Profile from './pages/Profile';
import Journey from './pages/Journey';
import Shop from './pages/Shop';
import GroupRoom from './pages/GroupRoom';
import MapOfIndiaPage from './pages/MapOfIndia';
import AdminUpload from './pages/AdminUpload';
import DuelLobbyPage from './pages/DuelLobbyPage';
import MistakeNotebookPage from './pages/MistakeNotebookPage';
import MistakeDrillPage from './pages/MistakeDrillPage';
import RedeemChallengePage from './pages/RedeemChallengePage';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import BottomNav from './components/BottomNav';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { AppModeProvider } from './context/AppModeContext';
import { ServerHealthProvider, useServerHealth } from './context/ServerHealthContext';
import ServerWarmupSplash from './components/ServerWarmupSplash';
import { socket } from './socket';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useContext(AuthContext);
  if (loading) return <div className="min-h-screen bg-dh-bg flex items-center justify-center text-dh-text font-heading font-bold text-xl animate-pulse">Loading...</div>;
  return currentUser ? children : <Navigate to="/auth" />;
};

const MatchWrapper = () => {
  const location = useLocation();
  const matchPayload = location.state?.matchData;
  const remountKey = location.state?.remountKey || matchPayload?.roomId;
  if (!matchPayload) return <Navigate to="/dashboard" />;
  return <MatchScreen key={remountKey} matchPayload={matchPayload} />;
};

const MatchRequestOverlay = () => {
  const [matchRequest, setMatchRequest] = React.useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleMatchRequestReceived = (data) => {
      setMatchRequest(data);
    };

    const handleMatchFound = (payload) => {
      navigate('/match', { state: { matchData: payload } });
    };

    socket.on('match_request_received', handleMatchRequestReceived);
    socket.on('match_found', handleMatchFound);

    return () => {
      socket.off('match_request_received', handleMatchRequestReceived);
      socket.off('match_found', handleMatchFound);
    };
  }, [navigate]);

  const handleAccept = () => {
    if (!matchRequest) return;
    socket.emit('match_request_accepted', { requesterId: matchRequest.requester.id });
    setMatchRequest(null);
  };

  const handleDecline = () => {
    if (!matchRequest) return;
    socket.emit('match_request_declined', { requesterId: matchRequest.requester.id });
    setMatchRequest(null);
  };

  if (!matchRequest) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-pop-in">
        <div className="w-16 h-16 rounded-full bg-dh-accent/20 border-2 border-dh-accent flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce-subtle">
          ⚔️
        </div>
        <h3 className="text-xl font-heading font-black text-white mb-1">
          Challenge Received!
        </h3>
        <p className="text-dh-text-muted text-sm mb-6">
          <strong className="text-dh-accent">{matchRequest.requester.username}</strong> wants to battle you in <strong className="text-white">{matchRequest.subject}</strong>!
        </p>
        <div className="flex gap-3">
          <button 
            onClick={handleAccept} 
            className="flex-1 bg-dh-green border-b-4 border-dh-green-dark text-white font-heading font-black py-3 rounded-xl active:translate-y-[2px] active:border-b-0 transition-all uppercase tracking-wide"
          >
            Accept
          </button>
          <button 
            onClick={handleDecline} 
            className="flex-1 bg-dh-red border-b-4 border-dh-red-dark text-white font-heading font-black py-3 rounded-xl active:translate-y-[2px] active:border-b-0 transition-all uppercase tracking-wide"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const location = useLocation();
  const { isServerReady } = useServerHealth();
  const hideNav = location.pathname === '/auth' || location.pathname === '/match' || location.pathname === '/admin' || location.pathname.startsWith('/duel/') || location.pathname.startsWith('/d/');

  if (!isServerReady) {
    return <ServerWarmupSplash />;
  }

  return (
    <div className="min-h-screen bg-dh-bg text-dh-text w-full font-sans">
      <MatchRequestOverlay />
      <PWAInstallPrompt />
      {/* Bottom padding = nav height + raised play button + device safe area, so content never hides under the nav */}
      <div style={hideNav ? undefined : { paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/auth" element={
            <AuthPage />
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/match" element={
            <ProtectedRoute>
              <MatchWrapper />
            </ProtectedRoute>
          } />
          <Route path="/saved-questions" element={
            <ProtectedRoute>
              <SavedQuestions />
            </ProtectedRoute>
          } />
          <Route path="/journey" element={
            <ProtectedRoute>
              <Journey />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/shop" element={
            <ProtectedRoute>
              <Shop />
            </ProtectedRoute>
          } />
          <Route path="/group-room" element={
            <ProtectedRoute>
              <GroupRoom />
            </ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute>
              <MapOfIndiaPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminUpload />
            </ProtectedRoute>
          } />
          <Route path="/notebook" element={
            <ProtectedRoute>
              <MistakeNotebookPage />
            </ProtectedRoute>
          } />
          <Route path="/notebook/drill" element={
            <ProtectedRoute>
              <MistakeDrillPage />
            </ProtectedRoute>
          } />
          <Route path="/notebook/redeem" element={
            <ProtectedRoute>
              <RedeemChallengePage />
            </ProtectedRoute>
          } />
          <Route path="/duel/:code" element={<DuelLobbyPage />} />
          <Route path="/d/:code" element={<DuelLobbyPage />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
};

function App() {
  return (
    <ServerHealthProvider>
      <AuthProvider>
        <AppModeProvider>
          <Router>
            <AppLayout />
          </Router>
        </AppModeProvider>
      </AuthProvider>
    </ServerHealthProvider>
  );
}

export default App;
