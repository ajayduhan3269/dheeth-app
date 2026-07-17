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
import BottomNav from './components/BottomNav';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { AppModeProvider } from './context/AppModeContext';
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
    socket.emit('accept_match_request', {
      senderId: matchRequest.userId,
      subject: matchRequest.subject,
      mode: matchRequest.mode
    });
    setMatchRequest(null);
  };

  const handleDecline = () => {
    if (!matchRequest) return;
    socket.emit('decline_match_request', {
      senderId: matchRequest.userId
    });
    setMatchRequest(null);
  };

  if (!matchRequest) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-[scaleIn_0.3s_ease-out]">
        <div className="text-4xl mb-4">🔥</div>
        <h2 className="text-xl font-heading font-black text-dh-text mb-2">
          {matchRequest.username} challenged you!
        </h2>
        <p className="text-dh-text-muted font-heading font-bold mb-8">
          Subject: {matchRequest.subject}
        </p>
        <div className="flex gap-4">
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
  const hideNav = location.pathname === '/auth' || location.pathname === '/match' || location.pathname === '/admin';

  return (
    <div className="min-h-screen bg-dh-bg text-dh-text w-full font-sans">
      <MatchRequestOverlay />
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
    <AuthProvider>
      <AppModeProvider>
        <Router>
          <AppLayout />
        </Router>
      </AppModeProvider>
    </AuthProvider>
  );
}

export default App;
