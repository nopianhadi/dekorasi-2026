import React, { useMemo, useEffect } from 'react';
import { ViewType, User, Profile } from '../types';
import { NAV_ITEMS, LogOutIcon, UsersIcon } from '../constants';

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentUser: User | null;
  profile: Profile;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = React.memo(({ activeView, setActiveView, isOpen, setIsOpen, currentUser, profile, onLogout }) => {
  const navGroupConfig = useMemo(() => ([
    {
      id: 'pengantin',
      title: 'Pengelolaan Pengantin',
      description: 'Kelola data calon pengantin hingga pelaksanaan acara.',
      views: [
        ViewType.DASHBOARD,
        ViewType["Calon Pengantin"],
        ViewType.BOOKING,
        ViewType.CALENDAR,
        ViewType.CLIENTS,
        ViewType.PROJECTS,
        ViewType.INVENTORY,
        ViewType.CONTRACTS,
      ],
    },
    {
      id: 'layanan-produk',
      title: 'Layanan & Produk',
      description: 'Kelola layanan dan paket yang ditawarkan.',
      views: [
        ViewType.PACKAGES,
        ViewType.PROMO_CODES,
        ViewType.GALLERY,
      ],
    },
    {
      id: 'keuangan',
      title: 'Pengelolaan Keuangan',
      description: 'Pantau pembayaran, biaya operasional, dan performa tim.',
      views: [ViewType.FINANCE],
    },
    {
      id: 'vendor',
      title: 'Pengelolaan Vendor',
      description: 'Kelola data vendor serta koordinasi dengan pihak terkait.',
      views: [ViewType.TEAM],
    },
    {
      id: 'testimoni',
      title: 'Testimoni Pengantin',
      description: 'Kelola ulasan dan tingkat kepuasan pengantin.',
      views: [ViewType.CLIENT_REPORTS],
    },
    {
      id: 'pengaturan',
      title: 'Pengaturan Sistem',
      description: 'Atur konfigurasi aplikasi, akses pengguna, dan profil vendor.',
      views: [ViewType.SETTINGS, ViewType.VENDOR_PROFILE],
    },
  ]), []);

  const visibleNavItems = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') {
      return NAV_ITEMS;
    }
    // Member role
    const memberPermissions = new Set(currentUser.permissions || []);
    return NAV_ITEMS.filter(item => memberPermissions.has(item.view));
  }, [currentUser]);

  const groupedNavItems = useMemo(() => {
    const itemMap = new Map(visibleNavItems.map(item => [item.view, item]));
    const grouped = navGroupConfig
      .map(group => ({
        ...group,
        items: group.views
          .map(view => itemMap.get(view))
          .filter((item): item is (typeof NAV_ITEMS)[number] => Boolean(item)),
      }))
      .filter(group => group.items.length > 0);

    const assignedViews = new Set(grouped.flatMap(group => group.items.map(item => item.view)));
    const ungroupedItems = visibleNavItems.filter(item => !assignedViews.has(item.view));

    if (ungroupedItems.length > 0) {
      grouped.push({
        id: 'lainnya',
        title: 'Menu Lainnya',
        description: 'Menu tambahan yang tetap bisa diakses sesuai hak pengguna.',
        views: [],
        items: ungroupedItems,
      });
    }

    return grouped;
  }, [navGroupConfig, visibleNavItems]);

  const navAnimationIndexMap = useMemo(
    () => new Map(visibleNavItems.map((item, index) => [item.view, index])),
    [visibleNavItems]
  );

  // Handle scroll lock when sidebar is open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 1280) { // Only lock for mobile sidebar
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Enhanced Backdrop with better blur */}
      <div
        className={`
          fixed inset-0 
          bg-black/50 
          backdrop-blur-sm
          z-30 
          xl:hidden 
          transition-all duration-300 ease-out
          ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
        onClick={() => setIsOpen(false)}
      />

      {/* Enhanced Sidebar Container */}
      <aside
        id="sidebar"
        className={`
          fixed xl:fixed 
          inset-y-0 left-0 
          w-72 sm:w-80 xl:w-64
          bg-brand-surface 
          flex-col flex-shrink-0 flex 
          z-40 
          transform transition-all duration-300 ease-out
          xl:translate-x-0
          border-r border-brand-border/50
          shadow-2xl xl:shadow-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          paddingTop: 'var(--safe-area-inset-top, 0px)',
          paddingBottom: 'var(--safe-area-inset-bottom, 0px)',
          paddingLeft: 'var(--safe-area-inset-left, 0px)',
        }}
      >
        {/* Enhanced Header with Logo */}
        <div className="
          h-16 sm:h-20 
          flex items-center 
          px-4 sm:px-6 
          border-b border-brand-border/50
          bg-brand-surface
        ">
          <div className="flex items-center gap-3">
            {/* Logo/Brand Icon */}
            <div className="
              w-10 h-10 
              rounded-xl 
              bg-brand-surface
              flex items-center justify-center
              shadow-sm
              overflow-hidden
            ">
              {profile?.logoBase64 ? (
                <img src={profile.logoBase64} alt={profile.companyName || "Company Logo"} className="w-full h-full object-cover" />
              ) : (
                <img src="/assets/images/logos/logoIcon.svg" alt="Weddfin Logo" className="w-8 h-8 object-contain" />
              )}
            </div>

            {/* Brand Text with Enhanced Typography */}
            <span className="
              text-lg sm:text-xl 
              font-extrabold 
              text-brand-text-light
              select-none
              tracking-tight
              truncate
              max-w-[150px]
            ">
              {profile?.companyName || 'weddfin'}
            </span>
          </div>
        </div>

        {/* Enhanced Navigation with Better Scrolling */}
        <nav className="
          flex-1 
          px-3 sm:px-4 
          py-4 sm:py-6 
          overflow-y-auto 
          overscroll-contain
        "
          style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-5">
            {groupedNavItems.map((group) => (
              <section key={group.id}>
                <div className="px-3 sm:px-4 mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text-secondary">
                    {group.title}
                  </p>
                  <p className="text-xs text-brand-text-secondary/90 leading-snug mt-1">
                    {group.description}
                  </p>
                </div>

                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.view}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveView(item.view);
                          setIsOpen(false); // Auto-close on mobile
                        }}
                        className={`
                          flex items-center 
                          px-3 sm:px-4 
                          py-3 sm:py-3.5 
                          my-1 
                          text-sm font-semibold 
                          rounded-xl 
                          transition-all duration-200
                          group
                          relative
                          overflow-hidden
                          min-h-[48px]
                          ${activeView === item.view
                            ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/25'
                            : 'text-brand-text-primary hover:bg-brand-input active:bg-brand-input/80'
                          }
                        `}
                        style={{
                          animationDelay: `${(navAnimationIndexMap.get(item.view) ?? 0) * 50}ms`,
                          animation: isOpen ? 'slideInLeft 0.3s ease-out forwards' : 'none'
                        }}
                      >
                        {/* Background shimmer effect for active item */}
                        {activeView === item.view && (
                          <div className="
                            absolute inset-0 
                            bg-gradient-to-r 
                            from-transparent 
                            via-white/10 
                            to-transparent 
                            -translate-x-full 
                            group-hover:translate-x-full 
                            transition-transform duration-1000
                          " />
                        )}

                        {/* Enhanced Icon Container */}
                        <div className="
                          w-6 sm:w-7 
                          mr-3 sm:mr-4 
                          flex-shrink-0 
                          flex items-center justify-center
                          relative
                        ">
                          <item.icon className={`
                            w-5 h-5 sm:w-6 sm:h-6
                            transition-all duration-200
                            ${activeView !== item.view ? 'text-brand-text-secondary group-hover:text-brand-text-primary' : 'text-white'}
                          `} />
                        </div>

                        {/* Enhanced Label */}
                        <span className="
                          flex-1 
                          truncate
                          relative
                          leading-tight
                        ">
                          {item.label}
                        </span>

                        {/* Active indicator */}
                        {activeView === item.view && (
                          <div className="
                            w-1.5 h-6 
                            bg-white/30 
                            rounded-full
                            flex-shrink-0
                          " />
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </nav>

        {/* Enhanced Footer Section */}
        <div className="
          px-4 sm:px-6 
          py-4 sm:py-6 
          flex-shrink-0 
          border-t border-brand-border/50
          bg-brand-surface
        ">
          {/* Enhanced User Profile */}
          {currentUser && (
            <div className="
              flex items-center 
              gap-3 
              p-3
              rounded-xl
              bg-brand-input/50
              border border-brand-border/30
            ">
              <div className="
                w-10 h-10 sm:w-12 sm:h-12 
                rounded-full 
                bg-gradient-to-br from-brand-accent/20 to-brand-accent/10
                flex items-center justify-center
                border-2 border-brand-accent/20
                flex-shrink-0
              ">
                <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="
                  font-semibold 
                  text-sm sm:text-base 
                  text-brand-text-light
                  truncate
                  leading-tight
                ">
                  {profile?.fullName || currentUser.fullName}
                </p>
                <p className="
                  text-xs sm:text-sm 
                  text-brand-text-secondary
                  truncate
                  leading-tight
                ">
                  {currentUser.role}
                </p>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="
              mt-3 w-full flex items-center gap-3
              px-3 py-2.5 rounded-lg
              text-sm font-semibold
              text-brand-text-primary
              hover:bg-brand-input active:bg-brand-input/80
              transition-colors
              border border-transparent hover:border-brand-border/50
            "
            aria-label="Keluar"
          >
            <LogOutIcon className="w-5 h-5 text-brand-text-secondary" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        /* Enhanced scrollbar for navigation */
        nav::-webkit-scrollbar {
          width: 6px;
        }
        
        nav::-webkit-scrollbar-track {
          background: transparent;
        }
        
        nav::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 3px;
        }
        
        nav::-webkit-scrollbar-thumb:hover {
          background: var(--color-text-secondary);
        }
        
        /* iOS momentum scrolling */
        @supports (-webkit-touch-callout: none) {
          nav {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </>
  );
});

export default Sidebar;
