import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ConnectWallet } from '../common/ConnectWallet';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Swap', path: '/swap' },
  { name: 'Pool', path: '/pool' },
  { name: 'Staking', path: '/staking' },
  { name: 'Bridge', path: '/bridge' },
  { name: 'Dashboard', path: '/dashboard' },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 glass border-b border-neutral-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">AstroSwap</h1>
              <p className="text-xs text-neutral-400 -mt-1">Professional AMM</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'relative px-4 py-2 rounded-xl font-medium transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  )}
                >
                  {item.name}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-primary rounded-xl -z-10"
                      transition={{ type: 'spring', duration: 0.5 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Connect Wallet */}
          <div className="flex items-center gap-3">
            <ConnectWallet />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-neutral-800">
        <nav className="container mx-auto px-4 py-2 flex gap-1 overflow-x-auto no-scrollbar">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-colors flex-shrink-0',
                  isActive
                    ? 'text-white'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                )}
              >
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="activeTabMobile"
                    className="absolute inset-0 bg-gradient-primary rounded-xl -z-10"
                    transition={{ type: 'spring', duration: 0.5 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
