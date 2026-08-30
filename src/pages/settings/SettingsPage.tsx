import React, { useEffect, useState, useCallback } from 'react';
import { Profile, Transaction, Project, User, ViewType, ProjectStatusConfig, SubStatusConfig, Package, ChatTemplate, ChecklistTemplate } from '../../types';
import PageHeader from '../../layouts/PageHeader';
import Modal from '../../shared/ui/Modal';
import { PencilIcon, PlusIcon, Trash2Icon, KeyIcon, UsersIcon, ListIcon, FolderKanbanIcon, FileTextIcon, SettingsIcon, MessageSquareIcon, RefreshCwIcon, NAV_ITEMS, DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_PROJECT_TYPES, DEFAULT_EVENT_TYPES, DEFAULT_PACKAGE_CATEGORIES, DEFAULT_PROJECT_STATUS_SUGGESTIONS, DEFAULT_BRIEFING_TEMPLATE, DEFAULT_TERMS_AND_CONDITIONS, DEFAULT_PACKAGE_SHARE_TEMPLATE, DEFAULT_BOOKING_FORM_TEMPLATE, CHAT_TEMPLATES, DEFAULT_BILLING_TEMPLATES, DEFAULT_INVOICE_SHARE_TEMPLATE, DEFAULT_RECEIPT_SHARE_TEMPLATE, DEFAULT_EXPENSE_SHARE_TEMPLATE, DEFAULT_PORTAL_SHARE_TEMPLATE } from '../../constants';
import { upsertProfile } from '../../services/profile';
import { createUser, updateUser, deleteUser } from '../../services/users';
import { validateTemplate, processTemplate } from '../../services/chatTemplatesOffline';
import { DEFAULT_CHECKLIST_TEMPLATES } from '../../services/weddingDayChecklist';

