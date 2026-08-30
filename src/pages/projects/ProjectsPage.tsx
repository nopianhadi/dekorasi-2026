import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, PaymentStatus, TeamMember, Client, Package, TeamProjectPayment, Transaction, TransactionType, AssignedTeamMember, Profile, NavigationAction, AddOn, PrintingItem, Card, ProjectStatusConfig, SubStatusConfig, CustomCost, FinancialPocket, InventoryItem, ProjectInventoryItem } from '../../types';
import PageHeader from '../../layouts/PageHeader';
import Modal from '../../shared/ui/Modal';
import StatCard from '../../shared/ui/StatCard';
import StatCardModal from '../../shared/ui/StatCardModal';
import DonutChart from '../../shared/ui/DonutChart';
import { EyeIcon, ListIcon, LayoutGridIcon, FolderKanbanIcon, AlertCircleIcon, CalendarIcon, CheckSquareIcon, ClockIcon, UsersIcon, ArrowUpIcon, DollarSignIcon, MessageSquareIcon, BriefcaseIcon, LightbulbIcon, ArrowUpIcon as ArrowUpIconStat, ArrowDownIcon as ArrowDownIconStat } from '../../constants';
import { ClipboardListIcon, FileTextIcon, PencilIcon, Share2Icon, ArrowDownIcon, CheckCircleIcon, PlusIcon, Trash2Icon, SendIcon, ChevronRightIcon, ChevronLeftIcon, UserIcon, BoxIcon, PackageIcon } from 'lucide-react';
import { listChecklistByProject, upsertChecklistItems, deleteChecklistItem, initializeDefaultChecklist, DEFAULT_CHECKLIST_TEMPLATES, setChecklistItemCompleted, updateChecklistItemFields, updateChecklistItemText, renameChecklistCategory, deleteChecklistItemsByProjectAndCategory } from '../../services/weddingDayChecklist';
import { createProjectWithRelations, updateProject as updateProjectInDb, deleteProject as deleteProjectInDb, sanitizeProjectData, getProjectWithRelations } from '../../services/projects';

import { upsertAssignmentsForProject } from '../../services/projectTeamAssignments';
import { upsertTeamPaymentsForProject } from '../../services/teamProjectPayments';
import { createTransaction, updateCardBalance, updateTransaction as updateTransactionRow, deleteTransaction as deleteTransactionRow } from '../../services/transactions';
import { syncClientStatusFromProjects } from '../../services/clients';
import { generateWhatsAppLink, cleanPhoneNumber } from '../../utils/whatsapp';
import ChatModal from '../../features/communication/components/ChatModal';
import ShareMessageModal from '../../features/communication/components/ShareMessageModal';
import supabase from '../../lib/supabaseClient';

export interface ProjectsProps {
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    clients: Client[];
    packages: Package[];
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    initialAction: NavigationAction | null;
    setInitialAction: (action: NavigationAction | null) => void;
    profile: Profile;
    showNotification: (message: string) => void;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    totals: {
        projects: number;
        activeProjects: number;
        clients: number;
        activeClients: number;
        leads: number;
        discussionLeads: number;
        followUpLeads: number;
        teamMembers: number;
        transactions: number;
        revenue: number;
        expense: number;
    };
}

// UI/UX Improvement Components
import ProjectCard from '../../features/projects/components/ProjectCard';
import CollapsibleSection from '../../shared/ui/CollapsibleSection';
import ProgressTracker from '../../features/projects/components/ProgressTracker';
import QuickStatusModal from '../../features/projects/components/QuickStatusModal';

const ensureOnlineOrNotify = (showNotification: (message: string) => void): boolean => {
    if (!navigator.onLine) {
        showNotification('Harus online untuk melakukan perubahan');
        return false;
    }
    return true;
};

type SharePreviewData = {
    title: string;
    message: string;
    phone?: string | null;
} | null;

type StatModalItem = {
    id: string;
    primary: string;
    secondary: string;
    value: string;
};

type StatModalData = {
    title: string;
    items: StatModalItem[];
    total: number | null;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

const getSubStatusText = (project: Project): string => {
    if (project.activeSubStatuses && project.activeSubStatuses.length > 0) {
        return project.activeSubStatuses.join(', ');
    }
    if (project.status === 'Dikirim' && project.shippingDetails) {
        return `Dikirim: ${project.shippingDetails}`;
    }
    return project.status;
};

const getStatusColor = (status: string, config: ProjectStatusConfig[]): string => {
    const statusConfig = config.find(c => c.name === status);
    return statusConfig ? statusConfig.color : '#64748b'; // slate-500 default
};

const getStatusClass = (status: string, config: ProjectStatusConfig[]) => {
    const color = getStatusColor(status, config);
    const colorMap: { [key: string]: string } = {
        '#10b981': 'status-badge status-success', // Selesai
        '#3b82f6': 'status-badge status-info', // Dikonfirmasi
        '#8b5cf6': 'status-badge status-purple', // Editing
        '#f97316': 'status-badge status-orange', // Produksi Fisik
        '#06b6d4': 'status-badge status-cyan', // Dikirim
        '#eab308': 'status-badge status-warning', // Tertunda
        '#6366f1': 'status-badge status-info', // Persiapan
        '#ef4444': 'status-badge status-danger', // Dibatalkan
        '#14b8a6': 'status-badge status-cyan', // Revisi
    };
    return colorMap[color] || 'status-badge status-gray';
};

/** Progress 0-100 from project.progress or derived from status order / defaultProgress in config */
const getDisplayProgress = (project: Project, config: ProjectStatusConfig[]): number => {
    const raw = project.progress;
    if (typeof raw === 'number' && !Number.isNaN(raw) && raw >= 0 && raw <= 100) return Math.round(raw);
    const idx = config.findIndex(s => s.name === project.status);
    if (idx === -1) return 0;
    const statusConfig = config[idx];
    if (statusConfig.defaultProgress != null && statusConfig.defaultProgress !== undefined) {
        return Math.min(100, Math.max(0, statusConfig.defaultProgress));
    }
    return Math.round(((idx + 1) / config.length) * 100);
};

const getProgressForStatus = (status: string, config: ProjectStatusConfig[]): number => {
    const idx = config.findIndex(s => s.name === status);
    if (idx === -1) return 0;
    const statusConfig = config[idx];
    if (statusConfig.defaultProgress != null && statusConfig.defaultProgress !== undefined) {
        return Math.min(100, Math.max(0, statusConfig.defaultProgress));
    }
    return Math.round(((idx + 1) / config.length) * 100);
};



// --- [NEW] ProjectForm Component ---
interface ProjectFormProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'add' | 'edit';
    formData: any; // Simplified for now
    onFormChange: (e: React.ChangeEvent<any>) => void;
    onSubStatusChange: (option: string, isChecked: boolean) => void;
    onClientChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onTeamChange: (member: TeamMember) => void;
    onTeamFeeChange: (memberId: string, fee: number) => void;

    onTeamSubJobChange: (memberId: string, subJob: string) => void;
    onTeamClientPortalLinkChange: (memberId: string, link: string) => void;
    onCustomSubStatusChange: (index: number, field: 'name' | 'note', value: string) => void;
    onAddCustomSubStatus: () => void;
    onRemoveCustomSubStatus: (index: number) => void;
    onSubmit: (e: React.FormEvent) => void;
    clients: Client[];
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    profile: Profile;
    teamByCategory: Record<string, Record<string, TeamMember[]>>;
    showNotification: (message: string) => void;
    setFormData: React.Dispatch<React.SetStateAction<any>>;
}

