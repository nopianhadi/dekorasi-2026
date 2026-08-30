


import React from 'react';
import { ViewType, TransactionType, PaymentStatus, PocketType, ClientStatus, LeadStatus, ContactChannel, CardType, PerformanceNoteType, SatisfactionLevel, Notification, SocialMediaPost, PostType, PostStatus, PromoCode, ClientType, ProjectStatusConfig, VendorData, BookingStatus, ChatTemplate } from '../types';
import type { User } from '../types';

// --- UTILITY FUNCTIONS ---
export const cleanPhoneNumber = (phone: string | undefined) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); // Remove all non-numeric characters
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
    }
    return cleaned;
};

export const lightenColor = (hex: string, percent: number): string => {
    if (!hex || !hex.startsWith('#')) return '#ffffff';
    let [r, g, b] = hex.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [255, 255, 255];
    const factor = percent / 100;
    r = Math.min(255, Math.floor(r + (255 - r) * factor));
    g = Math.min(255, Math.floor(g + (255 - g) * factor));
    b = Math.min(255, Math.floor(b + (255 - b) * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const darkenColor = (hex: string, percent: number): string => {
    if (!hex || !hex.startsWith('#')) return '#000000';
    let [r, g, b] = hex.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [0, 0, 0];
    const factor = 1 - percent / 100;
    r = Math.floor(r * factor);
    g = Math.floor(g * factor);
    b = Math.floor(b * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const hexToHsl = (hex: string): string => {
    if (!hex || !hex.startsWith('#')) return '0 0% 0%';
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length == 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    return `${h} ${s}% ${l}%`;
}

// --- ICONS (NEW THEME) ---
// A collection of SVG icon components used throughout the application. Style based on a consistent, modern, and clean line-icon set.
export const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.75 10.75l9-8.25 9 8.25" />
        <path d="M4.75 9.75v10.5c0 .55.45 1 1 1h12.5c.55 0 1-.45 1-1v-10.5" />
        <path d="M9.75 21.25v-6.5c0-.55.45-1 1-1h2.5c.55 0 1 .45 1 1v6.5" />
    </svg>
);
export const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.25" />
        <path d="M3.75 19.75v-2c0-2.21 1.79-4 4-4h2.5c2.21 0 4 1.79 4 4v2" />
        <circle cx="16" cy="8" r="3.25" />
        <path d="M19.25 19.75v-2c0-2.21-1.79-4-4-4h-1.5" />
    </svg>
);
export const FolderKanbanIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.75 6.75C2.75 5.64543 3.64543 4.75 4.75 4.75H9.25L11.25 6.75H19.25C20.3546 6.75 21.25 7.64543 21.25 8.75V17.25C21.25 18.3546 20.3546 19.25 19.25 19.25H4.75C3.64543 19.25 2.75 18.3546 2.75 17.25V6.75Z" />
        <line x1="9.75" y1="12.25" x2="9.75" y2="15.25" />
        <line x1="12.75" y1="10.75" x2="12.75" y2="15.25" />
        <line x1="15.75" y1="13.25" x2="15.75" y2="15.25" />
    </svg>
);
export const BriefcaseIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.75" y="7.75" width="18.5" height="13.5" rx="2" />
        <path d="M16.75 7.75V5.75c0-1.1-.9-2-2-2h-6c-1.1 0-2 .9-2 2v2" />
    </svg>
);
export const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.75V21.25" />
        <path d="M17.25 8.75A3.5 3.5 0 0 0 13.75 5.25H9.75a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7H6.75" />
    </svg>
);
export const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.75" y="4.75" width="18.5" height="16.5" rx="2" />
        <path d="M2.75 9.75h18.5" />
        <path d="M8.75 2.75v4" />
        <path d="M15.25 2.75v4" />
    </svg>
);
export const PackageIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.75 8.75v8.5c0 .55.45 1 1 1h16.5c.55 0 1-.45 1-1v-8.5" />
        <path d="M2.75 8.75L12 4.75l9.25 4" />
        <path d="M12 21.25v-12" />
        <path d="M18.25 12.25l-6.25 4-6.25-4" />
        <path d="M2.75 8.75h18.5" />
    </svg>
);
export const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8.75a3.25 3.25 0 100 6.5 3.25 3.25 0 000-6.5z" />
        <path d="M18.18 10.63a1.5 1.5 0 00.32-2.07l.55-.95a2 2 0 00-1-3.46l-1.1.2c-1-.7-2.18-1.1-3.45-1.1h-.01c-1.27 0-2.45.4-3.45 1.1l-1.1-.2a2 2 0 00-1 3.46l.55.95c.2.34.36.73.32 1.13 0 .4-.13.79-.32 1.13l-.55.95a2 2 0 001 3.46l1.1-.2c1 .7 2.18 1.1 3.45 1.1h.01c1.27 0 2.45-.4 3.45-1.1l1.1.2a2 2 0 001-3.46l-.55-.95a1.5 1.5 0 00-.32-1.13z" />
    </svg>
);
export const ChartPieIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.75a9.25 9.25 0 109.25 9.25H12v-9.25z" />
        <path d="M12.75 2.75a9.25 9.25 0 11-10 10" />
    </svg>
);
export const TargetIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.25" />
        <circle cx="12" cy="12" r="5.25" />
        <circle cx="12" cy="12" r="1.25" />
    </svg>
);
export const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);
export const LogOutIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.75 8.75l3.5 3.25-3.5 3.25" />
        <path d="M8.75 12h10.5" />
        <path d="M8.75 20.25h-4c-1.1 0-2-.9-2-2V5.75c0-1.1.9-2 2-2h4" />
    </svg>
);
export const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.75 18.25A9.25 9.25 0 1121.25 9.75c-2.03 4.2-6.55 7.2-11.75 6.75-1.2-.1-2.35-.45-3.4-1" />
    </svg>
);
export const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4.25" />
        <path d="M12 2.75V1.75" />
        <path d="M12 22.25V21.25" />
        <path d="M4.75 4.75l-.7-.7" />
        <path d="M19.25 19.25l-.7-.7" />
        <path d="M2.75 12H1.75" />
        <path d="M22.25 12H21.25" />
        <path d="M4.75 19.25l-.7.7" />
        <path d="M19.25 4.75l-.7.7" />
    </svg>
);
export const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);
export const CreditCardIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2" />
        <line x1="2.75" y1="9.75" x2="21.25" y2="9.75" />
    </svg>
);
export const ClipboardListIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.75 4.75h3.5c.55 0 1 .45 1 1v14.5c0 .55-.45 1-1 1h-13c-.55 0-1-.45 1-1v-14.5c0-.55.45-1 1-1h3.5" />
        <path d="M12.75 2.75h-1.5c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h1.5c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1z" />
        <path d="M8.75 12.75h6.5" />
        <path d="M8.75 16.75h6.5" />
    </svg>
);
export const LightbulbIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.75 18.25h4.5" />
        <path d="M12 21.25v-3" />
        <path d="M12 15.25c-3.18 0-5.75-2.57-5.75-5.75 0-3.18 2.57-5.75 5.75-5.75s5.75 2.57 5.75 5.75c0 1.94-.97 3.67-2.45 4.75" />
    </svg>
);
export const StarIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
);
export const CameraIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.75 8.75a2 2 0 012-2h3.5l1.5-2.5h5l1.5 2.5h3.5a2 2 0 012 2v10.5a2 2 0 01-2 2h-16.5a2 2 0 01-2-2v-10.5z" />
        <circle cx="12" cy="13.5" r="3.25" />
    </svg>
);
export const FileTextIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.75 2.75v6.5h6.5" />
        <path d="M14.75 21.25H5.75c-1.1 0-2-.9-2-2V4.75c0-1.1.9-2 2-2h8l5.5 5.5v9c0 1.1-.9 2-2 2z" />
        <path d="M8.75 13.75h6.5" />
        <path d="M8.75 17.75h6.5" />
    </svg>
);
export const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.75 12c1.5-4.5 5-7.25 9.25-7.25s7.75 2.75 9.25 7.25c-1.5 4.5-5 7.25-9.25 7.25s-7.75-2.75-9.25-7.25z" />
        <circle cx="12" cy="12" r="2.25" />
    </svg>
);
export const PencilIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16.75 3.25a2.121 2.121 0 013 3L8.75 17.25l-4 1 1-4L16.75 3.25z" />
        <path d="M14.75 5.25l3 3" />
    </svg>
);
export const Trash2Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.75 6.75h16.5" />
        <path d="M18.75 6.75v12.5c0 1.1-.9 2-2 2h-9.5c-1.1 0-2-.9-2-2V6.75" />
        <path d="M8.75 6.75V4.75c0-1.1.9-2 2-2h2.5c1.1 0 2 .9 2 2v2" />
        <path d="M9.75 11.75v5.5" />
        <path d="M14.25 11.75v5.5" />
    </svg>
);
export const PrinterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.75 18.25h12.5" />
        <path d="M19.25 12.25v-6.5c0-.55-.45-1-1-1h-12.5c-.55 0-1 .45 1-1v6.5" />
        <path d="M4.75 12.25h1.5c.28 0 .5.22.5.5v7.5c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1v-7.5c0-.28.22-.5.5-.5h1.5c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-1.5" />
    </svg>
);
export const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);
export const PhoneIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"></path>
    </svg>
);
export const MailIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
);
export const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);
export const CopyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
    </svg>
);
export const RefreshCwIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
    </svg>
);
export const BellIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 01-3.46 0"></path>
    </svg>
);
export const Share2Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
);
export const HistoryIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.75 7.75v-4h4" />
        <path d="M3.56 12.25a9.25 9.25 0 102.19-4.5L2.75 7.75" />
        <path d="M12 7.75v4.5l3 2" />
    </svg>
);
export const TrendingUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
);
export const AlertCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.25" />
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
);
export const MessageSquareIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.25 11.75c0 4.14-3.36 7.5-7.5 7.5h-1l-4.5 3v-3h-1.5c-4.14 0-7.5-3.36-7.5-7.5v-4.5c0-4.14 3.36-7.5 7.5-7.5h6c4.14 0 7.5 3.36 7.5 7.5v1.5z" />
    </svg>
);
export const MessageCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.75 21.25C8.05 21.25 4.75 18.15 4.75 13.75C4.75 9.35 8.05 6.25 12.75 6.25C17.45 6.25 20.75 9.35 20.75 13.75C20.75 15.15 20.25 16.45 19.45 17.55L21.25 19.25L19.25 21.25L17.55 19.45C16.45 20.25 15.15 20.75 13.75 20.75H12.75Z" />
    </svg>
);
export const PhoneIncomingIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.75 14.25l-3.5 3.5" />
        <path d="M12.25 17.75v-3.5h-3.5" />
        <path d="M21.25 15.25c0 .55-.45 1-1 1-2.02 0-3.92-.78-5.3-2.17s-2.17-3.28-2.17-5.3c0-.55.45-1 1-1 .9 0 1.76.15 2.55.43.34.12.55.51.45.88l-.6 2.1c-.1.36-.45.6-.83.5s-.7-.28-.95-.53c-.76-.76-.76-2 0-2.76.25-.25.38-.6.28-.95l-1.05-3.7c-.1-.36-.48-.57-.85-.45-1.07.35-2.07.86-3 1.57-2.7 2.07-3.88 5.78-2.5 9.25 1.5 3.75 4.88 6.5 8.75 6.5 1.4 0 2.75-.3 4-1 .98-.7 1.6-1.7 1.9-2.88" />
    </svg>
);
export const MapPinIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21.25C12 21.25 4.75 15.25 4.75 10C4.75 6.54822 7.29822 3.75 12 3.75C16.7018 3.75 19.25 6.54822 19.25 10C19.25 15.25 12 21.25 12 21.25Z" />
        <circle cx="12" cy="10" r="3.25" />
    </svg>
);
export const TrendingDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
        <polyline points="17 18 23 18 23 12"></polyline>
    </svg>
);
export const ArrowDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
    </svg>
);
export const ArrowUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
);
export const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.75 14.75v3.5c0 .55.45 1 1 1h16.5c.55 0 1-.45 1-1v-3.5" />
        <path d="M12 15.75v-13" />
        <path d="M8.75 12.75l3.25 3 3.25-3" />
    </svg>
);
export const ListIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
);
export const LayoutGridIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
    </svg>
);
export const CheckSquareIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.75 11.75l2.5 2.5 5-5" />
        <path d="M2.75 5.75c0-1.1.9-2 2-2h14.5c1.1 0 2 .9 2 2v12.5c0 1.1-.9 2-2 2H4.75c-1.1 0-2-.9-2-2V5.75z" />
    </svg>
);
export const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.25" />
        <path d="M12 7.75v4.5l3 2" />
    </svg>
);
export const SendIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.25 3.75L2.75 11.25l7.5 2.5 2.5 7.5 7.5-18.5z" />
        <path d="M10.25 13.75l7.5-7.5" />
    </svg>
);

