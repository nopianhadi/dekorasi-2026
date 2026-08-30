import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Gallery, GalleryImage, Profile } from '../../../types';
import { getPublicGallery } from '../../../services/galleries';
import { getProfile } from '../../../services/profile';
import { cleanPhoneNumber } from '../../../constants';

interface PublicGalleryProps {
    galleryId: string;
}

// Sanitize image URLs to prevent XSS attacks
const sanitizeImageUrl = (url: string): string => {
    try {
        const parsed = new URL(url);
        // Only allow HTTP(S) protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            console.warn('[Security] Blocked non-HTTP(S) image URL:', url);
            return '/placeholder-image.jpg';
        }
        return url;
    } catch (error) {
        console.warn('[Security] Invalid image URL:', url);
        return '/placeholder-image.jpg';
    }
};

const PublicGallery: React.FC<PublicGalleryProps> = ({ galleryId }) => {
    const [gallery, setGallery] = useState<Gallery | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        loadGalleryData();
    }, [galleryId]);

    const loadGalleryData = async () => {
        try {
            setIsLoading(true);
            const [galleryData, profileData] = await Promise.all([
                getPublicGallery(galleryId),
                getProfile()
            ]);

            setGallery(galleryData);
            setProfile(profileData);
        } catch (error) {
            console.error('Error loading gallery:', error);
            setError('Pricelist tidak ditemukan atau tidak dapat diakses');
        } finally {
            setIsLoading(false);
        }
    };

    const openLightbox = (image: GalleryImage, index: number) => {
        setSelectedImage(image);
        setCurrentImageIndex(index);
    };

    const closeLightbox = () => {
        setSelectedImage(null);
    };

    const navigateImage = useCallback((direction: 'prev' | 'next') => {
        if (!gallery) return;

        setCurrentImageIndex(prevIndex => {
            let newIndex = prevIndex;
            if (direction === 'prev') {
                newIndex = prevIndex > 0 ? prevIndex - 1 : gallery.images.length - 1;
            } else {
                newIndex = prevIndex < gallery.images.length - 1 ? prevIndex + 1 : 0;
            }
            setSelectedImage(gallery.images[newIndex]);
            return newIndex;
        });
    }, [gallery]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeLightbox();
        }
        if (e.key === 'ArrowLeft') {
            navigateImage('prev');
        }
        if (e.key === 'ArrowRight') {
            navigateImage('next');
        }
    }, [navigateImage]);

    useEffect(() => {
        if (selectedImage) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [selectedImage, handleKeyDown]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
                <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600">Memuat Pricelist...</p>
                </div>
            </div>
        );
    }

    if (error || !gallery) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
                <div className="text-center p-8 max-w-lg mx-auto">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-red-100 to-red-200 rounded-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Pricelist Tidak Ditemukan</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium"
                    >
                        Coba Lagi
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
            {/* Hero Header */}
            <header className="bg-white">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                            {gallery.title}
                        </h1>
                    </div>
                </div>
            </header>

            {/* Gallery Content */}
            <main className="max-w-7xl mx-auto px-0 py-0">
                {!gallery.images || gallery.images.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Pricelist Kosong</h3>
                        <p className="text-gray-600 text-lg">Belum ada gambar yang diupload ke Pricelist ini</p>
                    </div>
                ) : (
                    <div>
                        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-0">
                            {gallery.images.map((image, index) => (
                                <div
                                    key={image.id}
                                    className="break-inside-avoid cursor-pointer group overflow-hidden relative bg-gray-100"
                                    onClick={() => openLightbox(image, index)}
                                >
                                    <img
                                        src={sanitizeImageUrl(image.thumbnailUrl || image.url)}
                                        alt={image.caption || `Gambar ${index + 1}`}
                                        className="w-full h-auto object-cover transition-opacity duration-300"
                                        loading={index < 8 ? "eager" : "lazy"}
                                        decoding="async"
                                        onLoad={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                        }}
                                        style={{ opacity: 0 }}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Booking CTA & Admin Help */}
                        <div className="px-4 py-10 bg-white">
                            <div className="max-w-3xl mx-auto text-center space-y-4">
                                <p className="text-gray-700">Tertarik dengan layanan kami?</p>
                                <button
                                    onClick={() => {
                                        const bookingUrl = gallery.booking_link && gallery.booking_link.trim() !== ''
                                            ? gallery.booking_link
                                            : `${window.location.origin}${window.location.pathname}#/public-booking${gallery.region ? `?region=${encodeURIComponent(String(gallery.region).toLowerCase())}` : ''}`;

                                        // Open in new tab for better user experience and immediate loading
                                        window.open(bookingUrl, '_blank');
                                    }}
                                    className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow hover:from-blue-700 hover:to-purple-700 transition-colors duration-200 cursor-pointer"
                                >
                                    Booking Sekarang
                                </button>

                                {profile?.phone && (
                                    <div className="pt-4">
                                        <h4 className="text-sm font-semibold text-gray-900">Butuh Bantuan?</h4>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Jika ada pertanyaan atau butuh bantuan dalam pengisian formulir, jangan ragu untuk menghubungi admin kami melalui WhatsApp.
                                        </p>
                                        <a
                                            href={`https://wa.me/${cleanPhoneNumber(profile.phone)}?text=${encodeURIComponent('Halo Admin, saya butuh bantuan pengisian formulir.')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center mt-2 px-3 py-1.5 rounded-md bg-black text-white text-xs font-medium shadow hover:bg-gray-900 transition-colors duration-200"
                                        >
                                            Hubungi Admin ({profile.phone})
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Lightbox */}
            {selectedImage && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
                    <div className="relative w-full h-full max-w-6xl max-h-full flex items-center justify-center">
                        <button
                            onClick={closeLightbox}
                            className="absolute top-6 right-6 z-20 p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-all duration-200"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>


                        <div className="relative flex items-center justify-center w-full h-full">
                            <img
                                src={sanitizeImageUrl(selectedImage.url)}
                                alt={selectedImage.caption || 'Gambar'}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            />
                        </div>

                        {selectedImage.caption && (
                            <div className="absolute bottom-6 left-6 right-6 z-20">
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                                    <p className="text-white text-lg font-medium text-center">{selectedImage.caption}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};

export default PublicGallery;