const ProjectForm: React.FC<ProjectFormProps> = ({
    isOpen, onClose, mode, formData, onFormChange, onSubStatusChange, onClientChange,
    onTeamChange, onTeamFeeChange, onTeamSubJobChange, onTeamClientPortalLinkChange,
    onCustomSubStatusChange, onAddCustomSubStatus, onRemoveCustomSubStatus,
    onSubmit, clients, teamMembers,
    teamProjectPayments,
    profile, teamByCategory,
    showNotification, setFormData
}) => {
    const paidMemberIdsForThisProject = useMemo(() => {
        const projectId = formData?.id;
        if (!projectId) return new Set<string>();
        return new Set(
            (teamProjectPayments || [])
                .filter(p => p.projectId === projectId && p.status === 'Paid')
                .map(p => p.teamMemberId)
        );
    }, [teamProjectPayments, formData?.id]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'add' ? 'Tambah Acara Pernikahan Baru (Operasional)' : `Edit Acara Pernikahan: ${formData.projectName}`}
            size="4xl"
        >
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-6 form-compact form-compact--ios-scale">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-4 md:gap-y-6 max-h-[70vh] overflow-y-auto pr-2 pb-4">
                    {/* --- LEFT COLUMN --- */}
                    <div className="space-y-5 md:space-y-6">
                        {/* Section 1: Basic Info */}
                        <section className="bg-brand-surface md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border">
                            <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border pb-2 mb-4">Informasi Dasar Acara Pernikahan</h4>
                            <div className="space-y-5">
                                {mode === 'add' && (
                                    <div className="space-y-2">
                                        <label htmlFor="clientId" className="block text-xs text-brand-text-secondary">Pengantin</label>
                                        <select id="clientId" name="clientId" value={formData.clientId} onChange={onClientChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" required>
                                            <option value="" className="bg-brand-surface text-brand-text-primary">Pilih Pengantin...</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <p className="text-xs text-brand-text-secondary">Pilih pengantin yang terkait dengan Acara Pernikahan ini</p>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label htmlFor="projectName" className="block text-xs text-brand-text-secondary">Nama Acara Pernikahan</label>
                                    <input type="text" id="projectName" name="projectName" value={formData.projectName} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="Masukkan nama Acara Pernikahan" required />
                                    <p className="text-xs text-brand-text-secondary">Nama Acara Pernikahan (contoh: Wedding John & Jane)</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="projectType" className="block text-xs text-brand-text-secondary">Jenis Acara Pernikahan</label>
                                        <select id="projectType" name="projectType" value={formData.projectType} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" required>
                                            <option value="" disabled>Pilih Jenis...</option>
                                            {profile.projectTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                        </select>
                                        <p className="text-xs text-brand-text-secondary">Kategori jenis Acara Pernikahan</p>
                                    </div>
                                    {mode === 'add' && (
                                        <div className="space-y-2">
                                            <label htmlFor="status" className="block text-xs text-brand-text-secondary">Progres Acara Pernikahan Pengantin</label>
                                            <select id="status" name="status" value={formData.status} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" required>
                                                {profile.projectStatusConfig.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                            <p className="text-xs text-brand-text-secondary">Status progres Acara Pernikahan saat ini</p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label htmlFor="location" className="block text-xs text-brand-text-secondary">Lokasi (Kota)</label>
                                        <input type="text" id="location" name="location" value={formData.location} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="Kota Contoh: Jakarta" />
                                        <p className="text-xs text-brand-text-secondary">Kota tempat Acara Pernikahan berlangsung</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="address" className="block text-xs text-brand-text-secondary">Alamat Lengkap / Gedung</label>
                                        <textarea id="address" name="address" value={formData.address} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="Contoh: Gedung Mulia, Jl. Gatot Subroto No. 1" rows={3}></textarea>
                                        <p className="text-xs text-brand-text-secondary">Alamat spesifik venue Acara Pernikahan</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Schedule & Details */}
                        <section className="bg-brand-surface md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border">
                            <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border pb-2 mb-4">Jadwal & Detail</h4>
                            <div className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="date" className="block text-xs text-brand-text-secondary">Tanggal Acara Pernikahan</label>
                                        <input type="date" id="date" name="date" value={formData.date || ''} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" required />
                                        <p className="text-xs text-brand-text-secondary">Tanggal pelaksanaan Acara Pernikahan</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="deadlineDate" className="block text-xs text-brand-text-secondary">Deadline</label>
                                        <input type="date" id="deadlineDate" name="deadlineDate" value={formData.deadlineDate || ''} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                                        <p className="text-xs text-brand-text-secondary">Batas waktu penyerahan hasil</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="startTime" className="block text-xs text-brand-text-secondary">Waktu Mulai</label>
                                        <input type="time" id="startTime" name="startTime" value={formData.startTime || ''} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                                        <p className="text-xs text-brand-text-secondary">Jam mulai Acara Pernikahan</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="endTime" className="block text-xs text-brand-text-secondary">Waktu Selesai</label>
                                        <input type="time" id="endTime" name="endTime" value={formData.endTime || ''} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                                        <p className="text-xs text-brand-text-secondary">Jam selesai Acara Pernikahan</p>
                                    </div>
                                </div>
                                {formData.status === 'Dikirim' && (
                                    <div className="space-y-2">
                                        <label htmlFor="shippingDetails" className="block text-xs text-brand-text-secondary">Detail Pengiriman</label>
                                        <input type="text" id="shippingDetails" name="shippingDetails" value={formData.shippingDetails} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="Masukkan detail pengiriman" />
                                        <p className="text-xs text-brand-text-secondary">Informasi pengiriman hasil ke pengantin</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Section 3: Links & Notes - Using CollapsibleSection */}
                        <CollapsibleSection
                            title="Tautan & Catatan"
                            defaultExpanded={false}
                            status={formData.driveLink || formData.notes ? 'valid' : undefined}
                            statusText={formData.driveLink || formData.notes ? 'Terisi' : undefined}
                        >
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label htmlFor="driveLink" className="block text-xs text-brand-text-secondary">Link Brief/Moodboard (Internal)</label>
                                    <input type="url" id="driveLink" name="driveLink" value={formData.driveLink} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="https://..." />
                                    <p className="text-xs text-brand-text-secondary">Link ke folder brief atau moodboard untuk tim internal</p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="clientDriveLink" className="block text-xs text-brand-text-secondary">Link File dari Pengantin</label>
                                    <input type="url" id="clientDriveLink" name="clientDriveLink" value={formData.clientDriveLink || ''} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="https://drive.google.com/..." />
                                    <p className="text-xs text-brand-text-secondary">Link file atau referensi yang diberikan pengantin</p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="finalDriveLink" className="block text-xs text-brand-text-secondary">Link File Jadi (untuk Pengantin)</label>
                                    <input type="url" id="finalDriveLink" name="finalDriveLink" value={formData.finalDriveLink || ''} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="https://drive.google.com/..." />
                                    <p className="text-xs text-brand-text-secondary">Link hasil akhir yang akan dibagikan ke pengantin</p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="notes" className="block text-xs text-brand-text-secondary">Catatan Tambahan</label>
                                    <textarea id="notes" name="notes" value={formData.notes} onChange={onFormChange} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none" placeholder="Catatan tambahan untuk Acara Pernikahan ini..." rows={4}></textarea>
                                    <p className="text-xs text-brand-text-secondary">Catatan penting terkait Acara Pernikahan ini</p>
                                </div>
                            </div>
                        </CollapsibleSection>
                    </div>

                    {/* --- RIGHT COLUMN --- */}
                    <div className="space-y-5 md:space-y-6">
                        {/* Section 4: Team Assignment */}
                        <section className="bg-brand-surface md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border">
                            <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border pb-2 mb-4">Tugas Tim</h4>
                            <div className="space-y-6">
                                {(['Tim', 'Vendor'] as const).map(category => (
                                    <div key={category} className="space-y-4">
                                        <h5 className={`text-sm font-bold uppercase tracking-widest pb-2 border-b-2 flex items-center gap-2 ${category === 'Tim' ? 'text-blue-400 border-blue-400/20' : 'text-purple-400 border-purple-400/20'}`}>
                                            <div className={`w-2 h-2 rounded-full ${category === 'Tim' ? 'bg-blue-400' : 'bg-purple-400'}`}></div>
                                            {category === 'Tim' ? 'Pilih Tim Internal' : 'Pilih Vendor / Tim / Vendor'}
                                        </h5>

                                        <div className="space-y-4">
                                            {Object.entries(teamByCategory[category] || {}).map(([role, members]) => (
                                                <div key={role} className="space-y-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h6 className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-tighter">{role}</h6>
                                                        <div className="h-px flex-grow bg-brand-border/30"></div>
                                                    </div>
                                                    {(members as TeamMember[]).map(member => {
                                                        const assignedMember = formData.team.find((t: any) => t.memberId === member.id);
                                                        const isSelected = !!assignedMember;
                                                        return (
                                                            <div key={member.id} className={`p-4 rounded-xl transition-all ${isSelected ? 'bg-blue-50/10 border-2 border-blue-400' : 'bg-brand-bg border border-brand-border hover:border-brand-accent/30'}`}>
                                                                <div className="flex justify-between items-center">
                                                                    <label className="flex items-center gap-3 cursor-pointer flex-grow">
                                                                        <input type="checkbox" checked={isSelected} onChange={() => onTeamChange(member)} className="h-5 w-5 text-blue-600 rounded-lg border-brand-border bg-white/5 focus:ring-blue-500" />
                                                                        <div>
                                                                            <p className="font-semibold text-brand-text-light">{member.name}</p>
                                                                            {isSelected && <p className="text-[10px] text-brand-text-secondary mt-0.5">Pembayaran Standar: {formatCurrency(member.standardFee)}</p>}
                                                                        </div>
                                                                    </label>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-brand-border/40">
                                                                        <div className="sm:col-span-2 space-y-1.5">
                                                                            <label className="block text-[10px] uppercase font-bold text-brand-text-secondary">Biaya Tim / Vendor per Acara</label>
                                                                            <input
                                                                                type="number"
                                                                                value={assignedMember.fee}
                                                                                onChange={e => onTeamFeeChange(member.id, Number(e.target.value))}
                                                                                disabled={paidMemberIdsForThisProject.has(member.id)}
                                                                                className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white/5 text-brand-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right font-mono"
                                                                                placeholder="0"
                                                                            />
                                                                        </div>
                                                                        <div className="sm:col-span-2 space-y-1.5">
                                                                            <label className="block text-[10px] uppercase font-bold text-brand-text-secondary">Keterangan Tugas Spesipik unutk tim</label>
                                                                            <input
                                                                                type="text"
                                                                                value={assignedMember.subJob || ''}
                                                                                onChange={e => onTeamSubJobChange(member.id, e.target.value)}
                                                                                className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white/5 text-brand-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                                placeholder="Tugas spesifik (misal: Leader, Drone Operator, dll)"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>


                        <CollapsibleSection
                            title="Vendor (Allpackage)"
                            defaultExpanded={false}
                            status={(formData.printingDetails || []).length > 0 ? 'info' : undefined}
                            statusText={(formData.printingDetails || []).length > 0 ? `${(formData.printingDetails || []).length} item` : undefined}
                        >
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {(formData.printingDetails || []).length > 0 ? (formData.printingDetails || []).map((item: PrintingItem) => (
                                    <div key={item.id} className="p-3 rounded-lg bg-brand-bg flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-brand-text-light">{item.customName || item.type}</p>

                                        </div>
                                    </div>
                                )) : <p className="text-sm text-center text-brand-text-secondary py-4">Tidak ada layanan/produk yang ditambahkan ke Package ini.</p>}
                            </div>
                        </CollapsibleSection>



                        {mode === 'add' && (
                            <section className="bg-brand-surface md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border">
                                <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border pb-2 mb-4">Sub-Status untuk "{formData.status}"</h4>
                                <div className="p-4 bg-brand-bg rounded-xl">
                                    <label className="block text-xs font-semibold text-blue-600 mb-2">Pilih sub-status aktif:</label>
                                    <p className="text-xs text-brand-text-secondary mb-3">Centang sub-status yang sedang aktif untuk Acara Pernikahan ini</p>
                                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                        {(formData.customSubStatuses || []).map((sub: SubStatusConfig) => (
                                            <label key={sub.name} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${(formData.activeSubStatuses || []).includes(sub.name)
                                                ? 'bg-blue-50/10 border-2 border-blue-400'
                                                : 'bg-brand-input border border-brand-border hover:border-blue-300'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={(formData.activeSubStatuses || []).includes(sub.name)}
                                                    onChange={e => onSubStatusChange(sub.name, e.target.checked)}
                                                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
                                                />
                                                <span className="font-medium">{sub.name}</span>
                                            </label>
                                        ))}
                                    </div>

                                    <h5 className="text-sm font-semibold text-brand-text-secondary mt-6 pt-4 border-t border-brand-border">Edit Sub-Status (khusus Acara Pernikahan ini)</h5>
                                    <p className="text-xs text-brand-text-secondary mb-3">Kelola sub-status khusus untuk Acara Pernikahan ini</p>
                                    <div className="space-y-4 mt-3 max-h-60 overflow-y-auto pr-2">
                                        {(formData.customSubStatuses || []).map((sub: SubStatusConfig, index: number) => (
                                            <div key={index} className="p-4 bg-brand-surface rounded-xl border border-brand-border space-y-4">
                                                <div className="space-y-2">
                                                    <label className="block text-xs text-brand-text-secondary">Nama Sub-Status</label>
                                                    <input
                                                        type="text"
                                                        value={sub.name || ''}
                                                        onChange={e => onCustomSubStatusChange(index, 'name', e.target.value)}
                                                        placeholder="Masukkan nama sub-status"
                                                        className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    />
                                                    <p className="text-xs text-brand-text-secondary">Nama tahapan atau status (contoh: Persiapan Materi / Produksi)</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs text-brand-text-secondary">Catatan (Opsional)</label>
                                                    <input
                                                        type="text"
                                                        value={sub.note || ''}
                                                        onChange={e => onCustomSubStatusChange(index, 'note', e.target.value)}
                                                        placeholder="Catatan tambahan"
                                                        className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white/5 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    />
                                                    <p className="text-xs text-brand-text-secondary">Keterangan atau detail tambahan</p>
                                                </div>
                                                <div className="flex justify-end pt-2 border-t border-brand-border">
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveCustomSubStatus(index)}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2Icon className="w-4 h-4" />
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onAddCustomSubStatus}
                                        className="mt-3 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50/10 rounded-lg transition-colors"
                                    >
                                        + Tambah Sub-Status Baru
                                    </button>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-end items-stretch md:items-center gap-3 pt-6 border-t border-brand-border">
                    <button type="button" onClick={onClose} className="button-secondary w-full md:w-auto order-2 md:order-1">Batal</button>
                    <button type="submit" className="button-primary w-full md:w-auto order-1 md:order-2 active:scale-95 transition-transform">{mode === 'add' ? 'Simpan Acara Pernikahan' : 'Update Acara Pernikahan'}</button>
                </div>
            </form>
        </Modal>
    );
};


// --- Project Value by Type Chart Component ---
const ProjectValueByTypeChart: React.FC<{ projects: Project[] }> = ({ projects }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const chartData = useMemo(() => {
        const typeValues = projects.reduce((acc, p) => {
            acc[p.projectType] = (acc[p.projectType] || 0) + p.totalCost;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(typeValues)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6); // Top 6 types
    }, [projects]);

    const maxValue = Math.max(...chartData.map(d => d.value), 1);
    const colors = ['from-blue-500 to-cyan-400', 'from-purple-500 to-pink-400', 'from-green-500 to-emerald-400', 'from-orange-500 to-amber-400', 'from-pink-500 to-rose-400', 'from-indigo-500 to-blue-400'];

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-sm text-brand-text-secondary">
                Belum ada data Acara Pernikahan
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {chartData.map((item, index) => {
                const percentage = (item.value / maxValue) * 100;
                const isHovered = hoveredIndex === index;
                return (
                    <div
                        key={item.name}
                        className="relative"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-sm font-medium transition-colors ${isHovered ? 'text-brand-accent' : 'text-brand-text-light'}`}>
                                {item.name}
                            </span>
                            <span className="text-xs font-semibold text-brand-text-secondary">
                                {formatCurrency(item.value)}
                            </span>
                        </div>
                        <div className="h-3 bg-brand-bg rounded-full overflow-hidden">
                            <div
                                className={`h-full bg-gradient-to-r ${colors[index % colors.length]} transition-all duration-500 rounded-full ${isHovered ? 'shadow-lg' : ''}`}
                                style={{ width: `${percentage}%` }}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// --- [NEW] ProjectAnalytics Component - Fokus detil pekerjaan, tanpa pembayaran ---
const ProjectAnalytics: React.FC<{
    projects: Project[];
    projectStatusConfig: ProjectStatusConfig[];
    totals: ProjectsProps['totals'];
    onStatCardClick: (stat: 'count' | 'deadline' | 'top_type' | 'status_dist') => void;
}> = ({ projects, projectStatusConfig, totals, onStatCardClick }) => {
    const activeProjects = useMemo(() => projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan'), [projects]);

    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);

        const deadlineSoonCount = activeProjects.filter(p => {
            const d = new Date(p.deadlineDate || p.date);
            d.setHours(0, 0, 0, 0);
            return d >= today && d <= in7Days;
        }).length;

        const projectTypeCounts = projects.reduce((acc, p) => {
            acc[p.projectType] = (acc[p.projectType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topProjectType = Object.keys(projectTypeCounts).length > 0
            ? Object.entries(projectTypeCounts).sort(([, a], [, b]) => b - a)[0][0]
            : 'N/A';

        const statusCounts = activeProjects.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const topStatus = Object.keys(statusCounts).length > 0
            ? Object.entries(statusCounts).sort(([, a], [, b]) => b - a)[0][0]
            : 'N/A';

        return { activeCount: totals.activeProjects, deadlineSoonCount, topProjectType, topStatus };
    }, [activeProjects, projects]);

    const projectStatusDistribution = useMemo(() => {
        const statusCounts = activeProjects.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(statusCounts).map(([label, value]) => {
            const config = projectStatusConfig.find(s => s.name === label);
            return {
                label,
                value,
                color: config ? config.color : '#64748b'
            };
        }).sort((a, b) => b.value - a.value);
    }, [activeProjects, projectStatusConfig]);

    return (
        <div className="mb-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <div className="widget-animate transition-transform duration-200 hover:scale-105" style={{ animationDelay: '100ms' }}>
                    <StatCard
                        icon={<FolderKanbanIcon className="w-5 h-5 md:w-6 md:h-6" />}
                        title="Acara Pernikahan Aktif"
                        value={String(stats.activeCount)}
                        subtitle="Acara Pernikahan yang sedang berjalan"
                        colorVariant="blue"
                        description={`Jumlah Acara Pernikahan yang sedang aktif (belum selesai atau dibatalkan).\n\nTotal: ${stats.activeCount} Acara Pernikahan\n\nFokus pada penyelesaian pekerjaan Acara Pernikahan-Acara Pernikahan ini.`}
                        onClick={() => onStatCardClick('count')}
                    />
                </div>
                <div className="widget-animate transition-transform duration-200 hover:scale-105" style={{ animationDelay: '200ms' }}>
                    <StatCard
                        icon={<ClockIcon className="w-5 h-5 md:w-6 md:h-6" />}
                        title="Deadline Dekat"
                        value={String(stats.deadlineSoonCount)}
                        subtitle="Acara Pernikahan jatuh tempo 7 hari ke depan"
                        colorVariant="orange"
                        description={`Acara Pernikahan dengan deadline dalam 7 hari ke depan.\n\nPerlu perhatian: ${stats.deadlineSoonCount} Acara Pernikahan\n\nPastikan Acara Pernikahan selesai tepat waktu.`}
                        onClick={() => onStatCardClick('deadline')}
                    />
                </div>
                <div className="widget-animate transition-transform duration-200 hover:scale-105" style={{ animationDelay: '300ms' }}>
                    <StatCard
                        icon={<CheckSquareIcon className="w-5 h-5 md:w-6 md:h-6" />}
                        title="Status Terbanyak"
                        value={stats.topStatus}
                        subtitle="Progres Acara Pernikahan Pengantin paling banyak saat ini"
                        colorVariant="purple"
                        description={`Status yang paling banyak saat ini: ${stats.topStatus}.\n\nMembantu memahami di tahap mana Acara Pernikahan-Acara Pernikahan Anda berada.`}
                        onClick={() => onStatCardClick('status_dist')}
                    />
                </div>
                <div className="widget-animate transition-transform duration-200 hover:scale-105" style={{ animationDelay: '400ms' }}>
                    <StatCard
                        icon={<FolderKanbanIcon className="w-5 h-5 md:w-6 md:h-6" />}
                        title="Jenis Acara Pernikahan Teratas"
                        value={stats.topProjectType}
                        subtitle="Jenis paling banyak dikerjakan"
                        colorVariant="purple"
                        description={`Jenis Acara Pernikahan yang paling sering Anda kerjakan.\n\nJenis Teratas: ${stats.topProjectType}\n\nInformasi ini membantu memahami fokus pekerjaan.`}
                        onClick={() => onStatCardClick('top_type')}
                    />
                </div>
            </div>

            <div className="bg-brand-surface p-4 md:p-6 rounded-2xl shadow-lg border border-brand-border widget-animate" style={{ animationDelay: '500ms' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="md:col-span-1">
                        <h3 className="text-base md:text-lg font-bold text-gradient mb-2">Distribusi Progres Acara Pernikahan Pengantin</h3>
                        <p className="text-xs text-brand-text-secondary mb-3 md:mb-4">Breakdown Progres Acara Pernikahan Pengantin aktif</p>
                        <DonutChart data={projectStatusDistribution} />
                    </div>
                    <div className="md:col-span-2">
                        <h3 className="text-base md:text-lg font-bold text-gradient mb-2">Nilai Acara Pernikahan per Jenis</h3>
                        <p className="text-xs text-brand-text-secondary mb-3 md:mb-4">Total nilai Acara Pernikahan berdasarkan jenis Acara Pernikahan</p>
                        <ProjectValueByTypeChart projects={activeProjects} />
                    </div>
                </div>
            </div>
        </div>
    );
};


interface ProjectListViewProps {
    projects: Project[];
    handleOpenDetailModal: (project: Project) => void;
    handleOpenForm: (mode: 'edit', project: Project) => void;
    handleProjectDelete: (projectId: string) => void;
    config: ProjectStatusConfig[];
    clients: Client[];
    handleQuickStatusChange: (projectId: string, newStatus: string, notifyClient: boolean) => Promise<void>;
    handleSendMessage: (project: Project) => void;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
}

const ProjectListView: React.FC<ProjectListViewProps> = ({ projects, handleOpenDetailModal, handleOpenForm, handleProjectDelete, config, clients, handleQuickStatusChange, handleSendMessage, hasMore, isLoadingMore, onLoadMore }) => {

    const ProgressBar: React.FC<{ progress: number, status: string, config: ProjectStatusConfig[] }> = ({ progress, status, config }) => (
        <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: getStatusColor(status, config) }}></div>
        </div>
    );

    return (
        <div>
            {/* Mobile cards - Using ProjectCard Component */}
            <div className="md:hidden space-y-3">
                {projects.map(p => {
                    const client = clients.find(c => c.id === p.clientId);
                    return (
                        <ProjectCard
                            key={p.id}
                            project={p}
                            client={client}
                            projectStatusConfig={config}
                            onStatusChange={(projectId, newStatus) => handleQuickStatusChange(projectId, newStatus, false)}
                            onViewDetails={handleOpenDetailModal}
                            onEdit={(project) => handleOpenForm('edit', project)}
                            onSendMessage={handleSendMessage}
                        />
                    );
                })}
                {projects.length === 0 && <p className="text-center py-8 text-sm text-brand-text-secondary">Tidak ada Acara Pernikahan dalam kategori ini.</p>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-brand-text-secondary uppercase">
                        <tr>
                            <th className="px-6 py-4 font-medium tracking-wider">Nama Acara Pernikahan</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Pengantin</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Tanggal</th>
                            <th className="px-6 py-4 font-medium tracking-wider min-w-[200px]">Progress</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Tim</th>
                            <th className="px-6 py-4 font-medium tracking-wider text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                        {projects.map(p => (
                            <tr key={p.id} className="hover:bg-brand-bg transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-brand-text-light">{p.projectName}</p>
                                    </div>
                                    <p className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${getStatusClass(p.status, config)}`}>
                                        {getSubStatusText(p)}
                                    </p>
                                </td>
                                <td className="px-6 py-4 text-brand-text-primary">{p.clientName}</td>
                                <td className="px-6 py-4 text-brand-text-primary">{new Date(p.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <ProgressBar progress={getDisplayProgress(p, config)} status={p.status} config={config} />
                                        <span className="text-xs font-semibold text-brand-text-secondary">{getDisplayProgress(p, config)}%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-brand-text-primary">{p.team.map(t => t.name.split(' ')[0]).join(', ') || '-'}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center space-x-1">
                                        <button onClick={() => handleOpenDetailModal(p)} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors" title="Detail Acara Pernikahan"><EyeIcon className="w-5 h-5 text-white" /></button>
                                        <button onClick={() => handleOpenForm('edit', p)} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors" title="Edit Acara Pernikahan"><PencilIcon className="w-5 h-5 text-white" /></button>
                                        <button onClick={() => handleProjectDelete(p.id)} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-600 hover:bg-red-700 transition-colors" title="Hapus Acara Pernikahan"><Trash2Icon className="w-5 h-5 text-white" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {hasMore && (
                <div className="mt-8 flex justify-center pb-8">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-bg border border-brand-border text-brand-text-primary hover:bg-brand-surface transition-all disabled:opacity-50"
                    >
                        {isLoadingMore ? (
                            <>
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                Loading...
                            </>
                        ) : (
                            <>
                                <ArrowDownIcon className="w-4 h-4" />
                                Muat Lebih Banyak
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

interface ProjectKanbanViewProps {
    projects: Project[];
    handleOpenDetailModal: (project: Project) => void;
    draggedProjectId: string | null;
    handleDragStart: (e: React.DragEvent<HTMLDivElement>, projectId: string) => void;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: React.DragEvent<HTMLDivElement>, newStatus: string) => void;
    config: ProjectStatusConfig[];
}

const ProjectKanbanView: React.FC<ProjectKanbanViewProps> = ({ projects, handleOpenDetailModal, draggedProjectId, handleDragStart, handleDragOver, handleDrop, config }) => {

    const ProgressBar: React.FC<{ progress: number, status: string, config: ProjectStatusConfig[] }> = ({ progress, status, config }) => (
        <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: getStatusColor(status, config) }}></div>
        </div>
    );

    return (
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 overscroll-x-contain scroll-smooth projects-kanban-scroll hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
            {config
                .filter(statusConfig => statusConfig.name !== 'Dibatalkan')
                .map(statusConfig => {
                    const status = statusConfig.name;
                    return (
                        <div
                            key={status}
                            className="w-72 min-w-[280px] md:w-80 flex-shrink-0 bg-brand-bg rounded-2xl border border-brand-border snap-start"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, status)}
                        >
                            <div className="p-4 font-semibold text-brand-text-light border-b-2 flex justify-between items-center sticky top-0 bg-brand-bg/80 backdrop-blur-sm rounded-t-2xl z-10" style={{ borderBottomColor: getStatusColor(status, config) }}>
                                <span>{status}</span>
                                <span className="text-sm font-normal bg-brand-surface text-brand-text-secondary px-2.5 py-1 rounded-full">{projects.filter(p => p.status === status).length}</span>
                            </div>
                            <div className="p-3 space-y-3 min-h-[200px] h-[calc(100vh-380px)] sm:h-[calc(100vh-420px)] overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                                {projects
                                    .filter(p => p.status === status)
                                    .map(p => (
                                        <div
                                            key={p.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.id)}
                                            onClick={() => handleOpenDetailModal(p)}
                                            className={`p-4 bg-brand-surface rounded-xl cursor-grab border-l-4 shadow-lg ${draggedProjectId === p.id ? 'opacity-50 ring-2 ring-brand-accent' : 'opacity-100'}`}
                                            style={{ borderLeftColor: getStatusColor(p.status, config) }}
                                        >
                                            <p className="font-semibold text-sm text-brand-text-light">{p.projectName}</p>
                                            <p className="text-xs text-brand-text-secondary mt-1">{p.clientName}</p>
                                            <p className="text-xs font-bold text-brand-text-primary mt-1">
                                                {getSubStatusText(p)}
                                            </p>
                                            <ProgressBar progress={getDisplayProgress(p, config)} status={p.status} config={config} />
                                            <div className="flex justify-between items-center mt-3 text-xs">
                                                <span className="text-brand-text-secondary">{new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )
                })
            }
        </div>
    );
};

interface ProjectDetailModalProps {
    selectedProject: Project | null;
    setSelectedProject: React.Dispatch<React.SetStateAction<Project | null>>;
    teamMembers: TeamMember[];
    clients: Client[];
    profile: Profile;
    showNotification: (message: string) => void;
    projects: Project[]; // Added for DekorasiTab conflict checking
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    onClose: () => void;
    handleOpenForm: (mode: 'edit', project: Project) => void;
    handleProjectDelete: (projectId: string) => void;
    handleOpenBriefingModal: () => void;
    packages: Package[];
    transactions: Transaction[];
    teamProjectPayments: TeamProjectPayment[];
    cards: Card[];
    onOpenSharePreview: (data: { title: string; message: string; phone?: string | null }) => void;
};

// --- Komponen Tab Kebutuhan Dekorasi ---
interface DekorasiTabProps {
    selectedProject: Project;
    projects: Project[]; // All projects for conflict checking
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    showNotification: (msg: string) => void;
}

const DekorasiTab: React.FC<DekorasiTabProps> = ({ selectedProject, projects, setProjects, showNotification }) => {
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(true);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [applyingTemplate, setApplyingTemplate] = useState(false);
    const [showSuratJalanModal, setShowSuratJalanModal] = useState(false);

    // State for event detail fields
    const eventDetails = selectedProject.eventDetails || {};
    const [tentaSize, setTentaSize] = useState<string>(eventDetails.tentaSize || '');
    const [tentaRef, setTentaRef] = useState<string>(eventDetails.tentaRef || '');
    const [themeColor, setThemeColor] = useState<string>(eventDetails.themeColor || '');
    const [catatan, setCatatan] = useState<string>(eventDetails.catatan || '');
    const [savingDetails, setSavingDetails] = useState(false);

    // Project inventory items state (items tagged to this project)
    const projectInventoryItems: ProjectInventoryItem[] = selectedProject.inventoryItems || [];

    const handlePrintSuratJalan = () => {
        window.print();
    };

    // Decoration Package Templates (Static Presets)
    const decorationTemplates = [
        {
            id: 'standard-akad',
            name: 'Paket Standard Akad',
            description: 'Dekorasi sederhana untuk acara akad nikah intimate',
            icon: '💒',
            items: [
                { category: 'Tenda', name: 'Tenda 5x5', quantity: 1 },
                { category: 'Kursi', name: 'Kursi Tiffany', quantity: 50 },
                { category: 'Meja', name: 'Meja Bundar', quantity: 5 },
                { category: 'Dekorasi', name: 'Standing Flower', quantity: 4 },
                { category: 'Lighting', name: 'Lampu String', quantity: 2 },
            ]
        },
        {
            id: 'resepsi-mewah',
            name: 'Paket Resepsi Mewah',
            description: 'Dekorasi premium untuk resepsi pernikahan grand',
            icon: '👑',
            items: [
                { category: 'Tenda', name: 'Tenda 10x20', quantity: 2 },
                { category: 'Kursi', name: 'Kursi Tiffany', quantity: 200 },
                { category: 'Meja', name: 'Meja Bundar', quantity: 20 },
                { category: 'Dekorasi', name: 'Standing Flower', quantity: 12 },
                { category: 'Dekorasi', name: 'Backdrop Utama', quantity: 1 },
                { category: 'Lighting', name: 'Lampu Hias Premium', quantity: 10 },
                { category: 'Properti', name: 'Karpet Merah', quantity: 1 },
            ]
        },
        {
            id: 'outdoor-garden',
            name: 'Paket Outdoor Garden',
            description: 'Dekorasi natural untuk pernikahan taman outdoor',
            icon: '🌿',
            items: [
                { category: 'Tenda', name: 'Tenda Transparan', quantity: 1 },
                { category: 'Kursi', name: 'Kursi Kayu Natural', quantity: 100 },
                { category: 'Meja', name: 'Meja Kayu Rustic', quantity: 10 },
                { category: 'Dekorasi', name: 'Pot Bunga', quantity: 20 },
                { category: 'Dekorasi', name: 'Arch Flower', quantity: 1 },
                { category: 'Lighting', name: 'Fairy Light', quantity: 5 },
            ]
        },
        {
            id: 'modern-minimalis',
            name: 'Paket Modern Minimalis',
            description: 'Dekorasi kontemporer dengan konsep clean & simple',
            icon: '✨',
            items: [
                { category: 'Tenda', name: 'Tenda Putih', quantity: 1 },
                { category: 'Kursi', name: 'Kursi Modern', quantity: 80 },
                { category: 'Meja', name: 'Meja Kotak', quantity: 8 },
                { category: 'Dekorasi', name: 'Backdrop Minimalis', quantity: 1 },
                { category: 'Lighting', name: 'LED Strip', quantity: 8 },
                { category: 'Properti', name: 'Neon Sign Custom', quantity: 1 },
            ]
        }
    ];

    // Calculate item usage on the same date for conflict checking
    const calculateItemUsageOnDate = (itemId: string, eventDate: string): number => {
        let totalUsed = 0;
        const targetDate = new Date(eventDate).toDateString();
        
        // Filter active projects on the same date (excluding current project and cancelled/completed)
        const conflictingProjects = projects.filter(p => 
            p.id !== selectedProject.id && 
            p.status !== 'Selesai' && 
            p.status !== 'Dibatalkan' &&
            new Date(p.date).toDateString() === targetDate
        );

        conflictingProjects.forEach(project => {
            const itemInProject = project.inventoryItems?.find(i => i.itemId === itemId);
            if (itemInProject) {
                totalUsed += itemInProject.quantity;
            }
        });

        return totalUsed;
    };

    const handleApplyTemplate = async (template: typeof decorationTemplates[0]) => {
        setApplyingTemplate(true);
        try {
            const newItems: ProjectInventoryItem[] = [];
            const warnings: string[] = [];
            let itemsAdded = 0;

            // Match template items with inventory items by category and name
            for (const templateItem of template.items) {
                const matchedItem = inventoryItems.find(
                    inv => inv.category.toLowerCase() === templateItem.category.toLowerCase() && 
                           inv.name.toLowerCase().includes(templateItem.name.toLowerCase())
                );

                if (matchedItem) {
                    // Check conflict
                    const usageOnSameDate = calculateItemUsageOnDate(matchedItem.id, selectedProject.date);
                    const availableOnDate = matchedItem.totalQuantity - usageOnSameDate;

                    if (templateItem.quantity <= availableOnDate) {
                        newItems.push({
                            itemId: matchedItem.id,
                            quantity: templateItem.quantity,
                            name: matchedItem.name,
                            coverImage: matchedItem.coverImage,
                        });
                        itemsAdded++;
                    } else {
                        warnings.push(`${matchedItem.name}: hanya ${availableOnDate} tersedia (diminta ${templateItem.quantity})`);
                    }
                } else {
                    warnings.push(`${templateItem.name} tidak ditemukan di inventaris`);
                }
            }

            if (newItems.length === 0) {
                showNotification('❌ Tidak ada item dari template yang bisa ditambahkan');
                setApplyingTemplate(false);
                return;
            }

            // Merge with existing items (don't duplicate)
            const existingItems = selectedProject.inventoryItems || [];
            const mergedItems = [...existingItems];
            
            newItems.forEach(newItem => {
                const existingIndex = mergedItems.findIndex(i => i.itemId === newItem.itemId);
                if (existingIndex >= 0) {
                    // Update quantity if already exists
                    mergedItems[existingIndex].quantity += newItem.quantity;
                } else {
                    mergedItems.push(newItem);
                }
            });

            const { updateProject } = await import('../../services/projects');
            await updateProject(selectedProject.id, { inventoryItems: mergedItems });
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, inventoryItems: mergedItems } : p));

            let message = `✓ Template "${template.name}" berhasil diterapkan! ${itemsAdded} item ditambahkan.`;
            if (warnings.length > 0) {
                message += ` Peringatan: ${warnings.slice(0, 2).join(', ')}${warnings.length > 2 ? '...' : ''}`;
            }
            showNotification(message);
            setShowTemplateModal(false);
        } catch (e) {
            showNotification('Gagal menerapkan template');
        } finally {
            setApplyingTemplate(false);
        }
    };

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const { listInventoryItems } = await import('../../services/inventoryItems');
                const items = await listInventoryItems();
                setInventoryItems(items);
            } catch (e) {
                console.error('Failed to load inventory:', e);
            } finally {
                setLoadingInventory(false);
            }
        };
        fetchInventory();
    }, []);

    const handleSaveEventDetails = async () => {
        setSavingDetails(true);
        try {
            const { updateProject } = await import('../../services/projects');
            const updatedDetails = { tentaSize, tentaRef, themeColor, catatan };
            const updated = await updateProject(selectedProject.id, { eventDetails: updatedDetails });
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, eventDetails: updatedDetails } : p));
            showNotification('Detail acara berhasil disimpan');
        } catch (e) {
            showNotification('Gagal menyimpan detail acara');
        } finally {
            setSavingDetails(false);
        }
    };

    const handleAddInventoryItem = async (itemId: string, quantity: number) => {
        const existingItems = selectedProject.inventoryItems || [];
        const alreadyAdded = existingItems.find(i => i.itemId === itemId);
        const inventoryItem = inventoryItems.find(i => i.id === itemId);
        if (!inventoryItem) return;

        // Conflict checking: Calculate usage on the same date
        const usageOnSameDate = calculateItemUsageOnDate(itemId, selectedProject.date);
        const currentProjectQty = alreadyAdded?.quantity || 0;
        const availableOnDate = inventoryItem.totalQuantity - usageOnSameDate + currentProjectQty;

        // Check if requested quantity exceeds available stock on that date
        if (quantity > availableOnDate) {
            showNotification(`⚠️ KONFLIK JADWAL: Item "${inventoryItem.name}" hanya tersedia ${availableOnDate} unit pada tanggal ${new Date(selectedProject.date).toLocaleDateString('id-ID')}. Sudah digunakan ${usageOnSameDate} unit di proyek lain.`);
            return;
        }

        let updatedItems: ProjectInventoryItem[];
        if (alreadyAdded) {
            updatedItems = existingItems.map(i => i.itemId === itemId ? { ...i, quantity } : i);
        } else {
            updatedItems = [...existingItems, {
                itemId,
                quantity,
                name: inventoryItem.name,
                coverImage: inventoryItem.coverImage,
            }];
        }

        try {
            const { updateProject } = await import('../../services/projects');
            await updateProject(selectedProject.id, { inventoryItems: updatedItems });
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, inventoryItems: updatedItems } : p));
            showNotification(`${inventoryItem.name} berhasil ditambahkan ke proyek`);
        } catch (e) {
            showNotification('Gagal menambahkan item');
        }
    };

    const handleRemoveInventoryItem = async (itemId: string) => {
        const updatedItems = (selectedProject.inventoryItems || []).filter(i => i.itemId !== itemId);
        try {
            const { updateProject } = await import('../../services/projects');
            await updateProject(selectedProject.id, { inventoryItems: updatedItems });
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, inventoryItems: updatedItems } : p));
            showNotification('Item berhasil dihapus dari proyek');
        } catch (e) {
            showNotification('Gagal menghapus item');
        }
    };

    return (
        <div className="space-y-6">
            {/* Detail Acara Section */}
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                <h3 className="text-lg font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                    <span className="text-2xl">📐</span> Detail Acara & Referensi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Ukuran Tenda</label>
                        <input type="text" value={tentaSize} onChange={e => setTentaSize(e.target.value)}
                            placeholder="Contoh: 10x20 meter, 200 pax"
                            className="w-full px-3 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Tema / Warna</label>
                        <input type="text" value={themeColor} onChange={e => setThemeColor(e.target.value)}
                            placeholder="Contoh: Rustic, Romantic, Gold & White"
                            className="w-full px-3 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none text-sm" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Link Referensi Dekorasi</label>
                        <input type="url" value={tentaRef} onChange={e => setTentaRef(e.target.value)}
                            placeholder="Contoh: https://pinterest.com/..."
                            className="w-full px-3 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none text-sm" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Catatan Khusus Acara</label>
                        <textarea value={catatan} onChange={e => setCatatan(e.target.value)}
                            rows={3} placeholder="Catatan tambahan untuk tim..."
                            className="w-full px-3 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none text-sm" />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={handleSaveEventDetails} disabled={savingDetails}
                        className="px-5 py-2 bg-brand-accent text-white rounded-xl font-semibold text-sm hover:bg-brand-accent/90 disabled:opacity-50 transition-colors">
                        {savingDetails ? 'Menyimpan...' : 'Simpan Detail Acara'}
                    </button>
                </div>
            </div>

            {/* Item Yang Sudah Di-tag */}
            {projectInventoryItems.length > 0 && (
                <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-brand-text-primary flex items-center gap-2">
                            <span className="text-2xl">📦</span> Item Dekorasi Acara Ini ({projectInventoryItems.length})
                        </h3>
                        <button
                            onClick={() => setShowSuratJalanModal(true)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors shadow-md hover:shadow-lg"
                        >
                            <FileTextIcon className="w-4 h-4" />
                            Cetak Surat Jalan
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {projectInventoryItems.map(pi => {
                            const detail = inventoryItems.find(i => i.id === pi.itemId);
                            return (
                                <div key={pi.itemId} className="flex items-center gap-3 p-3 bg-brand-bg rounded-xl border border-brand-border">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-brand-border flex-shrink-0 bg-gray-100">
                                        {pi.coverImage ? (
                                            <img src={pi.coverImage} alt={pi.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <BoxIcon className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="font-semibold text-sm text-brand-text-primary">{pi.name || detail?.name || 'Item'}</div>
                                        <div className="text-xs text-brand-text-secondary">{detail?.category}</div>
                                        <div className="text-xs font-bold text-brand-accent mt-0.5">Jumlah: {pi.quantity} unit</div>
                                    </div>
                                    <button onClick={() => handleRemoveInventoryItem(pi.itemId)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2Icon className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Katalog Inventaris */}
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-brand-text-primary flex items-center gap-2">
                        <span className="text-2xl">🏷️</span> Tag Item dari Inventaris
                    </h3>
                    <button
                        onClick={() => setShowTemplateModal(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors shadow-md hover:shadow-lg"
                    >
                        <PackageIcon className="w-4 h-4" />
                        Gunakan Template
                    </button>
                </div>
                {loadingInventory ? (
                    <div className="text-center py-6 text-brand-text-secondary text-sm">Memuat inventaris...</div>
                ) : inventoryItems.length === 0 ? (
                    <div className="text-center py-6 text-brand-text-secondary text-sm">
                        Belum ada item inventaris. Tambahkan dulu di menu <strong>Inventaris Dekorasi</strong>.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {inventoryItems.map(item => {
                            const alreadyTagged = projectInventoryItems.find(p => p.itemId === item.id);
                            const usageOnSameDate = calculateItemUsageOnDate(item.id, selectedProject.date);
                            const currentProjectQty = alreadyTagged?.quantity || 0;
                            const availableOnDate = item.totalQuantity - usageOnSameDate + currentProjectQty;
                            
                            return (
                                <InventoryItemCard
                                    key={item.id}
                                    item={item}
                                    taggedQty={alreadyTagged?.quantity}
                                    onAdd={(qty) => handleAddInventoryItem(item.id, qty)}
                                    usageOnSameDate={usageOnSameDate}
                                    availableOnDate={availableOnDate}
                                    eventDate={selectedProject.date}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Template Selection Modal */}
            <Modal isOpen={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="Pilih Template Dekorasi" size="3xl">
                <div className="p-4 space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">💡</span>
                            <div className="text-sm text-blue-800">
                                <p className="font-bold mb-1">Tentang Template Dekorasi</p>
                                <p>Template akan otomatis menambahkan bundel item dekorasi standar ke proyek Anda. Item yang cocok dari inventaris akan di-tag sesuai kuantitas template.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {decorationTemplates.map((template) => (
                            <div key={template.id} className="border-2 border-brand-border rounded-2xl p-5 hover:border-brand-accent hover:shadow-lg transition-all cursor-pointer group">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="text-3xl mb-2">{template.icon}</div>
                                        <h4 className="font-bold text-lg text-brand-text-primary group-hover:text-brand-accent transition-colors">{template.name}</h4>
                                        <p className="text-xs text-brand-text-secondary mt-1">{template.description}</p>
                                    </div>
                                </div>

                                <div className="mt-4 mb-4">
                                    <p className="text-xs font-bold text-brand-text-secondary uppercase mb-2">Isi Paket:</p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {template.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs py-1 px-2 bg-brand-bg rounded-lg">
                                                <span className="text-brand-text-primary">
                                                    <span className="font-semibold">{item.name}</span>
                                                    <span className="text-brand-text-secondary ml-1">({item.category})</span>
                                                </span>
                                                <span className="font-bold text-brand-accent">{item.quantity}x</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleApplyTemplate(template)}
                                    disabled={applyingTemplate}
                                    className="w-full px-4 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {applyingTemplate ? 'Menerapkan...' : 'Terapkan Template Ini'}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-brand-border">
                        <button
                            onClick={() => setShowTemplateModal(false)}
                            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Surat Jalan Modal */}
            <Modal isOpen={showSuratJalanModal} onClose={() => setShowSuratJalanModal(false)} title="Surat Jalan Logistik Dekorasi" size="4xl">
                <div className="p-6">
                    {/* Print Styles */}
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            #surat-jalan-content, #surat-jalan-content * { visibility: visible; }
                            #surat-jalan-content { 
                                position: absolute; 
                                left: 0; 
                                top: 0; 
                                width: 100%;
                                padding: 20mm;
                            }
                            .no-print { display: none !important; }
                            .print-break { page-break-after: always; }
                        }
                    `}</style>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mb-6 no-print">
                        <button
                            onClick={handlePrintSuratJalan}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                            <FileTextIcon className="w-5 h-5" />
                            Cetak / Print (Ctrl+P)
                        </button>
                        <button
                            onClick={() => setShowSuratJalanModal(false)}
                            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                        >
                            Tutup
                        </button>
                    </div>

                    {/* Surat Jalan Content */}
                    <div id="surat-jalan-content" className="bg-white border-2 border-gray-300 rounded-xl p-8 space-y-6">
                        {/* Header */}
                        <div className="text-center border-b-2 border-gray-800 pb-4">
                            <h1 className="text-3xl font-black text-gray-900 mb-2">SURAT JALAN LOGISTIK</h1>
                            <h2 className="text-xl font-bold text-gray-700">Dekorasi & Properti Acara</h2>
                        </div>

                        {/* Project Details */}
                        <div className="grid grid-cols-2 gap-6 border-b border-gray-300 pb-6">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Nama Acara</p>
                                    <p className="text-base font-bold text-gray-900">{selectedProject.projectName}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Nama Klien</p>
                                    <p className="text-base font-semibold text-gray-800">{selectedProject.clientName}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Tanggal Loading</p>
                                    <p className="text-base font-semibold text-gray-800">
                                        {new Date(selectedProject.date).toLocaleDateString('id-ID', { 
                                            weekday: 'long', 
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric' 
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Lokasi Acara</p>
                                    <p className="text-base font-semibold text-gray-800">{selectedProject.location}</p>
                                </div>
                                {selectedProject.address && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap</p>
                                        <p className="text-sm text-gray-700">{selectedProject.address}</p>
                                    </div>
                                )}
                                {eventDetails.tentaSize && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Ukuran Tenda</p>
                                        <p className="text-sm text-gray-700">{eventDetails.tentaSize}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Checklist Table */}
                        <div>
                            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                                <span>📋</span> DAFTAR BARANG YANG DIBAWA
                            </h3>
                            <table className="w-full border-2 border-gray-800">
                                <thead>
                                    <tr className="bg-gray-800 text-white">
                                        <th className="border border-gray-700 px-3 py-3 text-left text-sm font-bold w-12">NO</th>
                                        <th className="border border-gray-700 px-3 py-3 text-left text-sm font-bold">NAMA BARANG</th>
                                        <th className="border border-gray-700 px-3 py-3 text-center text-sm font-bold w-24">JUMLAH</th>
                                        <th className="border border-gray-700 px-3 py-3 text-center text-sm font-bold w-20">✓</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectInventoryItems.map((item, index) => {
                                        const detail = inventoryItems.find(i => i.id === item.itemId);
                                        return (
                                            <tr key={item.itemId} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="border border-gray-300 px-3 py-3 text-center font-bold text-gray-700">
                                                    {index + 1}
                                                </td>
                                                <td className="border border-gray-300 px-3 py-3">
                                                    <div className="font-bold text-gray-900">{item.name || detail?.name}</div>
                                                    {detail?.category && (
                                                        <div className="text-xs text-gray-500 mt-1">Kategori: {detail.category}</div>
                                                    )}
                                                </td>
                                                <td className="border border-gray-300 px-3 py-3 text-center">
                                                    <span className="font-black text-lg text-gray-900">{item.quantity}</span>
                                                    <span className="text-sm text-gray-600 ml-1">unit</span>
                                                </td>
                                                <td className="border border-gray-300 px-3 py-3 bg-yellow-50">
                                                    {/* Empty checkbox for manual checking */}
                                                    <div className="w-8 h-8 border-2 border-gray-400 mx-auto rounded"></div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100">
                                        <td colSpan={2} className="border border-gray-300 px-3 py-3 text-right font-bold text-gray-900">
                                            TOTAL ITEM:
                                        </td>
                                        <td className="border border-gray-300 px-3 py-3 text-center font-black text-xl text-gray-900">
                                            {projectInventoryItems.reduce((sum, item) => sum + item.quantity, 0)}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-3"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Notes Section */}
                        {eventDetails.catatan && (
                            <div className="border-2 border-yellow-400 bg-yellow-50 rounded-lg p-4">
                                <p className="text-xs font-bold text-yellow-900 uppercase mb-2">⚠️ CATATAN PENTING:</p>
                                <p className="text-sm text-yellow-900 font-medium">{eventDetails.catatan}</p>
                            </div>
                        )}

                        {/* Signature Section */}
                        <div className="grid grid-cols-3 gap-6 pt-8 mt-8 border-t-2 border-gray-300">
                            <div className="text-center">
                                <p className="text-sm font-bold text-gray-700 mb-16">Diserahkan Oleh,</p>
                                <div className="border-t-2 border-gray-800 pt-2">
                                    <p className="text-sm font-bold text-gray-900">Koordinator Logistik</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-gray-700 mb-16">Diterima Oleh,</p>
                                <div className="border-t-2 border-gray-800 pt-2">
                                    <p className="text-sm font-bold text-gray-900">Kru Lapangan</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-gray-700 mb-16">Mengetahui,</p>
                                <div className="border-t-2 border-gray-800 pt-2">
                                    <p className="text-sm font-bold text-gray-900">PIC Acara</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-xs text-gray-500 mt-6 pt-4 border-t border-gray-300">
                            <p>Dokumen ini dicetak pada {new Date().toLocaleDateString('id-ID', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</p>
                            <p className="mt-1 font-semibold">Pastikan semua item tercatat dengan benar sebelum pengiriman</p>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const InventoryItemCard: React.FC<{ 
    item: InventoryItem; 
    taggedQty?: number; 
    onAdd: (qty: number) => void;
    usageOnSameDate: number;
    availableOnDate: number;
    eventDate: string;
}> = ({ item, taggedQty, onAdd, usageOnSameDate, availableOnDate, eventDate }) => {
    const [qty, setQty] = useState(taggedQty || 1);
    const hasConflict = availableOnDate < qty;
    const isLowStock = availableOnDate <= 3 && availableOnDate > 0;
    
    return (
        <div className={`flex flex-col gap-3 p-3 bg-brand-bg rounded-xl border ${hasConflict ? 'border-red-300 bg-red-50' : isLowStock ? 'border-yellow-300 bg-yellow-50' : 'border-brand-border'}`}>
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-brand-border flex-shrink-0 bg-gray-100">
                    {item.coverImage ? (
                        <img src={item.coverImage} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <BoxIcon className="w-5 h-5" />
                        </div>
                    )}
                </div>
            <div className="flex-grow">
                <div className="font-semibold text-sm text-brand-text-primary">{item.name}</div>
                <div className="text-xs text-brand-text-secondary">{item.category} • Total Stok: {item.totalQuantity}</div>
                {taggedQty && <div className="text-xs text-brand-accent font-semibold">✓ Sudah ditag: {taggedQty}</div>}
            </div>
            <div className="flex items-center gap-1">
                <input type="number" min="1" max={item.totalQuantity} value={qty} onChange={e => setQty(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-sm border border-brand-border rounded-lg bg-brand-input text-center" />
                <button onClick={() => onAdd(qty)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${taggedQty ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-brand-accent text-white hover:bg-brand-accent/90'}`}>
                    {taggedQty ? 'Ubah' : 'Tag'}
                </button>
            </div>
            </div>
            
            {/* Conflict/Availability Warning */}
            {usageOnSameDate > 0 && (
                <div className={`text-xs p-2 rounded-lg ${hasConflict ? 'bg-red-100 border border-red-200 text-red-800' : isLowStock ? 'bg-yellow-100 border border-yellow-200 text-yellow-800' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
                    <div className="flex items-start gap-2">
                        <span className="text-base">{hasConflict ? '⚠️' : isLowStock ? '⚡' : 'ℹ️'}</span>
                        <div className="flex-1">
                            <div className="font-bold mb-1">
                                {hasConflict ? 'KONFLIK JADWAL!' : isLowStock ? 'Stok Terbatas' : 'Info Ketersediaan'}
                            </div>
                            <div className="space-y-0.5">
                                <div>📅 Tanggal: {new Date(eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                <div>📦 Digunakan proyek lain: <span className="font-bold">{usageOnSameDate} unit</span></div>
                                <div className={`font-bold ${hasConflict ? 'text-red-900' : isLowStock ? 'text-yellow-900' : ''}`}>
                                    ✓ Tersedia pada tanggal ini: <span className="text-base">{availableOnDate} unit</span>
                                </div>
                            </div>
                            {hasConflict && (
                                <div className="mt-1 pt-1 border-t border-red-200 text-red-900 font-bold">
                                    Kurangi jumlah atau koordinasikan dengan tim!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ selectedProject, setSelectedProject, teamMembers, clients, profile, showNotification, projects, setProjects, onClose, handleOpenForm, handleProjectDelete, handleOpenBriefingModal, packages, transactions, teamProjectPayments, cards, onOpenSharePreview }) => {
    const [detailTab, setDetailTab] = useState<'details' | 'files' | 'checklist' | 'dekorasi'>('details');
    const [newCharge, setNewCharge] = useState({ name: '', amount: '' });
    const [isEditingFinalLink, setIsEditingFinalLink] = useState(false);
    const [tempFinalLink, setTempFinalLink] = useState('');
    const [editingChecklistNotesId, setEditingChecklistNotesId] = useState<string | null>(null);
    const [checklistNotesDraft, setChecklistNotesDraft] = useState('');
    const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
    const [checklistItemNameDraft, setChecklistItemNameDraft] = useState('');
    const [picDraft, setPicDraft] = useState('');
    const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
    const [categoryNameDraft, setCategoryNameDraft] = useState('');
    const [isInitializingChecklist, setIsInitializingChecklist] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const teamByCategory = useMemo(() => {
        if (!selectedProject?.team) return { 'Tim': {}, 'Vendor': {} };
        return selectedProject.team.reduce((acc, member) => {
            const originalMember = teamMembers.find(m => m.id === member.memberId);
            const category = originalMember?.category || 'Tim';
            if (!acc[category]) acc[category] = {};
            if (!acc[category][member.role]) acc[category][member.role] = [];
            acc[category][member.role].push(member);
            return acc;
        }, { 'Tim': {}, 'Vendor': {} } as Record<string, Record<string, AssignedTeamMember[]>>);
    }, [selectedProject?.team, teamMembers]);

    useEffect(() => {
        setEditingChecklistItemId(null);
        setChecklistItemNameDraft('');
        setPicDraft('');
        setEditingChecklistNotesId(null);
        setChecklistNotesDraft('');
        setEditingCategoryName(null);
        setCategoryNameDraft('');
        setActiveCategory(null);
    }, [selectedProject?.id]);
    // Auto-load checklist dari database dan set realtime subscription ketika buka tab checklist
    useEffect(() => {
        const projectId = selectedProject?.id;
        if (!projectId) return;
        if (detailTab !== 'checklist') return;

        // Fetch initial data jika belum ada di state (atau pastikan selalu update saat pertama buka tab)
        (async () => {
            try {
                const items = await listChecklistByProject(projectId);
                setSelectedProject(prev => {
                    if (!prev || prev.id !== projectId) return prev;
                    // Hanya set jika berbeda untuk menghindari loop render (di-handle oleh React, tapi aman assign new obj)
                    const updatedProject = { ...prev, weddingDayChecklist: items };
                    setProjects(all => all.map(p => p.id === projectId ? updatedProject : p));
                    return updatedProject;
                });
            } catch (e) {
                console.error('Failed to load checklist:', e);
            }
        })();

        // Setup real-time subscription
        const channel = supabase
            .channel(`admin:wedding_day_checklists:project_id=eq.${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'wedding_day_checklists',
                    filter: `project_id=eq.${projectId}`
                },
                (payload) => {
                    setSelectedProject(prevProject => {
                        if (!prevProject || prevProject.id !== projectId) return prevProject;
                        
                        const currentList = prevProject.weddingDayChecklist || [];
                        let newList = [...currentList];

                        if (payload.eventType === 'INSERT') {
                            const newPayloadItem = payload.new as any;
                            const newItem = {
                                id: newPayloadItem.id,
                                projectId: newPayloadItem.project_id,
                                category: newPayloadItem.category,
                                itemName: newPayloadItem.item_name,
                                isCompleted: newPayloadItem.is_completed,
                                assignedTo: newPayloadItem.assigned_to,
                                notes: newPayloadItem.notes,
                                createdAt: newPayloadItem.created_at,
                                updatedAt: newPayloadItem.updated_at
                            };
                            if (!newList.some(item => item.id === newItem.id)) {
                                newList.push(newItem);
                            }
                        } else if (payload.eventType === 'UPDATE') {
                            const newPayloadItem = payload.new as any;
                            const updatedItem = {
                                id: newPayloadItem.id,
                                projectId: newPayloadItem.project_id,
                                category: newPayloadItem.category,
                                itemName: newPayloadItem.item_name,
                                isCompleted: newPayloadItem.is_completed,
                                assignedTo: newPayloadItem.assigned_to,
                                notes: newPayloadItem.notes,
                                createdAt: newPayloadItem.created_at,
                                updatedAt: newPayloadItem.updated_at
                            };
                            newList = newList.map(item => item.id === updatedItem.id ? updatedItem : item);
                        } else if (payload.eventType === 'DELETE') {
                            newList = newList.filter(item => item.id !== payload.old.id);
                        }

                        // Hanya update state jika ada perubahan
                        if (JSON.stringify(newList) === JSON.stringify(currentList)) return prevProject;

                        const updatedProject = { ...prevProject, weddingDayChecklist: newList };
                        setProjects(prevP => prevP.map(p => p.id === projectId ? updatedProject : p));
                        return updatedProject;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [detailTab, selectedProject?.id, setProjects]);

    const formatDateFull = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    const handleToggleDigitalItem = (itemText: string) => {
        if (!selectedProject) return;

        const currentCompleted = selectedProject.completedDigitalItems || [];
        const isCompleted = currentCompleted.includes(itemText);
        const newCompleted = isCompleted
            ? currentCompleted.filter(item => item !== itemText)
            : [...currentCompleted, itemText];

        const updatedProject = { ...selectedProject, completedDigitalItems: newCompleted };

        setProjects(prevProjects => prevProjects.map(p => p.id === selectedProject.id ? updatedProject : p));
        setSelectedProject(updatedProject); // Update local state for immediate UI feedback in the modal
    };

    const handleStatusUpdate = async (newStatus: string) => {
        if (!selectedProject) return;
        const nextProgress = getProgressForStatus(newStatus, profile.projectStatusConfig);
        const statusConfig = profile.projectStatusConfig.find(s => s.name === newStatus);

        try {
            const updated = {
                ...selectedProject,
                status: newStatus,
                progress: nextProgress,
                activeSubStatuses: [], // Reset active sub-statuses on major status shift
                customSubStatuses: statusConfig?.subStatuses || [], // Load defaults for the new status
            } as Project;

            await updateProjectInDb(selectedProject.id, {
                status: newStatus as any,
                progress: nextProgress as any,
                activeSubStatuses: [] as any,
                customSubStatuses: (statusConfig?.subStatuses || []) as any,
            } as any);

            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updated : p));
            setSelectedProject(updated);
            showNotification(`Status diubah ke "${newStatus}"`);
        } catch (err) {
            console.error('[DetailModal] Status update failed:', err);
            showNotification('Gagal memperbarui status. Coba lagi.');
        }
    };

    const handleSubStatusToggle = async (subName: string, isChecked: boolean) => {
        if (!selectedProject) return;
        const currentActive = selectedProject.activeSubStatuses || [];
        const nextActive = isChecked
            ? [...currentActive, subName]
            : currentActive.filter(s => s !== subName);

        try {
            const updated = { ...selectedProject, activeSubStatuses: nextActive };

            await updateProjectInDb(selectedProject.id, {
                activeSubStatuses: nextActive as any,
            } as any);

            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updated : p));
            setSelectedProject(updated);
        } catch (err) {
            console.error('[DetailModal] Sub-status toggle failed:', err);
            showNotification('Gagal memperbarui tahapan.');
        }
    };

    const handleSaveFinalLink = async () => {
        if (!selectedProject) return;
        try {
            const updated = { ...selectedProject, finalDriveLink: tempFinalLink };
            await updateProjectInDb(selectedProject.id, { finalDriveLink: tempFinalLink } as any);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updated : p));
            setSelectedProject(updated);
            setIsEditingFinalLink(false);
            showNotification('Link File Jadi berhasil diperbarui.');
        } catch (err) {
            console.error('[DetailModal] Save final link failed:', err);
            showNotification('Gagal memperbarui link.');
        }
    };

    const handleSendFinalLink = () => {
        if (!selectedProject || !selectedProject.finalDriveLink) {
            showNotification('Link File Jadi belum tersedia.');
            return;
        }
        const client = clients.find(c => c.id === selectedProject.clientId);
        const phone = client?.whatsapp || client?.phone;
        if (!phone) {
            showNotification('Nomor WhatsApp pengantin tidak ditemukan.');
            return;
        }
        
        // Coba cari template khusus untuk "Kirim Link" atau gunakan default
        const template = profile.chatTemplates?.find(t => t.title.toLowerCase().includes('link'))?.template 
            || `Halo Kak {clientName},\n\nTerima kasih telah mempercayakan acara {projectName} kepada kami. Berikut adalah link file hasil dokumentasi akhirnya:\n{finalDriveLink}\n\nSemoga suka dengan hasilnya!`;
        
        const message = template
            .replace(/{clientName}/g, selectedProject.clientName)
            .replace(/{projectName}/g, selectedProject.projectName)
            .replace(/{finalDriveLink}/g, selectedProject.finalDriveLink);

        onOpenSharePreview({
            title: `Bagikan Link File Jadi - ${selectedProject.projectName}`,
            message,
            phone,
        });
    };

    const handleNewChargeSubmit = async () => {
        if (!selectedProject || !newCharge.name.trim() || !newCharge.amount) {
            showNotification('Harap isi nama dan jumlah biaya dengan benar.');
            return;
        }

        const amount = Number(newCharge.amount);
        if (isNaN(amount) || amount <= 0) {
            showNotification('Jumlah biaya harus angka positif.');
            return;
        }

        const newCustomCost = {
            id: `custom-${Date.now()}`,
            description: newCharge.name.trim(),
            amount: amount
        };

        const existingCustomCosts = selectedProject.customCosts || [];
        const updatedCustomCosts = [...existingCustomCosts, newCustomCost];
        const newTotalCost = selectedProject.totalCost + amount;

        // Calculate new payment status based on current amountPaid
        const remaining = newTotalCost - selectedProject.amountPaid;
        const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (selectedProject.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);

        try {
            const updated = {
                ...selectedProject,
                customCosts: updatedCustomCosts,
                totalCost: newTotalCost,
                paymentStatus: newPaymentStatus
            };

            await updateProjectInDb(selectedProject.id, {
                custom_costs: updatedCustomCosts as any,
                total_cost: newTotalCost as any,
                payment_status: newPaymentStatus as any
            } as any);

            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updated : p));
            setSelectedProject(updated);
            setNewCharge({ name: '', amount: '' });
            showNotification('Biaya tambahan berhasil ditambahkan.');
        } catch (err) {
            console.error('[DetailModal] Add custom cost failed:', err);
            showNotification('Gagal menambahkan biaya tambahan.');
        }
    };

    const handleToggleChecklistItem = async (itemId: string, currentStatus: boolean) => {
        if (!selectedProject) return;
        try {
            const updatedRow = await setChecklistItemCompleted(itemId, !currentStatus);
            const updatedItems = selectedProject.weddingDayChecklist?.map(item =>
                item.id === itemId ? { ...item, isCompleted: updatedRow.isCompleted, updatedAt: updatedRow.updatedAt } : item
            ) || [];

            const updatedProject = { ...selectedProject, weddingDayChecklist: updatedItems };
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
        } catch (err) {
            console.error('Failed to toggle checklist item:', err);
            showNotification('Gagal memperbarui checklist.');
        }
    };

    const handleSaveChecklistNotes = async () => {
        if (!selectedProject || !editingChecklistNotesId) return;
        try {
            const updatedRow = await updateChecklistItemFields(editingChecklistNotesId, { notes: checklistNotesDraft });
            const updatedItems = selectedProject.weddingDayChecklist?.map(item =>
                item.id === editingChecklistNotesId ? { ...item, notes: updatedRow.notes, updatedAt: updatedRow.updatedAt } : item
            ) || [];

            const updatedProject = { ...selectedProject, weddingDayChecklist: updatedItems };
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
            setEditingChecklistNotesId(null);
            setChecklistNotesDraft('');
        } catch (err) {
            console.error('Failed to save checklist notes:', err);
            showNotification('Gagal menyimpan catatan.');
        }
    };

    const handleSaveItemEdits = async () => {
        if (!selectedProject || !editingChecklistItemId) return;
        const nextName = checklistItemNameDraft.trim();
        if (!nextName) {
            showNotification('Nama item tidak boleh kosong.');
            return;
        }
        try {
            const updatedRow = await updateChecklistItemFields(editingChecklistItemId, { 
                itemName: nextName,
                assignedTo: picDraft.trim() || null
            });
            const updatedItems = selectedProject.weddingDayChecklist?.map(item =>
                item.id === editingChecklistItemId ? { 
                    ...item, 
                    itemName: updatedRow.itemName, 
                    assignedTo: updatedRow.assignedTo, 
                    updatedAt: updatedRow.updatedAt 
                } : item
            ) || [];

            const updatedProject = { ...selectedProject, weddingDayChecklist: updatedItems };
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
            setEditingChecklistItemId(null);
            setChecklistItemNameDraft('');
            setPicDraft('');
        } catch (err) {
            console.error('Failed to save item edits:', err);
            showNotification('Gagal menyimpan perubahan item.');
        }
    };

    const handleAddChecklistItem = async (category: string, itemName: string) => {
        if (!selectedProject || !itemName.trim()) return;
        try {
            const newItem = {
                projectId: selectedProject.id,
                category,
                itemName: itemName.trim(),
                isCompleted: false
            };
            const result = await upsertChecklistItems([newItem]);
            const updatedProject = {
                ...selectedProject,
                weddingDayChecklist: [...(selectedProject.weddingDayChecklist || []), ...result]
            };
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
        } catch (err) {
            console.error('Failed to add checklist item:', err);
            showNotification('Gagal menambah item checklist.');
        }
    };

    const handleDeleteChecklistItem = async (itemId: string) => {
        if (!selectedProject) return;
        try {
            await deleteChecklistItem(itemId);
            const updatedProject = {
                ...selectedProject,
                weddingDayChecklist: selectedProject.weddingDayChecklist?.filter(item => item.id !== itemId) || []
            };
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
        } catch (err) {
            console.error('Failed to delete checklist item:', err);
            showNotification('Gagal menghapus item checklist.');
        }
    };

    const handleSaveCategoryName = async () => {
        if (!selectedProject || !editingCategoryName) return;
        const newName = categoryNameDraft.trim();
        if (!newName) {
            showNotification('Nama kategori tidak boleh kosong.');
            return;
        }
        if (newName === editingCategoryName) {
            setEditingCategoryName(null);
            setCategoryNameDraft('');
            return;
        }
        try {
            await renameChecklistCategory(selectedProject.id, editingCategoryName, newName);
            
            // Refresh data dari database untuk memastikan sinkronisasi
            const refreshedChecklist = await listChecklistByProject(selectedProject.id);
            const updatedProject = { ...selectedProject, weddingDayChecklist: refreshedChecklist };
            
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
            setEditingCategoryName(null);
            setCategoryNameDraft('');
            showNotification('Kategori berhasil diubah.');
        } catch (err) {
            console.error('Failed to rename category:', err);
            showNotification('Gagal mengubah nama kategori.');
        }
    };

    const handleDeleteCategory = async (category: string) => {
        if (!selectedProject) return;
        const categoryItems = selectedProject.weddingDayChecklist?.filter(item => item.category === category) || [];
        if (categoryItems.length === 0) return;
        
        const confirmed = window.confirm(`Hapus kategori "${category}" beserta ${categoryItems.length} item di dalamnya?`);
        if (!confirmed) return;

        try {
            await deleteChecklistItemsByProjectAndCategory(selectedProject.id, category);
            
            // Refresh data dari database untuk memastikan sinkronisasi
            const refreshedChecklist = await listChecklistByProject(selectedProject.id);
            const updatedProject = { ...selectedProject, weddingDayChecklist: refreshedChecklist };
            
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
            showNotification('Kategori berhasil dihapus.');
        } catch (err) {
            console.error('Failed to delete category:', err);
            showNotification('Gagal menghapus kategori.');
        }
    };

    const handleInitializeChecklist = async () => {
        if (!selectedProject || isInitializingChecklist) return;
        
        setIsInitializingChecklist(true);
        try {
            const customTemplates = profile.checklistTemplates && profile.checklistTemplates.length > 0
                ? profile.checklistTemplates
                : undefined;
            const result = await initializeDefaultChecklist(selectedProject.id, customTemplates);
            const updatedProject = { ...selectedProject, weddingDayChecklist: result };
            setSelectedProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
            showNotification('Checklist Hari H berhasil dibuat.');
        } catch (err) {
            console.error('Failed to initialize checklist:', err);
            showNotification('Gagal membuat checklist default.');
        } finally {
            setIsInitializingChecklist(false);
        }
    };

    const handleShareChecklist = () => {
        if (!selectedProject) return;
        const itemsByCat = (selectedProject.weddingDayChecklist || []).reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {} as Record<string, any[]>);

        let message = `*REKAP CHECKLIST HARI H - ${selectedProject.projectName}*\n\n`;
        Object.entries(itemsByCat).forEach(([cat, items]) => {
            message += `*${cat}:*\n`;
            items.forEach(item => {
                message += `${item.isCompleted ? '✅' : '⬜'} ${item.itemName}\n`;
            });
            message += `\n`;
        });

        onOpenSharePreview({
            title: `Bagikan Rekap Checklist - ${selectedProject.projectName}`,
            message,
            phone: null,
        });
    };

    const handleShareChecklistPortal = () => {
        if (!selectedProject) return;
        const portalLink = `${window.location.origin}/#/checklist-portal/${selectedProject.id}`;
        const message = `Portal Checklist Hari H - ${selectedProject.projectName}\n\n${portalLink}`;

        onOpenSharePreview({
            title: `Bagikan Portal Checklist - ${selectedProject.projectName}`,
            message,
            phone: null,
        });
    };

    if (!selectedProject) return null;

    const allSubStatusesForCurrentStatus = selectedProject.customSubStatuses || profile.projectStatusConfig.find(s => s.name === selectedProject.status)?.subStatuses || [];

    return (
        <div className="flex flex-col h-full">
            {/* Desktop Tab Navigation - Top */}
            <div className="hidden md:block border-b border-brand-border">
                <nav className="-mb-px flex space-x-6">
                    <button onClick={() => setDetailTab('details')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${detailTab === 'details' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><ClipboardListIcon className="w-5 h-5" /> Detail</button>
                    <button onClick={() => setDetailTab('checklist')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${detailTab === 'checklist' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><CheckCircleIcon className="w-5 h-5" /> Checklist Hari H</button>
                    <button onClick={() => setDetailTab('dekorasi')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${detailTab === 'dekorasi' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><PackageIcon className="w-5 h-5" /> Kebutuhan Dekorasi</button>
                    <button onClick={() => setDetailTab('files')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${detailTab === 'files' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><FileTextIcon className="w-5 h-5" /> File & Tautan</button>
                </nav>
            </div>

            {/* Mobile Tab Navigation - Top Pills */}
            <div className="md:hidden mb-3">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setDetailTab('details')}
                        className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${detailTab === 'details'
                            ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30'
                            : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'
                            }`}
                    >
                        <ClipboardListIcon className="w-4 h-4" />
                        <span>Detail</span>
                    </button>
                    <button
                        onClick={() => setDetailTab('checklist')}
                        className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${detailTab === 'checklist'
                            ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30'
                            : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'
                            }`}
                    >
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Checklist</span>
                    </button>
                    <button
                        onClick={() => setDetailTab('dekorasi')}
                        className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${detailTab === 'dekorasi'
                            ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30'
                            : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'
                            }`}
                    >
                        <PackageIcon className="w-4 h-4" />
                        <span>Dekorasi</span>
                    </button>
                    <button
                        onClick={() => setDetailTab('files')}
                        className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${detailTab === 'files'
                            ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30'
                            : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'
                            }`}
                    >
                        <FileTextIcon className="w-4 h-4" />
                        <span>File</span>
                    </button>
                </div>
            </div>

            <div className="pt-0 md:pt-6 max-h-[65vh] overflow-y-auto pr-2 pb-4">
                {detailTab === 'dekorasi' && (
                    <DekorasiTab
                        selectedProject={selectedProject}
                        projects={projects}
                        setProjects={setProjects}
                        showNotification={showNotification}
                    />
                )}
                {detailTab === 'checklist' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-extrabold text-brand-text-light tracking-tight">Checklist Hari H</h3>
                                <p className="text-xs text-brand-text-secondary mt-1">Kelola persiapan dan pelaksanaan lapangan secara real-time</p>
                            </div>
                            <div className="flex items-center justify-center space-x-1">
                                <div className="flex items-center p-1 bg-brand-input rounded-xl border border-brand-border">
                                    <button
                                        onClick={handleShareChecklistPortal}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 text-blue-400 text-xs font-bold transition-all active:scale-95"
                                        title="Bagikan Portal Checklist"
                                    >
                                        <SendIcon className="w-4 h-4" />
                                        <span className="hidden sm:inline">Portal</span>
                                    </button>
                                    <div className="w-px h-4 bg-brand-border mx-1"></div>
                                    <button
                                        onClick={handleShareChecklist}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 text-green-400 text-xs font-bold transition-all active:scale-95"
                                        title="Kirim ke WhatsApp"
                                    >
                                        <SendIcon className="w-4 h-4" />
                                        <span className="hidden sm:inline">WhatsApp</span>
                                    </button>
                                </div>
                                {(!selectedProject.weddingDayChecklist || selectedProject.weddingDayChecklist.length === 0) && (
                                    <button
                                        onClick={handleInitializeChecklist}
                                        disabled={isInitializingChecklist}
                                        className="px-4 py-2 bg-brand-accent text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-accent/20 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isInitializingChecklist ? 'Membuat...' : 'Buat Checklist'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Summary Stats */}
                        {selectedProject.weddingDayChecklist && selectedProject.weddingDayChecklist.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in">
                                <div className="bg-brand-surface p-4 rounded-2xl border border-brand-border shadow-sm">
                                    <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-1">Total Item</p>
                                    <p className="text-2xl font-black text-white">{selectedProject.weddingDayChecklist.length}</p>
                                </div>
                                <div className="bg-brand-surface p-4 rounded-2xl border border-brand-border shadow-sm">
                                    <p className="text-[10px] font-bold text-brand-success uppercase tracking-widest mb-1">Selesai</p>
                                    <p className="text-2xl font-black text-brand-success">{selectedProject.weddingDayChecklist.filter(i => i.isCompleted).length}</p>
                                </div>
                                <div className="bg-brand-surface p-4 rounded-2xl border border-brand-border shadow-sm">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Portal Link</p>
                                    <p className="text-[10px] font-medium text-blue-400/70 truncate mt-2">Active & Sync</p>
                                </div>
                                <div className="bg-brand-surface p-4 rounded-2xl border border-brand-border shadow-sm flex items-center justify-center">
                                    <div className="relative w-12 h-12">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
                                            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * (selectedProject.weddingDayChecklist.filter(i => i.isCompleted).length / selectedProject.weddingDayChecklist.length))} className="text-brand-accent transition-all duration-1000" />
                                        </svg>
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                            {selectedProject.weddingDayChecklist.length > 0 ? Math.round((selectedProject.weddingDayChecklist.filter(i => i.isCompleted).length / selectedProject.weddingDayChecklist.length) * 100) : 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-6">
                            {(() => {
                                // Ambil semua kategori unik dari checklist yang ada
                                const existingCategories = Array.from(
                                    new Set((selectedProject.weddingDayChecklist || [])
                                        .slice()
                                        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
                                        .map(item => item.category))
                                );
                                
                                // Jika tidak ada checklist, tampilkan pesan kosong
                                if (existingCategories.length === 0) {
                                    return (
                                        <div className="text-center py-20 bg-brand-surface rounded-3xl border-2 border-dashed border-brand-border">
                                            <CheckCircleIcon className="w-16 h-16 mx-auto text-brand-text-secondary/20 mb-4" />
                                            <h4 className="text-brand-text-light font-bold">Belum Ada Checklist</h4>
                                            <p className="text-xs text-brand-text-secondary mt-2 mb-6">Inisialisasi checklist default untuk membantu persiapan lapangan.</p>
                                            <button 
                                                onClick={handleInitializeChecklist}
                                                className="px-6 py-2 bg-brand-input border border-brand-border rounded-xl text-brand-text-light text-sm font-bold hover:bg-brand-accent hover:text-white hover:border-brand-accent transition-all"
                                            >
                                                Inisialisasi Sekarang
                                            </button>
                                        </div>
                                    );
                                }
                                
                                const currentCat = activeCategory || existingCategories[0];

                                return (
                                    <>
                                        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide snap-x">
                                            {existingCategories.map((category) => {
                                                const categoryItems = (selectedProject.weddingDayChecklist || []).filter(item => item.category === category);
                                                const catDone = categoryItems.filter(i => i.isCompleted).length;
                                                const catTotal = categoryItems.length;
                                                const isActive = category === currentCat;
                                                
                                                return (
                                                    <button
                                                        key={category}
                                                        onClick={() => setActiveCategory(category)}
                                                        className={`
                                                            flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border snap-start transition-all
                                                            ${isActive 
                                                                ? 'bg-brand-surface border-brand-accent shadow-sm shadow-brand-accent/10' 
                                                                : 'bg-brand-bg border-brand-border hover:border-brand-accent/50 opacity-70 hover:opacity-100'
                                                            }
                                                        `}
                                                    >
                                                        <span className={`text-xs font-bold whitespace-nowrap ${isActive ? 'text-brand-text-light' : 'text-brand-text-secondary'}`}>
                                                            {category}
                                                        </span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${catDone === catTotal && catTotal > 0 ? 'bg-brand-success/20 text-brand-success' : 'bg-brand-input text-brand-text-secondary'}`}>
                                                            {catDone}/{catTotal}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {(() => {
                                            const category = currentCat;
                                            const categoryItems = (selectedProject.weddingDayChecklist || []).filter(item => item.category === category);
                                            const catDone = categoryItems.filter(i => i.isCompleted).length;
                                            const catTotal = categoryItems.length;

                                            return (
                                                <div key={category} className="rounded-3xl bg-brand-surface border border-brand-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    <div className="bg-brand-input px-6 py-4 flex items-center justify-between border-b border-brand-border group">
                                                        {editingCategoryName === category ? (
                                                            <div className="flex items-center gap-2 flex-grow">
                                                                <input
                                                                    value={categoryNameDraft}
                                                                    onChange={(e) => setCategoryNameDraft(e.target.value)}
                                                                    className="flex-grow bg-brand-surface border border-brand-border rounded-xl px-4 py-2 text-sm text-brand-text-light focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveCategoryName();
                                                                        if (e.key === 'Escape') { setEditingCategoryName(null); setCategoryNameDraft(''); }
                                                                    }}
                                                                    autoFocus
                                                                />
                                                                <button type="button" className="p-2 bg-brand-accent text-white rounded-lg" onClick={handleSaveCategoryName}><CheckCircleIcon className="w-4 h-4" /></button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full bg-brand-accent"></div>
                                                                    <h4 className="font-extrabold text-brand-text-light tracking-tight uppercase text-xs">{category}</h4>
                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setEditingCategoryName(category); setCategoryNameDraft(category); }}
                                                                            className="p-1.5 text-brand-text-secondary hover:text-brand-accent transition-colors"
                                                                        >
                                                                            <PencilIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteCategory(category)}
                                                                            className="p-1.5 text-brand-text-secondary hover:text-red-400 transition-colors"
                                                                        >
                                                                            <Trash2Icon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black text-brand-text-secondary">{catDone}/{catTotal}</span>
                                                                    <div className="w-16 h-1.5 bg-brand-surface rounded-full overflow-hidden">
                                                                        <div className="h-full bg-brand-accent" style={{ width: `${catTotal > 0 ? (catDone/catTotal)*100 : 0}%` }}></div>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="p-4 space-y-1">
                                                        {categoryItems.map(item => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-start gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all group"
                                                            >
                                                                <button
                                                                    onClick={() => handleToggleChecklistItem(item.id, item.isCompleted)}
                                                                    className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all active:scale-90
                                                                        ${item.isCompleted ? 'bg-brand-accent border-brand-accent shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'border-brand-border bg-brand-surface hover:border-brand-accent/50'}
                                                                    `}
                                                                >
                                                                    {item.isCompleted && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                                </button>
                                                                
                                                                <div className="flex-grow min-w-0">
                                                                    {editingChecklistItemId === item.id ? (
                                                                        <div className="flex flex-col gap-2 w-full bg-brand-bg/50 p-3 rounded-xl border border-brand-border/50">
                                                                            <input
                                                                                value={checklistItemNameDraft}
                                                                                onChange={(e) => setChecklistItemNameDraft(e.target.value)}
                                                                                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm text-brand-text-light focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                                                                                placeholder="Nama tugas"
                                                                                autoFocus
                                                                            />
                                                                            <div className="flex flex-col md:flex-row gap-2">
                                                                                <div className="relative flex-grow">
                                                                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-secondary" />
                                                                                    <input
                                                                                        value={picDraft}
                                                                                        onChange={(e) => setPicDraft(e.target.value)}
                                                                                        className="w-full bg-brand-surface border border-brand-border rounded-xl pl-9 pr-3 py-2 text-sm text-brand-text-light focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                                                                                        placeholder="PIC / Penanggung Jawab"
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSaveItemEdits();
                                                                                            if (e.key === 'Escape') { setEditingChecklistItemId(null); setChecklistItemNameDraft(''); setPicDraft(''); }
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                                <div className="flex gap-2">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="px-4 py-2 bg-brand-surface text-brand-text-secondary text-xs rounded-xl hover:text-brand-text-light"
                                                                                        onClick={() => { setEditingChecklistItemId(null); setChecklistItemNameDraft(''); setPicDraft(''); }}
                                                                                    >
                                                                                        Batal
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="px-4 py-2 bg-brand-accent text-white text-xs rounded-xl shadow-lg shadow-brand-accent/20 active:scale-95 transition-all"
                                                                                        onClick={handleSaveItemEdits}
                                                                                    >
                                                                                        Simpan
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <div className="flex flex-col gap-1.5">
                                                                                <p className={`text-sm font-medium transition-colors ${item.isCompleted ? 'text-brand-text-secondary line-through' : 'text-brand-text-light'}`}>
                                                                                    {item.itemName}
                                                                                </p>
                                                                                {item.assignedTo && (
                                                                                    <span className="w-fit inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-input border border-brand-border text-[10px] sm:text-xs font-semibold text-brand-text-secondary group-hover:border-brand-accent/30 transition-colors">
                                                                                        <UserIcon className="w-3 h-3 text-brand-accent opacity-70" />
                                                                                        {item.assignedTo}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setEditingChecklistItemId(item.id); setChecklistItemNameDraft(item.itemName); setPicDraft(item.assignedTo || ''); }}
                                                                                    className="p-1 text-brand-text-secondary hover:text-brand-accent"
                                                                                >
                                                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDeleteChecklistItem(item.id)}
                                                                                    className="p-1 text-brand-text-secondary hover:text-red-400"
                                                                                >
                                                                                    <Trash2Icon className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="mt-1 flex items-center gap-3">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setEditingChecklistNotesId(item.id); setChecklistNotesDraft(item.notes || ''); }}
                                                                            className={`text-[9px] font-bold uppercase tracking-wider hover:text-brand-accent transition-colors ${item.notes ? 'text-brand-accent' : 'text-brand-text-secondary'}`}
                                                                        >
                                                                            {item.notes ? '• Lihat Catatan' : '+ Catatan'}
                                                                        </button>
                                                                        {item.isCompleted && item.updatedAt && (
                                                                            <span className="text-[9px] text-brand-text-secondary/50 font-medium">
                                                                                ✓ {new Date(item.updatedAt).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {editingChecklistNotesId && categoryItems.some(i => i.id === editingChecklistNotesId) && (
                                                            <div className="mt-2 p-4 rounded-2xl bg-brand-surface border border-brand-border shadow-inner animate-in fade-in slide-in-from-top-2">
                                                                <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Item Note</p>
                                                                <textarea
                                                                    value={checklistNotesDraft}
                                                                    onChange={(e) => setChecklistNotesDraft(e.target.value)}
                                                                    rows={3}
                                                                    className="w-full bg-brand-input border border-brand-border rounded-xl px-4 py-3 text-sm text-brand-text-light focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all shadow-inner"
                                                                    placeholder="Tambahkan instruksi khusus atau update lapangan..."
                                                                />
                                                                <div className="flex items-center justify-end gap-2 mt-3">
                                                                    <button
                                                                        type="button"
                                                                        className="px-4 py-2 bg-brand-surface text-brand-text-secondary text-xs font-bold rounded-xl hover:text-brand-text-light"
                                                                        onClick={() => { setEditingChecklistNotesId(null); setChecklistNotesDraft(''); }}
                                                                    >
                                                                        Batal
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="px-6 py-2 bg-brand-accent text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-accent/20 active:scale-95 transition-all"
                                                                        onClick={handleSaveChecklistNotes}
                                                                    >
                                                                        Simpan Catatan
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="mt-4 px-3 border-t border-brand-border/30 pt-4">
                                                            <div className="relative">
                                                                <PlusIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-secondary" />
                                                                <input
                                                                    type="text"
                                                                    placeholder={`Tambah item ke ${category}...`}
                                                                    className="w-full bg-brand-input border border-brand-border rounded-xl pl-10 pr-4 py-3 text-sm text-brand-text-light focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleAddChecklistItem(category, e.currentTarget.value);
                                                                            e.currentTarget.value = '';
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {detailTab === 'details' && (
                    <div className="space-y-6 tab-content-mobile">
                        {/* Mobile cards */}
                        <div className="md:hidden space-y-4">
                            {/* Header card */}
                            <div className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-base font-semibold text-brand-text-light leading-tight">{selectedProject.projectName}</p>
                                        <p className="text-xs text-brand-text-secondary mt-0.5">{selectedProject.clientName}</p>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                                    <span className="text-brand-text-secondary">Tanggal</span>
                                    <span className="text-brand-text-light text-right">{formatDateFull(selectedProject.date)}</span>
                                    <span className="text-brand-text-secondary">Lokasi</span>
                                    <span className="text-brand-text-light text-right">{selectedProject.location}</span>
                                    <span className="text-brand-text-secondary">Alamat</span>
                                    <span className="text-brand-text-light text-right text-xs">{selectedProject.address || '-'}</span>
                                </div>
                            </div>

                            {/* Package & Vendor */}
                            <div className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                                <h4 className="font-semibold text-brand-text-primary mb-1">Rincian Package</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Informasi Package dan rincian Acara Pernikahan</p>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <span className="text-brand-text-secondary">Package</span>
                                    <div>
                                        <span className="font-medium text-brand-text-light">{selectedProject.packageName}</span>
                                        {(() => {
                                            const pkg = packages.find(p => p.id === selectedProject.packageId);
                                            if (pkg && pkg.digitalItems.length > 0) {
                                                return (
                                                    <div className="mt-1 text-xs text-brand-text-secondary space-y-0.5">
                                                        {pkg.digitalItems.map((item, index) => (
                                                            <div key={index}>- {item}</div>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                    <span className="text-brand-text-secondary">Add-ons</span> <span className="font-medium text-brand-text-light">{selectedProject.addOns.map(a => a.name).join(', ') || '-'}</span>
                                </div>

                                {/* Custom Costs Mobile */}
                                {(selectedProject.customCosts && selectedProject.customCosts.length > 0) && (
                                    <div className="mt-4 pt-4 border-t border-brand-border/30 space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Biaya Tambahan Terdaftar</p>
                                        {selectedProject.customCosts.map(cost => (
                                            <div key={cost.id} className="flex justify-between items-center text-sm">
                                                <span className="text-orange-400 font-medium">+ {cost.description}</span>
                                                <span className="text-orange-400 font-bold">{formatCurrency(cost.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}


                            </div>

                            <div className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3 pb-3 border-b border-brand-border/30">
                                    <h4 className="font-semibold text-brand-text-primary">Progres Acara Pernikahan Pengantin</h4>
                                    <div className="relative group">
                                        <select
                                            value={selectedProject.status}
                                            onChange={(e) => handleStatusUpdate(e.target.value)}
                                            className={`
                                                appearance-none
                                                px-3 py-1.5 pr-8
                                                text-[11px] font-bold 
                                                rounded-xl border-2
                                                bg-white/5 active:scale-95 transition-all
                                                cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent/50
                                                ${getStatusClass(selectedProject.status, profile.projectStatusConfig)}
                                            `}
                                        >
                                            {profile.projectStatusConfig.map(s => (
                                                <option key={s.id} value={s.name} className="bg-brand-surface text-brand-text-primary px-2">{s.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-light opacity-60">
                                            <ArrowDownIcon className="w-3 h-3" />
                                        </div>
                                    </div>
                                </div>

                                <h4 className="font-semibold text-brand-text-primary mb-1">Progres Pengerjaan Pengantin</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Tahapan detail dalam Progres Acara Pernikahan Pengantin saat ini</p>
                                {allSubStatusesForCurrentStatus.length > 0 ? (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {allSubStatusesForCurrentStatus.map(subStatus => {
                                            const isActive = selectedProject.activeSubStatuses?.includes(subStatus.name);

                                            return (
                                                <label
                                                    key={subStatus.name}
                                                    className={`
                                                            flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98]
                                                            ${isActive
                                                            ? 'bg-brand-accent/10 border-2 border-brand-accent shadow-sm'
                                                            : 'bg-brand-surface border border-brand-border hover:border-brand-accent/50'
                                                        }
                                                        `}
                                                >
                                                    <div className="flex-shrink-0">
                                                        <div className={`
                                                                w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                                                                ${isActive ? 'bg-brand-accent border-brand-accent' : 'border-brand-border bg-white/5'}
                                                            `}>
                                                            {isActive && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={isActive}
                                                            onChange={(e) => handleSubStatusToggle(subStatus.name, e.target.checked)}
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-grow">
                                                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-brand-text-light' : 'text-brand-text-secondary'}`}>{subStatus.name}</p>
                                                        {subStatus.note && <p className="text-[10px] text-brand-text-secondary line-clamp-1">{subStatus.note}</p>}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-brand-text-secondary">Tidak ada sub-status aktif.</p>
                                )}
                            </div>

                            {/* Output */}
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-white/5 border border-brand-border">
                                    <h5 className="font-semibold text-brand-text-primary text-sm mb-2">Vendor (Allpackage)</h5>
                                    <p className="text-[10px] text-brand-text-secondary mb-2">Rincian vendor dan item fisik</p>
                                    {(() => {
                                        const printingItems = selectedProject.printingDetails || [];
                                        if (printingItems.length > 0) {
                                            return (
                                                <ul className="divide-y divide-brand-border/60">
                                                    {printingItems.map(item => (
                                                        <li key={item.id} className="py-2 text-sm text-brand-text-light">
                                                            {item.customName || item.type}
                                                        </li>
                                                    ))}
                                                </ul>
                                            );
                                        }
                                        const pkg = packages.find(p => p.id === selectedProject.packageId);
                                        if (pkg && pkg.physicalItems && pkg.physicalItems.length > 0) {
                                            return (
                                                <ul className="list-disc list-inside text-sm space-y-1">
                                                    {pkg.physicalItems.map((it, idx) => (
                                                        <li key={idx} className="text-brand-text-light">{it.name}</li>
                                                    ))}
                                                </ul>
                                            );
                                        }
                                        return <p className="text-sm text-brand-text-secondary italic">Tidak ada rincian vendor.</p>;
                                    })()}
                                </div>
                                <div className="p-4 rounded-2xl bg-white/5 border border-brand-border">
                                    <h5 className="font-semibold text-brand-text-primary text-sm mb-2">Deskripsi Package</h5>
                                    <p className="text-[10px] text-brand-text-secondary mb-2">Rincian layanan dan deskripsi Package</p>
                                    {(() => {
                                        const pkg = packages.find(p => p.id === selectedProject.packageId);
                                        if (!pkg || pkg.digitalItems.length === 0) {
                                            return <p className="text-sm text-brand-text-secondary italic">Tidak ada deskripsi Package.</p>;
                                        }
                                        return (
                                            <div className="space-y-2 text-sm">
                                                {pkg.digitalItems.map((item, index) => (
                                                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-brand-bg">
                                                        <span className="text-brand-text-primary text-sm">{item}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Tim */}
                            <div className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                                <h4 className="font-semibold text-brand-text-primary mb-1">Tim & Vendor</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Tugas anggota tim dan vendor Acara Pernikahan</p>

                                {(['Tim', 'Vendor'] as const).map(category => (
                                    <div key={category} className="mb-6 last:mb-0">
                                        <h5 className={`text-sm font-bold uppercase tracking-wider mb-3 pb-1 border-b ${category === 'Tim' ? 'text-blue-400 border-blue-400/30' : 'text-purple-400 border-purple-400/30'}`}>
                                            {category === 'Tim' ? 'Tim Internal' : 'Vendor / Tim / Vendor'}
                                        </h5>

                                        {Object.entries(teamByCategory[category]).length > 0 ? (
                                            Object.entries(teamByCategory[category]).map(([role, members]) => (
                                                <div key={role} className="mb-4 last:mb-0">
                                                    <h6 className="text-[10px] uppercase text-brand-text-secondary mb-1.5 ml-1">{role}</h6>
                                                    <div className="space-y-2">
                                                        {members.map(member => (
                                                            <div key={member.memberId} className="p-3 bg-brand-bg rounded-lg flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-sm text-brand-text-light font-medium">{member.name}</p>
                                                                    {member.subJob && <p className="text-xs text-brand-text-secondary">{member.subJob}</p>}
                                                                </div>
                                                                <div className="text-right text-xs flex items-center gap-3">
                                                                    <span className="text-brand-text-secondary">Fee</span>
                                                                    <span className="font-semibold text-brand-text-primary">{formatCurrency(member.fee)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-brand-text-secondary italic ml-1">Belum ada {category === 'Tim' ? 'tim internal' : 'vendor'} yang ditugaskan.</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Catatan */}
                            {selectedProject.notes && (
                                <div className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                                    <h4 className="font-semibold text-brand-text-primary mb-1">Catatan</h4>
                                    <p className="text-xs text-brand-text-secondary mb-2">Catatan tambahan terkait Acara Pernikahan ini</p>
                                    <p className="text-sm text-brand-text-primary whitespace-pre-wrap">{selectedProject.notes}</p>
                                </div>
                            )}

                            {/* Aksi Cepat */}
                            <div className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                                <h4 className="font-semibold text-brand-text-primary mb-1">Aksi Cepat</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Tombol aksi untuk mengelola Acara Pernikahan dengan cepat</p>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => { handleOpenForm('edit', selectedProject); onClose(); }} className="button-secondary text-sm inline-flex items-center gap-2">
                                        <PencilIcon className="w-4 h-4" /> Edit Acara Pernikahan
                                    </button>
                                    <button type="button" onClick={handleOpenBriefingModal} className="button-secondary text-sm inline-flex items-center gap-2">
                                        <Share2Icon className="w-4 h-4" /> Briefing Tim
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Desktop (existing) */}
                        <div className="hidden md:block space-y-6">
                            <div className="text-sm space-y-2">
                                <p><strong className="font-semibold text-brand-text-secondary w-32 inline-block">Pengantin:</strong> {selectedProject.clientName}</p>
                                <p><strong className="font-semibold text-brand-text-secondary w-32 inline-block">Tanggal Acara Pernikahan:</strong> {formatDateFull(selectedProject.date)}</p>
                                <p><strong className="font-semibold text-brand-text-secondary w-32 inline-block">Lokasi:</strong> {selectedProject.location}</p>
                                <p><strong className="font-semibold text-brand-text-secondary w-32 inline-block">Alamat Lengkap:</strong> {selectedProject.address || '-'}</p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gradient mb-1">Rincian Package & Biaya</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Informasi Package dan rincian biaya tambahan</p>
                                <div className="p-4 bg-brand-bg rounded-xl border border-brand-border/30">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                                        <span className="text-brand-text-secondary">Package:</span>
                                        <div>
                                            <span className="font-medium text-brand-text-light">{selectedProject.packageName}</span>
                                            {(() => {
                                                const pkg = packages.find(p => p.id === selectedProject.packageId);
                                                if (pkg && pkg.digitalItems.length > 0) {
                                                    return (
                                                        <div className="mt-1 text-xs text-brand-text-secondary space-y-0.5">
                                                            {pkg.digitalItems.map((item, index) => (
                                                                <div key={index}>- {item}</div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <span className="text-brand-text-secondary">Add-ons:</span> <span className="font-medium text-brand-text-light">{selectedProject.addOns.map(a => a.name).join(', ') || '-'}</span>
                                    </div>

                                    {/* Custom Costs Desktop */}
                                    {(selectedProject.customCosts && selectedProject.customCosts.length > 0) && (
                                        <div className="pt-4 border-t border-brand-border/30 space-y-2 mb-4">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Biaya Tambahan Terdaftar</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {selectedProject.customCosts.map(cost => (
                                                    <div key={cost.id} className="flex justify-between items-center text-sm bg-orange-400/5 p-2 rounded-lg border border-orange-400/20">
                                                        <span className="text-orange-400 font-medium">+ {cost.description}</span>
                                                        <span className="text-orange-400 font-bold">{formatCurrency(cost.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}


                                </div>
                            </div>

                            <div>
                                <div className="flex items-center gap-4 mb-4 p-4 bg-brand-bg rounded-xl border border-brand-border/30">
                                    <strong className="font-semibold text-brand-text-secondary w-32 inline-block">Progres Acara Pernikahan Pengantin:</strong>
                                    <div className="relative inline-block w-64">
                                        <select
                                            value={selectedProject.status}
                                            onChange={(e) => handleStatusUpdate(e.target.value)}
                                            className={`
                                                    appearance-none
                                                    w-full px-4 py-2 pr-10
                                                    text-sm font-bold 
                                                    rounded-xl border-2
                                                    bg-white/5 hover:bg-white/10 active:scale-95 transition-all
                                                    cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent/50
                                                    ${getStatusClass(selectedProject.status, profile.projectStatusConfig)}
                                                `}
                                        >
                                            {profile.projectStatusConfig.map(s => (
                                                <option key={s.id} value={s.name} className="bg-brand-surface text-brand-text-primary px-3 py-2 text-base">{s.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-light opacity-60">
                                            <ArrowDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-brand-text-secondary italic">Pilih status untuk mengubah progres secara otomatis</p>
                                </div>

                                <h4 className="font-semibold text-gradient mb-1">Progres Pengerjaan Pengantin</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Tahapan detail dalam Progres Acara Pernikahan Pengantin saat ini</p>
                                {allSubStatusesForCurrentStatus.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-brand-bg rounded-lg max-h-80 overflow-y-auto">
                                        {allSubStatusesForCurrentStatus.map(subStatus => {
                                            const isActive = selectedProject.activeSubStatuses?.includes(subStatus.name);

                                            return (
                                                <label
                                                    key={subStatus.name}
                                                    className={`
                                                        flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98]
                                                        ${isActive
                                                            ? 'bg-brand-accent/10 border-2 border-brand-accent'
                                                            : 'bg-brand-surface border border-brand-border hover:border-brand-accent/50 text-brand-text-secondary'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex-shrink-0">
                                                        <div className={`
                                                            w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                                                            ${isActive ? 'bg-brand-accent border-brand-accent' : 'border-brand-border bg-white/5'}
                                                        `}>
                                                            {isActive && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={isActive}
                                                            onChange={(e) => handleSubStatusToggle(subStatus.name, e.target.checked)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold ${isActive ? 'text-brand-text-light' : 'group-hover:text-brand-text-light'}`}>{subStatus.name}</p>
                                                        {subStatus.note && <p className="text-xs text-brand-text-secondary">{subStatus.note}</p>}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-brand-text-secondary p-4 bg-brand-bg rounded-lg">Tidak ada sub-status untuk Progres Acara Pernikahan Pengantin saat ini.</p>
                                )}
                            </div>

                            <div>
                                <h4 className="font-semibold text-gradient mb-1">Rincian Package & Vendor</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Daftar rincian layanan dan vendor yang diterima (digital dan fisik)</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-brand-bg rounded-lg">
                                        <h5 className="font-semibold text-brand-text-primary text-sm mb-2">Vendor (Allpackage)</h5>
                                        {(() => {
                                            const printingItems = selectedProject.printingDetails || [];
                                            if (printingItems.length > 0) {
                                                return (
                                                    <ul className="space-y-2 text-sm">
                                                        {printingItems.map(item => (
                                                            <li key={item.id} className="flex justify-between items-center">
                                                                <span className="text-brand-text-light">{item.customName || item.type}</span>

                                                            </li>
                                                        ))}
                                                    </ul>
                                                );
                                            }
                                            const pkg = packages.find(p => p.id === selectedProject.packageId);
                                            if (pkg && pkg.physicalItems && pkg.physicalItems.length > 0) {
                                                return (
                                                    <ul className="space-y-1 text-sm list-disc list-inside">
                                                        {pkg.physicalItems.map((it, idx) => (
                                                            <li key={idx} className="text-brand-text-light">{it.name}</li>
                                                        ))}
                                                    </ul>
                                                );
                                            }
                                            return <p className="text-sm text-brand-text-secondary italic">Tidak ada rincian vendor.</p>;
                                        })()}
                                    </div>
                                    <div className="p-4 bg-brand-bg rounded-lg">
                                        <h5 className="font-semibold text-brand-text-primary text-sm mb-2">Deskripsi Package</h5>
                                        {(() => {
                                            const pkg = packages.find(p => p.id === selectedProject.packageId);
                                            if (!pkg || pkg.digitalItems.length === 0) {
                                                return <p className="text-sm text-brand-text-secondary italic">Tidak ada rincian layanan.</p>;
                                            }
                                            return (
                                                <div className="space-y-2 text-sm">
                                                    {pkg.digitalItems.map((item, index) => (
                                                        <div key={index} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-brand-input">
                                                            <span className="text-sm text-brand-text-primary">{item}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gradient mb-1">Tim & Vendor Tugas</h4>
                                <p className="text-xs text-brand-text-secondary mb-4">Pembagian tugas tim internal dan vendor/Tim / Vendor untuk Acara Pernikahan ini</p>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {(['Tim', 'Vendor'] as const).map(category => (
                                        <div key={category} className="space-y-4">
                                            <h5 className={`font-bold uppercase tracking-widest text-xs pb-2 border-b-2 flex items-center gap-2 ${category === 'Tim' ? 'text-blue-400 border-blue-400/20' : 'text-purple-400 border-purple-400/20'}`}>
                                                <div className={`w-2 h-2 rounded-full ${category === 'Tim' ? 'bg-blue-400' : 'bg-purple-400'}`}></div>
                                                {category === 'Tim' ? 'Tim Internal' : 'Vendor / Tim / Vendor'}
                                            </h5>

                                            <div className="space-y-5">
                                                {Object.entries(teamByCategory[category]).length > 0 ? (
                                                    Object.entries(teamByCategory[category]).map(([role, members]) => (
                                                        <div key={role}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <h6 className="font-semibold text-brand-text-secondary text-[10px] uppercase tracking-wider">{role}</h6>
                                                                <div className="h-px flex-grow bg-brand-border/40"></div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {members.map(member => (
                                                                    <div key={member.memberId} className="p-3 bg-brand-bg rounded-xl flex justify-between items-center border border-transparent hover:border-brand-border/50 transition-colors">
                                                                        <div>
                                                                            <p className="text-sm text-brand-text-light font-medium">{member.name}</p>
                                                                            {member.subJob && <p className="text-[10px] text-brand-text-secondary mt-0.5">{member.subJob}</p>}
                                                                        </div>
                                                                        <div className="text-[10px] flex items-center gap-4">
                                                                            {(() => {
                                                                                const payment = teamProjectPayments.find(p => p.projectId === selectedProject.id && p.teamMemberId === member.memberId);
                                                                                const isPaid = payment?.status === 'Paid';
                                                                                return (
                                                                                    <span className={`px-2 py-1 rounded-full font-semibold border ${isPaid ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
                                                                                        {isPaid ? 'Lunas' : 'Belum dibayar'}
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                            <div className="text-right">
                                                                                <p className="text-brand-text-secondary opacity-60">Fee</p>
                                                                                <p className="font-semibold text-brand-text-primary">{formatCurrency(member.fee)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-8 text-center bg-brand-bg/30 rounded-2xl border border-dashed border-brand-border">
                                                        <p className="text-xs text-brand-text-secondary italic">Belum ada {category === 'Tim' ? 'tim internal' : 'vendor'} bertugas.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedProject.notes && (
                                <div>
                                    <h4 className="font-semibold text-gradient mb-1">Catatan</h4>
                                    <p className="text-xs text-brand-text-secondary mb-3">Catatan tambahan terkait Acara Pernikahan ini</p>
                                    <div className="p-4 bg-brand-bg rounded-lg">
                                        <p className="text-sm text-brand-text-primary whitespace-pre-wrap">{selectedProject.notes}</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="font-semibold text-gradient mb-1">Aksi Cepat</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Tombol aksi untuk mengelola Acara Pernikahan dengan cepat</p>
                                <div className="p-4 bg-brand-bg rounded-lg flex items-center gap-3">
                                    <button type="button" onClick={() => { handleOpenForm('edit', selectedProject); onClose(); }} className="button-secondary text-sm inline-flex items-center gap-2">
                                        <PencilIcon className="w-4 h-4" /> Edit Acara Pernikahan
                                    </button>
                                    <button type="button" onClick={handleOpenBriefingModal} className="button-secondary text-sm inline-flex items-center gap-2">
                                        <Share2Icon className="w-4 h-4" /> Bagikan Briefing Tim
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
                {detailTab === 'files' && (
                    <div className="space-y-4 tab-content-mobile">
                        {/* Mobile */}
                        <div className="md:hidden space-y-3">
                            <div className="rounded-2xl bg-white/5 border border-brand-border p-4">
                                <h4 className="font-semibold text-brand-text-primary mb-2">File & Tautan</h4>
                                <div className="divide-y divide-brand-border/60 text-sm">
                                    <div className="py-3 flex items-center justify-between">
                                        <span className="text-brand-text-secondary">Brief/Moodboard</span>
                                        {selectedProject.driveLink ? <a href={selectedProject.driveLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold">Buka</a> : <span className="text-brand-text-secondary">N/A</span>}
                                    </div>
                                    <div className="py-3 flex items-center justify-between">
                                        <span className="text-brand-text-secondary">File dari Pengantin</span>
                                        {selectedProject.clientDriveLink ? <a href={selectedProject.clientDriveLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold">Buka</a> : <span className="text-brand-text-secondary">N/A</span>}
                                    </div>
                                    <div className="py-3 flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-brand-text-secondary">File Jadi</span>
                                            <div className="flex gap-3">
                                                {!isEditingFinalLink && (
                                                    <button onClick={() => { setTempFinalLink(selectedProject.finalDriveLink || ''); setIsEditingFinalLink(true); }} className="text-xs text-brand-accent hover:underline flex items-center gap-1">
                                                        <PencilIcon className="w-3 h-3" /> Edit
                                                    </button>
                                                )}
                                                {selectedProject.finalDriveLink && (
                                                    <a href={selectedProject.finalDriveLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 font-semibold">Buka</a>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {isEditingFinalLink ? (
                                            <div className="flex items-center gap-2 mt-2">
                                                <input type="url" value={tempFinalLink} onChange={e => setTempFinalLink(e.target.value)} placeholder="https://..." className="flex-1 w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-brand-surface text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all" />
                                                <button onClick={handleSaveFinalLink} className="text-xs px-3 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors whitespace-nowrap">Simpan</button>
                                                <button onClick={() => setIsEditingFinalLink(false)} className="text-xs px-2 py-2 text-brand-text-secondary hover:text-brand-text-light">Batal</button>
                                            </div>
                                        ) : (
                                            selectedProject.finalDriveLink ? (
                                                <div className="mt-1">
                                                    <button onClick={handleSendFinalLink} className="w-full text-xs py-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1">
                                                        <SendIcon className="w-3 h-3" /> Kirim via WA
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-brand-text-secondary">Belum tersedia. Klik Edit untuk menambahkan.</span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Desktop existing */}
                        <div className="hidden md:block">
                            <h4 className="font-semibold text-gradient mb-2">File & Tautan Penting</h4>
                            <div className="p-4 bg-brand-bg rounded-lg space-y-3 text-sm">
                                <div className="flex justify-between items-center py-2 border-b border-brand-border"><span className="text-brand-text-secondary">Link Moodboard/Brief (Internal)</span>{selectedProject.driveLink ? <a href={selectedProject.driveLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-semibold">Buka Tautan</a> : <span className="text-brand-text-secondary">N/A</span>}</div>
                                <div className="flex justify-between items-center py-2 border-b border-brand-border"><span className="text-brand-text-secondary">Link File dari Pengantin</span>{selectedProject.clientDriveLink ? <a href={selectedProject.clientDriveLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-semibold">Buka Tautan</a> : <span className="text-brand-text-secondary">N/A</span>}</div>
                                <div className="py-2 border-t border-brand-border">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-brand-text-secondary">Link File Jadi (untuk Pengantin)</span>
                                        {!isEditingFinalLink && (
                                            <div className="flex gap-3 items-center">
                                                {selectedProject.finalDriveLink && (
                                                    <button onClick={handleSendFinalLink} className="text-xs py-1.5 px-3 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors flex items-center gap-1">
                                                        <SendIcon className="w-3 h-3" /> Kirim WhatsApp
                                                    </button>
                                                )}
                                                <button onClick={() => { setTempFinalLink(selectedProject.finalDriveLink || ''); setIsEditingFinalLink(true); }} className="text-xs text-brand-accent hover:underline flex items-center gap-1">
                                                    <PencilIcon className="w-3 h-3" /> Edit Link
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isEditingFinalLink ? (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input type="url" value={tempFinalLink} onChange={e => setTempFinalLink(e.target.value)} placeholder="https://drive.google.com/..." className="flex-1 px-3 py-2 text-sm rounded-lg border border-brand-border bg-brand-surface text-brand-text-primary focus:outline-none focus:ring-1 focus:ring-brand-accent transition-all" />
                                            <button onClick={handleSaveFinalLink} className="text-xs px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors">Simpan</button>
                                            <button onClick={() => setIsEditingFinalLink(false)} className="text-xs px-3 py-2 text-brand-text-secondary hover:text-brand-text-light">Batal</button>
                                        </div>
                                    ) : (
                                        selectedProject.finalDriveLink ? (
                                            <a href={selectedProject.finalDriveLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-semibold text-sm break-all">{selectedProject.finalDriveLink}</a>
                                        ) : (
                                            <div className="text-sm text-brand-text-secondary italic">Belum tersedia. Klik Edit Link untuk menambahkan.</div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const Projects: React.FC<ProjectsProps> = ({ projects, setProjects, clients, packages, teamMembers, teamProjectPayments, setTeamProjectPayments, transactions, setTransactions, initialAction, setInitialAction, profile, showNotification, cards, setCards, pockets, setPockets, totals }) => {
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [chatModalData, setChatModalData] = useState<{ project: Project; client: Client } | null>(null);
    const [sharePreview, setSharePreview] = useState<SharePreviewData>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | 'all'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');

    // UI/UX Improvement States
    const [quickStatusModalOpen, setQuickStatusModalOpen] = useState(false);
    const [selectedProjectForStatus, setSelectedProjectForStatus] = useState<Project | null>(null);

    const initialFormState = useMemo(() => ({
        id: '',
        clientId: '',
        projectName: '',
        clientName: '',
        projectType: '',
        packageName: '',
        status: profile.projectStatusConfig.find(s => s.name === 'Persiapan')?.name || profile.projectStatusConfig[0]?.name || '',
        activeSubStatuses: [] as string[],
        customSubStatuses: [] as SubStatusConfig[],
        customCosts: [] as { id: string, description: string, amount: string | number }[],
        location: '',
        date: new Date().toISOString().split('T')[0],
        deadlineDate: '',
        team: [] as AssignedTeamMember[],
        notes: '',
        driveLink: '',
        clientDriveLink: '',
        finalDriveLink: '',
        startTime: '',
        endTime: '',
        shippingDetails: '',
        printingDetails: [] as PrintingItem[],
        printingCost: 0,
        address: '',
        // duration/unit price for packages that offer durationOptions
        durationSelection: undefined as string | undefined,
        unitPrice: undefined as number | undefined,
    }), [profile]);

    const [formData, setFormData] = useState(initialFormState);

    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);

    const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
    const [briefingText, setBriefingText] = useState('');
    const [whatsappLink, setWhatsappLink] = useState('');
    const [googleCalendarLink, setGoogleCalendarLink] = useState('');
    const [icsDataUri, setIcsDataUri] = useState('');

    const [activeStatModal, setActiveStatModal] = useState<string | null>(null);
    const [offset, setOffset] = useState(100);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const loadMoreProjects = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const { listProjectsWithRelations } = await import('../../services/projects');
            const nextProjects = await listProjectsWithRelations({ limit: 100, offset });
            if (nextProjects.length < 100) {
                setHasMore(false);
            }
            if (nextProjects.length > 0) {
                setProjects(prev => {
                    // Filter out duplicates just in case
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = nextProjects.filter(p => !existingIds.has(p.id));
                    return [...prev, ...uniqueNew];
                });
                setOffset(prev => prev + 100);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error('[Projects] Failed to load more projects:', e);
            showNotification('Gagal memuat lebih banyak Acara Pernikahan.');
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Calculate stats for modals
    const allActiveProjectsForStats = useMemo(() => projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan'), [projects]);
    const statsForModal = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);
        const deadlineSoonProjects = allActiveProjectsForStats.filter(p => {
            const d = new Date(p.deadlineDate || p.date);
            d.setHours(0, 0, 0, 0);
            return d >= today && d <= in7Days;
        });
        const projectTypeCounts = projects.reduce((acc, p) => {
            acc[p.projectType] = (acc[p.projectType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const topProjectType = Object.keys(projectTypeCounts).length > 0
            ? Object.entries(projectTypeCounts).sort(([, a], [, b]) => b - a)[0][0]
            : 'N/A';
        const statusCounts = allActiveProjectsForStats.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const topStatus = Object.keys(statusCounts).length > 0
            ? Object.entries(statusCounts).sort(([, a], [, b]) => b - a)[0][0]
            : 'N/A';
        return { activeCount: allActiveProjectsForStats.length, deadlineSoonProjects, topProjectType, topStatus };
    }, [allActiveProjectsForStats, projects]);

    const [activeSectionOpen, setActiveSectionOpen] = useState(true);
    const [completedSectionOpen, setCompletedSectionOpen] = useState(false);

    // Keep selectedProject in sync when projects list updates
    useEffect(() => {
        if (!selectedProject) return;
        const updated = projects.find(p => p.id === selectedProject.id);
        if (updated && updated !== selectedProject) {
            // Preserve richer fields from selectedProject (e.g., team) if the incoming snapshot lacks them
            const merged = {
                ...updated,
                team: (updated as any).team && (updated as any).team.length > 0 ? (updated as any).team : (selectedProject as any).team,
            } as Project;
            setSelectedProject(merged);
        }
    }, [projects, selectedProject?.id]);

    const handleOpenDetailModal = (project: Project) => {
        // Open immediately with available data
        setSelectedProject(project);
        setIsDetailModalOpen(true);

        // Fetch fresh data in background
        (async () => {
            try {
                const fresh = await getProjectWithRelations(project.id);
                if (fresh) {
                    setSelectedProject(fresh);
                    setProjects(prev => prev.map(p => p.id === project.id ? fresh : p));
                }
            } catch (err) {
                console.warn('[Projects] Background fetch failed for detail:', err);
            }
        })();
    };

    useEffect(() => {
        if (initialAction && initialAction.type === 'VIEW_PROJECT_DETAILS' && initialAction.id) {
            const projectToView = projects.find(p => p.id === initialAction.id);
            if (projectToView) {
                handleOpenDetailModal(projectToView);
            }
            setInitialAction(null);
        }
    }, [initialAction, projects, setInitialAction]);

    const teamByCategory = useMemo(() => {
        return teamMembers.reduce((acc, member) => {
            const category = member.category || 'Tim';
            if (!acc[category]) acc[category] = {};
            if (!acc[category][member.role]) acc[category][member.role] = [];
            acc[category][member.role].push(member);
            return acc;
        }, { 'Tim': {}, 'Vendor': {} } as Record<string, Record<string, TeamMember[]>>);
    }, [teamMembers]);

    const filteredProjects = useMemo(() => {
        return projects
            .filter(p => viewMode === 'kanban' || statusFilter === 'all' || p.status === statusFilter)
            .filter(p => p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) || p.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(p => {
                if (!dateFrom && !dateTo) return true;
                const d = new Date(p.date);
                d.setHours(0, 0, 0, 0);
                if (dateFrom) {
                    const from = new Date(dateFrom);
                    from.setHours(0, 0, 0, 0);
                    if (d < from) return false;
                }
                if (dateTo) {
                    const to = new Date(dateTo);
                    to.setHours(23, 59, 59, 999);
                    if (d > to) return false;
                }
                return true;
            });
    }, [projects, searchTerm, statusFilter, viewMode, dateFrom, dateTo]);

    const allActiveProjects = useMemo(() => projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan'), [projects]);
    const activeProjects = useMemo(() => filteredProjects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan'), [filteredProjects]);
    const completedAndCancelledProjects = useMemo(() => filteredProjects.filter(p => p.status === 'Selesai' || p.status === 'Dibatalkan'), [filteredProjects]);

    const modalData = useMemo<StatModalData | null>(() => {
        if (!activeStatModal) return null;

        const activeProjectsList = projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);

        switch (activeStatModal) {
            case 'count':
                return {
                    title: 'Daftar Acara Pernikahan Aktif',
                    items: activeProjectsList.map(p => ({
                        id: p.id,
                        primary: p.projectName,
                        secondary: p.clientName,
                        value: p.status
                    })),
                    total: null
                };
            case 'deadline':
                const deadlineSoonList = activeProjectsList.filter(p => {
                    const d = new Date(p.deadlineDate || p.date);
                    d.setHours(0, 0, 0, 0);
                    return d >= today && d <= in7Days;
                });
                return {
                    title: 'Acara Pernikahan dengan Deadline Dekat',
                    items: deadlineSoonList.map(p => ({
                        id: p.id,
                        primary: p.projectName,
                        secondary: p.clientName,
                        value: new Date(p.deadlineDate || p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    })),
                    total: null
                };
            case 'status_dist':
                const statusCounts = activeProjectsList.reduce((acc, p) => {
                    acc[p.status] = (acc[p.status] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
                const topStatus = Object.keys(statusCounts).length > 0
                    ? Object.entries(statusCounts).sort(([, a], [, b]) => b - a)[0][0]
                    : 'N/A';
                const statusProjects = activeProjectsList.filter(p => p.status === topStatus);
                return {
                    title: `Acara Pernikahan dengan Status: ${topStatus}`,
                    items: statusProjects.map(p => ({
                        id: p.id,
                        primary: p.projectName,
                        secondary: p.clientName,
                        value: p.status
                    })),
                    total: null
                };
            case 'top_type':
                const projectTypeCounts = projects.reduce((acc, p) => {
                    acc[p.projectType] = (acc[p.projectType] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const topProjectType = Object.keys(projectTypeCounts).length > 0
                    ? Object.entries(projectTypeCounts).sort(([, a], [, b]) => b - a)[0][0]
                    : 'N/A';

                const topTypeProjects = projects.filter(p => p.projectType === topProjectType);

                return {
                    title: `Daftar Acara Pernikahan Jenis: ${topProjectType}`,
                    items: topTypeProjects.map((p: Project) => ({
                        id: p.id,
                        primary: p.projectName,
                        secondary: p.clientName,
                        value: p.projectType
                    })),
                    total: null
                };
            default:
                return null;
        }
    }, [activeStatModal, projects]);


    const handleOpenForm = (mode: 'add' | 'edit', project?: Project) => {
        setFormMode(mode);
        if (mode === 'edit' && project) {
            // Internal function to create form data object
            const createFormData = (current: Project): any => {
                const { addOns, paymentStatus, amountPaid, totalCost, progress, packageId, dpProofUrl, ...operationalData } = current;
                const statusConfig = profile.projectStatusConfig.find(s => s.name === current.status);
                const subStatuses = current.customSubStatuses ?? statusConfig?.subStatuses ?? [];
                
                let printingDetailsBase = (current.printingDetails || []) as PrintingItem[];
                if (!printingDetailsBase || printingDetailsBase.length === 0) {
                    const pkg = packages.find(p => (p as any).id === (current as any).packageId || p.name === current.packageName);
                    if (pkg && Array.isArray(pkg.physicalItems) && pkg.physicalItems.length > 0) {
                        printingDetailsBase = pkg.physicalItems.map((it, idx) => ({
                            id: `pi-${current.id}-${idx}`,
                            type: 'Custom' as const,
                            customName: it.name,
                            details: '',
                            cost: Number(it.price || 0),
                            paymentStatus: 'Unpaid' as const,
                        }));
                    }
                }
                const printingDetailsWithStatus = (printingDetailsBase || []).map(item => ({ ...item, paymentStatus: item.paymentStatus || 'Unpaid' }));

                return {
                    ...initialFormState,
                    ...operationalData,
                    date: (current.date || initialFormState.date).split('T')[0],
                    deadlineDate: current.deadlineDate ? current.deadlineDate.split('T')[0] : '',
                    startTime: current.startTime ? current.startTime.split(':').slice(0, 2).join(':') : '',
                    endTime: current.endTime ? current.endTime.split(':').slice(0, 2).join(':') : '',
                    location: current.location || '',
                    notes: current.notes || '',
                    clientDriveLink: current.clientDriveLink || '',
                    finalDriveLink: current.finalDriveLink || '',
                    shippingDetails: current.shippingDetails || '',
                    address: current.address || '',
                    durationSelection: (current as any).durationSelection || '',
                    unitPrice: (current as any).unitPrice,
                    // relations
                    team: (current.team || []).map((t: AssignedTeamMember) => ({
                        memberId: t.memberId,
                        name: t.name,
                        role: t.role,
                        fee: t.fee,
                        subJob: t.subJob,
                    })),
                    activeSubStatuses: current.activeSubStatuses || [],
                    customSubStatuses: subStatuses,
                    // extras passed through by services.createProject (printingDetails/customCosts handled in update step below if needed)
                };
            };

            // Populate mapping from existing project first (immediate)
            let projectToUse = project;
            // Fallback enrichment if needed
            if (!projectToUse.team || projectToUse.team.length === 0) {
                const payments = teamProjectPayments.filter(p => p.projectId === projectToUse.id);
                if (payments.length > 0) {
                    const enrichedTeam = payments.map(p => {
                        const tm = teamMembers.find(m => m.id === p.teamMemberId);
                        return {
                            memberId: p.teamMemberId,
                            name: p.teamMemberName,
                            role: tm?.role || 'Tim',
                            fee: p.fee,
                        } as AssignedTeamMember;
                    });
                    projectToUse = { ...projectToUse, team: enrichedTeam } as Project;
                }
            }
            setFormData(createFormData(projectToUse));

            // Fetch fresh in background
            (async () => {
                try {
                    const fresh = await getProjectWithRelations(project.id);
                    if (fresh) {
                        setFormData(prev => {
                            if (prev.id === fresh.id) {
                                // Background update
                                return createFormData(fresh);
                            }
                            return prev;
                        });
                        setProjects(prev => prev.map(p => p.id === project.id ? fresh : p));
                    }
                } catch (err) {
                    console.warn('[Projects] Background fetch failed for edit form:', err);
                }
            })();
        } else {
            setFormData({ ...initialFormState, projectType: profile.projectTypes[0] || '' });
        }
        setIsFormModalOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormModalOpen(false);
        setFormData(initialFormState);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
            return;
        }

        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'status') {
                newState.activeSubStatuses = [];
                // When status changes, populate customSubStatuses from the new status template
                const statusConfig = profile.projectStatusConfig.find(s => s.name === value);
                newState.customSubStatuses = statusConfig?.subStatuses || [];
                if (value !== 'Dikirim') {
                    newState.shippingDetails = '';
                }
            }
            return newState;
        });
    };

    const handleSubStatusChange = (option: string, isChecked: boolean) => {
        setFormData(prev => {
            const currentSubStatuses = prev.activeSubStatuses || [];
            if (isChecked) {
                return { ...prev, activeSubStatuses: [...currentSubStatuses, option] };
            } else {
                return { ...prev, activeSubStatuses: currentSubStatuses.filter(s => s !== option) };
            }
        });
    };

    const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const clientId = e.target.value;
        const client = clients.find(c => c.id === clientId);
        if (client) {
            setFormData(prev => ({
                ...prev,
                clientId: client.id,
                clientName: client.name,
                projectName: prev.projectName || `Acara Pernikahan ${client.name}`
            }));
        }
    };

    const handleTeamChange = (member: TeamMember) => {
        setFormData(prev => {
            const isSelected = prev.team.some(t => t.memberId === member.id);
            if (isSelected) {
                return {
                    ...prev,
                    team: prev.team.filter(t => t.memberId !== member.id)
                }
            } else {
                const newTeamMember: AssignedTeamMember = {
                    memberId: member.id,
                    name: member.name,
                    role: member.role,
                    fee: member.standardFee,
                };
                return {
                    ...prev,
                    team: [...prev.team, newTeamMember]
                }
            }
        });
    };

    const handleTeamFeeChange = (memberId: string, newFee: number) => {
        setFormData(prev => ({
            ...prev,
            team: prev.team.map(t => t.memberId === memberId ? { ...t, fee: newFee } : t)
        }));
    };



    const handleTeamSubJobChange = (memberId: string, subJob: string) => {
        setFormData(prev => ({
            ...prev,
            team: prev.team.map(t => t.memberId === memberId ? { ...t, subJob: subJob } : t)
        }));
    };

    const handleTeamClientPortalLinkChange = (memberId: string, link: string) => {
        setFormData(prev => ({
            ...prev,
            team: prev.team.map((t: any) => t.memberId === memberId ? { ...t, clientPortalLink: link } : t)
        }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ensureOnlineOrNotify(showNotification)) return;
        let projectData: Project;

        const clientIdsToSync = new Set<string>();

        if (formMode === 'add') {
            // Persist new project to Supabase
            const sanitized = sanitizeProjectData({ ...initialFormState, ...formData });
            try {
                const created = await createProjectWithRelations({
                    projectName: sanitized.projectName,
                    clientName: sanitized.clientName,
                    clientId: sanitized.clientId,
                    projectType: sanitized.projectType,
                    packageName: sanitized.packageName,
                    date: sanitized.date,
                    location: sanitized.location,
                    status: sanitized.status,
                    progress: 0,
                    totalCost: 0,
                    amountPaid: 0,
                    paymentStatus: PaymentStatus.BELUM_BAYAR,
                    bookingStatus: sanitized.bookingStatus,
                    notes: sanitized.notes,
                    accommodation: sanitized.accommodation,
                    driveLink: sanitized.driveLink,
                    promoCodeId: sanitized.promoCodeId,
                    discountAmount: sanitized.discountAmount,
                    printingCost: sanitized.printingCost,
                    address: sanitized.address,
                    addOns: (sanitized.addOns || []).map((a: AddOn) => ({ id: a.id, name: a.name, price: a.price })),
                    // Persist explicit duration/unit price if provided
                    durationSelection: sanitized.durationSelection,
                    unitPrice: sanitized.unitPrice,
                    // relations
                    team: (sanitized.team || []).map((t: AssignedTeamMember) => ({
                        memberId: t.memberId,
                        name: t.name,
                        role: t.role,
                        fee: t.fee,
                        subJob: t.subJob,
                    })),
                    activeSubStatuses: sanitized.activeSubStatuses,
                    customSubStatuses: sanitized.customSubStatuses,
                    // extras passed through by services.createProject (printingDetails/customCosts handled in update step below if needed)
                } as any);
                projectData = created;
                if (projectData?.clientId) clientIdsToSync.add(projectData.clientId);
            } catch (err) {
                console.warn('[Projects] Failed to create project in Supabase:', err);
                showNotification(!navigator.onLine ? 'Harus online untuk melakukan perubahan' : 'Gagal membuat Acara Pernikahan. Coba lagi.');
                return;
            }
        } else { // edit mode
            const originalProject = projects.find(p => p.id === formData.id);
            if (!originalProject) return;

            // If the project is reassigned to a different client, sync both old & new.
            if (originalProject.clientId) clientIdsToSync.add(originalProject.clientId);

            const oldPrintingCost = originalProject.printingCost || 0;
            const oldCustomCostsTotal = (originalProject.customCosts || []).reduce((sum, c) => sum + c.amount, 0);

            const newPrintingCost = Number(formData.printingCost) || 0;
            const newCustomCosts = (formData.customCosts || [])
                .filter((c: any) => c.description && Number(c.amount) > 0)
                .map((c: any) => ({ ...c, id: c.id || `cc-${Date.now()}`, amount: Number(c.amount) }));
            const newCustomCostsTotal = newCustomCosts.reduce((sum, c) => sum + c.amount, 0);

            const costDifference = (newPrintingCost - oldPrintingCost) + (newCustomCostsTotal - oldCustomCostsTotal);

            const newTotalCost = originalProject.totalCost + costDifference;
            const newAmountPaid = originalProject.amountPaid;
            const newPaymentStatus = newAmountPaid >= newTotalCost ? PaymentStatus.LUNAS : (newAmountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);

            projectData = {
                ...originalProject,
                ...formData,
                customCosts: newCustomCosts,
                printingCost: newPrintingCost,
                totalCost: newTotalCost,
                paymentStatus: newPaymentStatus,
            };

            if (projectData?.clientId) clientIdsToSync.add(projectData.clientId);
            // Persist to Supabase
            try {
                await updateProjectInDb(projectData.id, {
                    projectName: projectData.projectName,
                    clientName: projectData.clientName,
                    clientId: projectData.clientId,
                    projectType: projectData.projectType,
                    packageName: projectData.packageName,
                    date: projectData.date,
                    deadlineDate: projectData.deadlineDate as any,
                    location: projectData.location,
                    status: projectData.status,
                    progress: projectData.progress,
                    totalCost: projectData.totalCost,
                    amountPaid: projectData.amountPaid,
                    paymentStatus: projectData.paymentStatus,
                    notes: projectData.notes,
                    accommodation: projectData.accommodation,
                    driveLink: projectData.driveLink,
                    clientDriveLink: projectData.clientDriveLink as any,
                    finalDriveLink: projectData.finalDriveLink as any,
                    startTime: projectData.startTime as any,
                    endTime: projectData.endTime as any,
                    discountAmount: projectData.discountAmount,
                    printingDetails: projectData.printingDetails as any,
                    customCosts: projectData.customCosts as any,
                    printingCost: projectData.printingCost,
                    address: projectData.address as any,
                    transportPaid: projectData.transportPaid as any,
                    transportNote: projectData.transportNote as any,
                    printingCardId: projectData.printingCardId as any,
                    transportCardId: projectData.transportCardId as any,
                    completedDigitalItems: projectData.completedDigitalItems,
                    dpProofUrl: projectData.dpProofUrl,
                    shippingDetails: projectData.shippingDetails as any,
                    // Persist duration/unit if present
                    durationSelection: (projectData as any).durationSelection,
                    unitPrice: (projectData as any).unitPrice,
                    activeSubStatuses: projectData.activeSubStatuses as any,
                    customSubStatuses: projectData.customSubStatuses as any,
                    confirmedSubStatuses: projectData.confirmedSubStatuses as any,
                    clientSubStatusNotes: projectData.clientSubStatusNotes as any,
                    subStatusConfirmationSentAt: projectData.subStatusConfirmationSentAt as any,
                    invoiceSignature: projectData.invoiceSignature as any,
                } as any);

                // Persist team assignments to Supabase (delete+insert strategy)
                try {
                    await upsertAssignmentsForProject(projectData.id, (projectData.team || []).map((t: AssignedTeamMember) => ({
                        memberId: t.memberId,
                        name: t.name,
                        role: t.role,
                        fee: t.fee,
                        subJob: t.subJob,
                    })));
                } catch (teamErr) {
                    console.warn('[Projects] Failed to persist team assignments:', teamErr);
                }
            } catch (err) {
                console.warn('[Projects] Failed to update project in Supabase:', err);
                showNotification(!navigator.onLine ? 'Harus online untuk melakukan perubahan' : 'Gagal menyimpan perubahan Acara Pernikahan. Coba lagi.');
                return;
            }

            // Persist cost changes as transactions in Supabase
            const paymentCardId = cards.find(c => c.id !== 'CARD_CASH')?.id;
            if (paymentCardId) {
                const fieldsToProcess: ('printingCost')[] = [];
                if (originalProject.printingCost !== projectData.printingCost) fieldsToProcess.push('printingCost');

                for (const field of fieldsToProcess) {
                    const cost = projectData[field] || 0;
                    const oldCost = originalProject[field] || 0;
                    const costDiff = cost - oldCost;
                    const category = field === 'printingCost' ? 'Produksi Fisik' : 'Transportasi';
                    const description = `${category} - ${projectData.projectName}`;

                    // Try to find an existing cost transaction in local state for this project+category+description
                    const existingTx = transactions.find(t => t.projectId === projectData.id && t.category === category && t.description === description);

                    try {
                        if (existingTx) {
                            if (cost > 0) {
                                // Update existing transaction amount
                                const updated = await updateTransactionRow(existingTx.id, { amount: cost });
                                // Adjust card by the delta
                                if (costDiff !== 0) await updateCardBalance(paymentCardId, -Math.abs(costDiff) * Math.sign(costDiff));
                                // Update local cache
                                setTransactions(prev => prev.map(tx => tx.id === existingTx.id ? updated : tx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                                setCards(prev => prev.map(c => c.id === paymentCardId ? { ...c, balance: c.balance - costDiff } : c));
                            } else {
                                // Remove transaction and refund card by oldCost
                                await deleteTransactionRow(existingTx.id);
                                await updateCardBalance(paymentCardId, Math.abs(oldCost));
                                setTransactions(prev => prev.filter(tx => tx.id !== existingTx.id));
                                setCards(prev => prev.map(c => c.id === paymentCardId ? { ...c, balance: c.balance + oldCost } : c));
                            }
                        } else if (cost > 0) {
                            // Create new transaction and decrease card by full cost
                            const created = await createTransaction({
                                date: new Date().toISOString().split('T')[0],
                                description,
                                amount: cost,
                                type: TransactionType.EXPENSE,
                                projectId: projectData.id,
                                category,
                                method: 'Sistem',
                                cardId: paymentCardId,
                            } as any);
                            await updateCardBalance(paymentCardId, -Math.abs(cost));
                            setTransactions(prev => [created, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                            setCards(prev => prev.map(c => c.id === paymentCardId ? { ...c, balance: c.balance - cost } : c));
                        }
                    } catch (e) {
                        console.warn('[Projects] Failed to persist cost transaction:', e);
                        // Non-fatal: continue with other fields
                    }
                }
            }
        }

        const allTeamMembersOnProject = projectData.team;
        const otherProjectPayments = teamProjectPayments.filter(p => p.projectId !== projectData.id);
        const existingProjectPayments = teamProjectPayments.filter(p => p.projectId === projectData.id);
        const existingPaymentsByMemberId = new Map(existingProjectPayments.map(p => [p.teamMemberId, p] as const));

        const newProjectPaymentEntries: TeamProjectPayment[] = allTeamMembersOnProject.map(teamMember => {
            const prev = existingPaymentsByMemberId.get(teamMember.memberId);
            const isPaid = prev?.status === 'Paid';
            return {
                id: prev?.id || crypto.randomUUID(),
                projectId: projectData.id,
                teamMemberName: isPaid ? (prev?.teamMemberName || teamMember.name) : teamMember.name,
                teamMemberId: teamMember.memberId,
                date: isPaid ? (prev?.date || projectData.date) : projectData.date,
                status: isPaid ? 'Paid' : 'Unpaid',
                fee: isPaid ? (prev?.fee || teamMember.fee) : teamMember.fee,
            };
        });

        // Persist team payments to Supabase so they survive reloads
        let persistedPayments = newProjectPaymentEntries;
        try {
            persistedPayments = await upsertTeamPaymentsForProject(projectData.id, newProjectPaymentEntries);
        } catch (e) {
            console.warn('[Projects] Failed to persist team payments:', e);
        }
        setTeamProjectPayments([...otherProjectPayments, ...persistedPayments]);

        if (formMode === 'add') {
            setProjects(prev => [projectData, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } else {
            setProjects(prev => prev.map(p => p.id === projectData.id ? projectData : p).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }

        // Keep client status in sync with active projects.
        if (clientIdsToSync.size > 0) {
            try {
                await Promise.all(Array.from(clientIdsToSync).map(id => syncClientStatusFromProjects(id)));
            } catch (e) {
                console.warn('[Projects] Failed to sync client status from projects:', e);
            }
        }

        handleCloseForm();
    };

    const handleProjectDelete = async (projectId: string) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus Acara Pernikahan ini? Semua data terkait (termasuk tugas tim dan transaksi) akan dihapus.")) {
            if (!ensureOnlineOrNotify(showNotification)) return;
            try {
                await deleteProjectInDb(projectId);
            } catch (err) {
                console.warn('[Projects] Failed to delete project in Supabase:', err);
                showNotification(!navigator.onLine ? 'Harus online untuk melakukan perubahan' : 'Gagal menghapus Acara Pernikahan di server. Coba lagi.');
                return;
            }
            setProjects(prev => prev.filter(p => p.id !== projectId));
            setTeamProjectPayments(prev => prev.filter(fp => fp.projectId !== projectId));
            setTransactions(prev => prev.filter(t => t.projectId !== projectId));
        }
    };

    const handleOpenBriefingModal = (project: Project) => {
        setSelectedProject(project);
        const date = new Date(project.date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const teamList = project.team.length > 0
            ? project.team.map(t => `- ${t.name}`).join('\n')
            : 'Tim belum ditugaskan.';

        const parts = [];
        parts.push(`${date}`);
        parts.push(`*${project.projectName}*`);
        parts.push(`\n*Tim Bertugas:*\n${teamList}`);

        if (project.startTime || project.endTime || project.location) parts.push('');

        if (project.startTime) parts.push(`*Waktu Mulai:* ${project.startTime}`);
        if (project.endTime) parts.push(`*Waktu Selesai:* ${project.endTime}`);
        if (project.location) parts.push(`*Lokasi :* ${project.location}`);

        if (project.notes) {
            parts.push('');
            parts.push(`*Catatan:*\n${project.notes}`);
        }

        if (project.location || project.driveLink) parts.push('');

        if (project.location) {
            const mapsQuery = encodeURIComponent(project.location);
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
            parts.push(`*Link Lokasi:*\n${mapsLink}`);
        }

        if (project.driveLink) {
            if (project.location) parts.push('');
            parts.push(`*Link Moodboard:*\n${project.driveLink}`);
        }

        if (profile.briefingTemplate) {
            parts.push('\n---\n');
            parts.push(profile.briefingTemplate);
        }

        const text = parts.join('\n').replace(/\n\n\n+/g, '\n\n').trim();

        setBriefingText(text);
        setWhatsappLink(`whatsapp://send?text=${encodeURIComponent(text)}`);

        const toGoogleCalendarFormat = (date: Date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
        const timeRegex = /(\d{2}:\d{2})/;
        const startTimeMatch = project.startTime?.match(timeRegex);
        const endTimeMatch = project.endTime?.match(timeRegex);

        let googleLink = '';
        let icsDataUri = '';

        if (startTimeMatch) {
            const projectDateOnly = project.date.split('T')[0];
            const startDate = new Date(`${projectDateOnly}T${startTimeMatch[1]}:00`);
            const isInternalEvent = profile.eventTypes.includes(project.projectType);
            const durationHours = isInternalEvent ? 2 : 8;

            const endDate = endTimeMatch
                ? new Date(`${projectDateOnly}T${endTimeMatch[1]}:00`)
                : new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

            const googleDates = `${toGoogleCalendarFormat(startDate)}/${toGoogleCalendarFormat(endDate)}`;

            const calendarDescription = `Briefing untuk ${project.projectName}:\n\n${text}`;

            googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(project.projectName)}&dates=${googleDates}&details=${encodeURIComponent(calendarDescription)}&location=${encodeURIComponent(project.location || '')}`;

            const icsDescription = calendarDescription.replace(/\n/g, '\\n');
            icsDataUri = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'BEGIN:VEVENT',
                `UID:${project.id}@venapictures.com`,
                `DTSTAMP:${toGoogleCalendarFormat(new Date())}`,
                `DTSTART:${toGoogleCalendarFormat(startDate)}`,
                `DTEND:${toGoogleCalendarFormat(endDate)}`,
                `SUMMARY:${project.projectName}`,
                `DESCRIPTION:${icsDescription}`,
                `LOCATION:${project.location || ''}`,
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\n');
        }

        setGoogleCalendarLink(googleLink);
        setIcsDataUri(icsDataUri);

        setIsBriefingModalOpen(true);
    };


    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, projectId: string) => {
        e.dataTransfer.setData("projectId", projectId);
        setDraggedProjectId(projectId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
        e.preventDefault();
        const projectId = e.dataTransfer.getData("projectId");
        const projectToUpdate = projects.find(p => p.id === projectId);

        if (projectToUpdate && projectToUpdate.status !== newStatus) {
            const nextProgress = getProgressForStatus(newStatus, profile.projectStatusConfig);
            try {
                await updateProjectInDb(projectToUpdate.id, {
                    status: newStatus as any,
                    progress: nextProgress as any,
                    activeSubStatuses: [] as any,
                } as any);
                setProjects(prevProjects =>
                    prevProjects.map(p =>
                        p.id === projectId ? { ...p, status: newStatus, progress: nextProgress, activeSubStatuses: [] } : p
                    )
                );

                try {
                    await syncClientStatusFromProjects(projectToUpdate.clientId);
                } catch (e) {
                    console.warn('[Projects] Failed to sync client status from projects:', e);
                }
                showNotification(`Status "${projectToUpdate.projectName}" diubah ke "${newStatus}"`);
            } catch (err) {
                console.warn('[Projects] Failed to persist status change to Supabase:', err);
                showNotification('Gagal memperbarui Progres Acara Pernikahan Pengantin di server. Coba lagi.');
            }
        }
        setDraggedProjectId(null);
    };
    const handleCustomSubStatusChange = (index: number, field: 'name' | 'note', value: string) => {
        setFormData(prev => {
            const newCustomSubStatuses = [...(prev.customSubStatuses || [])];
            const oldName = newCustomSubStatuses[index]?.name;
            newCustomSubStatuses[index] = { ...newCustomSubStatuses[index], [field]: value };

            if (field === 'name' && oldName && (prev.activeSubStatuses || []).includes(oldName)) {
                const newActiveSubStatuses = (prev.activeSubStatuses || []).map(name => name === oldName ? value : name);
                return { ...prev, customSubStatuses: newCustomSubStatuses, activeSubStatuses: newActiveSubStatuses };
            }

            return { ...prev, customSubStatuses: newCustomSubStatuses };
        });
    };

    const addCustomSubStatus = () => {
        setFormData(prev => ({
            ...prev,
            customSubStatuses: [...(prev.customSubStatuses || []), { name: '', note: '' }]
        }));
    };

    const removeCustomSubStatus = (index: number) => {
        setFormData(prev => {
            const customSubStatuses = prev.customSubStatuses || [];
            const subStatusToRemove = customSubStatuses[index];
            const newCustomSubStatuses = customSubStatuses.filter((_, i) => i !== index);

            let newActiveSubStatuses = prev.activeSubStatuses || [];
            if (subStatusToRemove) {
                newActiveSubStatuses = newActiveSubStatuses.filter(name => name !== subStatusToRemove.name);
            }

            return {
                ...prev,
                customSubStatuses: newCustomSubStatuses,
                activeSubStatuses: newActiveSubStatuses
            };
        });
    };

    const handlePayForPrintingItem = async (projectId: string, printingItemId: string, sourceCardId: string, sourcePocketId?: string) => {
        const project = projects.find(p => p.id === projectId) || (selectedProject && selectedProject.id === projectId ? selectedProject : null);
        // Resolve current list of printing items: prefer project, fallback to the open form
        const formIsForThisProject = !!(formData?.id && formData.id === projectId);
        const currentItems: PrintingItem[] = (project?.printingDetails && project.printingDetails.length > 0)
            ? (project.printingDetails as PrintingItem[])
            : (formIsForThisProject && Array.isArray(formData.printingDetails) ? (formData.printingDetails as PrintingItem[]) : []);

        const printingItem = currentItems.find(item => item.id === printingItemId);

        // Determine payment source: pocket or card
        const isFromPocket = !!sourcePocketId;
        const sourcePocket = isFromPocket ? pockets.find(p => p.id === sourcePocketId) : null;
        const sourceCard = !isFromPocket ? cards.find(c => c.id === sourceCardId) : null;

        if (!printingItem || (!sourcePocket && !sourceCard)) {
            showNotification("Error: Data tidak lengkap untuk memproses pembayaran.");
            return;
        }

        // Check balance
        if (isFromPocket && sourcePocket) {
            if (sourcePocket.amount < printingItem.cost) {
                showNotification(`Error: Saldo di kantong ${sourcePocket.name} tidak mencukupi.`);
                return;
            }
        } else if (sourceCard) {
            if (sourceCard.balance < printingItem.cost) {
                showNotification(`Error: Saldo di ${sourceCard.bankName} tidak mencukupi.`);
                return;
            }
        }

        try {
            // 1) Create expense transaction in DB
            const created = await createTransaction({
                date: new Date().toISOString().split('T')[0],
                description: `Biaya Produksi Fisik: ${printingItem.customName || printingItem.type} - Acara Pernikahan ${project?.projectName || (formIsForThisProject ? formData.projectName : 'Acara Pernikahan')}`,
                amount: printingItem.cost,
                type: TransactionType.EXPENSE,
                projectId: projectId,
                category: 'Produksi Fisik',
                method: 'Sistem',
                cardId: isFromPocket ? undefined : sourceCardId,
                pocketId: isFromPocket ? sourcePocketId : undefined,
                printingItemId: printingItemId,
            } as any);

            // 2) Decrease balance in DB (card or pocket)
            if (isFromPocket && sourcePocketId) {
                const { updatePocket } = await import('../../services/pockets');
                await updatePocket(sourcePocketId, { amount: sourcePocket!.amount - printingItem.cost });
            } else if (sourceCardId) {
                await updateCardBalance(sourceCardId, -Math.abs(printingItem.cost));
            }

            // 3) Persist project printingDetails paymentStatus change
            const updatedPrintingDetails = (currentItems || []).map(item =>
                item.id === printingItemId ? { ...item, paymentStatus: 'Paid' as 'Paid' } : item
            );
            await updateProjectInDb(projectId, { printingDetails: updatedPrintingDetails } as any);

            // 4) Optimistically update local UI state
            setTransactions(prev => [created, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            if (isFromPocket && sourcePocketId) {
                setPockets(prev => prev.map(p => p.id === sourcePocketId ? { ...p, amount: p.amount - printingItem.cost } : p));
            } else if (sourceCardId) {
                setCards(prev => prev.map(c => c.id === sourceCardId ? { ...c, balance: c.balance - printingItem.cost } : c));
            }

            if (project) {
                setProjects(prevProjects => prevProjects.map(p => {
                    if (p.id === projectId) {
                        return { ...p, printingDetails: updatedPrintingDetails } as Project;
                    }
                    return p;
                }));
            }
            setFormData(prev => {
                const updatedPrintingDetailsForm = (prev.printingDetails || []).map((item: PrintingItem) =>
                    item.id === printingItemId ? { ...item, paymentStatus: 'Paid' as 'Paid' } : item
                );
                return { ...prev, printingDetails: updatedPrintingDetailsForm };
            });

            const sourceName = isFromPocket ? sourcePocket!.name : sourceCard!.bankName;
            showNotification(`Pembayaran untuk "${printingItem.customName || printingItem.type}" berhasil dari ${sourceName}.`);
        } catch (err) {
            console.warn('[Projects] Failed to process printing payment:', err);
            showNotification('Gagal memproses pembayaran produksi fisik di server. Coba lagi.');
        }
    };

    // UI/UX Improvement Handlers
    const handleQuickStatusChange = async (
        projectId: string,
        newStatus: string,
        notifyClient: boolean
    ) => {
        try {
            const project = projects.find(p => p.id === projectId);
            if (!project) return;

            const nextProgress = getProgressForStatus(newStatus, profile.projectStatusConfig);
            const updated = {
                ...project,
                status: newStatus,
                progress: nextProgress,
                activeSubStatuses: [],
            } as Project;
            await updateProjectInDb(projectId, {
                status: newStatus,
                progress: nextProgress,
                activeSubStatuses: [],
            } as any);

            setProjects(prev => prev.map(p => p.id === projectId ? updated : p));

            try {
                await syncClientStatusFromProjects(project.clientId);
            } catch (e) {
                console.warn('[Projects] Failed to sync client status from projects:', e);
            }

            if (notifyClient) {
                // TODO: Implement client notification
                console.log('Notifying client about status change:', newStatus);
            }

            showNotification(`Status berhasil diubah ke "${newStatus}"`);
        } catch (error) {
            console.error('Quick status change error:', error);
            showNotification('Gagal mengubah status');
        }
    };

    const handleSendMessage = (project: Project) => {
        const client = clients.find(c => c.id === project.clientId);
        if (!client) return;
        setChatModalData({ project, client });
    };

    return (
        <div className="space-y-8">
            <PageHeader title="Acara Pernikahan Wedding" subtitle="Lacak semua Acara Pernikahan dari awal hingga selesai.">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsInfoModalOpen(true)} className="button-secondary">Pelajari Halaman Ini</button>
                    <button onClick={() => handleOpenForm('add')} className="button-primary inline-flex items-center gap-2">
                        <PlusIcon className="w-5 h-5" />
                        Tambah Acara Pernikahan
                    </button>
                </div>
            </PageHeader>

            <div className="space-y-6">
                <ProjectAnalytics
                    projects={projects}
                    projectStatusConfig={profile.projectStatusConfig}
                    totals={totals}
                    onStatCardClick={setActiveStatModal}
                />

                <div className="bg-brand-surface p-3 md:p-4 rounded-xl shadow-lg border border-brand-border flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
                    <div className="input-group flex-grow !mt-0 w-full md:w-auto">
                        <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-2 md:p-2.5 text-sm" placeholder=" " />
                        <label className="input-label text-sm">Cari Acara Pernikahan atau pengantin...</label>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <CalendarIcon className="w-4 h-4 text-brand-text-secondary flex-shrink-0" />
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-2 md:p-2.5 text-sm w-full md:w-40" title="Dari tanggal" />
                        </div>
                        <span className="text-brand-text-secondary text-sm hidden md:inline">–</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-2 md:p-2.5 text-sm w-full md:w-40" title="Sampai tanggal" />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-2 md:p-2.5 text-sm w-full md:w-48">
                            <option value="all">Semua Status</option>
                            {profile.projectStatusConfig.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        <div className="p-0.5 md:p-1 bg-brand-bg rounded-lg flex items-center h-fit w-full md:w-auto">
                            <button onClick={() => setViewMode('list')} className={`flex-1 md:flex-none flex justify-center p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-brand-surface shadow-sm text-brand-text-light' : 'text-brand-text-secondary'}`}><ListIcon className="w-4 h-4 md:w-5 md:h-5" /></button>
                            <button onClick={() => setViewMode('kanban')} className={`flex-1 md:flex-none flex justify-center p-1.5 md:p-2 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-brand-surface shadow-sm text-brand-text-light' : 'text-brand-text-secondary'}`}><LayoutGridIcon className="w-4 h-4 md:w-5 md:h-5" /></button>
                        </div>
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <div className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border">
                        <div className="p-3 md:p-4 border-b border-brand-border">
                            <button onClick={() => setActiveSectionOpen(p => !p)} className="w-full flex justify-between items-center">
                                <h3 className="text-sm md:text-base font-semibold text-brand-text-light">Acara Pernikahan Aktif ({activeProjects.length})</h3>
                                {activeSectionOpen ? <ArrowUpIcon className="w-4 h-4 md:w-5 md:h-5 text-brand-text-secondary" /> : <ArrowDownIcon className="w-4 h-4 md:w-5 md:h-5 text-brand-text-secondary" />}
                            </button>
                        </div>
                        {activeSectionOpen && <ProjectListView projects={activeProjects} handleOpenDetailModal={handleOpenDetailModal} handleOpenForm={handleOpenForm} handleProjectDelete={handleProjectDelete} config={profile.projectStatusConfig} clients={clients} handleQuickStatusChange={handleQuickStatusChange} handleSendMessage={handleSendMessage} hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMoreProjects} />}
                        <div className="p-3 md:p-4 border-t border-brand-border">
                            <button onClick={() => setCompletedSectionOpen(p => !p)} className="w-full flex justify-between items-center">
                                <h3 className="text-sm md:text-base font-semibold text-brand-text-light">Acara Pernikahan Selesai & Dibatalkan ({completedAndCancelledProjects.length})</h3>
                                {completedSectionOpen ? <ArrowUpIcon className="w-4 h-4 md:w-5 md:h-5 text-brand-text-secondary" /> : <ArrowDownIcon className="w-4 h-4 md:w-5 md:h-5 text-brand-text-secondary" />}
                            </button>
                        </div>
                        {completedSectionOpen && <ProjectListView projects={completedAndCancelledProjects} handleOpenDetailModal={handleOpenDetailModal} handleOpenForm={handleOpenForm} handleProjectDelete={handleProjectDelete} config={profile.projectStatusConfig} clients={clients} handleQuickStatusChange={handleQuickStatusChange} handleSendMessage={handleSendMessage} hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMoreProjects} />}
                    </div>
                ) : (
                    <ProjectKanbanView projects={filteredProjects} handleOpenDetailModal={handleOpenDetailModal} draggedProjectId={draggedProjectId} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} config={profile.projectStatusConfig} />
                )}
            </div>

            <ProjectForm
                isOpen={isFormModalOpen}
                onClose={handleCloseForm}
                mode={formMode}
                formData={formData}
                onFormChange={handleFormChange}
                onSubStatusChange={handleSubStatusChange}
                onClientChange={handleClientChange}
                onTeamChange={handleTeamChange}
                onTeamFeeChange={handleTeamFeeChange}

                onTeamSubJobChange={handleTeamSubJobChange}
                onTeamClientPortalLinkChange={handleTeamClientPortalLinkChange}
                onCustomSubStatusChange={handleCustomSubStatusChange}
                onAddCustomSubStatus={addCustomSubStatus}
                onRemoveCustomSubStatus={removeCustomSubStatus}
                onSubmit={handleFormSubmit}
                clients={clients}
                teamMembers={teamMembers}
                teamProjectPayments={teamProjectPayments}
                profile={profile}
                teamByCategory={teamByCategory}
                showNotification={showNotification}
                setFormData={setFormData}
            />

            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Detail Acara Pernikahan: ${selectedProject?.projectName}`} size="3xl">
                <ProjectDetailModal
                    selectedProject={selectedProject}
                    setSelectedProject={setSelectedProject}
                    teamMembers={teamMembers}
                    clients={clients}
                    profile={profile}
                    showNotification={showNotification}
                    projects={projects}
                    setProjects={setProjects}
                    onClose={() => setIsDetailModalOpen(false)}
                    handleOpenForm={handleOpenForm}
                    handleProjectDelete={handleProjectDelete}
                    handleOpenBriefingModal={() => {
                        if (selectedProject) handleOpenBriefingModal(selectedProject);
                    }}
                    packages={packages}
                    transactions={transactions}
                    teamProjectPayments={teamProjectPayments}
                    cards={cards}
                    onOpenSharePreview={(data) => setSharePreview({ title: data.title, message: data.message, phone: data.phone })}
                />
            </Modal>

            <Modal isOpen={isBriefingModalOpen} onClose={() => setIsBriefingModalOpen(false)} title="Bagikan Briefing Acara Pernikahan" size="2xl">
                {selectedProject && (
                    <div className="space-y-4">
                        <textarea value={briefingText} readOnly rows={15} className="input-field w-full text-sm"></textarea>
                        <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-brand-border">
                            {icsDataUri && <a href={icsDataUri} download={`${selectedProject.projectName}.ics`} className="button-secondary text-sm">Download .ICS</a>}
                            {googleCalendarLink && <a href={googleCalendarLink} target="_blank" rel="noopener noreferrer" className="button-secondary text-sm">Tambah ke Google Calendar</a>}
                            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="button-primary inline-flex items-center gap-2">
                                <SendIcon className="w-4 h-4" /> Bagikan ke WhatsApp
                            </a>
                        </div>
                    </div>
                )}
            </Modal>

            {/* StatCard Detail Modals - Fokus detil pekerjaan */}
            <StatCardModal
                isOpen={activeStatModal === 'count'}
                onClose={() => setActiveStatModal(null)}
                icon={<FolderKanbanIcon className="w-6 h-6" />}
                title="Acara Pernikahan Aktif"
                value={String(statsForModal.activeCount)}
                subtitle="Acara Pernikahan yang sedang berjalan"
                colorVariant="blue"
                description={`Jumlah Acara Pernikahan yang sedang aktif.\n\nTotal: ${statsForModal.activeCount} Acara Pernikahan`}
            >
                <div className="space-y-3">
                    <h4 className="font-semibold text-brand-text-light border-b border-brand-border pb-2">Daftar Acara Pernikahan Aktif</h4>
                    {allActiveProjectsForStats.slice(0, 10).map(project => (
                        <div key={project.id} className="p-3 bg-brand-bg rounded-lg hover:bg-brand-input transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <p className="font-semibold text-brand-text-light text-sm">{project.projectName}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent">{project.status}</span>
                            </div>
                            <p className="text-xs text-brand-text-secondary">{clients.find(c => c.id === project.clientId)?.name}</p>
                        </div>
                    ))}
                    {allActiveProjectsForStats.length > 10 && (
                        <p className="text-xs text-brand-text-secondary text-center pt-2">Dan {allActiveProjectsForStats.length - 10} Acara Pernikahan lainnya...</p>
                    )}
                </div>
            </StatCardModal>

            <StatCardModal
                isOpen={activeStatModal === 'deadline'}
                onClose={() => setActiveStatModal(null)}
                icon={<ClockIcon className="w-6 h-6" />}
                title="Deadline Dekat"
                value={String(statsForModal.deadlineSoonProjects.length)}
                subtitle="Acara Pernikahan jatuh tempo 7 hari ke depan"
                colorVariant="orange"
                description={`Acara Pernikahan dengan deadline dalam 7 hari ke depan: ${statsForModal.deadlineSoonProjects.length} Acara Pernikahan`}
            >
                <div className="space-y-3">
                    <h4 className="font-semibold text-brand-text-light border-b border-brand-border pb-2">Acara Pernikahan Mendekati Deadline</h4>
                    {statsForModal.deadlineSoonProjects.length > 0 ? statsForModal.deadlineSoonProjects.map(project => (
                        <div key={project.id} className="p-3 bg-brand-bg rounded-lg hover:bg-brand-input transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <p className="font-semibold text-brand-text-light text-sm">{project.projectName}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500">
                                    {new Date(project.deadlineDate || project.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                            <p className="text-xs text-brand-text-secondary">{clients.find(c => c.id === project.clientId)?.name}</p>
                        </div>
                    )) : (
                        <p className="text-sm text-brand-text-secondary py-4 text-center">Tidak ada Acara Pernikahan dengan deadline dalam 7 hari ke depan</p>
                    )}
                </div>
            </StatCardModal>

            <StatCardModal
                isOpen={activeStatModal === 'status_dist'}
                onClose={() => setActiveStatModal(null)}
                icon={<CheckSquareIcon className="w-6 h-6" />}
                title="Status Terbanyak"
                value={statsForModal.topStatus}
                subtitle="Progres Acara Pernikahan Pengantin paling banyak saat ini"
                colorVariant="purple"
                description={`Status paling banyak: ${statsForModal.topStatus}`}
            >
                <div className="space-y-3">
                    <h4 className="font-semibold text-brand-text-light border-b border-brand-border pb-2">Acara Pernikahan dengan Status: {statsForModal.topStatus}</h4>
                    {allActiveProjectsForStats.filter(p => p.status === statsForModal.topStatus).slice(0, 10).map(project => (
                        <div key={project.id} className="p-3 bg-brand-bg rounded-lg hover:bg-brand-input transition-colors">
                            <p className="font-semibold text-brand-text-light text-sm">{project.projectName}</p>
                            <p className="text-xs text-brand-text-secondary">{clients.find(c => c.id === project.clientId)?.name}</p>
                        </div>
                    ))}
                    {allActiveProjectsForStats.filter(p => p.status === statsForModal.topStatus).length > 10 && (
                        <p className="text-xs text-brand-text-secondary text-center pt-2">Dan {allActiveProjectsForStats.filter(p => p.status === statsForModal.topStatus).length - 10} Acara Pernikahan lainnya...</p>
                    )}
                </div>
            </StatCardModal>

            <StatCardModal
                isOpen={activeStatModal === 'top_type'}
                onClose={() => setActiveStatModal(null)}
                icon={<FolderKanbanIcon className="w-6 h-6" />}
                title="Jenis Acara Pernikahan Teratas"
                value={statsForModal.topProjectType}
                subtitle="Jenis paling banyak dikerjakan"
                colorVariant="purple"
                description={`Jenis Acara Pernikahan yang paling sering Anda kerjakan.\n\nJenis Teratas: ${statsForModal.topProjectType}\n\nInformasi ini membantu Anda memahami spesialisasi bisnis dan fokus pemasaran.`}
            >
                <div className="space-y-3">
                    <h4 className="font-semibold text-brand-text-light border-b border-brand-border pb-2">Distribusi Jenis Acara Pernikahan</h4>
                    {Object.entries(
                        projects.reduce((acc, p) => {
                            acc[p.projectType] = (acc[p.projectType] || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>)
                    ).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                        <div key={type} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                            <p className="font-semibold text-brand-text-light text-sm">{type}</p>
                            <span className="text-sm text-brand-accent font-semibold">{count} Acara Pernikahan</span>
                        </div>
                    ))}
                </div>
            </StatCardModal>

            {/* UI/UX Improvement: Quick Status Modal */}
            <QuickStatusModal
                isOpen={quickStatusModalOpen}
                onClose={() => {
                    setQuickStatusModalOpen(false);
                    setSelectedProjectForStatus(null);
                }}
                project={selectedProjectForStatus}
                statusConfig={profile.projectStatusConfig}
                onStatusChange={handleQuickStatusChange}
                showNotification={showNotification}
            />
            {chatModalData && (
                <ChatModal
                    isOpen={!!chatModalData}
                    onClose={() => setChatModalData(null)}
                    project={chatModalData.project}
                    client={chatModalData.client}
                    userProfile={profile}
                    onSendMessage={(projectId, messageText) => {
                        setSharePreview({
                            title: `Bagikan Pesan - ${chatModalData.client.name}`,
                            message: messageText,
                            phone: chatModalData.client.whatsapp || chatModalData.client.phone,
                        });
                    }}
                />
            )}

            {sharePreview && (
                <ShareMessageModal
                    isOpen={!!sharePreview}
                    onClose={() => setSharePreview(null)}
                    title={sharePreview.title}
                    initialMessage={sharePreview.message}
                    phone={sharePreview.phone}
                    showNotification={showNotification}
                />
            )}
        </div>
    );
};

export default Projects;