export const MicrophoneIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.75a3.25 3.25 0 0 1 3.25 3.25v6a3.25 3.25 0 0 1-6.5 0v-6A3.25 3.25 0 0 1 12 2.75z" />
        <path d="M19.25 10v2a7.25 7.25 0 0 1-14.5 0v-2" />
        <path d="M12 18.25v2.5" />
        <path d="M8.75 20.75h6.5" />
    </svg>
);

export const MicrophoneOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2.75" y1="2.75" x2="21.25" y2="21.25" />
        <path d="M15.25 9.4v2.6a3.25 3.25 0 0 1-5.55 2.3" />
        <path d="M8.75 6.1v-0.35A3.25 3.25 0 0 1 12 2.75a3.25 3.25 0 0 1 3.25 3.25v6" />
        <path d="M19.25 10v2a7.25 7.25 0 0 1-1.5 4.4" />
        <path d="M12 18.25v2.5" />
        <path d="M8.75 20.75h6.5" />
    </svg>
);

export const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21.25a9.25 9.25 0 100-18.5 9.25 9.25 0 000 18.5z" />
        <path d="M8.75 12.25l2.5 2.5 5-5" />
    </svg>
);
export const PiggyBankIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.75 14.75v4.5c0 .55.45 1 1 1h4" />
        <path d="M19.75 14.75c1.1 0 2 .9 2 2v2.5" />
        <path d="M2.75 12.75c0-4.14 3.36-7.5 7.5-7.5h.5c3.85 0 7.08 2.92 7.45 6.75" />
        <path d="M11.75 14.75h4.5c.55 0 1 .45 1 1v4.5c0 .55-.45 1-1 1h-12c-1.1 0-2-.9-2-2V13.75c0-1 .6-1.87 1.5-2.2" />
        <path d="M15.75 8.75v1.5" />
    </svg>
);
export const UserCheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.75 18.75v-2c0-2.21-1.79-4-4-4h-4.5c-2.21 0-4 1.79-4 4v2" />
        <circle cx="8.25" cy="6.75" r="3" />
        <path d="M16.75 11.75l2 2 4-4" />
    </svg>
);
export const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.75" y="11.75" width="16.5" height="9.5" rx="2" />
        <path d="M6.75 11.75V7.75c0-2.76 2.24-5 5-5s5 2.24 5 5v4" />
    </svg>
);
export const Users2Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.25" />
        <path d="M3.75 19.75v-2c0-2.21 1.79-4 4-4h2.5c2.21 0 4 1.79 4 4v2" />
        <circle cx="16" cy="8" r="3.25" />
        <path d="M19.25 19.75v-2c0-2.21-1.79-4-4-4h-1.5" />
    </svg>
);
export const BarChart2Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
);
export const BanIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.25"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
    </svg>
);
export const CashIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.75" y="6.75" width="18.5" height="10.5" rx="2" />
        <circle cx="12" cy="12" r="2.25" />
    </svg>
);
export const KeyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8.25" cy="15.75" r="4.5" />
        <path d="M12.75 11.25l5-5" />
        <path d="M15.75 9.25l2-2" />
    </svg>
);
export const SmileIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.25" />
        <path d="M8.75 14.75s1.5 2 3.25 2 3.25-2 3.25-2" />
        <circle cx="9.25" cy="9.75" r=".5" fill="currentColor" />
        <circle cx="14.75" cy="9.75" r=".5" fill="currentColor" />
    </svg>
);
export const ThumbsUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 3 1.88Z" />
    </svg>
);
export const MehIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.25" />
        <path d="M8.75 15.75h6.5" />
        <circle cx="9.25" cy="9.75" r=".5" fill="currentColor" />
        <circle cx="14.75" cy="9.75" r=".5" fill="currentColor" />
    </svg>
);
export const FrownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.25" />
        <path d="M15.25 15.75s-1.5-2-3.25-2-3.25 2-3.25 2" />
        <circle cx="9.25" cy="9.75" r=".5" fill="currentColor" />
        <circle cx="14.75" cy="9.75" r=".5" fill="currentColor" />
    </svg>
);
export const ChevronLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);
export const GalleryHorizontalIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="2" />
        <circle cx="8.75" cy="8.75" r="1.5" />
        <path d="M21.25 14.75l-4.5-4.5-9 9" />
    </svg>
);
export const BookOpenIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
);
export const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);
export const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

