import React, { useState, useEffect } from 'react';
import { VendorProfile, VendorPortfolio } from '../../types';
import { getVendorProfile } from '../../services/vendorProfile';
import { listVendorPortfolios } from '../../services/vendorPortfolios';

const INITIAL_VISIBLE = 6;

const VendorPublicProfile: React.FC = () => {
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [portfolios, setPortfolios] = useState<VendorPortfolio[]>([]);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('Semua');
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [profileData, portfoliosData] = await Promise.all([
                    getVendorProfile(),
                    listVendorPortfolios()
                ]);
                if (profileData) setProfile(profileData);
                setPortfolios(portfoliosData);
            } catch (error) {
                console.error("Error loading vendor public profile:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const formatWa = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

    // Build unique category list
    const categories = ['Semua', ...Array.from(new Set(portfolios.map(p => p.category).filter(Boolean)))];
    const filteredPortfolios = activeFilter === 'Semua' ? portfolios : portfolios.filter(p => p.category === activeFilter);

    // Reset showAll when filter changes
    const handleFilterChange = (cat: string) => {
        setActiveFilter(cat);
        setShowAll(false);
    };

    const visiblePortfolios = showAll ? filteredPortfolios : filteredPortfolios.slice(0, INITIAL_VISIBLE);
    const hasMore = filteredPortfolios.length > INITIAL_VISIBLE;

    // Smooth scroll helper — avoids hash routing conflicts
    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setMenuOpen(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f4f0]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#c9a87c] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs tracking-[0.3em] uppercase text-gray-400" style={{ fontFamily: 'Montserrat, sans-serif' }}>Loading</p>
                </div>
            </div>
        );
    }

    const whatsappUrl = profile?.whatsapp_number ? formatWa(profile.whatsapp_number) : null;
    const vendorName = profile?.hero_title || 'Vendor Dekorasi';

    const handlePortfolioClick = (id: string) => {
        window.location.hash = `#/portfolio/${id}`;
    };

    return (
        <div className="min-h-screen bg-[#f7f4f0]" style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif" }}>
            {/* Google Fonts */}
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />

            {/* ─── Navbar ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#f7f4f0]/90 backdrop-blur-sm border-b border-[#e5ddd4]/60">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Left nav links */}
                    <div className="hidden md:flex items-center gap-8">
                        <button
                            onClick={() => scrollTo('about')}
                            className="text-xs text-[#8a7260] tracking-[0.18em] uppercase hover:text-[#3d2e22] transition-colors bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                        >
                            About
                        </button>
                        <button
                            onClick={() => scrollTo('portfolio')}
                            className="text-xs text-[#8a7260] tracking-[0.18em] uppercase hover:text-[#3d2e22] transition-colors bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                        >
                            Portfolio
                        </button>
                    </div>

                    {/* Center logo */}
                    <button
                        onClick={() => scrollTo('hero')}
                        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center bg-transparent border-none cursor-pointer"
                    >
                        <span className="text-xl font-light text-[#3d2e22] tracking-[0.12em]">{vendorName}</span>
                    </button>

                    {/* Right nav links */}
                    <div className="hidden md:flex items-center gap-8">
                        {whatsappUrl && (
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-[#8a7260] tracking-[0.18em] uppercase hover:text-[#3d2e22] transition-colors"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Contact
                            </a>
                        )}
                    </div>

                    {/* Mobile hamburger */}
                    <button className="md:hidden ml-auto text-[#8a7260]" onClick={() => setMenuOpen(!menuOpen)}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {menuOpen
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                            }
                        </svg>
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div className="md:hidden bg-[#f7f4f0] border-t border-[#e5ddd4] px-6 py-4 flex flex-col gap-4">
                        <button
                            onClick={() => scrollTo('about')}
                            className="text-sm text-[#8a7260] tracking-[0.15em] uppercase text-left bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                        >
                            About
                        </button>
                        <button
                            onClick={() => scrollTo('portfolio')}
                            className="text-sm text-[#8a7260] tracking-[0.15em] uppercase text-left bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                        >
                            Portfolio
                        </button>
                        {whatsappUrl && (
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                                className="text-sm text-[#8a7260] tracking-[0.15em] uppercase"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}
                                onClick={() => setMenuOpen(false)}
                            >
                                Contact
                            </a>
                        )}
                    </div>
                )}
            </nav>

            {/* ─── Hero Section ─── */}
            <section id="hero" className="relative w-full h-screen flex items-end overflow-hidden">
                {profile?.hero_image_url ? (
                    <img src={profile.hero_image_url} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-[#d4c5b0] to-[#8a7260]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
                    <div className="w-px h-16 bg-white/40 animate-pulse" />
                    <span className="text-white/50 text-[10px] tracking-[0.25em] uppercase mt-2" style={{ writingMode: 'vertical-rl', fontFamily: 'Montserrat, sans-serif' }}>scroll</span>
                </div>

                <div className="relative z-10 px-8 md:px-16 pb-16 md:pb-24 max-w-3xl">
                    <h1 className="text-white text-4xl sm:text-5xl md:text-7xl font-light leading-tight mb-4">
                        {profile?.hero_title || 'Capture Every Moment'}
                    </h1>
                    {profile?.hero_subtitle && (
                        <p className="text-white/70 text-lg font-light max-w-md mb-8">{profile.hero_subtitle}</p>
                    )}
                    {whatsappUrl && (
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 border border-white/50 text-white text-xs tracking-[0.2em] uppercase px-7 py-3 hover:bg-white hover:text-[#3d2e22] transition-all duration-300"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            Get in Touch
                        </a>
                    )}
                </div>
            </section>

            {/* ─── About Section ─── */}
            <section id="about" className="py-20 md:py-28 px-6 bg-[#f7f4f0]">
                <div className="max-w-2xl mx-auto text-center">
                    <p className="text-[#c9a87c] text-xs tracking-[0.35em] uppercase mb-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        Hi, you've found us!
                    </p>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#3d2e22] font-light leading-relaxed mb-8">
                        {profile?.hero_subtitle
                            || "We love these things — thought to remember, to stay as they happened. Preserving love's timeless and beautiful story about yours."}
                    </h2>
                    <div className="w-10 h-px bg-[#c9a87c] mx-auto" />
                </div>
            </section>

            {/* ─── Portfolio Grid Section ─── */}
            {portfolios.length > 0 && (
                <section id="portfolio" className="py-10 md:py-16 px-4 sm:px-6 bg-[#f7f4f0]">
                    <div className="max-w-7xl mx-auto">
                        {/* Section header */}
                        <div className="text-center mb-8">
                            <p className="text-[#8a7260] text-xs tracking-[0.3em] uppercase mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>Our Work</p>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#3d2e22] font-light">Portfolio</h2>
                        </div>

                        {/* Category Filter */}
                        {categories.length > 2 && (
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => handleFilterChange(cat)}
                                        className={`px-4 py-1.5 rounded-full text-xs tracking-[0.15em] uppercase border transition-all duration-200 ${activeFilter === cat
                                            ? 'bg-[#3d2e22] text-white border-[#3d2e22]'
                                            : 'bg-transparent text-[#8a7260] border-[#d4c5b0] hover:border-[#3d2e22] hover:text-[#3d2e22]'
                                            }`}
                                        style={{ fontFamily: 'Montserrat, sans-serif' }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Portfolio Grid — mobile: 2 col, tablet: 2 col, desktop: 3 col */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                            {visiblePortfolios.map(portfolio => {
                                const thumb = portfolio.cover_image_url
                                    || (portfolio.images && portfolio.images.length > 0 ? portfolio.images[0].url : null);

                                return (
                                    <button
                                        key={portfolio.id}
                                        onClick={() => handlePortfolioClick(portfolio.id)}
                                        className="relative overflow-hidden group block text-left w-full"
                                        style={{ aspectRatio: '1/1' }}
                                    >
                                        {thumb ? (
                                            <img
                                                src={thumb}
                                                alt={portfolio.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-[#e5ddd4] flex items-center justify-center">
                                                <span className="text-[#8a7260] text-sm">No Image</span>
                                            </div>
                                        )}
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all duration-500" />
                                        {/* Hover text */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-400">
                                            <span className="text-white/70 text-[10px] tracking-[0.3em] uppercase mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                {portfolio.category}
                                            </span>
                                            <h3 className="text-white text-xl font-light text-center">{portfolio.title}</h3>
                                            <p className="text-white/60 text-xs mt-2 tracking-widest" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                                {portfolio.images?.length || 0} gambar · Lihat Detail →
                                            </p>
                                        </div>
                                        {/* Always-visible label */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/65 to-transparent group-hover:opacity-0 transition-opacity duration-300">
                                            <p className="text-white/70 text-[9px] tracking-widest uppercase mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>{portfolio.category}</p>
                                            <p className="text-white font-light text-base leading-tight">{portfolio.title}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {filteredPortfolios.length === 0 && (
                            <div className="text-center py-16 text-[#8a7260]">
                                Tidak ada portofolio dalam kategori ini.
                            </div>
                        )}

                        {/* ─── Lihat Lebih Banyak / Sembunyikan Button ─── */}
                        {hasMore && (
                            <div className="mt-10 flex justify-center">
                                <button
                                    onClick={() => setShowAll(prev => !prev)}
                                    className="group inline-flex items-center gap-3 border border-[#3d2e22]/30 text-[#3d2e22] text-xs tracking-[0.25em] uppercase px-10 py-4 hover:bg-[#3d2e22] hover:text-white transition-all duration-300"
                                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                                >
                                    {showAll ? (
                                        <>
                                            <svg className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
                                            </svg>
                                            Sembunyikan
                                        </>
                                    ) : (
                                        <>
                                            Lihat Lebih Banyak
                                            <svg className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                            <span className="ml-1 text-[#8a7260] group-hover:text-white/70 text-[10px]">
                                                (+{filteredPortfolios.length - INITIAL_VISIBLE})
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ─── CTA Section ─── */}
            <section id="contact" className="relative py-24 md:py-36 px-6 overflow-hidden bg-[#3d2e22]">
                {profile?.hero_image_url && (
                    <img src={profile.hero_image_url} alt="CTA Background" className="absolute inset-0 w-full h-full object-cover opacity-25" />
                )}
                <div className="relative z-10 max-w-xl mx-auto text-center">
                    <p className="text-[#c9a87c] text-xs tracking-[0.35em] uppercase mb-5" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        Let's Work Together
                    </p>
                    <h2 className="text-white text-3xl sm:text-4xl md:text-5xl font-light mb-4">We'll see you soon</h2>
                    <p className="text-white/50 text-sm md:text-base font-light mb-10 leading-relaxed">
                        Thank you for taking the time to explore our work. We hope our story is as amazing as the love we serve here.
                    </p>
                    {whatsappUrl && (
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 bg-[#c9a87c] hover:bg-[#b8956a] text-[#3d2e22] text-xs font-semibold tracking-[0.2em] uppercase px-8 py-4 transition-colors duration-300"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            Get in Touch
                        </a>
                    )}
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="bg-[#2e2018] py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10">
                        <div>
                            <h4 className="text-[#c9a87c] text-xs tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>Studio</h4>
                            <ul className="space-y-2">
                                <li>
                                    <button onClick={() => scrollTo('about')} className="text-white/40 hover:text-white/70 text-sm font-light transition-colors text-left bg-transparent border-none cursor-pointer">
                                        About
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollTo('portfolio')} className="text-white/40 hover:text-white/70 text-sm font-light transition-colors text-left bg-transparent border-none cursor-pointer">
                                        Portfolio
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[#c9a87c] text-xs tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>Contact</h4>
                            <ul className="space-y-2">
                                {whatsappUrl && (
                                    <li><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/70 text-sm font-light transition-colors">WhatsApp</a></li>
                                )}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[#c9a87c] text-xs tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>Categories</h4>
                            <ul className="space-y-2">
                                {categories.filter(c => c !== 'Semua').map(cat => (
                                    <li key={cat}>
                                        <button
                                            onClick={() => { handleFilterChange(cat); scrollTo('portfolio'); }}
                                            className="text-white/40 hover:text-white/70 text-sm font-light transition-colors text-left bg-transparent border-none cursor-pointer"
                                        >
                                            {cat}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-white/5 pt-8 text-center">
                        <p className="text-white/20 text-xs tracking-widest" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            © {vendorName} Copyright {new Date().getFullYear()} Studio
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default VendorPublicProfile;
