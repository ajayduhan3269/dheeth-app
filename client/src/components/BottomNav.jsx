import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket';
import { useAppMode } from '../context/AppModeContext';

const navItems = [
    {
      id: 'home',
      label: 'HOME',
      path: '/dashboard',
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? '#00e676' : '#4a4a5a'} className="w-5 h-5">
          <path d="M11.47 3.841a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.061l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.689z" />
          <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15.75a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a.748.748 0 01.091-.086L12 5.432z" />
        </svg>
      ),
    },
    {
      id: 'people',
      label: 'PEOPLE',
      path: '/profile',
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? '#00e676' : '#4a4a5a'} className="w-5 h-5">
          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'play',
      label: '',
      isCenter: true,
      icon: () => null,
    },
    {
      id: 'journey',
      label: 'JOURNEY',
      path: '/journey',
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? '#00e676' : '#4a4a5a'} className="w-5 h-5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
    },
    {
      id: 'map',
      label: 'MAP',
      path: '/map',
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? '#00e676' : '#4a4a5a'} className="w-5 h-5">
          <path fillRule="evenodd" d="M8.161 2.58a1.875 1.875 0 011.678 0l4.993 2.498c.106.052.23.052.337 0l3.011-1.506a1.215 1.215 0 011.563.754 1.202 1.202 0 01-.065 1.27l-4.036 5.74a.75.75 0 01-1.06.19l-4.5-3.75a.75.75 0 00-.95 0l-4.5 3.75a.75.75 0 01-1.06-.19L2.754 4.597a1.202 1.202 0 01-.065-1.27 1.215 1.215 0 011.563-.754l3.01 1.506c.106.052.23.052.337 0L8.16 2.58zm-.903 5.831a.75.75 0 01.95 0l1.52 1.267a.75.75 0 01-.164 1.294l-.99.396a.75.75 0 01-.542 0l-.99-.396a.75.75 0 01-.163-1.294l1.22-1.017.18-.18zM5.75 12.5a.75.75 0 01.75.75v3.25c0 .414.336.75.75.75h1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-4.5A.75.75 0 014 19v-5.75a.75.75 0 01.75-.75h1zm7.5 0a.75.75 0 01.75.75v2.5a.75.75 0 01-.75.75H12a.75.75 0 01-.75-.75v-2.5a.75.75 0 01.75-.75h1.25z" clipRule="evenodd" />
        </svg>
      ),
    },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useAppMode();

  const isActive = (item) => {
    if (item.id === 'play') return false;
    return location.pathname === item.path;
  };

  const handleClick = (item) => {
    navigate(item.path);
  };

  const handleQuickMatch = () => {
    const isOnJourney = location.pathname === '/journey';
    if (isOnJourney) {
      // On Journey page — emit a subject search (frontend will pick)
      const journeySubject = window.__journeySubject;
      if (journeySubject) {
        socket.emit('join_queue', { subject: journeySubject, mode });
      } else {
        socket.emit('quick_match', { mode });
      }
    } else {
      socket.emit('quick_match', { mode });
    }
    navigate('/dashboard');
  };

  return (
    <nav id="bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 glass-surface border-t border-dh-border/50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-end justify-around px-2 h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item);

          if (item.isCenter) {
            return (
              <button
                key={item.id}
                id="nav-play-btn"
                onClick={handleQuickMatch}
                className="relative -translate-y-4 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-dh-red to-dh-red-dark shadow-lg shadow-dh-red/40 transition-all duration-300 hover:scale-110 hover:shadow-dh-red/60 active:scale-95 lightning-btn"
              >
                <span className="text-2xl drop-shadow-lg text-white">⚡</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`nav-${item.id}-btn`}
              onClick={() => handleClick(item)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 transition-all duration-200 group min-w-[52px]"
            >
              <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
                {item.icon(active)}
              </div>
              <span className={`text-[10px] font-heading font-bold tracking-wider transition-colors duration-200 ${active ? 'text-dh-accent' : 'text-dh-text-muted group-hover:text-dh-accent-light'}`}>
                {item.label}
              </span>
              {active && (
                <div className="w-1 h-1 rounded-full bg-dh-accent mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;