export const SparkleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2.5l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5 1.5-4z" />
        <path d="M18.5 12.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
        <path d="M18.5 2.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
    </svg>
);
export const QrCodeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
        <line x1="14" y1="14" x2="14" y2="14.01"></line>
        <line x1="17" y1="14" x2="17" y2="14.01"></line>
        <line x1="14" y1="17" x2="14" y2="17.01"></line>
        <line x1="17" y1="17" x2="17" y2="17.01"></line>
        <line x1="21" y1="14" x2="21" y2="14.01"></line>
        <line x1="14" y1="21" x2="14" y2="21.01"></line>
        <line x1="17" y1="21" x2="17" y2="21.01"></line>
        <line x1="21" y1="17" x2="21" y2="21.01"></line>
        <line x1="21" y1="21" x2="21" y2="21.01"></line>
    </svg>
);
export const WhatsappIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.47 14.38C17.2 14.24 16.1 13.71 15.88 13.62C15.67 13.53 15.51 13.5 15.36 13.77C15.21 14.04 14.67 14.65 14.53 14.81C14.38 14.97 14.24 15 13.97 14.86C13.7 14.71 12.83 14.41 11.8 13.54C11 12.86 10.45 12.03 10.31 11.76C10.16 11.49 10.31 11.35 10.45 11.21C10.58 11.07 10.75 10.85 10.9 10.69C11.04 10.53 11.1 10.41 11.21 10.22C11.33 10.03 11.27 9.87 11.2 9.73C11.12 9.59 10.61 8.31 10.4 7.78C10.19 7.25 9.98 7.32 9.83 7.31C9.69 7.31 9.53 7.31 9.38 7.31C9.23 7.31 8.95 7.38 8.75 7.65C8.55 7.92 7.9 8.49 7.9 9.61C7.9 10.73 8.78 11.82 8.92 11.96C9.06 12.11 10.66 14.49 13 15.46C15.34 16.43 15.34 16.03 15.82 15.96C16.3 15.89 17.24 15.35 17.42 14.81C17.6 14.27 17.6 13.8 17.52 13.66C17.44 13.53 17.3 13.46 17.16 13.41L17.47 14.38Z" />
        <path d="M21.12 12.42C21.12 17.39 17.14 21.38 12.18 21.38C10.29 21.38 8.52 20.85 7.03 19.94L3 21L4.09 17.12C3.12 15.65 2.55 13.92 2.55 12.23C2.55 7.26 6.53 3.28 11.49 3.28C13.88 3.28 16.04 4.16 17.76 5.61C19.48 7.06 20.57 8.93 20.57 11.01" />
    </svg>
);
export const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
);
export const HashtagIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="10" y1="3" x2="8" y2="21"></line>
        <line x1="16" y1="3" x2="14" y2="21"></line>
    </svg>
);