// Helper Component for Toggle Switches
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void; id?: string }> = ({ enabled, onChange, id }) => (
    <button
        type="button"
        id={id}
        className={`${enabled ? 'bg-brand-accent' : 'bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-surface`}
        onClick={onChange}
    >
        <span
            className={`${enabled ? 'translate-x-5' : 'translate-x-0'} inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

// Reusable UI component for managing a list of categories
const CategoryManager: React.FC<{
    title: string;
    categories: string[];
    inputValue: string;
    onInputChange: (value: string) => void;
    onAddOrUpdate: () => void;
    onEdit: (value: string) => void;
    onDelete: (value: string) => void;
    editingValue: string | null;
    onCancelEdit: () => void;
    placeholder: string;
    /** Opsi saran default untuk mempermudah input; jika ada, tombol "Tambah dari saran" ditampilkan */
    suggestedDefaults?: string[];
    onAddSuggested?: () => void;
}> = ({ title, categories, inputValue, onInputChange, onAddOrUpdate, onEdit, onDelete, editingValue, onCancelEdit, placeholder, suggestedDefaults, onAddSuggested }) => {

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onAddOrUpdate();
        }
    };

    const renderCategoryItem = (category: string) => (
        <div key={category} className="flex items-center justify-between p-2 md:p-2.5 bg-brand-bg rounded-md">
            <span className="text-xs md:text-sm text-brand-text-primary truncate flex-1 mr-2">{category}</span>
            <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
                <button type="button" onClick={() => onEdit(category)} className="p-1 text-brand-text-secondary hover:text-brand-accent" title="Edit"><PencilIcon className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                <button type="button" onClick={() => onDelete(category)} className="p-1 text-brand-text-secondary hover:text-brand-danger" title="Hapus"><Trash2Icon className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
            </div>
        </div>
    );

    return (
        <div>
            <h3 className="text-sm md:text-lg font-semibold text-brand-text-light border-b border-gray-700/50 pb-2 md:pb-3 mb-3 md:mb-4">{title}</h3>
            <div className="flex flex-col sm:flex-row gap-2 mb-3 md:mb-4">
                <div className="input-group flex-grow !mt-0">
                    <input
                        type="text"
                        id={`input-${title.replace(/\s/g, '')}`}
                        value={inputValue}
                        onChange={e => onInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder=" "
                        className="input-field"
                    />
                    <label htmlFor={`input-${title.replace(/\s/g, '')}`} className="input-label">{placeholder}</label>
                </div>
                <div className="flex gap-2">
                    <button onClick={onAddOrUpdate} className="button-primary h-fit mt-2 flex-1 sm:flex-none">{editingValue ? 'Update' : 'Tambah'}</button>
                    {editingValue && <button onClick={onCancelEdit} className="button-secondary h-fit mt-2 flex-1 sm:flex-none">Batal</button>}
                </div>
            </div>
            {suggestedDefaults?.length && onAddSuggested && (
                <div className="mb-3 md:mb-4">
                    <button type="button" onClick={onAddSuggested} className="text-xs md:text-sm text-brand-accent hover:underline">
                        + Tambah dari saran default
                    </button>
                </div>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {categories && categories.length > 0 ? categories.map(cat => renderCategoryItem(cat)) : (
                    <div className="text-center text-brand-text-secondary text-sm py-4">
                        Belum ada {title.toLowerCase()}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-component for Project Status Management ---
const ProjectStatusManager: React.FC<{
    config: ProjectStatusConfig[];
    onConfigChange: (newConfig: ProjectStatusConfig[]) => void;
    projects: Project[];
    profile: Profile;
    onAddDefaultStatuses?: () => void;
}> = ({ config, onConfigChange, projects, profile, onAddDefaultStatuses }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [selectedStatus, setSelectedStatus] = useState<ProjectStatusConfig | null>(null);

    const initialFormState = {
        name: '',
        color: '#64748b',
        note: '',
        defaultProgress: undefined as number | undefined,
        subStatuses: [] as SubStatusConfig[],
    };
    const [form, setForm] = useState(initialFormState);

    const handleOpenModal = (mode: 'add' | 'edit', status?: ProjectStatusConfig) => {
        setModalMode(mode);
        if (mode === 'edit' && status) {
            setSelectedStatus(status);
            setForm({
                name: status.name,
                color: status.color,
                note: status.note,
                defaultProgress: (status as any).defaultProgress,
                subStatuses: [...status.subStatuses],
            });
        } else {
            setSelectedStatus(null);
            setForm(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'defaultProgress') {
            const num = value === '' ? undefined : Math.max(0, Math.min(100, Math.round(Number(value))));
            setForm(prev => ({ ...prev, [name]: num }));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubStatusChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newSubStatuses = [...form.subStatuses];
        newSubStatuses[index] = { ...newSubStatuses[index], [name]: value };
        setForm(prev => ({ ...prev, subStatuses: newSubStatuses }));
    };

    const addSubStatus = () => {
        setForm(prev => ({ ...prev, subStatuses: [...prev.subStatuses, { name: '', note: '' }] }));
    };

    const removeSubStatus = (index: number) => {
        const newSubStatuses = [...form.subStatuses];
        newSubStatuses.splice(index, 1);
        setForm(prev => ({ ...prev, subStatuses: newSubStatuses }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (modalMode === 'add') {
            const newStatus: ProjectStatusConfig = {
                id: crypto.randomUUID(),
                ...form,
                subStatuses: form.subStatuses.filter(s => s.name.trim() !== '')
            };
            const newConfig = [...config, newStatus];
            onConfigChange(newConfig);
            // Save to Supabase
            try {
                await upsertProfile({ id: profile.id, projectStatusConfig: newConfig } as any);
            } catch (err: any) {
                console.error('[Settings] Save project status config failed:', err);
                alert('Gagal menyimpan Progres Acara Pernikahan Pengantin: ' + (err?.message || 'Coba lagi.'));
            }
        } else if (selectedStatus) {
            const updatedConfig = config.map(s =>
                s.id === selectedStatus.id ? { ...s, ...form, subStatuses: form.subStatuses.filter(sub => sub.name.trim() !== '') } : s
            );
            onConfigChange(updatedConfig);
            // Save to Supabase
            try {
                await upsertProfile({ id: profile.id, projectStatusConfig: updatedConfig } as any);
            } catch (err: any) {
                console.error('[Settings] Update project status config failed:', err);
                alert('Gagal mengupdate Progres Acara Pernikahan Pengantin: ' + (err?.message || 'Coba lagi.'));
            }
        }
        handleCloseModal();
    };

    const handleDelete = async (statusId: string) => {
        const status = config.find(s => s.id === statusId);
        if (!status) return;

        const isUsed = projects.some(p => p.status === status.name);
        if (isUsed) {
            alert(`Status "${status.name}" tidak dapat dihapus karena sedang digunakan oleh Acara Pernikahan.`);
            return;
        }

        if (window.confirm(`Yakin ingin menghapus status "${status.name}"?`)) {
            const newConfig = config.filter(s => s.id !== statusId);
            onConfigChange(newConfig);
            // Save to Supabase
            try {
                await upsertProfile({ id: profile.id, projectStatusConfig: newConfig } as any);
            } catch (err: any) {
                console.error('[Settings] Delete project status config failed:', err);
                alert('Gagal menghapus Progres Acara Pernikahan Pengantin: ' + (err?.message || 'Coba lagi.'));
            }
        }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
                <h3 className="text-sm md:text-lg font-semibold text-brand-text-light">Manajemen Progres Acara Pernikahan Pengantin</h3>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {onAddDefaultStatuses && (
                        <button onClick={onAddDefaultStatuses} className="button-secondary inline-flex items-center gap-2 text-sm md:text-base">
                            + Tambah dari saran default
                        </button>
                    )}
                    <button onClick={() => handleOpenModal('add')} className="button-primary inline-flex items-center gap-2 w-full sm:w-auto text-sm md:text-base">
                        <PlusIcon className="w-4 h-4 md:w-5 md:h-5" /> Tambah Status
                    </button>
                </div>
            </div>
            <div className="space-y-3 md:space-y-4">
                {config.map(status => (
                    <div key={status.id} className="p-3 md:p-4 bg-brand-bg rounded-lg">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 md:gap-3">
                                <span className="w-3 h-3 md:w-4 md:h-4 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }}></span>
                                <span className="font-semibold text-sm md:text-base text-brand-text-light">{status.name}</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                                <button onClick={() => handleOpenModal('edit', status)} className="p-1.5 md:p-2 text-brand-text-secondary hover:bg-brand-input rounded-full"><PencilIcon className="w-4 h-4 md:w-5 md:h-5" /></button>
                                <button onClick={() => handleDelete(status.id)} className="p-1.5 md:p-2 text-brand-text-secondary hover:bg-brand-input rounded-full"><Trash2Icon className="w-4 h-4 md:w-5 md:h-5" /></button>
                            </div>
                        </div>
                        {status.subStatuses.length > 0 && (
                            <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-brand-border/50 pl-5 md:pl-7 space-y-1.5 md:space-y-2">
                                {status.subStatuses.map((sub, index) => (
                                    <div key={index}><p className="text-xs md:text-sm font-medium text-brand-text-primary">{sub.name}</p><p className="text-[10px] md:text-xs text-brand-text-secondary">{sub.note}</p></div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'add' ? 'Tambah Status Baru' : `Edit Status: ${selectedStatus?.name}`}>
                <form onSubmit={handleSubmit} className="space-y-4 form-compact form-compact--ios-scale">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="input-group md:col-span-2"><input type="text" id="name" name="name" value={form.name} onChange={handleFormChange} className="input-field" required placeholder=" " /><label htmlFor="name" className="input-label">Nama Status</label></div>
                        <div className="input-group"><input type="color" id="color" name="color" value={form.color} onChange={handleFormChange} className="input-field !p-1 h-12" /><label htmlFor="color" className="input-label">Warna</label></div>
                        <div className="input-group"><input type="number" min={0} max={100} id="defaultProgress" name="defaultProgress" value={form.defaultProgress ?? ''} onChange={handleFormChange} className="input-field" placeholder=" " /><label htmlFor="defaultProgress" className="input-label">Default Progress (%)</label></div>
                    </div>
                    <div className="input-group"><textarea id="note" name="note" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} className="input-field" rows={2} placeholder=" " /><label htmlFor="note" className="input-label">Catatan/Deskripsi Status</label></div>

                    <div>
                        <h4 className="text-base font-semibold text-brand-text-light mb-2">Sub-Status</h4>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                            {form.subStatuses.map((sub, index) => (
                                <div key={index} className="p-3 bg-brand-bg rounded-lg grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                                    <div className="input-group !mt-0"><input type="text" name="name" value={sub.name} onChange={e => handleSubStatusChange(index, e)} placeholder="Nama Sub-Status" className="input-field !p-2 !text-sm" /></div>
                                    <div className="flex items-center gap-2">
                                        <div className="input-group flex-grow !mt-0"><input type="text" name="note" value={sub.note} onChange={e => handleSubStatusChange(index, e)} placeholder="Catatan" className="input-field !p-2 !text-sm" /></div>
                                        <button type="button" onClick={() => removeSubStatus(index)} className="p-2 text-brand-danger hover:bg-brand-danger/10 rounded-full"><Trash2Icon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addSubStatus} className="text-sm font-semibold text-brand-accent hover:underline mt-2">+ Tambah Sub-Status</button>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
                        <button type="button" onClick={handleCloseModal} className="button-secondary">Batal</button>
                        <button type="submit" className="button-primary">{modalMode === 'add' ? 'Simpan Status' : 'Update Status'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// Chat Template Settings sub-component
// ─────────────────────────────────────────────────────────────
const VARIABLE_CHIPS = [
    { label: '{clientName}', desc: 'Nama pengantin' },
    { label: '{projectName}', desc: 'Nama acara' },
    { label: '{packageName}', desc: 'Nama paket' },
    { label: '{amountPaid}', desc: 'Sudah dibayar' },
    { label: '{totalCost}', desc: 'Total biaya' },
    { label: '{sisaTagihan}', desc: 'Sisa tagihan' },
    { label: '{portalLink}', desc: 'Link portal pengantin' },
    { label: '{companyName}', desc: 'Nama perusahaan' },
];

const BILLING_VARIABLE_CHIPS = [
    { label: '{clientName}', desc: 'Nama pengantin' },
    { label: '{projectDetails}', desc: 'Rincian acara & sisa tagihan per acara' },
    { label: '{totalDue}', desc: 'Total sisa tagihan' },
    { label: '{portalLink}', desc: 'Link portal pengantin' },
    { label: '{bankAccount}', desc: 'No. rekening bank' },
    { label: '{companyName}', desc: 'Nama perusahaan' },
];

const PREVIEW_VARS: Record<string, string> = {
    clientName: 'Budi & Ani',
    projectName: 'Wedding Budi & Ani',
    packageName: 'Gold Package',
    amountPaid: 'Rp 5.000.000',
    totalCost: 'Rp 10.000.000',
    sisaTagihan: 'Rp 5.000.000',
    portalLink: 'https://example.com/portal/abc123',
    // Billing preview vars
    projectDetails: '- Acara Pernikahan: *Wedding Budi & Ani*\n  Sisa Tagihan: Rp 5.000.000',
    totalDue: 'Rp 5.000.000',
    bankAccount: 'BCA 1234567890 a.n. Wedding Studio',
    companyName: 'Wedding Studio',
    // Share template preview vars
    leadName: 'Calon Pengantin',
    packageLink: 'https://example.com/packages/abc123',
    bookingFormLink: 'https://example.com/booking/abc123',
    invoiceLink: 'https://example.com/invoice/abc123',
    receiptLink: 'https://example.com/receipt/abc123',
    txDate: '14 Maret 2026',
    txAmount: 'Rp 2.000.000',
    txMethod: 'Transfer BCA',
    txDesc: 'Pelunasan biaya dekorasi',
    targetName: 'Vendor Bunga',
};

// Share template config for the "Template Share" sub-tab
const SHARE_TEMPLATE_CONFIGS = [
    {
        key: 'packageShareTemplate' as const,
        label: 'Bagikan Katalog Package',
        desc: 'Digunakan saat share link katalog package ke Calon Pengantin di halaman Leads.',
        icon: '📦',
        color: 'purple',
        placeholder: 'Tulis template pesan untuk berbagi katalog package...',
        defaultValue: DEFAULT_PACKAGE_SHARE_TEMPLATE,
        variables: [
            { label: '{leadName}', desc: 'Nama calon pengantin' },
            { label: '{companyName}', desc: 'Nama perusahaan' },
            { label: '{packageLink}', desc: 'Link katalog package' },
        ],
    },
    {
        key: 'bookingFormTemplate' as const,
        label: 'Kirim Form Booking',
        desc: 'Digunakan saat mengirim link form booking ke Calon Pengantin.',
        icon: '📋',
        color: 'blue',
        placeholder: 'Tulis template pesan untuk mengirim form booking...',
        defaultValue: DEFAULT_BOOKING_FORM_TEMPLATE,
        variables: [
            { label: '{leadName}', desc: 'Nama calon pengantin' },
            { label: '{companyName}', desc: 'Nama perusahaan' },
            { label: '{bookingFormLink}', desc: 'Link form booking' },
        ],
    },
    {
        key: 'invoiceShareTemplate' as const,
        label: 'Kirim Invoice',
        desc: 'Digunakan saat share link Invoice PDF via WhatsApp dari halaman Acara Pernikahan.',
        icon: '🧾',
        color: 'yellow',
        placeholder: 'Tulis template pesan untuk mengirim invoice...',
        defaultValue: DEFAULT_INVOICE_SHARE_TEMPLATE,
        variables: [
            { label: '{clientName}', desc: 'Nama pengantin' },
            { label: '{companyName}', desc: 'Nama perusahaan' },
            { label: '{projectName}', desc: 'Nama acara' },
            { label: '{totalCost}', desc: 'Total biaya' },
            { label: '{amountPaid}', desc: 'Sudah dibayar' },
            { label: '{sisaTagihan}', desc: 'Sisa tagihan' },
            { label: '{invoiceLink}', desc: 'Link invoice PDF' },
        ],
    },
    {
        key: 'receiptShareTemplate' as const,
        label: 'Kirim Tanda Terima Pelanggan',
        desc: 'Digunakan saat share Tanda Terima Pembayaran PDF ke pelanggan.',
        icon: '✅',
        color: 'green',
        placeholder: 'Tulis template pesan untuk mengirim tanda terima...',
        defaultValue: DEFAULT_RECEIPT_SHARE_TEMPLATE,
        variables: [
            { label: '{clientName}', desc: 'Nama pengantin' },
            { label: '{companyName}', desc: 'Nama perusahaan' },
            { label: '{projectName}', desc: 'Nama acara' },
            { label: '{txDate}', desc: 'Tanggal transaksi' },
            { label: '{txAmount}', desc: 'Jumlah pembayaran' },
            { label: '{txMethod}', desc: 'Metode pembayaran' },
            { label: '{txDesc}', desc: 'Keterangan transaksi' },
            { label: '{receiptLink}', desc: 'Link tanda terima PDF' },
        ],
    },
    {
        key: 'expenseShareTemplate' as const,
        label: 'Kirim Slip Pengeluaran',
        desc: 'Digunakan saat share Bukti Pengeluaran / Slip Pembayaran ke vendor/supplier.',
        icon: '💸',
        color: 'red',
        placeholder: 'Tulis template pesan untuk mengirim slip pengeluaran...',
        defaultValue: DEFAULT_EXPENSE_SHARE_TEMPLATE,
        variables: [
            { label: '{targetName}', desc: 'Nama penerima / vendor' },
            { label: '{companyName}', desc: 'Nama perusahaan' },
            { label: '{txDate}', desc: 'Tanggal transaksi' },
            { label: '{txAmount}', desc: 'Jumlah pembayaran' },
            { label: '{txMethod}', desc: 'Metode pembayaran' },
            { label: '{txDesc}', desc: 'Keterangan transaksi' },
            { label: '{receiptLink}', desc: 'Link slip PDF' },
        ],
    },
    {
        key: 'portalShareTemplate' as const,
        label: 'Share Portal Pengantin',
        desc: 'Digunakan saat membagikan link Portal Pengantin ke klien.',
        icon: '🔗',
        color: 'cyan',
        placeholder: 'Tulis template pesan untuk share portal pengantin...',
        defaultValue: DEFAULT_PORTAL_SHARE_TEMPLATE,
        variables: [
            { label: '{clientName}', desc: 'Nama pengantin' },
            { label: '{companyName}', desc: 'Nama perusahaan' },
            { label: '{portalLink}', desc: 'Link portal pengantin' },
        ],
    },
] as const;

type ShareTemplateKey = typeof SHARE_TEMPLATE_CONFIGS[number]['key'];

// Reusable template CRUD list for Chat & Billing sections
const TemplateCrudSection: React.FC<{
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    accentClass: string;
    chipClass: string;
    templates: ChatTemplate[];
    variableChips: { label: string; desc: string }[];
    editingId: string | null;
    isAddingNew: boolean;
    formData: { title: string; template: string };
    formError: string;
    isSaving: boolean;
    previewId: string | null;
    onAddNew: () => void;
    onEdit: (t: ChatTemplate) => void;
    onDelete: (id: string) => void;
    onSave: () => void;
    onCancel: () => void;
    onReset: () => void;
    onPreviewToggle: (id: string) => void;
    onFormChange: (field: 'title' | 'template', val: string) => void;
    onInsertVar: (v: string) => void;
    textareaId: string;
}> = ({
    title, subtitle, icon, accentClass, chipClass,
    templates, variableChips,
    editingId, isAddingNew, formData, formError, isSaving, previewId,
    onAddNew, onEdit, onDelete, onSave, onCancel, onReset, onPreviewToggle,
    onFormChange, onInsertVar, textareaId,
}) => {
        const getPreviewText = (t: ChatTemplate) => processTemplate(t.template, PREVIEW_VARS);

        const handleCopy = (text: string) => {
            navigator.clipboard.writeText(text);
            alert('Template disalin ke clipboard!');
        };

        return (
            <div className="space-y-6">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-bg/50 p-4 rounded-2xl border border-brand-border">
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-2xl ${accentClass} flex items-center justify-center text-xl shadow-lg shadow-brand-accent/10`}>{icon}</div>
                        <div>
                            <h3 className="text-base font-bold text-brand-text-light">{title}</h3>
                            <p className="text-xs text-brand-text-secondary mt-1 max-w-md">{subtitle}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={onReset} disabled={isSaving} className="button-secondary inline-flex items-center gap-2 text-xs py-2 px-3 flex-1 sm:flex-none justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-brand-border">
                            <RefreshCwIcon className="w-3.5 h-3.5" /> Reset Default
                        </button>
                        <button onClick={onAddNew} disabled={isAddingNew || isSaving} className="button-primary inline-flex items-center gap-2 text-xs py-2 px-4 flex-1 sm:flex-none justify-center rounded-xl shadow-lg shadow-brand-accent/20">
                            <PlusIcon className="w-4 h-4" /> Tambah Template
                        </button>
                    </div>
                </div>

                {/* Add/Edit form - Positioned atop the list for visibility */}
                {(isAddingNew || editingId) && (
                    <div className="p-5 bg-brand-surface rounded-2xl border-2 border-brand-accent/50 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between">
                            <h4 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                {isAddingNew ? '✨ Buat Template Baru' : '✏️ Edit Template Chat'}
                            </h4>
                        </div>

                        {formError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-xl flex items-center gap-2">
                                <span className="text-base">⚠️</span> {formError}
                            </div>
                        )}

                        <div className="input-group !mt-0">
                            <input type="text" id="ct-title" value={formData.title} onChange={e => onFormChange('title', e.target.value)} className="input-field !bg-brand-bg rounded-xl" placeholder=" " />
                            <label htmlFor="ct-title" className="input-label">Judul Template (misal: Sapaan Awal)</label>
                        </div>

                        <div className="space-y-2">
                            <div className="input-group !mt-0">
                                <textarea id={textareaId} value={formData.template} onChange={e => onFormChange('template', e.target.value)} className="input-field !bg-brand-bg min-h-[160px] rounded-xl font-sans leading-relaxed" placeholder=" " rows={6} />
                                <label htmlFor={textareaId} className="input-label">Isi Pesan Template</label>
                            </div>

                            <div className="p-4 bg-brand-bg/50 rounded-xl border border-brand-border/50 backdrop-blur-sm">
                                <p className="text-[11px] font-bold text-brand-text-secondary mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                                    📌 Klik Variabel Untuk Menyisipkan
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {variableChips.map(v => (
                                        <button key={v.label} type="button" onClick={() => onInsertVar(v.label)} title={v.desc}
                                            className={`inline-flex items-center px-2.5 py-1.5 rounded-lg ${chipClass} text-[11px] font-mono border transition-all hover:scale-105 active:scale-95 shadow-sm`}>
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={onSave} disabled={isSaving} className="button-primary flex-1 py-3 rounded-xl font-bold shadow-lg shadow-brand-accent/20">
                                {isSaving ? 'Sedang Menyimpan...' : (isAddingNew ? 'Buat Sekarang' : 'Simpan Perubahan')}
                            </button>
                            <button onClick={onCancel} disabled={isSaving} className="button-secondary flex-1 py-3 rounded-xl font-bold bg-white/5 border border-brand-border">
                                Batal
                            </button>
                        </div>
                    </div>
                )}

                {/* Template list */}
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    {templates.length === 0 && !isAddingNew && (
                        <div className="text-center py-20 bg-brand-bg/30 rounded-3xl border border-brand-border/50 border-dashed">
                            <div className="bg-brand-surface w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-border">
                                <MessageSquareIcon className="w-8 h-8 text-brand-text-secondary opacity-30" />
                            </div>
                            <p className="text-brand-text-secondary font-medium italic">Anda belum memiliki template chat kustom.</p>
                            <button onClick={onAddNew} className="button-primary mt-6 text-sm px-6 rounded-xl shadow-lg">+ Tambah Template Pertama</button>
                        </div>
                    )}
                    {templates.map((t, idx) => (
                        <div key={t.id} className={`group p-5 rounded-2xl border transition-all duration-300 ${editingId === t.id ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20' : 'border-brand-border bg-brand-surface hover:border-brand-accent/40 hover:shadow-xl hover:shadow-black/5'}`}>
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div className="flex-1 min-w-0 w-full">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${accentClass} text-[10px] font-black flex-shrink-0 shadow-sm`}>{idx + 1}</span>
                                        <h4 className="font-bold text-base text-brand-text-light truncate group-hover:text-brand-accent transition-colors">{t.title}</h4>
                                    </div>
                                    <div className="relative">
                                        <p className="text-sm text-brand-text-secondary line-clamp-3 pl-9 leading-relaxed group-hover:text-brand-text-primary transition-colors italic">
                                            "{t.template}"
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:self-start bg-brand-bg/80 p-1 rounded-xl border border-brand-border/50 backdrop-blur-sm self-end">
                                    <button onClick={() => onPreviewToggle(t.id)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${previewId === t.id ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'text-brand-text-secondary hover:bg-brand-surface hover:text-brand-accent border border-transparent'}`} title="Preview Pesan">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                    <button onClick={() => handleCopy(t.template)} className="w-9 h-9 text-brand-text-secondary hover:bg-brand-surface hover:text-brand-accent rounded-lg flex items-center justify-center transition-all border border-transparent" title="Salin Template">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
                                    </button>
                                    <button onClick={() => onEdit(t)} className="w-9 h-9 text-brand-text-secondary hover:bg-brand-surface hover:text-brand-accent rounded-lg flex items-center justify-center transition-all border border-transparent" title="Edit Template">
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDelete(t.id)} className="w-9 h-9 text-brand-text-secondary hover:bg-red-500/10 hover:text-red-500 rounded-lg flex items-center justify-center transition-all border border-transparent" title="Hapus Template">
                                        <Trash2Icon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Preview Section - Modern WhatsApp Bubble Style */}
                            {previewId === t.id && (
                                <div className="mt-5 pt-5 border-t border-brand-border/50 animate-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                        <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest">Live Preview WhatsApp</p>
                                    </div>
                                    <div className="bg-[#0b141a] rounded-2xl p-4 sm:p-6 border border-white/5 relative overflow-hidden shadow-2xl">
                                        {/* BG Pattern */}
                                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                                        <div className="relative max-w-[85%] sm:max-w-[70%] ml-auto">
                                            <div className="bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none shadow-sm text-sm whitespace-pre-wrap leading-relaxed">
                                                {getPreviewText(t)}
                                                <div className="flex justify-end gap-1 items-center mt-1.5">
                                                    <span className="text-[10px] opacity-60">12:45 PM</span>
                                                    <svg width="16" height="15" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
                                                        <path d="M15.01 3.47L8.41 10.07L5.59 7.25L4.88 7.96L8.41 11.49L15.72 4.18L15.01 3.47ZM12.89 3.47L8.41 7.95L10.03 9.57L11.44 8.16L11.41 8.13L13.6 5.94L12.89 3.47ZM0.28 7.96L3.81 11.49L4.52 10.78L0.99 7.25L0.28 7.96Z" fill="#34B7F1" />
                                                    </svg>
                                                </div>
                                            </div>
                                            {/* Triangle tip */}
                                            <div className="absolute top-0 -right-2 w-0 h-0 border-[6px] border-transparent border-t-[#005c4b] border-l-[#005c4b]"></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-center text-brand-text-secondary mt-3 opacity-60">Pesan ini dihasilkan menggunakan data profil & Acara Pernikahan contoh</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

const ShareTemplateItem: React.FC<{
    config: any;
    stringValue: string;
    onProfileUpdate: (key: string, value: string) => void;
    onReset: () => void;
    showSuccess: (msg: string) => void;
}> = ({ config, stringValue, onProfileUpdate, onReset, showSuccess }) => {
    const [showPreview, setShowPreview] = useState(false);
    const previewText = processTemplate(stringValue, PREVIEW_VARS);

    const handleInsertVar = (varName: string) => {
        const textarea = document.getElementById(config.key) as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = stringValue;
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newValue = before + varName + after;
            onProfileUpdate(config.key, newValue);
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + varName.length, start + varName.length);
            }, 0);
        } else {
            onProfileUpdate(config.key, stringValue + varName);
        }
    };

    return (
        <div className={`group p-6 bg-brand-surface rounded-2xl border transition-all duration-300 ${showPreview ? 'border-cyan-500 shadow-xl' : 'border-brand-border hover:border-cyan-500/40 hover:shadow-lg'}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">{config.icon}</span>
                    <div>
                        <h4 className="font-bold text-base text-brand-text-light">{config.label}</h4>
                        <p className="text-xs text-brand-text-secondary mt-0.5">{config.desc}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${showPreview ? 'bg-green-500 text-white shadow-lg' : 'text-brand-text-secondary hover:bg-brand-bg hover:text-brand-accent'}`}
                        title="Lihat Preview"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="w-9 h-9 text-brand-text-secondary hover:bg-brand-bg hover:text-orange-400 rounded-lg flex items-center justify-center transition-all"
                        title="Reset ke Default"
                    >
                        <RefreshCwIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="input-group !mt-0 group/field">
                    <textarea
                        id={config.key}
                        value={stringValue}
                        onChange={(e) => onProfileUpdate(config.key, e.target.value)}
                        className="input-field !bg-brand-bg min-h-[140px] rounded-xl font-sans leading-relaxed group-hover/field:border-cyan-500/50 transition-colors"
                        placeholder={config.placeholder}
                        rows={5}
                    />
                    <label htmlFor={config.key} className="input-label !text-brand-text-secondary">Isi Pesan WhatsApp</label>
                </div>

                <div className="p-4 bg-brand-bg/50 rounded-xl border border-brand-border/50 backdrop-blur-sm">
                    <p className="text-[10px] font-bold text-brand-text-secondary mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                        📌 Klik Variabel Untuk Menyisipkan
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {config.variables.map((v: any) => (
                            <button
                                key={v.label}
                                type="button"
                                onClick={() => handleInsertVar(v.label)}
                                title={v.desc}
                                className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-cyan-400/10 text-cyan-400 text-[11px] font-mono border border-cyan-400/20 hover:scale-105 active:scale-95 transition-all shadow-sm"
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>

                {showPreview && (
                    <div className="pt-4 border-t border-brand-border/30 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest">Live Preview WhatsApp</p>
                        </div>
                        <div className="bg-[#0b141a] rounded-2xl p-4 sm:p-6 border border-white/5 relative overflow-hidden shadow-2xl">
                            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                            <div className="relative max-w-[85%] sm:max-w-[70%] ml-auto">
                                <div className="bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none shadow-sm text-sm whitespace-pre-wrap leading-relaxed">
                                    {previewText}
                                    <div className="flex justify-end gap-1 items-center mt-1.5">
                                        <span className="text-[10px] opacity-60">12:45 PM</span>
                                        <svg width="16" height="15" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
                                            <path d="M15.01 3.47L8.41 10.07L5.59 7.25L4.88 7.96L8.41 11.49L15.72 4.18L15.01 3.47ZM12.89 3.47L8.41 7.95L10.03 9.57L11.44 8.16L11.41 8.13L13.6 5.94L12.89 3.47ZM0.28 7.96L3.81 11.49L4.52 10.78L0.99 7.25L0.28 7.96Z" fill="#34B7F1" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="absolute top-0 -right-2 w-0 h-0 border-[6px] border-transparent border-t-[#005c4b] border-l-[#005c4b]"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatTemplateSettings: React.FC<{
    profile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
    showSuccess: (msg: string) => void;
}> = ({ profile, setProfile, showSuccess }) => {
    const [innerTab, setInnerTab] = useState<'chat' | 'billing' | 'share'>('chat');

    // ── Chat Templates state ──────────────────────────────────
    const [templates, setTemplates] = useState<ChatTemplate[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [formData, setFormData] = useState({ title: '', template: '' });
    const [formError, setFormError] = useState('');
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // ── Billing Templates state ──────────────────────────────
    const [billingTemplates, setBillingTemplates] = useState<ChatTemplate[]>([]);
    const [billingEditingId, setBillingEditingId] = useState<string | null>(null);
    const [isBillingAddingNew, setIsBillingAddingNew] = useState(false);
    const [billingFormData, setBillingFormData] = useState({ title: '', template: '' });
    const [billingFormError, setBillingFormError] = useState('');
    const [billingPreviewId, setBillingPreviewId] = useState<string | null>(null);
    const [isBillingSaving, setIsBillingSaving] = useState(false);

    // Load templates from profile or fallback to defaults
    useEffect(() => {
        const profileTemplates = profile.chatTemplates;
        if (profileTemplates && profileTemplates.length > 0) {
            setTemplates(profileTemplates);
        } else {
            setTemplates(CHAT_TEMPLATES);
        }
    }, [profile.chatTemplates]);

    // Load billing templates from profile or fallback to defaults
    useEffect(() => {
        const bt = profile.billingTemplates;
        if (bt && bt.length > 0) {
            setBillingTemplates(bt);
        } else {
            setBillingTemplates(DEFAULT_BILLING_TEMPLATES);
        }
    }, [profile.billingTemplates]);

    const persistTemplates = useCallback(async (updated: ChatTemplate[]) => {
        setIsSaving(true);
        try {
            const updatedProfile = await upsertProfile({ ...profile, chatTemplates: updated } as any);
            setProfile(updatedProfile);
            setTemplates(updated);
            showSuccess('Template berhasil disimpan!');
        } catch (err: any) {
            alert('Gagal menyimpan: ' + (err?.message || 'Coba lagi.'));
        } finally {
            setIsSaving(false);
        }
    }, [profile, setProfile, showSuccess]);

    const handleAddNew = () => {
        setEditingId(null);
        setFormData({ title: '', template: '' });
        setFormError('');
        setIsAddingNew(true);
    };

    const handleEdit = (t: ChatTemplate) => {
        setIsAddingNew(false);
        setFormData({ title: t.title, template: t.template });
        setFormError('');
        setEditingId(t.id);
    };

    const handleCancel = () => {
        setEditingId(null);
        setIsAddingNew(false);
        setFormData({ title: '', template: '' });
        setFormError('');
    };

    const handleSave = async () => {
        const validation = validateTemplate({ id: editingId || 'temp', title: formData.title, template: formData.template });
        if (!validation.valid) {
            setFormError(validation.errors.join(' • '));
            return;
        }

        const titleExists = templates.some(t => t.title.toLowerCase() === formData.title.toLowerCase() && t.id !== editingId);
        if (titleExists) {
            setFormError('Template dengan judul ini sudah ada. Gunakan judul lain.');
            return;
        }

        let updated: ChatTemplate[];
        if (editingId) {
            updated = templates.map(t => t.id === editingId ? { ...t, ...formData } : t);
        } else {
            const newT: ChatTemplate = { id: `custom_${Date.now()}`, ...formData };
            updated = [...templates, newT];
        }
        await persistTemplates(updated);
        handleCancel();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Hapus template ini?')) return;
        const updated = templates.filter(t => t.id !== id);
        await persistTemplates(updated);
    };

    const handleReset = async () => {
        if (!window.confirm('Reset ke template default? Semua template custom akan dihapus.')) return;
        await persistTemplates(CHAT_TEMPLATES);
    };

    const insertVariable = (variable: string) => {
        const textarea = document.getElementById('ct-message') as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = formData.template;
            const newValue = text.substring(0, start) + variable + text.substring(end);
            setFormData(prev => ({ ...prev, template: newValue }));
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + variable.length, start + variable.length);
            }, 0);
        } else {
            setFormData(prev => ({ ...prev, template: prev.template + variable }));
        }
    };

    const currentPreview = previewId ? templates.find(t => t.id === previewId) : null;
    const previewText = currentPreview ? processTemplate(currentPreview.template, PREVIEW_VARS) : '';

    // Billing template handlers
    const persistBillingTemplates = useCallback(async (updated: ChatTemplate[]) => {
        setIsBillingSaving(true);
        try {
            const updatedProfile = await upsertProfile({ ...profile, billingTemplates: updated } as any);
            setProfile(updatedProfile);
            setBillingTemplates(updated);
            showSuccess('Template tagihan berhasil disimpan!');
        } catch (err: any) {
            alert('Gagal menyimpan: ' + (err?.message || 'Coba lagi.'));
        } finally {
            setIsBillingSaving(false);
        }
    }, [profile, setProfile, showSuccess]);

    const handleBillingAddNew = () => { setBillingEditingId(null); setBillingFormData({ title: '', template: '' }); setBillingFormError(''); setIsBillingAddingNew(true); };
    const handleBillingEdit = (t: ChatTemplate) => { setIsBillingAddingNew(false); setBillingFormData({ title: t.title, template: t.template }); setBillingFormError(''); setBillingEditingId(t.id); };
    const handleBillingCancel = () => { setBillingEditingId(null); setIsBillingAddingNew(false); setBillingFormData({ title: '', template: '' }); setBillingFormError(''); };
    const handleBillingSave = async () => {
        const validation = validateTemplate({ id: billingEditingId || 'temp', title: billingFormData.title, template: billingFormData.template });
        if (!validation.valid) { setBillingFormError(validation.errors.join(' • ')); return; }

        const titleExists = billingTemplates.some(t => t.title.toLowerCase() === billingFormData.title.toLowerCase() && t.id !== billingEditingId);
        if (titleExists) {
            setBillingFormError('Template dengan judul ini sudah ada. Gunakan judul lain.');
            return;
        }

        let updated: ChatTemplate[];
        if (billingEditingId) {
            updated = billingTemplates.map(t => t.id === billingEditingId ? { ...t, ...billingFormData } : t);
        } else {
            updated = [...billingTemplates, { id: `billing_custom_${Date.now()}`, ...billingFormData }];
        }
        await persistBillingTemplates(updated);
        handleBillingCancel();
    };
    const handleBillingDelete = async (id: string) => { if (!window.confirm('Hapus template ini?')) return; await persistBillingTemplates(billingTemplates.filter(t => t.id !== id)); };
    const handleBillingReset = async () => { if (!window.confirm('Reset ke template default?')) return; await persistBillingTemplates(DEFAULT_BILLING_TEMPLATES); };
    const insertBillingVariable = (v: string) => {
        const textarea = document.getElementById('bt-message') as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = billingFormData.template;
            const newValue = text.substring(0, start) + v + text.substring(end);
            setBillingFormData(prev => ({ ...prev, template: newValue }));
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + v.length, start + v.length);
            }, 0);
        } else {
            setBillingFormData(prev => ({ ...prev, template: prev.template + v }));
        }
    };

    const currentBillingPreview = billingPreviewId ? billingTemplates.find(t => t.id === billingPreviewId) : null;
    const billingPreviewText = currentBillingPreview ? processTemplate(currentBillingPreview.template, PREVIEW_VARS) : '';

    return (
        <div className="space-y-6">
            {/* ─── INNER TAB NAVIGATION ──────────────────────── */}
            <div className="flex gap-2 border-b border-brand-border pb-3 overflow-x-auto">
                <button
                    onClick={() => setInnerTab('chat')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${innerTab === 'chat'
                        ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 scale-105'
                        : 'text-brand-text-secondary hover:bg-brand-bg hover:text-brand-text-primary'
                        }`}
                >
                    <span className="text-lg">💬</span> Komunikasi Umum
                </button>
                <button
                    onClick={() => setInnerTab('billing')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${innerTab === 'billing'
                        ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 scale-105'
                        : 'text-brand-text-secondary hover:bg-brand-bg hover:text-brand-text-primary'
                        }`}
                >
                    <span className="text-lg">💰</span> Template Tagihan
                </button>
                <button
                    onClick={() => setInnerTab('share')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${innerTab === 'share'
                        ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 scale-105'
                        : 'text-brand-text-secondary hover:bg-brand-bg hover:text-brand-text-primary'
                        }`}
                >
                    <span className="text-lg">🔗</span> Share Link & Dokumen
                </button>
            </div>

            {/* ─── CHAT TEMPLATES TAB ──────────────────────── */}
            {innerTab === 'chat' && (
                <TemplateCrudSection
                    title="Chat Templates WhatsApp"
                    subtitle="Template ini langsung tersedia saat Anda membuka chat dengan pengantin di halaman Acara Pernikahan."
                    icon={<MessageSquareIcon className="w-5 h-5" />}
                    accentClass="bg-brand-accent/20 text-brand-accent"
                    chipClass="bg-brand-accent/10 text-brand-accent border-brand-accent/20"
                    templates={templates}
                    variableChips={VARIABLE_CHIPS}
                    editingId={editingId}
                    isAddingNew={isAddingNew}
                    formData={formData}
                    formError={formError}
                    isSaving={isSaving}
                    previewId={previewId}
                    onAddNew={handleAddNew}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onReset={handleReset}
                    onPreviewToggle={(id) => setPreviewId(previewId === id ? null : id)}
                    onFormChange={(field, val) => setFormData(p => ({ ...p, [field]: val }))}
                    onInsertVar={insertVariable}
                    textareaId="ct-message"
                />
            )}

            {/* ─── BILLING TEMPLATES TAB ──────────────────────── */}
            {innerTab === 'billing' && (
                <TemplateCrudSection
                    title="Template Tagihan & Invoice WA"
                    subtitle="Digunakan di tombol 'Kirim Tagihan via WA' pada halaman Manajemen Klien."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}
                    accentClass="bg-orange-400/20 text-orange-400"
                    chipClass="bg-orange-400/10 text-orange-400 border-orange-400/20"
                    templates={billingTemplates}
                    variableChips={BILLING_VARIABLE_CHIPS}
                    editingId={billingEditingId}
                    isAddingNew={isBillingAddingNew}
                    formData={billingFormData}
                    formError={billingFormError}
                    isSaving={isBillingSaving}
                    previewId={billingPreviewId}
                    onAddNew={handleBillingAddNew}
                    onEdit={handleBillingEdit}
                    onDelete={handleBillingDelete}
                    onSave={handleBillingSave}
                    onCancel={handleBillingCancel}
                    onReset={handleBillingReset}
                    onPreviewToggle={(id) => setBillingPreviewId(billingPreviewId === id ? null : id)}
                    onFormChange={(field, val) => setBillingFormData(p => ({ ...p, [field]: val }))}
                    onInsertVar={insertBillingVariable}
                    textareaId="bt-message"
                />
            )}

            {/* ─── SHARE TEMPLATES TAB ──────────────────────── */}
            {innerTab === 'share' && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-bg/50 p-4 rounded-2xl border border-brand-border">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-cyan-400/20 text-cyan-400 flex items-center justify-center text-xl shadow-lg shadow-cyan-400/10 text-2xl">🔗</div>
                            <div>
                                <h3 className="text-base font-bold text-brand-text-light">Template Share Link & Dokumen</h3>
                                <p className="text-xs text-brand-text-secondary mt-1 max-w-md">
                                    Pesan khusus untuk membagikan link portal, katalog, dan dokumen PDF melalui WhatsApp.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                setIsSaving(true);
                                try {
                                    const updates: any = { id: profile.id };
                                    SHARE_TEMPLATE_CONFIGS.forEach(config => {
                                        updates[config.key] = profile[config.key];
                                    });
                                    const updated = await upsertProfile(updates);
                                    setProfile(updated);
                                    showSuccess('Semua template share berhasil disimpan!');
                                } catch (err: any) {
                                    alert('Gagal menyimpan: ' + (err?.message || 'Coba lagi.'));
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                            disabled={isSaving}
                            className="button-primary py-3 px-6 rounded-xl font-bold shadow-lg shadow-brand-accent/20 w-full sm:w-auto"
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {SHARE_TEMPLATE_CONFIGS.map((config) => (
                            <ShareTemplateItem
                                key={config.key}
                                config={config}
                                stringValue={typeof profile[config.key] === 'string' ? profile[config.key] as string : ''}
                                onProfileUpdate={(key, val) => setProfile(p => ({ ...p, [key]: val }))}
                                onReset={() => setProfile(p => ({ ...p, [config.key]: config.defaultValue }))}
                                showSuccess={showSuccess}
                            />
                        ))}
                    </div>

                    <div className="flex justify-end pt-8 border-t border-brand-border">
                        <button
                            onClick={async () => {
                                setIsSaving(true);
                                try {
                                    const updates: any = { id: profile.id };
                                    SHARE_TEMPLATE_CONFIGS.forEach(config => {
                                        updates[config.key] = profile[config.key];
                                    });
                                    const updated = await upsertProfile(updates);
                                    setProfile(updated);
                                    showSuccess('Semua template share berhasil disimpan!');
                                } catch (err: any) {
                                    alert('Gagal menyimpan: ' + (err?.message || 'Coba lagi.'));
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                            disabled={isSaving}
                            className="button-primary py-4 px-10 rounded-2xl font-bold text-lg shadow-xl shadow-brand-accent/30 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan Semua Template Share'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


interface SettingsProps {
    profile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
    transactions: Transaction[];
    projects: Project[];
    packages: Package[];
    users: User[]; // This will now be pre-filtered by App.tsx
    setUsers: React.Dispatch<React.SetStateAction<User[]>>; // This updates the global user list
    currentUser: User | null;
}

const emptyUserForm = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Member' as User['role'],
    permissions: [] as ViewType[],
};

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

// --- Checklist Template Settings Component ---
const ChecklistTemplateSettings: React.FC<{
    profile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
    showNotification: (msg: string) => void;
}> = ({ profile, setProfile, showNotification }) => {
    const getTemplates = (): ChecklistTemplate[] => {
        if (profile.checklistTemplates && profile.checklistTemplates.length > 0) {
            return profile.checklistTemplates;
        }
        return DEFAULT_CHECKLIST_TEMPLATES;
    };

    const [templates, setTemplates] = useState<ChecklistTemplate[]>(getTemplates);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [newItemInputs, setNewItemInputs] = useState<Record<number, string>>({});
    const [editingItem, setEditingItem] = useState<{ catIdx: number; itemIdx: number } | null>(null);
    const [editingItemName, setEditingItemName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const save = async (updated: ChecklistTemplate[]) => {
        setIsSaving(true);
        try {
            const saved = await upsertProfile({ id: profile.id, checklistTemplates: updated } as any);
            setProfile(prev => ({ ...prev, checklistTemplates: updated }));
            setTemplates(updated);
            showNotification('Template checklist berhasil disimpan.');
        } catch (e) {
            console.error('Failed to save checklist templates:', e);
            showNotification('Gagal menyimpan template.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddCategory = () => {
        const name = newCategoryName.trim();
        if (!name) return;
        if (templates.some(t => t.category === name)) return;
        const updated = [...templates, { category: name, items: [] }];
        setTemplates(updated);
        save(updated);
        setNewCategoryName('');
    };

    const handleRenameCategory = (idx: number) => {
        const name = editingCategoryName.trim();
        if (!name || templates.some((t, i) => t.category === name && i !== idx)) return;
        const updated = templates.map((t, i) => i === idx ? { ...t, category: name } : t);
        setTemplates(updated);
        save(updated);
        setEditingCategoryIdx(null);
        setEditingCategoryName('');
    };

    const handleDeleteCategory = (idx: number) => {
        if (!window.confirm(`Hapus kategori "${templates[idx].category}" beserta semua itemnya?`)) return;
        const updated = templates.filter((_, i) => i !== idx);
        setTemplates(updated);
        save(updated);
    };

    const handleAddItem = (catIdx: number) => {
        const name = (newItemInputs[catIdx] || '').trim();
        if (!name) return;
        if (templates[catIdx].items.includes(name)) return;
        const updated = templates.map((t, i) =>
            i === catIdx ? { ...t, items: [...t.items, name] } : t
        );
        setTemplates(updated);
        save(updated);
        setNewItemInputs(prev => ({ ...prev, [catIdx]: '' }));
    };

    const handleRenameItem = (catIdx: number, itemIdx: number) => {
        const name = editingItemName.trim();
        if (!name) return;
        const updated = templates.map((t, i) =>
            i === catIdx ? { ...t, items: t.items.map((item, j) => j === itemIdx ? name : item) } : t
        );
        setTemplates(updated);
        save(updated);
        setEditingItem(null);
        setEditingItemName('');
    };

    const handleDeleteItem = (catIdx: number, itemIdx: number) => {
        const updated = templates.map((t, i) =>
            i === catIdx ? { ...t, items: t.items.filter((_, j) => j !== itemIdx) } : t
        );
        setTemplates(updated);
        save(updated);
    };

    const handleResetToDefault = () => {
        if (!window.confirm('Reset ke template default? Semua kustomisasi akan hilang.')) return;
        const updated = DEFAULT_CHECKLIST_TEMPLATES;
        setTemplates(updated);
        save(updated);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm md:text-lg font-semibold text-brand-text-light">Template Checklist Hari H</h3>
                    <p className="text-xs text-brand-text-secondary mt-1">
                        Template ini digunakan saat membuat checklist baru untuk setiap project.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="button-secondary text-xs flex items-center gap-1"
                >
                    <RefreshCwIcon className="w-3.5 h-3.5" /> Reset Default
                </button>
            </div>

            {/* Add Category */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                    placeholder="Nama kategori baru..."
                    className="flex-grow px-3 py-2 rounded-lg border border-brand-border bg-white/5 text-sm text-brand-text-light focus:outline-none focus:ring-1 focus:ring-brand-accent"
                />
                <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={isSaving}
                    className="button-primary text-sm flex items-center gap-1"
                >
                    <PlusIcon className="w-4 h-4" /> Tambah Kategori
                </button>
            </div>

            {/* Categories List */}
            <div className="space-y-4">
                {templates.map((template, catIdx) => (
                    <div key={catIdx} className="rounded-2xl bg-white/5 border border-brand-border p-4">
                        {/* Category Header */}
                        <div className="flex items-center justify-between mb-3 group">
                            {editingCategoryIdx === catIdx ? (
                                <div className="flex items-center gap-2 flex-grow">
                                    <input
                                        value={editingCategoryName}
                                        onChange={e => setEditingCategoryName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleRenameCategory(catIdx);
                                            if (e.key === 'Escape') { setEditingCategoryIdx(null); setEditingCategoryName(''); }
                                        }}
                                        className="flex-grow bg-brand-surface border border-brand-border rounded-lg px-3 py-1.5 text-sm text-brand-text-light focus:outline-none focus:ring-1 focus:ring-brand-accent"
                                        autoFocus
                                    />
                                    <button type="button" className="button-primary text-xs px-3 py-1" onClick={() => handleRenameCategory(catIdx)}>Simpan</button>
                                    <button type="button" className="button-secondary text-xs px-3 py-1" onClick={() => { setEditingCategoryIdx(null); setEditingCategoryName(''); }}>Batal</button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-brand-accent">{template.category}</span>
                                        <span className="text-[10px] bg-brand-accent/20 px-2 py-0.5 rounded-full text-brand-accent">{template.items.length} item</span>
                                        <button
                                            type="button"
                                            onClick={() => { setEditingCategoryIdx(catIdx); setEditingCategoryName(template.category); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-brand-text-secondary hover:text-brand-text-light hover:bg-white/10 rounded transition-all"
                                        >
                                            <PencilIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCategory(catIdx)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-400/20 rounded transition-all"
                                        >
                                            <Trash2Icon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Items */}
                        <div className="space-y-1.5 mb-3">
                            {template.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="flex items-center gap-2 group/item">
                                    {editingItem?.catIdx === catIdx && editingItem?.itemIdx === itemIdx ? (
                                        <>
                                            <input
                                                value={editingItemName}
                                                onChange={e => setEditingItemName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenameItem(catIdx, itemIdx);
                                                    if (e.key === 'Escape') { setEditingItem(null); setEditingItemName(''); }
                                                }}
                                                className="flex-grow bg-brand-surface border border-brand-border rounded-lg px-2 py-1 text-sm text-brand-text-light focus:outline-none focus:ring-1 focus:ring-brand-accent"
                                                autoFocus
                                            />
                                            <button type="button" className="button-primary text-xs px-2 py-1" onClick={() => handleRenameItem(catIdx, itemIdx)}>Simpan</button>
                                            <button type="button" className="button-secondary text-xs px-2 py-1" onClick={() => { setEditingItem(null); setEditingItemName(''); }}>Batal</button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="flex-grow text-sm text-brand-text-light bg-brand-bg px-3 py-1.5 rounded-lg">{item}</span>
                                            <button
                                                type="button"
                                                onClick={() => { setEditingItem({ catIdx, itemIdx }); setEditingItemName(item); }}
                                                className="opacity-0 group-hover/item:opacity-100 p-1 text-brand-text-secondary hover:text-brand-text-light hover:bg-white/10 rounded transition-all"
                                            >
                                                <PencilIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteItem(catIdx, itemIdx)}
                                                className="opacity-0 group-hover/item:opacity-100 p-1 text-red-400 hover:bg-red-400/20 rounded transition-all"
                                            >
                                                <Trash2Icon className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Item Input */}
                        <input
                            type="text"
                            value={newItemInputs[catIdx] || ''}
                            onChange={e => setNewItemInputs(prev => ({ ...prev, [catIdx]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(catIdx); } }}
                            placeholder="Tambah item baru..."
                            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-xs text-brand-text-light focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                    </div>
                ))}
            </div>

            {templates.length === 0 && (
                <div className="text-center py-8 text-brand-text-secondary text-sm">
                    Belum ada kategori. Tambahkan kategori di atas.
                </div>
            )}
        </div>
    );
};

const Settings: React.FC<SettingsProps> = ({ profile, setProfile, transactions, projects, packages, users, setUsers, currentUser }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [didInitProjectStatuses, setDidInitProjectStatuses] = useState(false);

    useEffect(() => {
        try {
            const tab = window.localStorage.getItem('vena-settings-tab');
            if (tab) {
                setActiveTab(tab);
                window.localStorage.removeItem('vena-settings-tab');
            }
        } catch (e) {
        }
    }, []);

    // State for category management
    const [incomeCategoryInput, setIncomeCategoryInput] = useState('');
    const [editingIncomeCategory, setEditingIncomeCategory] = useState<string | null>(null);
    const [expenseCategoryInput, setExpenseCategoryInput] = useState('');
    const [editingExpenseCategory, setEditingExpenseCategory] = useState<string | null>(null);
    const [projectTypeInput, setProjectTypeInput] = useState('');
    const [editingProjectType, setEditingProjectType] = useState<string | null>(null);
    const [eventTypeInput, setEventTypeInput] = useState('');
    const [editingEventType, setEditingEventType] = useState<string | null>(null);
    const [packageCategoryInput, setPackageCategoryInput] = useState('');
    const [editingPackageCategory, setEditingPackageCategory] = useState<string | null>(null);

    // State for user management
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userModalMode, setUserModalMode] = useState<'add' | 'edit'>('add');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userForm, setUserForm] = useState(emptyUserForm);
    const [userFormError, setUserFormError] = useState('');


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };



    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                alert("Ukuran file logo tidak boleh melebihi 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, logoBase64: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                alert("Ukuran file TTD tidak boleh melebihi 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, signatureBase64: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleNotificationChange = (key: keyof Profile['notificationSettings']) => {
        setProfile(p => {
            const base = p.notificationSettings ?? { newProject: false, paymentConfirmation: false, deadlineReminder: false };
            return {
                ...p,
                notificationSettings: {
                    ...base,
                    [key]: !(p.notificationSettings?.[key] ?? false),
                },
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        setSaveError('');
        try {
            const updated = await upsertProfile(profile);
            setProfile(updated);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err: any) {
            console.error('[Settings] Save profile failed:', err);
            setSaveError(err?.message || 'Gagal menyimpan profil.');
        } finally {
            setIsSaving(false);
        }
    }

    // --- User Management Handlers ---
    const handleOpenUserModal = (mode: 'add' | 'edit', user: User | null = null) => {
        setUserModalMode(mode);
        setSelectedUser(user);
        if (mode === 'edit' && user) {
            setUserForm({
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                password: '',
                confirmPassword: '',
                permissions: user.permissions || [],
            });
        } else {
            setUserForm(emptyUserForm);
        }
        setUserFormError('');
        setIsUserModalOpen(true);
    };

    const handleCloseUserModal = () => {
        setIsUserModalOpen(false);
        setSelectedUser(null);
        setUserForm(emptyUserForm);
        setUserFormError('');
    };

    const handleUserFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setUserForm(prev => ({ ...prev, [name]: value }));
    };

    const handlePermissionsChange = (view: ViewType, checked: boolean) => {
        setUserForm(prev => {
            const currentPermissions = new Set(prev.permissions);
            if (checked) {
                currentPermissions.add(view);
            } else {
                currentPermissions.delete(view);
            }
            return { ...prev, permissions: Array.from(currentPermissions) };
        });
    };

    const handleUserFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUserFormError('');

        if (userForm.password && userForm.password !== userForm.confirmPassword) {
            setUserFormError('Konfirmasi kata sandi tidak cocok.');
            return;
        }

        try {
            if (userModalMode === 'add') {
                if (!userForm.email || !userForm.password || !userForm.fullName) {
                    setUserFormError('Nama, email, dan kata sandi wajib diisi.');
                    return;
                }
                if (users.some(u => u.email === userForm.email)) {
                    setUserFormError('Email sudah digunakan di dalam vendor ini.');
                    return;
                }
                if (!currentUser) {
                    setUserFormError('Tidak dapat membuat pengguna: sesi tidak valid.');
                    return;
                }

                const newUserData = {
                    fullName: userForm.fullName,
                    email: userForm.email,
                    password: userForm.password,
                    role: userForm.role,
                    permissions: userForm.role === 'Member' ? userForm.permissions : undefined,
                };
                const created = await createUser(newUserData);
                setUsers(prev => [...prev, created]);
            } else if (userModalMode === 'edit' && selectedUser) {
                if (users.some(u => u.email === userForm.email && u.id !== selectedUser.id)) {
                    setUserFormError('Email sudah digunakan oleh pengguna lain.');
                    return;
                }

                const updateData: any = {
                    fullName: userForm.fullName,
                    email: userForm.email,
                    role: userForm.role,
                    permissions: userForm.role === 'Member' ? userForm.permissions : undefined,
                };
                if (userForm.password) {
                    updateData.password = userForm.password;
                }

                const updated = await updateUser(selectedUser.id, updateData);
                setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
            }
            handleCloseUserModal();
        } catch (err: any) {
            console.error('[Settings] User operation failed:', err);
            setUserFormError(err?.message || 'Gagal menyimpan pengguna.');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (userId === currentUser?.id) {
            alert("Anda tidak dapat menghapus akun Anda sendiri.");
            return;
        }
        if (window.confirm("Apakah Anda yakin ingin menghapus pengguna ini?")) {
            try {
                await deleteUser(userId);
                setUsers(prev => prev.filter(u => u.id !== userId));
            } catch (err: any) {
                console.error('[Settings] Delete user failed:', err);
                alert('Gagal menghapus pengguna: ' + (err?.message || 'Coba lagi.'));
            }
        }
    };

    // --- Category Management Handlers ---
    const handleAddOrUpdateIncomeCategory = async () => {
        if (!incomeCategoryInput.trim()) return;
        const newCategory = incomeCategoryInput.trim();
        const categories = profile.incomeCategories || [];

        let newCategories: string[];
        if (editingIncomeCategory) { // Update
            if (newCategory !== editingIncomeCategory && categories.includes(newCategory)) {
                alert('Kategori ini sudah ada.'); return;
            }
            newCategories = categories.map(c => c === editingIncomeCategory ? newCategory : c).sort();
            setEditingIncomeCategory(null);
        } else { // Add
            if (categories.includes(newCategory)) {
                alert('Kategori ini sudah ada.'); return;
            }
            newCategories = [...categories, newCategory].sort();
        }

        try {
            const updated = await upsertProfile({ id: profile.id, incomeCategories: newCategories });
            setProfile(updated);
            setIncomeCategoryInput('');
        } catch (err: any) {
            console.error('[Settings] Save income category failed:', err);
            alert('Gagal menyimpan kategori: ' + (err?.message || 'Coba lagi.'));
        }
    };

    const handleEditIncomeCategory = (category: string) => { setEditingIncomeCategory(category); setIncomeCategoryInput(category); };
    const handleDeleteIncomeCategory = async (category: string) => {
        const isCategoryInUse = transactions.some(t => t.category === category && t.type === 'Pemasukan');
        if (isCategoryInUse) {
            alert(`Kategori "${category}" tidak dapat dihapus karena sedang digunakan dalam transaksi.`); return;
        }
        if (window.confirm(`Yakin ingin menghapus kategori "${category}"?`)) {
            const newCategories = (profile.incomeCategories || []).filter(c => c !== category);
            try {
                const updated = await upsertProfile({ id: profile.id, incomeCategories: newCategories });
                setProfile(updated);
            } catch (err: any) {
                console.error('[Settings] Delete income category failed:', err);
                alert('Gagal menghapus kategori: ' + (err?.message || 'Coba lagi.'));
            }
        }
    };

    const handleAddOrUpdateExpenseCategory = async () => {
        if (!expenseCategoryInput.trim()) return;
        const newCategory = expenseCategoryInput.trim();
        const categories = profile.expenseCategories || [];

        let newCategories: string[];
        if (editingExpenseCategory) {
            if (newCategory !== editingExpenseCategory && categories.includes(newCategory)) {
                alert('Kategori ini sudah ada.'); return;
            }
            newCategories = categories.map(c => c === editingExpenseCategory ? newCategory : c).sort();
            setEditingExpenseCategory(null);
        } else {
            if (categories.includes(newCategory)) {
                alert('Kategori ini sudah ada.'); return;
            }
            newCategories = [...categories, newCategory].sort();
        }

        try {
            const updated = await upsertProfile({ id: profile.id, expenseCategories: newCategories });
            setProfile(updated);
            setExpenseCategoryInput('');
        } catch (err: any) {
            console.error('[Settings] Save expense category failed:', err);
            alert('Gagal menyimpan kategori: ' + (err?.message || 'Coba lagi.'));
        }
    };

    const handleEditExpenseCategory = (category: string) => { setEditingExpenseCategory(category); setExpenseCategoryInput(category); };
    const handleDeleteExpenseCategory = async (category: string) => {
        const isCategoryInUse = transactions.some(t => t.category === category && t.type === 'Pengeluaran');
        if (isCategoryInUse) {
            alert(`Kategori "${category}" tidak dapat dihapus karena sedang digunakan dalam transaksi.`); return;
        }
        if (window.confirm(`Yakin ingin menghapus kategori "${category}"?`)) {
            const newCategories = (profile.expenseCategories || []).filter(c => c !== category);
            try {
                const updated = await upsertProfile({ id: profile.id, expenseCategories: newCategories });
                setProfile(updated);
            } catch (err: any) {
                console.error('[Settings] Delete expense category failed:', err);
                alert('Gagal menghapus kategori: ' + (err?.message || 'Coba lagi.'));
            }
        }
    };

    const handleAddOrUpdateProjectType = async () => {
        if (!projectTypeInput.trim()) return;
        const newType = projectTypeInput.trim();
        const types = profile.projectTypes || [];
        let newTypes: string[];
        if (editingProjectType) {
            if (newType !== editingProjectType && types.includes(newType)) { alert('Jenis Acara Pernikahan ini sudah ada.'); return; }
            newTypes = types.map(t => t === editingProjectType ? newType : t).sort();
        } else {
            if (types.includes(newType)) { alert('Jenis Acara Pernikahan ini sudah ada.'); return; }
            newTypes = [...types, newType].sort();
        }
        try {
            const updated = await upsertProfile({ id: profile.id, projectTypes: newTypes } as any);
            setProfile(updated);
            setEditingProjectType(null);
            setProjectTypeInput('');
        } catch (err: any) {
            console.error('[Settings] Save project type failed:', err);
            alert('Gagal menyimpan jenis Acara Pernikahan: ' + (err?.message || 'Coba lagi.'));
        }
    };

    const handleEditProjectType = (type: string) => { setEditingProjectType(type); setProjectTypeInput(type); };
    const handleDeleteProjectType = async (type: string) => {
        const isTypeInUse = projects.some(p => p.projectType === type);
        if (isTypeInUse) { alert(`Jenis Acara Pernikahan "${type}" tidak dapat dihapus karena sedang digunakan.`); return; }
        if (window.confirm(`Yakin ingin menghapus jenis Acara Pernikahan "${type}"?`)) {
            const newTypes = (profile.projectTypes || []).filter(t => t !== type);
            try {
                const updated = await upsertProfile({ id: profile.id, projectTypes: newTypes } as any);
                setProfile(updated);
            } catch (err: any) {
                console.error('[Settings] Delete project type failed:', err);
                alert('Gagal menghapus jenis Acara Pernikahan: ' + (err?.message || 'Coba lagi.'));
            }
        }
    };

    const handleAddOrUpdateEventType = async () => {
        if (!eventTypeInput.trim()) return;
        const newType = eventTypeInput.trim();
        const types = profile.eventTypes || [];
        let newTypes: string[];
        if (editingEventType) {
            if (newType !== editingEventType && types.includes(newType)) { alert('Jenis Acara Pernikahan ini sudah ada.'); return; }
            newTypes = types.map(t => t === editingEventType ? newType : t).sort();
        } else {
            if (types.includes(newType)) { alert('Jenis Acara Pernikahan ini sudah ada.'); return; }
            newTypes = [...types, newType].sort();
        }
        try {
            const updated = await upsertProfile({ id: profile.id, eventTypes: newTypes } as any);
            setProfile(updated);
            setEditingEventType(null);
            setEventTypeInput('');
        } catch (err: any) {
            console.error('[Settings] Save event type failed:', err);
            alert('Gagal menyimpan jenis Acara Pernikahan: ' + (err?.message || 'Coba lagi.'));
        }
    };
    const handleEditEventType = (type: string) => { setEditingEventType(type); setEventTypeInput(type); };
    const handleDeleteEventType = async (type: string) => {
        const isTypeInUse = projects.some(p => p.clientName === 'Acara Pernikahan Internal' && p.projectType === type);
        if (isTypeInUse) { alert(`Jenis Acara Pernikahan "${type}" tidak dapat dihapus karena sedang digunakan di kalender.`); return; }
        if (window.confirm(`Yakin ingin menghapus jenis Acara Pernikahan "${type}"?`)) {
            const newTypes = (profile.eventTypes || []).filter(t => t !== type);
            try {
                const updated = await upsertProfile({ id: profile.id, eventTypes: newTypes } as any);
                setProfile(updated);
            } catch (err: any) {
                console.error('[Settings] Delete event type failed:', err);
                alert('Gagal menghapus jenis Acara Pernikahan: ' + (err?.message || 'Coba lagi.'));
            }
        }
    };

    const handleAddOrUpdatePackageCategory = async () => {
        if (!packageCategoryInput.trim()) return;
        const newCat = packageCategoryInput.trim();
        const cats = profile.packageCategories || [];
        let newCats: string[];
        if (editingPackageCategory) {
            if (newCat !== editingPackageCategory && cats.includes(newCat)) { alert('Kategori ini sudah ada.'); return; }
            newCats = cats.map(c => c === editingPackageCategory ? newCat : c).sort();
        } else {
            if (cats.includes(newCat)) { alert('Kategori ini sudah ada.'); return; }
            newCats = [...cats, newCat].sort();
        }
        try {
            const updated = await upsertProfile({ id: profile.id, packageCategories: newCats } as any);
            setProfile(updated);
            setEditingPackageCategory(null);
            setPackageCategoryInput('');
        } catch (err: any) {
            console.error('[Settings] Save package category failed:', err);
            alert('Gagal menyimpan kategori Package: ' + (err?.message || 'Coba lagi.'));
        }
    };
    const handleEditPackageCategory = (cat: string) => { setEditingPackageCategory(cat); setPackageCategoryInput(cat); };
    const handleDeletePackageCategory = async (cat: string) => {
        const isUsed = packages.some(p => p.category === cat);
        if (isUsed) { alert(`Kategori "${cat}" tidak dapat dihapus karena sedang digunakan oleh Package.`); return; }
        if (window.confirm(`Yakin ingin menghapus kategori Package "${cat}"?`)) {
            const newCats = (profile.packageCategories || []).filter(c => c !== cat);
            try {
                const updated = await upsertProfile({ id: profile.id, packageCategories: newCats } as any);
                setProfile(updated);
            } catch (err: any) {
                console.error('[Settings] Delete package category failed:', err);
                alert('Gagal menghapus kategori Package: ' + (err?.message || 'Coba lagi.'));
            }
        }
    };

    // --- Tambah dari saran default (hanya yang belum ada) ---
    const mergeSuggested = async (current: string[], suggested: string[], key: keyof Profile) => {
        const set = new Set(current || []);
        const toAdd = suggested.filter(s => !set.has(s));
        if (toAdd.length === 0) return;
        const newList = [...(current || []), ...toAdd].sort();
        try {
            const updated = await upsertProfile({ id: profile.id, [key]: newList } as any);
            setProfile(updated);
        } catch (err: any) {
            console.error('[Settings] Merge suggested failed:', err);
            alert('Gagal menambah dari saran: ' + (err?.message || 'Coba lagi.'));
        }
    };
    const handleAddSuggestedIncome = () => mergeSuggested(profile.incomeCategories || [], DEFAULT_INCOME_CATEGORIES, 'incomeCategories');
    const handleAddSuggestedExpense = () => mergeSuggested(profile.expenseCategories || [], DEFAULT_EXPENSE_CATEGORIES, 'expenseCategories');
    const handleAddSuggestedProjectTypes = () => mergeSuggested(profile.projectTypes || [], DEFAULT_PROJECT_TYPES, 'projectTypes');
    const handleAddSuggestedEventTypes = () => mergeSuggested(profile.eventTypes || [], DEFAULT_EVENT_TYPES, 'eventTypes');
    const handleAddSuggestedPackageCategories = () => mergeSuggested(profile.packageCategories || [], DEFAULT_PACKAGE_CATEGORIES, 'packageCategories');

    const handleAddDefaultProjectStatuses = async () => {
        const current = profile.projectStatusConfig || [];
        const existingNames = new Set(current.map(s => s.name));
        const toAdd = DEFAULT_PROJECT_STATUS_SUGGESTIONS.filter(s => !existingNames.has(s.name)).map(s => ({
            id: crypto.randomUUID(),
            name: s.name,
            color: s.color,
            defaultProgress: s.defaultProgress,
            note: s.description,
            subStatuses: (s.subStatuses || []).map(sub => ({ name: sub.name, note: sub.note })),
        }));
        if (toAdd.length === 0) return;
        const newConfig = [...current, ...toAdd];
        setProfile(prev => ({ ...prev, projectStatusConfig: newConfig }));
        try {
            await upsertProfile({ id: profile.id, projectStatusConfig: newConfig } as any);
        } catch (err: any) {
            console.error('[Settings] Add default statuses failed:', err);
            alert('Gagal menambah status default: ' + (err?.message || 'Coba lagi.'));
        }
    };

    useEffect(() => {
        if (didInitProjectStatuses) return;
        if (!profile?.id) return;
        if (currentUser?.role !== 'Admin') return;
        if ((profile.projectStatusConfig || []).length > 0) {
            setDidInitProjectStatuses(true);
            return;
        }

        setDidInitProjectStatuses(true);
        handleAddDefaultProjectStatuses();
    }, [didInitProjectStatuses, profile?.id, (profile.projectStatusConfig || []).length, currentUser?.role]);

    const tabs = [
        { id: 'profile', label: 'Profil Saya', icon: UsersIcon, adminOnly: false },
        { id: 'users', label: 'Pengguna', icon: KeyIcon, adminOnly: true },
        { id: 'categories', label: 'Kustomisasi Kategori', icon: ListIcon, adminOnly: false },
        { id: 'projectStatus', label: 'Progres Acara Pernikahan Pengantin', icon: FolderKanbanIcon, adminOnly: true },
        { id: 'checklistTemplate', label: 'Template Checklist Hari H', icon: FileTextIcon, adminOnly: false },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <form onSubmit={handleSubmit} className="form-compact form-compact--ios-scale">
                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-sm md:text-lg font-semibold text-brand-text-light border-b border-gray-700/50 pb-2 md:pb-3">Informasi Publik</h3>
                            <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div className="input-group"><input id="fullName" type="text" name="fullName" value={profile.fullName || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="fullName" className="input-label">Nama Owner</label></div>
                                    <div className="input-group"><input id="companyName" type="text" name="companyName" value={profile.companyName || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="companyName" className="input-label">Nama Perusahaan</label></div>
                                    <div className="input-group"><input id="email" type="email" name="email" value={profile.email || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="email" className="input-label">Email</label></div>
                                    <div className="input-group"><input id="phone" type="tel" name="phone" value={profile.phone || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="phone" className="input-label">Telepon</label></div>
                                    <div className="input-group"><input id="website" type="url" name="website" value={profile.website || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="website" className="input-label">Website</label></div>
                                </div>
                                <div className="input-group"><input id="address" type="text" name="address" value={profile.address || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="address" className="input-label">Alamat</label></div>
                                <div className="input-group"><input id="bankAccount" type="text" name="bankAccount" value={profile.bankAccount || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="bankAccount" className="input-label">Rekening Bank</label></div>
                                <div className="input-group"><input id="authorizedSigner" type="text" name="authorizedSigner" value={profile.authorizedSigner || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="authorizedSigner" className="input-label">Nama Penanggung Jawab Tanda Tangan</label></div>
                                <div className="input-group"><input id="idNumber" type="text" name="idNumber" value={profile.idNumber || ''} onChange={handleInputChange} className="input-field" placeholder=" " /><label htmlFor="idNumber" className="input-label">No. KTP Penanggung Jawab</label></div>
                                <div className="input-group"><textarea id="bio" name="bio" value={profile.bio || ''} onChange={handleInputChange} className="input-field" placeholder=" " rows={3}></textarea><label htmlFor="bio" className="input-label">Bio Perusahaan</label></div>
                                <div>
                                    <div className="input-group"><textarea id="briefingTemplate" name="briefingTemplate" value={profile.briefingTemplate || ''} onChange={handleInputChange} className="input-field" placeholder=" " rows={3}></textarea><label htmlFor="briefingTemplate" className="input-label">Template Pesan Briefing Tim</label></div>
                                    <p className="text-xs text-brand-text-secondary mt-1">Ditambahkan di akhir pesan saat membagikan briefing Acara Pernikahan ke tim via WhatsApp.</p>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, briefingTemplate: DEFAULT_BRIEFING_TEMPLATE }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                            </div>

                            <h3 className="text-sm md:text-lg font-semibold text-brand-text-light border-b border-gray-700/50 pb-2 md:pb-3 mt-6 md:mt-8">Branding & Kustomisasi</h3>
                            <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
                                <div>
                                    <label htmlFor="logoUpload" className="text-xs md:text-sm font-medium text-brand-text-secondary">Logo Perusahaan (u/ Invoice)</label>
                                    <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                                        {profile.logoBase64 ?
                                            <img src={profile.logoBase64} alt="Logo preview" className="h-12 w-12 md:h-16 md:w-16 object-contain rounded-md bg-brand-bg p-1 border border-brand-border flex-shrink-0" />
                                            : <div className="h-12 w-12 md:h-16 md:w-16 rounded-md bg-brand-bg border border-brand-border flex items-center justify-center text-[10px] md:text-xs text-brand-text-secondary flex-shrink-0">No Logo</div>
                                        }
                                        <input
                                            id="logoUpload"
                                            type="file"
                                            name="logoBase64"
                                            onChange={handleLogoChange}
                                            className="block w-full text-xs md:text-sm text-brand-text-secondary file:mr-2 md:file:mr-4 file:py-1.5 md:file:py-2 file:px-3 md:file:px-4 file:rounded-full file:border-0 file:text-xs md:file:text-sm file:font-semibold file:bg-brand-accent/10 file:text-brand-accent hover:file:bg-brand-accent/20 cursor-pointer"
                                            accept="image/png, image/jpeg, image/svg+xml"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="signatureUpload" className="text-xs md:text-sm font-medium text-brand-text-secondary">Tanda Tangan (TTD) - untuk Invoice, Kontrak, Slip Gaji</label>
                                    <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                                        {profile.signatureBase64 ?
                                            <img src={profile.signatureBase64} alt="TTD preview" className="h-16 w-24 md:h-20 md:w-32 object-contain rounded-md bg-white p-1 border border-brand-border flex-shrink-0" />
                                            : <div className="h-16 w-24 md:h-20 md:w-32 rounded-md bg-brand-bg border border-brand-border flex items-center justify-center text-[10px] md:text-xs text-brand-text-secondary flex-shrink-0 text-center px-1">Belum Upload TTD</div>
                                        }
                                        <div className="flex flex-col gap-1">
                                            <input
                                                id="signatureUpload"
                                                type="file"
                                                name="signatureBase64"
                                                onChange={handleSignatureChange}
                                                className="block w-full text-xs md:text-sm text-brand-text-secondary file:mr-2 md:file:mr-4 file:py-1.5 md:file:py-2 file:px-3 md:file:px-4 file:rounded-full file:border-0 file:text-xs md:file:text-sm file:font-semibold file:bg-brand-accent/10 file:text-brand-accent hover:file:bg-brand-accent/20 cursor-pointer"
                                                accept="image/png, image/jpeg, image/webp"
                                            />
                                            <p className="text-[10px] md:text-xs text-brand-text-secondary">Upload gambar TTD Anda. TTD ini akan otomatis digunakan saat menandatangani invoice, kontrak, dan slip gaji.</p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="brandColor" className="text-xs md:text-sm font-medium text-brand-text-secondary">Warna Aksen Merek</label>
                                    <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                                        <div className="relative flex-shrink-0">
                                            <input
                                                id="brandColor"
                                                type="color"
                                                name="brandColor"
                                                value={profile.brandColor || '#3b82f6'}
                                                onChange={handleInputChange}
                                                className="w-12 h-8 md:w-16 md:h-10 p-1 bg-brand-bg border border-brand-border rounded-md cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-xs md:text-sm text-brand-text-secondary">Pilih warna yang mewakili merek Anda. Warna ini akan diterapkan di seluruh aplikasi, portal pengantin, dan dokumen.</p>
                                    </div>
                                </div>
                                <div>
                                    <div className="input-group !mt-6"><textarea id="termsAndConditions" name="termsAndConditions" value={profile.termsAndConditions || ''} onChange={handleInputChange} className="input-field" placeholder=" " rows={15}></textarea><label htmlFor="termsAndConditions" className="input-label">Syarat & Ketentuan (u/ Invoice)</label></div>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, termsAndConditions: DEFAULT_TERMS_AND_CONDITIONS }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                                <h4 className="text-sm font-semibold text-brand-text-light mt-6 mb-2">Template WhatsApp (Calon Pengantin/Leads)</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Digunakan saat membagikan link Package atau form booking ke Calon Pengantin dari halaman Calon Pengantin.</p>
                                <div>
                                    <div className="input-group !mt-2"><textarea id="packageShareTemplate" name="packageShareTemplate" value={profile.packageShareTemplate || ''} onChange={handleInputChange} className="input-field" placeholder=" " rows={5}></textarea><label htmlFor="packageShareTemplate" className="input-label">Template Bagikan Package</label></div>
                                    <p className="text-xs text-brand-text-secondary mt-1">Placeholder: {`{leadName}`}, {`{companyName}`}, {`{packageLink}`}</p>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, packageShareTemplate: DEFAULT_PACKAGE_SHARE_TEMPLATE }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                                <div className="mt-4">
                                    <div className="input-group !mt-2"><textarea id="bookingFormTemplate" name="bookingFormTemplate" value={profile.bookingFormTemplate || ''} onChange={handleInputChange} className="input-field" placeholder=" " rows={5}></textarea><label htmlFor="bookingFormTemplate" className="input-label">Template Kirim Form Booking</label></div>
                                    <p className="text-xs text-brand-text-secondary mt-1">Placeholder: {`{leadName}`}, {`{companyName}`}, {`{bookingFormLink}`}</p>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, bookingFormTemplate: DEFAULT_BOOKING_FORM_TEMPLATE }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                                <h4 className="text-sm font-semibold text-brand-text-light mt-8 mb-2 border-t border-brand-border pt-6">Template WhatsApp (Keuangan & Dokumen)</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Digunakan saat mengirim Invoice, Tanda Terima, Slip Pembayaran, atau share Portal Pengantin via WA.</p>

                                <div>
                                    <div className="input-group !mt-2"><textarea id="invoiceShareTemplate" name="invoiceShareTemplate" value={profile.invoiceShareTemplate || ''} onChange={handleInputChange} className="input-field min-h-[140px]" placeholder=" " rows={5}></textarea><label htmlFor="invoiceShareTemplate" className="input-label">Template Kirim Invoice</label></div>
                                    <p className="text-xs text-brand-text-secondary mt-1">Placeholder: {`{clientName}`}, {`{companyName}`}, {`{projectName}`}, {`{totalCost}`}, {`{amountPaid}`}, {`{sisaTagihan}`}, {`{invoiceLink}`}</p>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, invoiceShareTemplate: DEFAULT_INVOICE_SHARE_TEMPLATE }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                                <div className="mt-4">
                                    <div className="input-group !mt-2"><textarea id="receiptShareTemplate" name="receiptShareTemplate" value={profile.receiptShareTemplate || ''} onChange={handleInputChange} className="input-field min-h-[140px]" placeholder=" " rows={5}></textarea><label htmlFor="receiptShareTemplate" className="input-label">Template Kirim Tanda Terima Pelanggan</label></div>
                                    <p className="text-xs text-brand-text-secondary mt-1">Placeholder: {`{clientName}`}, {`{companyName}`}, {`{projectName}`}, {`{txDate}`}, {`{txAmount}`}, {`{txMethod}`}, {`{txDesc}`}, {`{receiptLink}`}</p>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, receiptShareTemplate: DEFAULT_RECEIPT_SHARE_TEMPLATE }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                                <div className="mt-4">
                                    <div className="input-group !mt-2"><textarea id="expenseShareTemplate" name="expenseShareTemplate" value={profile.expenseShareTemplate || ''} onChange={handleInputChange} className="input-field min-h-[140px]" placeholder=" " rows={5}></textarea><label htmlFor="expenseShareTemplate" className="input-label">Template Kirim Slip Pengeluaran</label></div>
                                    <p className="text-xs text-brand-text-secondary mt-1">Placeholder: {`{targetName}`}, {`{companyName}`}, {`{txDate}`}, {`{txAmount}`}, {`{txMethod}`}, {`{txDesc}`}, {`{receiptLink}`}</p>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, expenseShareTemplate: DEFAULT_EXPENSE_SHARE_TEMPLATE }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                                <div className="mt-4">
                                    <div className="input-group !mt-2"><textarea id="portalShareTemplate" name="portalShareTemplate" value={profile.portalShareTemplate || ''} onChange={handleInputChange} className="input-field min-h-[140px]" placeholder=" " rows={5}></textarea><label htmlFor="portalShareTemplate" className="input-label">Template Share Portal Pengantin</label></div>
                                    <p className="text-xs text-brand-text-secondary mt-1">Placeholder: {`{clientName}`}, {`{companyName}`}, {`{portalLink}`}</p>
                                    <button type="button" onClick={() => setProfile(p => ({ ...p, portalShareTemplate: DEFAULT_PORTAL_SHARE_TEMPLATE }))} className="text-xs text-brand-accent hover:underline mt-2">+ Gunakan contoh</button>
                                </div>
                            </div>

                            <h3 className="text-sm md:text-lg font-semibold text-brand-text-light border-b border-gray-700/50 pb-2 md:pb-3 mt-6 md:mt-8">Notifikasi</h3>
                            <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
                                <div className="flex justify-between items-center gap-3"><label htmlFor="notif-newProject" className="text-xs md:text-sm">Acara Pernikahan Baru Dibuat</label><ToggleSwitch id="notif-newProject" enabled={!!profile.notificationSettings?.newProject} onChange={() => handleNotificationChange('newProject')} /></div>
                                <div className="flex justify-between items-center gap-3"><label htmlFor="notif-paymentConfirmation" className="text-xs md:text-sm">Konfirmasi Pembayaran Diterima</label><ToggleSwitch id="notif-paymentConfirmation" enabled={!!profile.notificationSettings?.paymentConfirmation} onChange={() => handleNotificationChange('paymentConfirmation')} /></div>
                                <div className="flex justify-between items-center gap-3"><label htmlFor="notif-deadlineReminder" className="text-xs md:text-sm">Pengingat Deadline Acara Pernikahan</label><ToggleSwitch id="notif-deadlineReminder" enabled={!!profile.notificationSettings?.deadlineReminder} onChange={() => handleNotificationChange('deadlineReminder')} /></div>
                            </div>

                            <h3 className="text-sm md:text-lg font-semibold text-brand-text-light border-b border-gray-700/50 pb-2 md:pb-3 mt-6 md:mt-8">Keamanan</h3>
                            <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
                                <div className="flex justify-between items-center gap-3"><label htmlFor="security-2fa" className="text-xs md:text-sm">Autentikasi Dua Faktor (2FA)</label><ToggleSwitch id="security-2fa" enabled={!!profile.securitySettings?.twoFactorEnabled} onChange={() => setProfile(p => ({ ...p, securitySettings: { twoFactorEnabled: !(p.securitySettings?.twoFactorEnabled ?? false) } }))} /></div>
                            </div>

                            {saveError && (
                                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                                    {saveError}
                                </div>
                            )}
                            <div className="text-right mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-700/50">
                                <button type="submit" className="button-primary relative w-full md:w-auto" disabled={isSaving}>
                                    {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    {showSuccess && <span className="absolute -right-4 -top-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full animate-fade-in-out">✓</span>}
                                </button>
                            </div>
                        </div>
                    </form>
                );
            case 'users':
                if (currentUser?.role !== 'Admin') return <p className="text-sm md:text-base text-brand-text-secondary">Anda tidak memiliki akses ke halaman ini.</p>;
                return (
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
                            <h3 className="text-sm md:text-lg font-semibold text-brand-text-light">Manajemen Pengguna</h3>
                            <button onClick={() => handleOpenUserModal('add')} className="button-primary inline-flex items-center gap-2 w-full sm:w-auto text-sm md:text-base"><PlusIcon className="w-4 h-4 md:w-5 md:h-5" />Tambah Pengguna</button>
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            {users.map(user => (
                                <div key={user.id} className="p-3 md:p-4 bg-brand-bg rounded-lg flex justify-between items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm md:text-base text-brand-text-light truncate">{user.fullName}</p>
                                        <p className="text-xs md:text-sm text-brand-text-secondary truncate">{user.email} - <span className="font-medium">{user.role}</span></p>
                                    </div>
                                    <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                        <button onClick={() => handleOpenUserModal('edit', user)} className="p-1.5 md:p-2 text-brand-text-secondary hover:bg-brand-input rounded-full" title="Edit"><PencilIcon className="w-4 h-4 md:w-5 md:h-5" /></button>
                                        <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 md:p-2 text-brand-text-secondary hover:bg-brand-input rounded-full" title="Hapus"><Trash2Icon className="w-4 h-4 md:w-5 md:h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'categories':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
                        <CategoryManager
                            title="Kategori Pemasukan"
                            categories={profile.incomeCategories}
                            inputValue={incomeCategoryInput}
                            onInputChange={setIncomeCategoryInput}
                            onAddOrUpdate={handleAddOrUpdateIncomeCategory}
                            onEdit={handleEditIncomeCategory}
                            onDelete={handleDeleteIncomeCategory}
                            editingValue={editingIncomeCategory}
                            onCancelEdit={() => { setEditingIncomeCategory(null); setIncomeCategoryInput(''); }}
                            placeholder="e.g., DP Acara Pernikahan"
                            suggestedDefaults={DEFAULT_INCOME_CATEGORIES}
                            onAddSuggested={handleAddSuggestedIncome}
                        />
                        <CategoryManager
                            title="Kategori Pengeluaran"
                            categories={profile.expenseCategories}
                            inputValue={expenseCategoryInput}
                            onInputChange={setExpenseCategoryInput}
                            onAddOrUpdate={handleAddOrUpdateExpenseCategory}
                            onEdit={handleEditExpenseCategory}
                            onDelete={handleDeleteExpenseCategory}
                            editingValue={editingExpenseCategory}
                            onCancelEdit={() => { setEditingExpenseCategory(null); setExpenseCategoryInput(''); }}
                            placeholder="e.g., Gaji Tim / Vendor"
                            suggestedDefaults={DEFAULT_EXPENSE_CATEGORIES}
                            onAddSuggested={handleAddSuggestedExpense}
                        />
                        <CategoryManager
                            title="Jenis Acara Pernikahan"
                            categories={profile.projectTypes}
                            inputValue={projectTypeInput}
                            onInputChange={setProjectTypeInput}
                            onAddOrUpdate={handleAddOrUpdateProjectType}
                            onEdit={handleEditProjectType}
                            onDelete={handleDeleteProjectType}
                            editingValue={editingProjectType}
                            onCancelEdit={() => { setEditingProjectType(null); setProjectTypeInput(''); }}
                            placeholder="e.g., Pernikahan"
                            suggestedDefaults={DEFAULT_PROJECT_TYPES}
                            onAddSuggested={handleAddSuggestedProjectTypes}
                        />
                        <CategoryManager
                            title="Jenis Acara Pernikahan Internal"
                            categories={profile.eventTypes}
                            inputValue={eventTypeInput}
                            onInputChange={setEventTypeInput}
                            onAddOrUpdate={handleAddOrUpdateEventType}
                            onEdit={handleEditEventType}
                            onDelete={handleDeleteEventType}
                            editingValue={editingEventType}
                            onCancelEdit={() => { setEditingEventType(null); setEventTypeInput(''); }}
                            placeholder="e.g., Meeting Pengantin"
                            suggestedDefaults={DEFAULT_EVENT_TYPES}
                            onAddSuggested={handleAddSuggestedEventTypes}
                        />
                        <CategoryManager
                            title="Kategori Package"
                            categories={profile.packageCategories || []}
                            inputValue={packageCategoryInput}
                            onInputChange={setPackageCategoryInput}
                            onAddOrUpdate={handleAddOrUpdatePackageCategory}
                            onEdit={handleEditPackageCategory}
                            onDelete={handleDeletePackageCategory}
                            editingValue={editingPackageCategory}
                            onCancelEdit={() => { setEditingPackageCategory(null); setPackageCategoryInput(''); }}
                            placeholder="e.g., Pernikahan"
                            suggestedDefaults={DEFAULT_PACKAGE_CATEGORIES}
                            onAddSuggested={handleAddSuggestedPackageCategories}
                        />
                    </div>
                );
            case 'projectStatus':
                if (currentUser?.role !== 'Admin') return <p className="text-sm md:text-base text-brand-text-secondary">Anda tidak memiliki akses ke halaman ini.</p>;
                return (
                    <ProjectStatusManager
                        config={profile.projectStatusConfig}
                        onConfigChange={(newConfig) => setProfile(prev => ({ ...prev, projectStatusConfig: newConfig }))}
                        projects={projects}
                        profile={profile}
                        onAddDefaultStatuses={handleAddDefaultProjectStatuses}
                    />
                );

            case 'checklistTemplate':
                return (
                    <ChecklistTemplateSettings
                        profile={profile}
                        setProfile={setProfile}
                        showNotification={(msg) => {
                            setShowSuccess(true);
                            setTimeout(() => setShowSuccess(false), 3000);
                        }}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <PageHeader title="Pengaturan" subtitle="Kelola profil, pengguna, dan kustomisasi aplikasi Anda." icon={<SettingsIcon className="w-6 h-6" />} />

            {/* Mobile Tab Navigation - Horizontal Scroll */}
            <div className="lg:hidden">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:-mx-0 md:px-0">
                    {tabs
                        .filter(tab => !(tab.adminOnly && currentUser?.role !== 'Admin'))
                        .map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-shrink-0 inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-full font-medium text-xs md:text-sm transition-all duration-200 ${activeTab === tab.id
                                    ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30'
                                    : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'
                                    }`}
                            >
                                <tab.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                {/* Desktop Sidebar Navigation */}
                <aside className="hidden lg:block lg:col-span-1">
                    <nav className="space-y-1 sticky top-24">
                        {tabs
                            .filter(tab => !(tab.adminOnly && currentUser?.role !== 'Admin'))
                            .map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-lg transition-all duration-200 text-left ${activeTab === tab.id
                                        ? 'bg-brand-accent text-white shadow-lg'
                                        : 'text-brand-text-secondary hover:bg-brand-input hover:text-brand-text-light'
                                        }`}
                                >
                                    <tab.icon className="w-5 h-5 mr-3" />
                                    {tab.label}
                                </button>
                            ))}
                    </nav>
                </aside>
                <main className="lg:col-span-3 bg-brand-surface p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl shadow-lg min-h-[60vh]">
                    {renderTabContent()}
                </main>
            </div>

            <Modal isOpen={isUserModalOpen} onClose={handleCloseUserModal} title={userModalMode === 'add' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}>
                <form onSubmit={handleUserFormSubmit} className="space-y-4 form-compact form-compact--ios-scale">
                    {userFormError && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-md">{userFormError}</p>}

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                            <KeyIcon className="w-4 h-4" />
                            Informasi Pengguna
                        </h4>
                        <p className="text-xs text-brand-text-secondary">
                            Tambahkan pengguna baru yang dapat mengakses sistem. Atur peran dan izin akses sesuai kebutuhan.
                        </p>
                    </div>

                    <div>
                        <h5 className="text-sm font-semibold text-brand-text-light mb-3">Data Pribadi</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="input-group">
                                <input type="text" name="fullName" value={userForm.fullName} onChange={handleUserFormChange} className="input-field" placeholder=" " required />
                                <label className="input-label">Nama Pengantin</label>
                                <p className="text-xs text-brand-text-secondary mt-1">Nama Pengantin pengguna</p>
                            </div>
                            <div className="input-group">
                                <input type="email" name="email" value={userForm.email} onChange={handleUserFormChange} className="input-field" placeholder=" " required />
                                <label className="input-label">Email</label>
                                <p className="text-xs text-brand-text-secondary mt-1">Email untuk login ke sistem</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h5 className="text-sm font-semibold text-brand-text-light mb-3">Keamanan</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="input-group">
                                <input type="password" name="password" value={userForm.password} onChange={handleUserFormChange} className="input-field" placeholder=" " required={userModalMode === 'add'} />
                                <label className="input-label">{userModalMode === 'add' ? 'Kata Sandi' : 'Kata Sandi Baru'}</label>
                                <p className="text-xs text-brand-text-secondary mt-1">{userModalMode === 'add' ? 'Minimal 6 karakter' : 'Kosongkan jika tidak berubah'}</p>
                            </div>
                            <div className="input-group">
                                <input type="password" name="confirmPassword" value={userForm.confirmPassword} onChange={handleUserFormChange} className="input-field" placeholder=" " required={!!userForm.password} />
                                <label className="input-label">Konfirmasi Kata Sandi</label>
                                <p className="text-xs text-brand-text-secondary mt-1">Ketik ulang kata sandi</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h5 className="text-sm font-semibold text-brand-text-light mb-3">Peran & Izin Akses</h5>
                        <div className="input-group">
                            <select name="role" value={userForm.role} onChange={handleUserFormChange} className="input-field">
                                <option value="Member">Member</option>
                                <option value="Admin">Admin</option>
                            </select>
                            <label className="input-label">Peran</label>
                            <p className="text-xs text-brand-text-secondary mt-1">Admin memiliki akses penuh, Member dapat dikustomisasi</p>
                        </div>
                    </div>

                    {userForm.role === 'Member' && (
                        <div className="bg-brand-bg p-4 rounded-lg border border-brand-border">
                            <h5 className="text-sm font-semibold text-brand-text-light mb-3">Izin Akses Halaman</h5>
                            <p className="text-xs text-brand-text-secondary mb-3">Pilih halaman mana saja yang dapat diakses oleh pengguna ini</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {NAV_ITEMS.filter(item => item.view !== ViewType.SETTINGS).map(item => (
                                    <label key={item.view} className="flex items-center gap-2 p-2 rounded-md hover:bg-brand-input cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={userForm.permissions.includes(item.view)}
                                            onChange={e => handlePermissionsChange(item.view, e.target.checked)}
                                            className="h-4 w-4 rounded flex-shrink-0 text-brand-accent focus:ring-brand-accent transition-colors"
                                        />
                                        <span className="text-sm text-brand-text-primary">{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-brand-border">
                        <button type="button" onClick={handleCloseUserModal} className="button-secondary w-full sm:w-auto">Batal</button>
                        <button type="submit" className="button-primary w-full sm:w-auto">{userModalMode === 'add' ? 'Simpan Pengguna' : 'Update Pengguna'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Settings;