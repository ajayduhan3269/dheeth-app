import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

const AppLayout = () => {
  const location = useLocation();
  const hideNav = location.pathname === '/auth' || location.pathname === '/match' || location.pathname === '/admin';

  return (
    <div className="min-h-screen bg-dh-bg text-dh-text w-full font-sans">
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