export const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

export const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
);

export const LinkIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

export const ImageIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21,15 16,10 5,21" />
    </svg>
);


export const UserCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="10" r="3" />
        <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </svg>
);

// --- NAVIGATION ---
export const NAV_ITEMS = [
    { view: ViewType.DASHBOARD, label: 'Dashboard', icon: HomeIcon },
    { view: ViewType["Calon Pengantin"], label: 'Calon Pengantin', icon: TargetIcon },
    { view: ViewType.BOOKING, label: 'Booking Jadwal', icon: ClipboardListIcon },
    { view: ViewType.CALENDAR, label: 'Jadwal Wedding', icon: CalendarIcon },
    { view: ViewType.CLIENTS, label: 'Data Pengantin', icon: UsersIcon },
    { view: ViewType.PROJECTS, label: 'Acara Pernikahan', icon: FolderKanbanIcon },
    { view: ViewType.CONTRACTS, label: 'Kontrak Digital', icon: FileTextIcon },
    { view: ViewType.TEAM, label: 'Tim / Vendor', icon: BriefcaseIcon },
    { view: ViewType.INVENTORY, label: 'Inventaris Dekorasi', icon: LayoutGridIcon },
    { view: ViewType.FINANCE, label: 'Keuangan', icon: DollarSignIcon },
    { view: ViewType.PACKAGES, label: 'Layanan / Package', icon: PackageIcon },
    { view: ViewType.PROMO_CODES, label: 'Voucher', icon: LightbulbIcon },
    { view: ViewType.GALLERY, label: 'Upload Pricelist Publik', icon: ImageIcon },
    { view: ViewType.VENDOR_PROFILE, label: 'Profil Vendor', icon: UserCircleIcon },
    { view: ViewType.CLIENT_REPORTS, label: 'Testimoni', icon: ChartPieIcon },
    { view: ViewType.SETTINGS, label: 'Pengaturan', icon: SettingsIcon },
];

