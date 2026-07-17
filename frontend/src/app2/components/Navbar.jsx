import { useAuth } from '../context/AuthContext';

export default function Navbar({ onNavigate }) {
  const { user, logout, token } = useAuth();

  const handleLogout = () => {
    logout();
    onNavigate('landing');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => token ? onNavigate('upload') : onNavigate('landing')}
          className="flex items-center gap-2.5 group cursor-pointer bg-transparent border-none"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center
                          shadow-[0_0_20px_rgba(99,102,241,0.25)] group-hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow duration-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-text-primary">
            TrueHire<span className="text-brand-400 ml-0.5">AI</span>
          </span>
        </button>

        {/* User section */}
        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                <span className="text-xs font-semibold text-brand-300">
                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <span className="text-sm font-medium text-text-secondary">
                {user.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-text-muted hover:text-text-primary
                         px-3 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all duration-200 cursor-pointer
                         border border-transparent hover:border-white/[0.08]"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