// --- TERMINOLOGY MAPPING CONFIGURATION ---
/**
 * Terminology changes mapping for wedding industry terminology update.
 * Maps old generic project management terms to wedding-specific terms.
 * Each entry includes context information and target files for the change.
 */
export interface TerminologyChange {
    oldTerm: string;
    newTerm: string;
    context: 'navigation' | 'page-title' | 'table-header' | 'label' | 'button';
    files: string[];
}

export const TERMINOLOGY_CHANGES: TerminologyChange[] = [
    {
        oldTerm: 'Klien Pengantin',
        newTerm: 'Data Pengantin',
        context: 'navigation',
        files: ['constants.tsx', 'components/Clients.tsx']
    },
    {
        oldTerm: 'Detail Proyek',
        newTerm: 'Detail Acara Pernikahan',
        context: 'page-title',
        files: ['components/Projects.tsx', 'components/ClientPortal.tsx']
    },
    {
        oldTerm: 'Proyek Terbaru',
        newTerm: 'Acara Pernikahan Terbaru',
        context: 'table-header',
        files: ['components/Clients.tsx', 'components/Dashboard.tsx']
    },
    {
        oldTerm: 'Total Nilai Proyek',
        newTerm: 'Total Package',
        context: 'label',
        files: ['components/Clients.tsx', 'components/ClientPortal.tsx', 'components/ClientKPI.tsx']
    },
    {
        oldTerm: 'Progres Sub-Status',
        newTerm: 'Progres Pengerjaan Pengantin',
        context: 'label',
        files: ['components/Projects.tsx']
    },
    {
        oldTerm: 'Pekerjaan Wedding',
        newTerm: 'Acara Pernikahan Wedding',
        context: 'navigation',
        files: ['constants.tsx']
    }
];

// --- PENGATURAN: KONSTANTA DEFAULT (mempermudah input) ---
/** Saran kategori pemasukan untuk layanan pernikahan */
export const DEFAULT_INCOME_CATEGORIES = ['DP Acara Pernikahan', 'Pelunasan', 'Tambahan (Add-on)', 'Layanan Fisik/Produk', 'Lainnya'];
/** Saran kategori pengeluaran */
export const DEFAULT_EXPENSE_CATEGORIES = ['Gaji Tim / Vendor', 'Operasional', 'Produksi Fisik', 'Transport', 'Perlengkapan', 'Lainnya'];
/** Saran jenis proyek */
export const DEFAULT_PROJECT_TYPES = ['Pernikahan', 'Lamaran / Engagement', 'Corporate / Event', 'Ulang Tahun', 'Wisuda', 'Lainnya'];
/** Saran jenis Acara Pernikahan internal (kalender) */
export const DEFAULT_EVENT_TYPES = ['Meeting Pengantin', 'Persiapan Acara Pernikahan', 'Pelaksanaan (Hari H)', 'Evaluasi', 'Lainnya'];
/** Saran kategori Package */
export const DEFAULT_PACKAGE_CATEGORIES = ['Pernikahan', 'Lamaran / Engagement', 'Corporate / Event', 'Ulang Tahun', 'Wisuda', 'Lainnya'];
/** Saran status proyek beserta sub-status (id diisi di komponen) */
export const DEFAULT_PROJECT_STATUS_SUGGESTIONS: {
    name: string;
    color: string;
    description: string;
    defaultProgress: number;
    subStatuses: { name: string; note: string }[];
}[] = [
        {
            name: 'Dikonfirmasi',
            color: '#3b82f6', // blue-500
            description: 'Acara Pernikahan telah dikonfirmasi dan siap dijadwalkan.',
            defaultProgress: 10,
            subStatuses: [
                { name: 'DP Terbayar', note: 'Uang muka telah diterima' },
                { name: 'Kontrak Ditandatangani', note: 'Surat perjanjian sudah oke' }
            ]
        },
        {
            name: 'Persiapan',
            color: '#6366f1', // indigo-500
            description: 'Tahap persiapan teknis, vendor pendukung, dan koordinasi tim.',
            defaultProgress: 25,
            subStatuses: [
                { name: 'Technical Meeting', note: 'Koordinasi akhir dengan pengantin dan vendor lain' },
                { name: 'Persiapan Kebutuhan Acara Pernikahan', note: 'Cek kesiapan perlengkapan/material' }
            ]
        },
        {
            name: 'Hari H (Pelaksanaan)',
            color: '#f97316', // orange-500
            description: 'Pelaksanaan layanan di hari Acara Pernikahan pernikahan.',
            defaultProgress: 50,
            subStatuses: [
                { name: 'Loading In / Standby', note: 'Persiapan di lokasi Acara Pernikahan' },
                { name: 'Acara Pernikahan Selesai / Pelaksanaan Sukses', note: 'Pekerjaan di hari H selesai' }
            ]
        },
        {
            name: 'Pasca Acara Pernikahan / Penyelesaian',
            color: '#8b5cf6', // purple-500
            description: 'Tahap penyelesaian akhir atau follow-up pasca Acara Pernikahan.',
            defaultProgress: 75,
            subStatuses: [
                { name: 'Review / Evaluasi Internal', note: 'Evaluasi hasil kerja hari H' },
                { name: 'Follow-up Pengantin Pasca Acara Pernikahan', note: 'Memastikan kepuasan pengantin' }
            ]
        },
        {
            name: 'Serah Terima Keuangan/Aset',
            color: '#ec4899', // pink-500
            description: 'Tahap membereskan sisa tagihan atau serah terima aset khusus.',
            defaultProgress: 90,
            subStatuses: [
                { name: 'Rekap Sisa Pembayaran / Refund', note: 'Mengurus administrasi keuangan sisa' },
                { name: 'Pengembalian / Serah Terima Barang', note: 'Memastikan tidak ada aset tertinggal/dipinjam' }
            ]
        },
        {
            name: 'Penyelesaian Administrasi',
            color: '#06b6d4', // cyan-500
            description: 'Mengurus pengarsipan dan penutupan dokumen Acara Pernikahan.',
            defaultProgress: 95,
            subStatuses: [
                { name: 'Arsip Data Pengantin', note: 'Menyimpan riwayat Acara Pernikahan' },
                { name: 'Pengiriman Laporan/Dokumen Akhir', note: 'Jika pengantin meminta laporan khusus' }
            ]
        },
        {
            name: 'Selesai',
            color: '#10b981', // emerald-500
            description: 'Semua pekerjaan selesai dan hasil telah diterima pengantin.',
            defaultProgress: 100,
            subStatuses: [
                { name: 'Pekerjaan Selesai', note: 'Hasil akhir/layanan sudah diterima pengantin' },
                { name: 'Testimoni Diterima', note: 'Pengantin puas' }
            ]
        },
        {
            name: 'Dibatalkan',
            color: '#ef4444', // red-500
            description: 'Pekerjaan dibatalkan oleh vendor atau pengantin.',
            defaultProgress: 0,
            subStatuses: [
                { name: 'Refund Proses', note: 'Proses pengembalian dana jika ada' },
                { name: 'File Diarsipkan', note: 'Pekerjaan ditutup' }
            ]
        }
    ];

// --- DEFAULT TEMPLATES (untuk pengisian awal di Settings) ---
export const DEFAULT_BRIEFING_TEMPLATE = `Hai Tim,

Berikut briefing untuk proyek ini. Mohon diperhatikan:
- Cek detail proyek di link di atas
- Pastikan deadline dan deliverable jelas
- Jika ada pertanyaan, hubungi admin

Terima kasih!`;

export const DEFAULT_TERMS_AND_CONDITIONS = `1. Pembayaran DP minimal 50% dari total biaya untuk mengunci jadwal.
2. Pelunasan dilakukan sebelum atau pada hari H Acara Pernikahan.
3. Revisi hasil kerja maksimal 2x (minor). Revisi mayor dikenakan biaya tambahan.
4. Hasil kerja/Layanan diselesaikan dalam format yang disepakati, maksimal 14 hari setelah Acara Pernikahan atau sesuai perjanjian.
5. Pengantin bertanggung jawab atas kerugian atau kerusakan alat/data/aset setelah proses penyerahan selesai.
6. Pembatalan: DP tidak dapat dikembalikan jika pembatalkan dilakukan kurang dari 7 hari sebelum Acara Pernikahan.`;

export const DEFAULT_PACKAGE_SHARE_TEMPLATE = `Halo {leadName}! 👋

Terima kasih atas ketertarikan Anda. Berikut link katalog Package kami dari {companyName}:

{packageLink}

Silakan pilih Package yang sesuai. Jika ada pertanyaan, jangan ragu untuk menghubungi kami. Terima kasih!`;

export const DEFAULT_BOOKING_FORM_TEMPLATE = `Halo {leadName}! 👋

Terima kasih telah memilih {companyName}. Untuk melanjutkan booking, silakan isi formulir berikut:

{bookingFormLink}

Kami akan segera memproses setelah formulir terisi. Terima kasih!`;

// --- NEW SHARE TEMPLATES ---
export const DEFAULT_INVOICE_SHARE_TEMPLATE = `Halo *{clientName}*! 👋

Berikut kami kirimkan *Invoice* untuk Acara Pernikahan Anda bersama *{companyName}* 💍

📋 *Detail Tagihan:*
• Acara: {projectName}
• Total Biaya: *{totalCost}*
• Sudah Dibayar: {amountPaid}
• Sisa Tagihan: *{sisaTagihan}*

📄 *Lihat & Download Invoice PDF di sini:*
{invoiceLink}

_(File PDF invoice juga telah kami kirimkan terpisah)_

Terima kasih atas kepercayaan Anda. Semoga acaranya berjalan lancar! 🙏`;

export const DEFAULT_RECEIPT_SHARE_TEMPLATE = `Halo *{clientName}*! 👋

Berikut kami kirimkan *Tanda Terima Pembayaran* untuk Acara Pernikahan Anda bersama *{companyName}* ✅

📋 *Detail Pembayaran:*
• Acara: {projectName}
• Tanggal: {txDate}
• Jumlah: *{txAmount}*
• Metode: {txMethod}
• Keterangan: {txDesc}

📄 *Lihat & Download Tanda Terima PDF di sini:*
{receiptLink}

_(File PDF tanda terima juga telah kami kirimkan terpisah)_

Terima kasih, pembayaran Anda telah kami terima dengan baik. Semoga persiapannya lancar! 🙏`;

export const DEFAULT_EXPENSE_SHARE_TEMPLATE = `Halo *{targetName}*! 👋

Berikut kami kirimkan *Bukti Pengeluaran / Slip Pembayaran* dari *{companyName}* ✅

📋 *Detail Pembayaran:*
• Tanggal: {txDate}
• Jumlah: *{txAmount}*
• Metode: {txMethod}
• Keterangan: {txDesc}

📄 *Lihat & Download Slip PDF di sini:*
{receiptLink}

_(File PDF slip pembayaran juga telah kami kirimkan terpisah)_

Terima kasih! 🙏`;

export const DEFAULT_PORTAL_SHARE_TEMPLATE = `Halo {clientName}! 👋

Salam dari tim *{companyName}* 💍

Kami dengan senang hati membagikan *Portal Pengantin* Anda, di mana Anda bisa memantau:
✅ Progres persiapan acara pernikahan Anda
💰 Detail pembayaran & invoice
📋 Package & vendor yang dipilih

🔗 *Akses Portal Anda di sini:*
{portalLink}

Jika ada pertanyaan, jangan ragu menghubungi kami. Semoga membantu! 🙏`;


// --- CHAT TEMPLATES ---
export const CHAT_TEMPLATES: ChatTemplate[] = [
    {
        id: 'welcome',
        title: 'Ucapan Selamat Datang',
        template: 'Halo {clientName}, selamat! Booking Anda untuk Acara Pernikahan "{projectName}" telah kami konfirmasi. Kami sangat senang bisa bekerja sama dengan Anda! Tim kami akan segera menghubungi Anda untuk langkah selanjutnya. Terima kasih!'
    },
    {
        id: 'next_steps',
        title: 'Langkah Selanjutnya',
        template: 'Hai {clientName}, menindaklanjuti konfirmasi Acara Pernikahan "{projectName}", berikut langkah selanjutnya: [jadwal meeting, survey lokasi, dll]. Mohon informasikan waktu terbaik Anda. Terima kasih.'
    },
    {
        id: 'progress_update',
        title: 'Update Progres Pengerjaan',
        template: 'Halo {clientName},\n\nKami ingin memberikan update progress Acara Pernikahan Anda:\n\nAcara Pernikahan: {projectName}\nTotal Biaya: {totalCost}\nTerbayar: {amountPaid}\nSisa Tagihan: {sisaTagihan}\n\nAnda dapat memantau progres detailnya melalui portal pengantin di sini:\n{portalLink}\n\nTerima kasih!'
    },
    {
        id: 'schedule_confirmation',
        title: 'Konfirmasi Jadwal & Lokasi',
        template: 'Halo {clientName},\n\nKami ingin mengkonfirmasi jadwal Acara Pernikahan Anda:\n\nAcara Pernikahan: {projectName}\nLokasi: {location}\n\nMohon konfirmasinya jika sudah sesuai. Terima kasih!'
    },
    {
        id: 'payment_reminder',
        title: 'Pengingat Pelunasan',
        template: 'Yth. {clientName},\n\nIni pengingat ramah untuk pembayaran pelunasan Acara Pernikahan "{projectName}" yang akan segera jatuh tempo.\n\nSisa Tagihan: {sisaTagihan}\n\nMohon konfirmasinya jika pembayaran telah dilakukan. Terima kasih.'
    },
    {
        id: 'detailed_bill',
        title: 'Rekap Tagihan Detil',
        template: 'Halo {clientName},\n\nSemoga sehat selalu. Kami ingin mengingatkan perihal sisa pembayaran untuk Acara Pernikahan Anda.\n\nBerikut rinciannya:\n- Acara Pernikahan: *{projectName}*\n- Paket: *{packageName}*\n\nSudah Terbayar: *{amountPaid}*\nSisa Tagihan: *{sisaTagihan}*\n\nTotal Sisa Tagihan: *{sisaTagihan}*\n\nAnda dapat melihat rincian invoice dan riwayat pembayaran melalui Portal Pengantin Anda di sini:\n{portalLink}\n\nMohon konfirmasinya jika pembayaran telah dilakukan. Terima kasih!\n\nSalam,\nTim {companyName}'
    },
    {
        id: 'survey_reminder',
        title: 'Pengingat Survey Lokasi',
        template: 'Hai {clientName}, untuk Acara Pernikahan "{projectName}", kami ingin mengatur jadwal survey lokasi. Kapan waktu yang cocok untuk Anda? Terima kasih.'
    },
    {
        id: 'delivery_ready',
        title: 'Hasil Siap Diambil / Selesai',
        template: 'Halo {clientName}, hasil kerja untuk "{projectName}" sudah siap! Silakan cek laporan/link yang kami kirim. Jika ada revisi atau tanggapan, beritahu kami dalam 7 hari. Terima kasih!'
    }
];

// --- BILLING / INVOICE CHAT TEMPLATES ---
export const DEFAULT_BILLING_TEMPLATES: ChatTemplate[] = [
    {
        id: 'billing_friendly_reminder',
        title: 'Pengingat Tagihan Ramah',
        template: 'Halo {clientName},\n\nSemoga sehat selalu. Kami ingin mengingatkan perihal sisa pembayaran untuk Acara Pernikahan Anda.\n\nBerikut rinciannya:\n{projectDetails}\n\nTotal Sisa Tagihan: *{totalDue}*\n\nAnda dapat melihat rincian invoice dan riwayat pembayaran melalui Portal Pengantin Anda di sini:\n{portalLink}\n\nPembayaran dapat dilakukan ke rekening berikut:\n{bankAccount}\n\nMohon konfirmasinya jika pembayaran telah dilakukan. Terima kasih!\n\nSalam,\nTim {companyName}'
    },
    {
        id: 'billing_due_date_reminder',
        title: 'Pengingat Jatuh Tempo',
        template: 'Yth. Bapak/Ibu {clientName},\n\nMenurut catatan kami, sisa pembayaran Acara Pernikahan Anda akan jatuh tempo. Berikut adalah rincian tagihan Anda:\n\n{projectDetails}\n\nTotal Sisa Tagihan: *{totalDue}*\n\nUntuk melihat detail invoice, silakan akses Portal Pengantin Anda di tautan berikut:\n{portalLink}\n\nKami mohon kesediaan Anda untuk menyelesaikan pembayaran sebelum tanggal jatuh tempo. Pembayaran dapat ditransfer ke:\n{bankAccount}\n\nTerima kasih atas kerja samanya.\n\nHormat kami,\nTim {companyName}'
    }
];

