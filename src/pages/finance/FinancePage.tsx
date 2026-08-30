import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, FinancialPocket, PocketType, Profile, Project, Card, CardType, TeamMember, PaymentStatus } from '../../types';
import PageHeader from '../../layouts/PageHeader';
import Modal from '../../shared/ui/Modal';
import StatCard from '../../shared/ui/StatCard';
import StatCardModal from '../../shared/ui/StatCardModal';
import DonutChart from '../../shared/ui/DonutChart';
import InteractiveCashflowChart from '../../shared/ui/InteractiveCashflowChart';
import RupiahInput from '../../shared/form/RupiahInput';
import { PencilIcon, Trash2Icon, PlusIcon, PiggyBankIcon, LockIcon, UsersIcon, ClipboardListIcon, DollarSignIcon, ArrowUpIcon, ArrowDownIcon, CreditCardIcon, FileTextIcon, CalendarIcon, TrendingUpIcon, TrendingDownIcon, BarChart2Icon, DownloadIcon, CashIcon, StarIcon, LightbulbIcon, TargetIcon, PrinterIcon, ChevronRightIcon } from '../../constants';
import { createCard as createCardRow, updateCard as updateCardRow, deleteCard as deleteCardRow, safeDeleteCard } from '../../services/cards';
import { createTransaction as createTransactionRow, updateCardBalance, updateTransaction as updateTransactionRow } from '../../services/transactions';
import { createPocket as createPocketRow, updatePocket as updatePocketRow, deletePocket as deletePocketRow } from '../../services/pockets';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

// Currency formatter for CSV: avoids non-breaking space that Excel may render as 'Â'
const formatCurrencyCSV = (amount: number) => {
    const numberPart = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(amount);
    return `Rp ${numberPart}`; // regular space between Rp and number
}

const downloadCSV = (
    headers: string[],
    data: (string | number | undefined)[][],
    filename: string,
    prefaceRows: (string | number | undefined)[][] = []
) => {
    // Use semicolon as delimiter for locales (like Indonesia) where Excel expects ';'
    const DELIM = ';';
    const normalizeField = (field: string | number | undefined) => {
        const str = String(field ?? '');
        if (str.includes(DELIM) || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    const normalizeRow = (row: (string | number | undefined)[]) => row.map(normalizeField).join(DELIM);

    const csvRows = [
        // Excel delimiter hint to ensure proper column splitting
        `sep=${DELIM}`,
        ...prefaceRows.map(normalizeRow),
        headers.map(normalizeField).join(DELIM),
        ...data.map(normalizeRow)
    ];

    const csvString = csvRows.join('\n');
    // Add UTF-8 BOM so Excel (Windows) recognizes encoding and Indonesian characters
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const PRODUCTION_COST_CATEGORIES = ["Gaji Tim / Vendor", "Transportasi", "Konsumsi", "Sewa Tempat", "Sewa Alat", "Produksi Fisik"];

const ShieldIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
);

const emptyTransaction = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    type: TransactionType.EXPENSE,
    category: '',
    method: 'Kartu',
    cardId: '',
    sourceId: '', // 'card-ID' or 'pocket-ID'
};

const emptyPocket: Omit<FinancialPocket, 'id' | 'amount'> = { name: '', description: '', type: PocketType.SAVING, icon: 'piggy-bank' };
const emptyCard: Omit<Card, 'id' | 'balance'> = { cardHolderName: 'Nama Pengguna', bankName: 'WBank', cardType: CardType.DEBIT, lastFourDigits: '', expiryDate: '', colorGradient: 'from-blue-500 to-cyan-500' };

const CardWidget: React.FC<{ card: Card, onEdit: () => void, onDelete: () => void, onClick: () => void, connectedPockets: FinancialPocket[] }> = ({ card, onEdit, onDelete, onClick, connectedPockets }) => {
    const gradient = card.colorGradient || 'from-slate-200 to-slate-400';
    const isLight = gradient.includes('slate-100');
    const textColor = isLight ? 'text-gray-800' : 'text-white';

    const ChipIcon = () => (
        <svg className="w-10 h-8" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="28" rx="4" fill="#D1D5DB" />
            <rect x="4" y="4" width="32" height="20" rx="2" fill="#FBBF24" />
            <path d="M4 14H18" stroke="#92400E" strokeWidth="2" />
            <path d="M22 14H36" stroke="#92400E" strokeWidth="2" />
            <path d="M20 4V12" stroke="#92400E" strokeWidth="2" />
            <path d="M20 16V24" stroke="#92400E" strokeWidth="2" />
        </svg>
    );
    const VisaLogo = () => <svg height="24px" viewBox="0 0 1000 310" className={`${isLight ? 'fill-black/70' : 'fill-white/90'}`}><path d="M783 310h101l-123-310H643l-89 220-22-220H414L291 310h103l23-60h100l15 60zM520 125l31 82 31-82h-62zM389 125l-63 158-20-44-41-114h-100l170 310h124L741 0H638l-49 125z" /></svg>;
    const MastercardLogo = () => (
        <svg className="w-12 h-8" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="16" r="10" fill="#EB001B" opacity="0.9" />
            <circle cx="30" cy="16" r="10" fill="#F79E1B" opacity="0.9" />
        </svg>
    );

    return (
        <div
            className="group relative w-full cursor-pointer"
            style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
            onClick={onClick}
        >
            <div className={`
                relative w-full h-full px-5 py-6 rounded-3xl ${textColor} shadow-xl flex flex-col justify-between 
                bg-gradient-to-br ${gradient} 
                transition-all duration-300 group-hover:shadow-2xl group-hover:scale-[1.02]
                overflow-hidden
                min-h-[200px]
            `}>
                {/* Decorative circles - modern mobile UI style */}
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
                <div className="absolute -right-4 top-12 w-24 h-24 rounded-full bg-white/5"></div>
                <div className="absolute right-8 top-20 w-16 h-16 rounded-full bg-white/10"></div>

                {/* Card Top */}
                <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                        <p className="font-bold text-base mb-0.5">{card.bankName}</p>
                        <p className="text-xs opacity-70">{card.cardType}</p>
                    </div>
                    {card.bankName.toUpperCase() === 'VISA' ? <VisaLogo /> :
                        card.bankName.toLowerCase().includes('master') ? <MastercardLogo /> :
                            <ChipIcon />}
                </div>

                {/* Card Middle - Card Number */}
                <div className="relative z-10 mb-4">
                    <p className="text-xl font-mono tracking-[0.15em] mb-3">
                        {card.lastFourDigits.padStart(4, '0')} •••• •••• {card.lastFourDigits.padStart(4, '0')}
                    </p>
                    <p className="text-3xl font-bold tracking-tight">{formatCurrency(card.balance)}</p>
                </div>

                {/* Card Bottom */}
                <div className="relative z-10 flex justify-between items-end text-sm">
                    <div>
                        <p className="text-xs opacity-60 mb-1">Card Holder</p>
                        <p className="font-semibold text-sm">{card.cardHolderName}</p>
                    </div>
                    {card.expiryDate && (
                        <div className="text-right">
                            <p className="text-xs opacity-60 mb-1">Expiry</p>
                            <p className="font-semibold text-sm">{card.expiryDate}</p>
                        </div>
                    )}
                </div>

                {/* Actions on hover */}
                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 non-printable z-20">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 backdrop-blur-sm"><PencilIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 backdrop-blur-sm"><Trash2Icon className="w-4 h-4" /></button>
                </div>
            </div>

            {connectedPockets.length > 0 && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] bg-brand-input p-2 rounded-lg text-xs shadow-md opacity-0 group-hover:opacity-100 group-hover:-bottom-5 transition-all duration-300">
                    <p className="font-semibold text-brand-text-secondary text-center">Terhubung ke: {connectedPockets.map(p => p.name).join(', ')}</p>
                </div>
            )}
        </div>
    );
};

const PocketStatCard: React.FC<{
    pocket: FinancialPocket;
    amount: number;
    sourceCardName?: string | null;
    progressPercent: number;
    onClick: () => void;
    onWithdraw: () => void;
    onDeposit: () => void;
    headerActions?: React.ReactNode;
}> = ({ pocket, amount, sourceCardName, progressPercent, onClick, onWithdraw, onDeposit, headerActions }) => {
    const gradientByType: Record<string, string> = {
        [PocketType.SAVING]: 'from-emerald-500 to-teal-500',
        [PocketType.EXPENSE]: 'from-rose-500 to-pink-500',
    };
    const gradient = gradientByType[pocket.type] || 'from-blue-500 to-cyan-500';
    const progress = Math.max(0, Math.min(progressPercent, 100));

    return (
        <div className="group relative w-full cursor-pointer" onClick={onClick}>
            <div className={
                `relative w-full h-full p-5 rounded-3xl shadow-xl border border-white/10 bg-gradient-to-br ${gradient} overflow-hidden transition-all duration-300 group-hover:shadow-2xl group-hover:scale-[1.01]`
            }>
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl"></div>
                <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-black/10 blur-2xl"></div>

                <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-bold text-lg text-white truncate">{pocket.name}</p>
                        {pocket.description && <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{pocket.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        {headerActions}
                        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white">
                            {pocketIcons[pocket.icon]}
                        </div>
                    </div>
                </div>

                <div className="relative z-10 mt-4">
                    <p className="text-3xl font-black tracking-tight text-white">{formatCurrency(amount)}</p>
                    {pocket.goalAmount ? (
                        <div className="mt-3">
                            <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                                <div className="bg-white h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-[11px] text-white/80 mt-1 text-right">Target: {formatCurrency(pocket.goalAmount)}</p>
                        </div>
                    ) : null}
                    {sourceCardName ? <p className="text-[11px] text-white/85 mt-2">Disimpan di: {sourceCardName}</p> : null}
                </div>

                <div className="relative z-10 flex gap-2 mt-4 pt-4 border-t border-white/15 non-printable">
                    <button
                        onClick={(e) => { e.stopPropagation(); onWithdraw(); }}
                        className="flex-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold py-2.5 transition-colors"
                    >
                        Tarik Dana
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDeposit(); }}
                        className="flex-1 rounded-xl bg-white text-slate-900 hover:bg-white/90 text-sm font-semibold py-2.5 transition-colors"
                    >
                        Setor Dana
                    </button>
                </div>
            </div>
        </div>
    );
};

const CashWidget: React.FC<{ card: Card, onTopUp: () => void, onEdit: () => void, onClick: () => void, connectedPockets: FinancialPocket[] }> = ({ card, onTopUp, onEdit, onClick, connectedPockets }) => {
    return (
        <div
            className="group relative w-full cursor-pointer"
            style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
            onClick={onClick}
        >
            <div className={`
                relative w-full h-full px-5 py-6 rounded-3xl text-slate-800 shadow-xl flex flex-col justify-between 
                bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100
                transition-all duration-300 group-hover:shadow-2xl group-hover:scale-[1.02]
                overflow-hidden
                min-h-[200px]
            `}>
                {/* Decorative circles - warm tone for cash */}
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-200/30 blur-2xl"></div>
                <div className="absolute -right-4 top-12 w-24 h-24 rounded-full bg-orange-200/20"></div>
                <div className="absolute right-8 top-20 w-16 h-16 rounded-full bg-amber-300/20"></div>

                {/* Top */}
                <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                        <p className="font-bold text-base text-amber-900 mb-0.5">{card.bankName}</p>
                        <p className="text-xs text-amber-700/70">Cash Account</p>
                    </div>
                    <div className="bg-amber-200/50 p-2 rounded-full">
                        <CashIcon className="w-6 h-6 text-amber-700" />
                    </div>
                </div>

                {/* Middle */}
                <div className="relative z-10 mb-4">
                    <p className="text-sm text-amber-700/80 mb-2">Available Balance</p>
                    <p className="text-3xl font-bold tracking-tight text-amber-900">{formatCurrency(card.balance)}</p>
                </div>

                {/* Bottom */}
                <div className="relative z-10 text-sm">
                    <p className="text-xs text-amber-700/60 mb-1">Account Holder</p>
                    <p className="font-semibold text-sm text-amber-900">{card.cardHolderName}</p>
                </div>

                {/* Actions on hover */}
                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 non-printable z-20">
                    <button onClick={(e) => { e.stopPropagation(); onTopUp(); }} className="bg-amber-900/10 hover:bg-amber-900/20 text-amber-900 rounded-full p-2 backdrop-blur-sm" title="Top-up Tunai"><ArrowUpIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="bg-amber-900/10 hover:bg-amber-900/20 text-amber-900 rounded-full p-2 backdrop-blur-sm" title="Edit"><PencilIcon className="w-4 h-4" /></button>
                </div>
            </div>

            {connectedPockets.length > 0 && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] bg-brand-input p-2 rounded-lg text-xs shadow-md opacity-0 group-hover:opacity-100 group-hover:-bottom-5 transition-all duration-300">
                    <p className="font-semibold text-brand-text-secondary text-center">Terhubung ke: {connectedPockets.map(p => p.name).join(', ')}</p>
                </div>
            )}
        </div>
    );
};

interface FinanceProps {
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    profile: Profile;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    teamMembers: TeamMember[];

}

const pocketIcons: { [key in FinancialPocket['icon']]: React.ReactNode } = {
    'piggy-bank': <PiggyBankIcon className="w-8 h-8" />, 'lock': <LockIcon className="w-8 h-8" />,
    'users': <UsersIcon className="w-8 h-8" />, 'clipboard-list': <ClipboardListIcon className="w-8 h-8" />,
    'star': <StarIcon className="w-8 h-8" />
};

const getMonthDateRange = (date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
        from: startOfMonth.toISOString().split('T')[0],
        to: endOfMonth.toISOString().split('T')[0]
    };
};

const TransactionTable: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    if (transactions.length === 0) return <p className="text-center py-10 text-brand-text-secondary">Tidak ada transaksi pada periode ini.</p>;
    return (
        <table className="w-full text-sm">
            <thead className="text-xs uppercase print-bg-slate bg-brand-input"><tr className="print-text-black"><th className="p-3 text-left">ID Transaksi</th><th className="p-3 text-left">Tanggal</th><th className="p-3 text-left">Deskripsi</th><th className="p-3 text-left">Kategori</th><th className="p-3 text-right">Jumlah</th></tr></thead>
            <tbody className="divide-y divide-brand-border">
                {transactions.map((t, idx) => (
                    <tr key={`${t.id || 'no-id'}-${idx}`}>
                        <td className="p-3 font-mono text-xs">{t.id}</td>
                        <td className="p-3">{new Date(t.date).toLocaleDateString('id-ID')}</td>
                        <td className="p-3 font-semibold">{t.description}</td>
                        <td className="p-3">{t.category}</td>
                        <td className={`p-3 text-right font-semibold ${t.type === TransactionType.INCOME ? 'print-text-green text-brand-success' : 'print-text-red text-brand-danger'}`}>{formatCurrency(t.amount)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const Finance: React.FC<FinanceProps> = ({ transactions, setTransactions, pockets, setPockets, projects, setProjects, profile, cards, setCards, teamMembers }) => {
    const [activeTab, setActiveTab] = useState<'transactions' | 'pockets' | 'cards' | 'cashflow' | 'laporan' | 'laporanKartu' | 'labaAcara Pernikahan'>('transactions');
    const [modalState, setModalState] = useState<{ type: null | 'transaction' | 'pocket' | 'card' | 'transfer' | 'topup-cash', mode: 'add' | 'edit', data?: any }>({ type: null, mode: 'add' });
    const [historyModalState, setHistoryModalState] = useState<{ type: 'card' | 'pocket', item: Card | FinancialPocket | null } | null>(null);
    const [form, setForm] = useState<any>({});
    const [activeStatModal, setActiveStatModal] = useState<'assets' | 'pockets' | 'income' | 'expense' | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    // FILTERS
    const [filters, setFilters] = useState({ searchTerm: '', dateFrom: '', dateTo: '' });
    const [categoryFilter, setCategoryFilter] = useState<{ type: TransactionType | 'all', category: string }>({ type: 'all', category: 'Semua' });
    const [reportFilters, setReportFilters] = useState({ client: 'all', dateFrom: '', dateTo: '' });
    const [profitReportFilters, setProfitReportFilters] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
    const [transactionProjectMonthFilter, setTransactionProjectMonthFilter] = useState<string>(() => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${now.getFullYear()}-${month}`;
    });


    const [offset, setOffset] = useState(100);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const loadMoreTransactions = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const { listTransactions } = await import('../../services/transactions');
            const nextTxs = await listTransactions({ limit: 100, offset });
            if (nextTxs.length < 100) {
                setHasMore(false);
            }
            if (nextTxs.length > 0) {
                setTransactions(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const uniqueNew = nextTxs.filter(t => !existingIds.has(t.id));
                    return [...prev, ...uniqueNew].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                });
                setOffset(prev => prev + 100);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error('[Finance] Failed to load more transactions:', e);
            // showNotification is not fully implemented in this component as per line 295, 
            // but we use console.error for now.
        } finally {
            setIsLoadingMore(false);
        }
    };

    const showNotification = (message: string) => {
        // A simple placeholder for the app's notification system
        // In the main App, this is handled via state. Here, we can just log it
        // or assume a global notification function exists if this component were truly standalone.
        // Notification suppressed to keep console clean.
        // This component doesn't have access to the App's notification state,
        // so we can't show a visual notification from here without prop drilling `setNotification`.
        // For the purpose of this request, we will assume it's available via props if needed,
        // but the core logic is what's important.
    };

    const handleCloseBudget = (budgetPocket: FinancialPocket, isAutomatic: boolean = false) => {
        if (!budgetPocket) {
            return;
        }

        const now = new Date();
        const closedPocketName = budgetPocket.name;
        const currentMonthName = `Anggaran Operasional ${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;

        if (budgetPocket.amount > 0) {
            const newSavedPocket: FinancialPocket = {
                id: `POC-SISA-${now.getTime()}`,
                name: `Sisa ${closedPocketName}`,
                description: 'Hasil penutupan anggaran bulanan.',
                icon: 'piggy-bank',
                type: PocketType.SAVING,
                amount: budgetPocket.amount,
                sourceCardId: budgetPocket.sourceCardId,
            };

            const closingTx: Transaction = {
                id: `TRN-CLOSE-${now.getTime()}`,
                date: now.toISOString().split('T')[0],
                description: `Penutupan anggaran: ${closedPocketName}`,
                amount: budgetPocket.amount,
                type: TransactionType.EXPENSE,
                category: 'Penutupan Anggaran',
                method: 'Sistem',
                pocketId: budgetPocket.id
            };

            setPockets(prev => {
                const withNewPocket = [...prev, newSavedPocket];
                return withNewPocket.map(p =>
                    p.id === budgetPocket.id
                        ? { ...p, amount: 0, name: currentMonthName }
                        : p);
            });
            setTransactions(prev => [closingTx, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            showNotification(`Anggaran "${closedPocketName}" ditutup. Sisa ${formatCurrency(budgetPocket.amount)} disimpan.`);
        } else {
            // Just reset the pocket for the new month if amount is 0
            setPockets(prev => prev.map(p =>
                p.id === budgetPocket.id
                    ? { ...p, name: currentMonthName }
                    : p
            ));
            if (isAutomatic) {
                showNotification(`Anggaran bulanan telah diperbarui untuk ${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}.`);
            }
        }
    };

    useEffect(() => {
        const autoCloseBudget = () => {
            const budgetPocket = pockets.find(p => p.type === PocketType.EXPENSE);
            if (!budgetPocket) return;

            const nameParts = budgetPocket.name.replace('Anggaran Operasional ', '').split(' ');
            if (nameParts.length < 2) return;

            const monthName = nameParts[0];
            const year = parseInt(nameParts[1], 10);

            if (isNaN(year)) return;

            const monthMap: { [key in string]: number } = {
                'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
                'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
            };
            const month = monthMap[monthName];

            if (month === undefined) return;

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            if (year < currentYear || (year === currentYear && month < currentMonth)) {
                handleCloseBudget(budgetPocket, true);
            }
        };

        autoCloseBudget();
    }, []); // Run only once on mount

    const cashflowChartData = useMemo(() => {
        const monthlyData: { [key: string]: { income: number, expense: number } } = {};
        [...transactions].reverse().forEach(t => {
            const month = new Date(t.date).toLocaleString('default', { month: 'short', year: '2-digit' });
            if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
            if (t.type === TransactionType.INCOME) monthlyData[month].income += t.amount;
            else if (t.type === TransactionType.EXPENSE) monthlyData[month].expense += t.amount;
        });

        let balance = 0;
        return Object.entries(monthlyData).map(([label, values]) => {
            balance += values.income - values.expense;
            return { label, ...values, balance };
        });
    }, [transactions]);

    const cashflowMetrics = useMemo(() => {
        const data = cashflowChartData; // The chart data is already calculated
        if (data.length === 0) {
            return { avgIncome: 0, avgExpense: 0, runway: 'N/A', burnRate: 0 };
        }
        const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
        const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
        const numMonths = data.length;

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentTransactions = transactions.filter(t => new Date(t.date) >= sixMonthsAgo);
        const recentNetChange = recentTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0) - recentTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
        const monthlyBurnRate = recentNetChange > 0 ? recentNetChange / Math.min(6, numMonths) : 0;

        let runway = 'Tak Terbatas';
        if (monthlyBurnRate > 0) {
            const totalAssets = cards.reduce((sum, card) => sum + card.balance, 0);
            const runwayInMonths = totalAssets / monthlyBurnRate;
            runway = `${runwayInMonths.toFixed(1)} bulan`;
        }

        return {
            avgIncome: totalIncome / numMonths,
            avgExpense: totalExpense / numMonths,
            runway,
            burnRate: monthlyBurnRate
        };
    }, [transactions, cards, cashflowChartData]);

    const { summary, thisMonthIncome, thisMonthExpense } = useMemo(() => {
        const totalAssets = cards.reduce((sum, c) => sum + c.balance, 0);
        const pocketsTotal = pockets.reduce((sum, p) => sum + p.amount, 0);

        const now = new Date();
        const { from, to } = getMonthDateRange(now);
        const fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);

        const thisMonthTransactions = transactions.filter(t => {
            const txDate = new Date(t.date);
            return txDate >= fromDate && txDate <= toDate;
        });

        const totalIncomeThisMonth = thisMonthTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
        const totalExpenseThisMonth = thisMonthTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);

        return {
            summary: { totalAssets, pocketsTotal, totalIncomeThisMonth, totalExpenseThisMonth },
            thisMonthIncome: thisMonthTransactions.filter(t => t.type === TransactionType.INCOME).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            thisMonthExpense: thisMonthTransactions.filter(t => t.type === TransactionType.EXPENSE).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        };
    }, [cards, pockets, transactions]);

    const monthlyBudgetPocket = useMemo(() => pockets.find(p => p.type === PocketType.EXPENSE), [pockets]);

    const categoryTotals = useMemo<{ income: Record<string, number>; expense: Record<string, number> }>(() => {
        const income: Record<string, number> = {};
        const expense: Record<string, number> = {};

        transactions.forEach(t => {
            if (t.type === TransactionType.INCOME) {
                income[t.category] = (income[t.category] || 0) + t.amount;
            } else {
                expense[t.category] = (expense[t.category] || 0) + t.amount;
            }
        });

        return { income, expense };
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const date = new Date(t.date);
            const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
            const to = filters.dateTo ? new Date(filters.dateTo) : null;
            if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);

            const searchMatch = (
                t.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                t.category.toLowerCase().includes(filters.searchTerm.toLowerCase())
            );
            const dateMatch = (!from || date >= from) && (!to || date <= to);

            let categoryMatch = true;
            if (categoryFilter.type !== 'all') {
                if (t.type !== categoryFilter.type) {
                    categoryMatch = false;
                } else if (categoryFilter.category !== 'Semua' && t.category !== categoryFilter.category) {
                    categoryMatch = false;
                }
            }

            return searchMatch && dateMatch && categoryMatch;
        });
    }, [transactions, filters, categoryFilter]);

    const filteredSummary = useMemo(() => {
        const income = filteredTransactions
            .filter(t => t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = filteredTransactions
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        return { income, expense, net: income - expense };
    }, [filteredTransactions]);

    const reportClientOptions = useMemo(() => {
        const clientMap = projects.reduce((acc, p) => {
            if (!acc[p.clientId]) {
                acc[p.clientId] = p.clientName;
            }
            return acc;
        }, {} as Record<string, string>);
        return Object.entries(clientMap).map(([id, name]) => ({ id, name }));
    }, [projects]);

    const reportTransactions = useMemo(() => transactions.filter(t => {
        const date = new Date(t.date);
        const from = reportFilters.dateFrom ? new Date(reportFilters.dateFrom) : null;
        const to = reportFilters.dateTo ? new Date(reportFilters.dateTo) : null;
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);

        const dateMatch = (!from || date >= from) && (!to || date <= to);

        const projectIdsForClient = projects
            .filter(p => p.clientId === reportFilters.client)
            .map(p => p.id);

        const clientMatch = reportFilters.client === 'all' || (t.projectId && projectIdsForClient.includes(t.projectId));

        return dateMatch && clientMatch;
    }), [transactions, projects, reportFilters]);

    const projectProfitabilityData = useMemo(() => {
        const { year, month } = profitReportFilters;

        // 1. Filter projects that have an event date within the selected month/year
        const projectsInMonth = projects.filter(p => {
            const projectDate = new Date(p.date);
            return projectDate.getFullYear() === year && projectDate.getMonth() === month;
        });

        // 2. Get a unique list of clientIds from these projects
        const clientIdsInMonth = [...new Set(projectsInMonth.map(p => p.clientId))];

        // 3. For each unique clientId, calculate profitability
        return clientIdsInMonth.map(clientId => {
            const client = reportClientOptions.find(c => c.id === clientId);
            if (!client) return null;

            const clientProjectsInMonth = projectsInMonth.filter(p => p.clientId === clientId);
            const clientProjectIdsInMonth = clientProjectsInMonth.map(p => p.id);

            // Find all transactions linked to this client's projects in this month
            const relevantTransactions = transactions.filter(t => t.projectId && clientProjectIdsInMonth.includes(t.projectId));

            const totalIncome = relevantTransactions
                .filter(t => t.type === TransactionType.INCOME)
                .reduce((sum, t) => sum + t.amount, 0);

            const totalCost = relevantTransactions
                .filter(t => t.type === TransactionType.EXPENSE && PRODUCTION_COST_CATEGORIES.includes(t.category))
                .reduce((sum, t) => sum + t.amount, 0);

            const totalPackageRevenue = clientProjectsInMonth.reduce((sum, p) => sum + (p.totalCost - (p.customCosts?.reduce((s, c) => s + c.amount, 0) || 0) - (Number(p.transportCost) || 0)), 0);
            const totalCustomCosts = clientProjectsInMonth.reduce((sum, p) => sum + (p.customCosts?.reduce((s, c) => s + c.amount, 0) || 0), 0);
            const totalTransportCosts = clientProjectsInMonth.reduce((sum, p) => sum + (Number(p.transportCost) || 0), 0);

            const profit = totalIncome - totalCost;

            return {
                clientId,
                clientName: client.name,
                totalIncome,
                totalCost,
                profit,
                totalPackageRevenue,
                totalCustomCosts,
                totalTransportCosts,
                projects: clientProjectsInMonth
            };
        }).filter(Boolean);
    }, [profitReportFilters, projects, transactions, reportClientOptions]);

    const profitReportMetrics = useMemo(() => {
        if (projectProfitabilityData.length === 0) {
            return { totalProfit: 0, mostProfitableClient: 'N/A', profitableProjectsCount: 0, avgProfit: 0 };
        }
        const totalProfit = projectProfitabilityData.reduce((sum, item) => sum + (item?.profit || 0), 0);
        const mostProfitableClient = [...projectProfitabilityData].sort((a, b) => (b?.profit || 0) - (a?.profit || 0))[0]?.clientName || 'N/A';
        const profitableProjectsCount = projectProfitabilityData.filter(item => (item?.profit || 0) > 0).length;
        const avgProfit = totalProfit / projectProfitabilityData.length;
        return { totalProfit, mostProfitableClient, profitableProjectsCount, avgProfit };
    }, [projectProfitabilityData]);

    const reportYearOptions = useMemo(() => {
        const years = new Set<number>(transactions.map(t => new Date(t.date).getFullYear()));
        return Array.from(years).sort((a: number, b: number) => b - a);
    }, [transactions]);

    const generalReportMetrics = useMemo(() => {
        if (reportFilters.client !== 'all') return null;
        const reportIncome = reportTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
        const reportExpense = reportTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
        const incomeDonut = Object.entries(reportTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => ({ ...acc, [t.category]: (acc[t.category] || 0) + t.amount }), {} as Record<string, number>)).map(([l, v], i) => ({ label: l, value: v, color: ['#34d399', '#60a5fa', '#38bdf8', '#a3e635', '#4ade80'][i % 5] }));
        const expenseDonut = Object.entries(reportTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => ({ ...acc, [t.category]: (acc[t.category] || 0) + t.amount }), {} as Record<string, number>)).map(([l, v], i) => ({ label: l, value: v, color: ['#f87171', '#fb923c', '#facc15', '#ef4444', '#f472b6'][i % 5] }));
        return { reportIncome, reportExpense, incomeDonut, expenseDonut };
    }, [reportTransactions, reportFilters.client]);

    const cardStats = useMemo(() => {
        // Total utang kartu kredit: gunakan nilai absolut agar selalu positif
        const creditDebt = cards
            .filter(c => c.cardType === CardType.KREDIT)
            .reduce((sum, c) => sum + Math.abs(Number(c.balance) || 0), 0);

        // Total aset (debit & tunai)
        const debitAndCashAssets = cards
            .filter(c => c.cardType !== CardType.KREDIT)
            .reduce((sum, c) => sum + (Number(c.balance) || 0), 0);

        // Total saldo tunai (bisa ada >1 kartu tunai)
        const cashBalance = cards
            .filter(c => c.cardType === CardType.TUNAI)
            .reduce((sum, c) => sum + (Number(c.balance) || 0), 0);

        // Hitung kartu paling sering dipakai hanya dari kartu yang ada di state 'cards'
        const cardIdSet = new Set(cards.map(c => c.id));
        const transactionCounts = transactions.reduce((acc, t) => {
            if (t.cardId && cardIdSet.has(t.cardId)) {
                acc[t.cardId] = (acc[t.cardId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const idsByUsage = Object.keys(transactionCounts).sort((a, b) => transactionCounts[b] - transactionCounts[a]);
        const mostUsedCardId = idsByUsage[0] || null;
        const mostUsedCard = mostUsedCardId ? cards.find(c => c.id === mostUsedCardId) : null;
        const mostUsedCardName = mostUsedCard ? `${mostUsedCard.bankName} (${mostUsedCard.lastFourDigits ? '...' + mostUsedCard.lastFourDigits : ''})` : 'N/A';
        const mostUsedCardTxCount = mostUsedCardId ? transactionCounts[mostUsedCardId] : 0;

        const topUsedCards = idsByUsage.slice(0, 3).map(id => {
            const card = cards.find(c => c.id === id);
            return { id, name: card ? `${card.bankName} (${card.lastFourDigits ? '...' + card.lastFourDigits : ''})` : id, count: transactionCounts[id] };
        });
        return { creditDebt, debitAndCashAssets, cashBalance, mostUsedCardName, mostUsedCardTxCount, topUsedCards };
    }, [cards, transactions]);

    const handleOpenModal = (type: 'transaction' | 'pocket' | 'card' | 'transfer' | 'topup-cash', mode: 'add' | 'edit', data?: any) => {
        setModalState({ type, mode, data });
        if (mode === 'add') {
            if (type === 'transaction') setForm({ ...emptyTransaction, cardId: cards.find(c => c.cardType !== CardType.TUNAI)?.id || '', sourceId: cards.find(c => c.cardType !== CardType.TUNAI)?.id ? `card-${cards.find(c => c.cardType !== CardType.TUNAI)?.id}` : '', projectId: '' });
            if (type === 'pocket') setForm(emptyPocket);
            if (type === 'card') setForm({ ...emptyCard, initialBalance: '' });
            if (type === 'transfer') {
                const transferType = data?.transferType || 'deposit';
                setForm({ amount: '', fromCardId: cards.find(c => c.cardType !== CardType.TUNAI)?.id || cards[0]?.id || '', toPocketId: data?.id, type: transferType });
            }
            if (type === 'topup-cash') setForm({ amount: '', fromCardId: cards.find(c => c.cardType !== CardType.TUNAI)?.id || '' });
        } else {
            setForm({ ...data, adjustmentAmount: '', adjustmentReason: '' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { type, mode, data } = modalState;

        if (type === 'transaction') {
            const newTx = { ...form, amount: Number(form.amount) };
            if (mode === 'add') {
                if (newTx.type === TransactionType.EXPENSE) {
                    const source = newTx.sourceId; // e.g., 'card-CARD001' or 'pocket-POC003'
                    if (source.startsWith('pocket-')) {
                        const pocketId = source.replace('pocket-', '');
                        const pocket = pockets.find(p => p.id === pocketId);
                        if (pocket && pocket.amount < newTx.amount) {
                            alert(`Saldo kantong "${pocket.name}" tidak mencukupi. Saldo: ${formatCurrency(pocket.amount)}`);
                            return;
                        }
                        newTx.pocketId = pocketId;
                        delete newTx.sourceId;
                    } else if (source.startsWith('card-')) {
                        const cardId = source.replace('card-', '');
                        newTx.cardId = cardId;
                        delete newTx.sourceId;
                    }
                }
                try {
                    const created = await createTransactionRow({
                        date: newTx.date,
                        description: newTx.description,
                        amount: newTx.amount,
                        type: newTx.type,
                        projectId: newTx.projectId || undefined,
                        category: newTx.category,
                        method: newTx.method,
                        pocketId: newTx.pocketId || undefined,
                        cardId: newTx.cardId || undefined,
                    } as Omit<Transaction, 'id' | 'vendorSignature'>);
                    setTransactions(prev => [...prev, created].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    if (created.pocketId) {
                        const pocket = pockets.find(p => p.id === created.pocketId);
                        if (pocket) {
                            const delta = created.type === TransactionType.INCOME ? created.amount : -created.amount;
                            const newAmount = pocket.amount + delta;
                            setPockets(prev => prev.map(p => p.id === created.pocketId ? { ...p, amount: newAmount } : p));
                            try {
                                await updatePocketRow(created.pocketId, { amount: newAmount });
                            } catch (e) {
                                console.warn('[Supabase] Gagal memperbarui saldo kantong saat transaksi.', e);
                            }
                        }
                    }
                    // Jika transaksi terkait kartu, update saldo kartu di DB dan lokal
                    if (created.cardId) {
                        const delta = created.type === TransactionType.INCOME ? created.amount : -created.amount;
                        setCards(prev => prev.map(c => c.id === created.cardId ? { ...c, balance: c.balance + delta } : c));
                    }
                    showNotification('Transaksi berhasil ditambahkan.');
                } catch (err) {
                    alert('Gagal menyimpan transaksi ke database. Coba lagi.');
                    return;
                }
            } else {
                try {
                    const before = transactions.find(t => t.id === data.id);
                    const updated = await updateTransactionRow(data.id, {
                        date: newTx.date,
                        description: newTx.description,
                        amount: newTx.amount,
                        type: newTx.type,
                        projectId: newTx.projectId,
                        category: newTx.category,
                        method: newTx.method,
                        pocketId: newTx.pocketId,
                        cardId: newTx.cardId,
                    });
                    // Adjust card balance if card/amount/type changed
                    if (before) {
                        // remove previous impact
                        if (before.cardId) {
                            const prevDelta = before.type === TransactionType.INCOME ? before.amount : -before.amount;
                            try { await updateCardBalance(before.cardId, -prevDelta); } catch { }
                            setCards(prev => prev.map(c => c.id === before.cardId ? { ...c, balance: c.balance - prevDelta } : c));
                        }
                        if (before.pocketId) {
                            const pocket = pockets.find(p => p.id === before.pocketId);
                            if (pocket) {
                                const prevDelta = before.type === TransactionType.INCOME ? before.amount : -before.amount;
                                const newAmount = pocket.amount - prevDelta;
                                setPockets(prev => prev.map(p => p.id === before.pocketId ? { ...p, amount: newAmount } : p));
                                try { await updatePocketRow(before.pocketId, { amount: newAmount }); } catch { }
                            }
                        }
                        // add new impact
                        if (updated.cardId) {
                            const newDelta = updated.type === TransactionType.INCOME ? updated.amount : -updated.amount;
                            try { await updateCardBalance(updated.cardId, newDelta); } catch { }
                            setCards(prev => prev.map(c => c.id === updated.cardId ? { ...c, balance: c.balance + newDelta } : c));
                        }
                        if (updated.pocketId) {
                            const pocket = pockets.find(p => p.id === updated.pocketId);
                            if (pocket) {
                                const newDelta = updated.type === TransactionType.INCOME ? updated.amount : -updated.amount;
                                const newAmount = pocket.amount + newDelta;
                                setPockets(prev => prev.map(p => p.id === updated.pocketId ? { ...p, amount: newAmount } : p));
                                try { await updatePocketRow(updated.pocketId, { amount: newAmount }); } catch { }
                            }
                        }
                    }
                    setTransactions(prev => prev.map(t => t.id === data.id ? updated : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    showNotification('Transaksi berhasil diperbarui.');
                } catch (err) {
                    alert('Gagal memperbarui transaksi di database. Coba lagi.');
                    return;
                }
            }

            // [SYNC] Update Project amountPaid and paymentStatus if linked
            if (newTx.projectId) {
                const proj = projects.find(p => p.id === newTx.projectId);
                if (proj) {
                    // Recalculate everything for this project to be safe
                    const projectTransactions = [...transactions, ...(mode === 'add' ? [form] : [])].filter(t =>
                        t.projectId === proj.id &&
                        (t.category.includes('DP') || t.category.includes('Pelunasan') || t.category.includes('Pembayaran') || t.category.includes('Koreksi'))
                    );

                    const totalPaid = projectTransactions.reduce((acc, t) => {
                        if (t.id === data?.id && mode === 'edit') {
                            return acc + Number(form.amount);
                        }
                        return acc + t.amount;
                    }, 0);

                    const newPaymentStatus = totalPaid >= proj.totalCost ? PaymentStatus.LUNAS : (totalPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);

                    try {
                        const { updateProject: updateProjectInDb } = await import('../../services/projects');
                        await updateProjectInDb(proj.id, { amountPaid: totalPaid, paymentStatus: newPaymentStatus });
                        setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, amountPaid: totalPaid, paymentStatus: newPaymentStatus as any } : p));
                    } catch (e) {
                        console.warn('[Sync] Gagal memperbarui status proyek:', e);
                    }
                }
            }
        }

        if (type === 'pocket') {
            if (mode === 'add') {
                try {
                    const created = await createPocketRow({
                        name: form.name,
                        description: form.description || '',
                        icon: form.icon,
                        type: form.type,
                        amount: 0,
                        sourceCardId: form.sourceCardId || undefined,
                        goalAmount: form.goalAmount || undefined,
                        lockEndDate: form.lockEndDate || undefined,
                    } as Omit<FinancialPocket, 'id' | 'members'>);
                    setPockets(prev => [...prev, created]);
                    showNotification('Kantong berhasil dibuat.');
                } catch (err) {
                    alert('Gagal menyimpan kantong ke database. Coba lagi.');
                    return;
                }
            } else {
                try {
                    const updated = await updatePocketRow(data.id, {
                        name: form.name,
                        description: form.description,
                        icon: form.icon,
                        type: form.type,
                        amount: form.amount,
                        sourceCardId: form.sourceCardId,
                        goalAmount: form.goalAmount,
                        lockEndDate: form.lockEndDate,
                    } as Partial<FinancialPocket>);
                    setPockets(prev => prev.map(p => p.id === data.id ? updated : p));
                    showNotification('Kantong berhasil diperbarui.');
                } catch (err) {
                    alert('Gagal memperbarui kantong di database. Coba lagi.');
                    return;
                }
            }
        }

        if (type === 'card') {
            const initialBalance = Number(form.initialBalance || 0);
            if (mode === 'add') {
                try {
                    const created = await createCardRow({
                        card_holder_name: form.cardHolderName,
                        bank_name: form.bankName,
                        card_type: form.cardType,
                        last_four_digits: form.lastFourDigits,
                        expiry_date: form.expiryDate || null,
                        balance: 0, // start at 0, then add initial via transaction
                        color_gradient: form.colorGradient || null,
                    });
                    // Map to UI Card type
                    const uiCard: Card = {
                        id: created.id,
                        cardHolderName: created.card_holder_name,
                        bankName: created.bank_name,
                        cardType: created.card_type as CardType,
                        lastFourDigits: created.last_four_digits,
                        expiryDate: created.expiry_date || '',
                        colorGradient: created.color_gradient || '',
                        balance: Number(created.balance || 0),
                    };
                    setCards(prev => [...prev, uiCard]);

                    if (initialBalance > 0) {
                        try {
                            const tx = await createTransactionRow({
                                date: new Date().toISOString().split('T')[0],
                                description: `Saldo Awal - ${uiCard.bankName} ${uiCard.cardType !== CardType.TUNAI ? uiCard.lastFourDigits : ''}`.trim(),
                                amount: initialBalance,
                                type: TransactionType.INCOME,
                                projectId: undefined,
                                category: 'Modal',
                                method: 'Sistem',
                                cardId: uiCard.id,
                            } as Omit<Transaction, 'id' | 'vendorSignature'>);
                            setTransactions(prev => [...prev, tx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                            // Update UI card balance locally
                            setCards(prev => prev.map(c => c.id === uiCard.id ? { ...c, balance: c.balance + initialBalance } : c));
                        } catch (err) {
                            console.warn('[Supabase] Gagal membuat transaksi saldo awal kartu, fallback lokal.', err);
                            const initialTx: Transaction = {
                                id: `TRN-INIT-${uiCard.id}`,
                                date: new Date().toISOString().split('T')[0],
                                description: `Saldo Awal - ${uiCard.bankName} ${uiCard.cardType !== CardType.TUNAI ? uiCard.lastFourDigits : ''}`.trim(),
                                amount: initialBalance,
                                type: TransactionType.INCOME,
                                category: 'Modal',
                                method: 'Sistem',
                                cardId: uiCard.id,
                            };
                            setTransactions(prev => [...prev, initialTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                            setCards(prev => prev.map(c => c.id === uiCard.id ? { ...c, balance: c.balance + initialBalance } : c));
                        }
                    }
                    showNotification('Kartu baru berhasil ditambahkan.');
                } catch (err) {
                    alert('Gagal menambahkan kartu ke database. Coba lagi.');
                    return;
                }
            } else if (mode === 'edit' && data?.id) {
                try {
                    const updated = await updateCardRow(data.id, {
                        card_holder_name: form.cardHolderName,
                        bank_name: form.bankName,
                        card_type: form.cardType,
                        last_four_digits: form.lastFourDigits,
                        expiry_date: form.expiryDate || null,
                        color_gradient: form.colorGradient || null,
                    });

                    // [ADJUSTMENT] Handle balance correction
                    if (form.adjustmentAmount && Number(form.adjustmentAmount) !== 0) {
                        const amount = Number(form.adjustmentAmount);
                        const reason = form.adjustmentReason || 'Penyesuaian Saldo';

                        try {
                            const adjTx = await createTransactionRow({
                                date: new Date().toISOString().split('T')[0],
                                description: `${reason} - ${updated.bank_name}`,
                                amount: Math.abs(amount),
                                type: amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
                                category: 'Penyesuaian',
                                method: 'Sistem',
                                cardId: updated.id,
                            } as Omit<Transaction, 'id' | 'vendorSignature'>);

                            setTransactions(prev => [adjTx, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

                            // Real DB update for balance
                            await updateCardBalance(updated.id, amount);
                            updated.balance = (updated.balance || 0) + amount;
                        } catch (e) {
                            console.warn('[Finance] Gagal menyimpan penyesuaian saldo.', e);
                        }
                    }

                    const uiCard: Card = {
                        id: updated.id,
                        cardHolderName: updated.card_holder_name,
                        bankName: updated.bank_name,
                        cardType: updated.card_type as CardType,
                        lastFourDigits: updated.last_four_digits,
                        expiryDate: updated.expiry_date || '',
                        colorGradient: updated.color_gradient || '',
                        balance: Number(updated.balance || 0),
                    };
                    setCards(prev => prev.map(c => c.id === uiCard.id ? { ...c, ...uiCard } : c));
                    showNotification('Kartu berhasil diperbarui.');
                } catch (err) {
                    alert('Gagal memperbarui kartu di database. Coba lagi.');
                }
            }
        }

        if (type === 'transfer') {
            const amount = Number(form.amount);
            const fromCardId = form.fromCardId;
            const toPocketId = form.toPocketId;
            const transferType = form.type;

            if (transferType === 'deposit') {
                try {
                    const transferTx = await createTransactionRow({
                        date: new Date().toISOString().split('T')[0],
                        description: 'Transfer ke kantong',
                        amount,
                        type: TransactionType.EXPENSE,
                        category: 'Transfer Internal',
                        method: 'Sistem',
                        cardId: fromCardId,
                        projectId: undefined,
                        pocketId: undefined,
                    } as Omit<Transaction, 'id' | 'vendorSignature'>);
                    setTransactions(prev => [...prev, transferTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    setPockets(prev => prev.map(p => p.id === toPocketId ? { ...p, amount: p.amount + amount } : p));
                    // Persist increased pocket balance to DB
                    try {
                        const pocketTo = pockets.find(p => p.id === toPocketId);
                        await updatePocketRow(toPocketId, { amount: (pocketTo?.amount || 0) + amount });
                    } catch (e) {
                        console.warn('[Supabase] Gagal memperbarui saldo kantong saat deposit transfer.', e);
                    }
                    // Kurangi saldo kartu sumber
                    setCards(prev => prev.map(c => c.id === fromCardId ? { ...c, balance: c.balance - amount } : c));
                    showNotification('Transfer berhasil.');
                } catch (err) {
                    alert('Gagal menyimpan transaksi transfer (deposit) ke database. Coba lagi.');
                    return;
                }
            } else {
                const pocket = pockets.find(p => p.id === toPocketId);
                if (pocket && pocket.amount < amount) {
                    alert(`Saldo kantong tidak mencukupi. Saldo: ${formatCurrency(pocket.amount)}`);
                    return;
                }
                try {
                    const withdrawTx = await createTransactionRow({
                        date: new Date().toISOString().split('T')[0],
                        description: 'Penarikan dari kantong',
                        amount,
                        type: TransactionType.INCOME,
                        category: 'Transfer Internal',
                        method: 'Sistem',
                        cardId: fromCardId,
                        projectId: undefined,
                        pocketId: undefined,
                    } as Omit<Transaction, 'id' | 'vendorSignature'>);
                    setTransactions(prev => [...prev, withdrawTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    setPockets(prev => prev.map(p => p.id === toPocketId ? { ...p, amount: p.amount - amount } : p));
                    // Persist decreased pocket balance to DB
                    try {
                        await updatePocketRow(toPocketId, { amount: (pocket?.amount || 0) - amount });
                    } catch (e) {
                        console.warn('[Supabase] Gagal memperbarui saldo kantong saat withdraw transfer.', e);
                    }
                    // Tambah saldo kartu tujuan
                    setCards(prev => prev.map(c => c.id === fromCardId ? { ...c, balance: c.balance + amount } : c));
                    showNotification('Penarikan berhasil.');
                } catch (err) {
                    alert('Gagal menyimpan transaksi transfer (withdraw) ke database. Coba lagi.');
                    return;
                }
            }
        }

        if (type === 'topup-cash') {
            const amount = Number(form.amount);
            const fromCardId = form.fromCardId;
            const cashCard = cards.find(c => c.cardType === CardType.TUNAI);

            if (cashCard) {
                try {
                    const topupTx = await createTransactionRow({
                        date: new Date().toISOString().split('T')[0],
                        description: 'Top-up Tunai',
                        amount,
                        type: TransactionType.EXPENSE,
                        category: 'Transfer Internal',
                        method: 'Sistem',
                        cardId: fromCardId,
                        projectId: undefined,
                        pocketId: undefined,
                    } as Omit<Transaction, 'id' | 'vendorSignature'>);
                    const cashIncomeTx = await createTransactionRow({
                        date: new Date().toISOString().split('T')[0],
                        description: 'Penerimaan Tunai',
                        amount,
                        type: TransactionType.INCOME,
                        category: 'Transfer Internal',
                        method: 'Sistem',
                        cardId: cashCard.id,
                        projectId: undefined,
                        pocketId: undefined,
                    } as Omit<Transaction, 'id' | 'vendorSignature'>);
                    setTransactions(prev => [...prev, topupTx, cashIncomeTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    // Update saldo kartu sumber dan kartu tunai
                    setCards(prev => prev.map(c => c.id === fromCardId ? { ...c, balance: c.balance - amount } : c));
                    setCards(prev => prev.map(c => c.id === cashCard.id ? { ...c, balance: c.balance + amount } : c));
                    showNotification('Top-up tunai berhasil.');
                } catch (err) {
                    alert('Gagal menyimpan transaksi top-up tunai ke database. Coba lagi.');
                    return;
                }
            }
        }

        handleCloseModal();
    };

    const handleDelete = async (type: 'transaction' | 'pocket' | 'card', id: string) => {
        if (type === 'card') {
            const referenced = transactions.some(t => t.cardId === id) || pockets.some(p => p.sourceCardId === id);
            const msg = referenced
                ? 'Kartu ini terhubung dengan transaksi/kantong. Sistem akan melepas keterhubungan lalu menghapus kartu. Lanjutkan?'
                : 'Yakin ingin menghapus kartu ini?';
            if (!window.confirm(msg)) return;
            try {
                if (referenced) {
                    await safeDeleteCard(id);
                } else {
                    await deleteCardRow(id);
                }
                setCards(p => p.filter(i => i.id !== id));
                showNotification('Kartu berhasil dihapus.');
            } catch (err) {
                alert('Gagal menghapus kartu di database. Coba lagi.');
            }
            return;
        }
        if (!window.confirm('Yakin ingin menghapus item ini?')) return;
        if (type === 'transaction') {
            try {
                const tx = transactions.find(t => t.id === id);
                if (!tx) {
                    setTransactions(p => p.filter(i => i.id !== id));
                } else {
                    // reverse impact on card balance if any
                    if (tx.cardId) {
                        const delta = tx.type === TransactionType.INCOME ? -tx.amount : tx.amount; // reverse
                        try { await updateCardBalance(tx.cardId, delta); } catch { }
                        setCards(prev => prev.map(c => c.id === tx.cardId ? { ...c, balance: c.balance + delta } : c));
                    }
                    if (tx.pocketId) {
                        const pocket = pockets.find(p => p.id === tx.pocketId);
                        if (pocket) {
                            const delta = tx.type === TransactionType.INCOME ? -tx.amount : tx.amount;
                            const newAmount = pocket.amount + delta;
                            setPockets(prev => prev.map(p => p.id === tx.pocketId ? { ...p, amount: newAmount } : p));
                            try { await updatePocketRow(tx.pocketId, { amount: newAmount }); } catch { }
                        }
                    }
                    // delete from DB
                    // lazy import at top already has service; we call it via dynamic import alternative: use updateTransactionRow? No, we added deleteTransaction in services.
                }
            } catch { }
            try {
                const { deleteTransaction } = await import('../../services/transactions');
                await deleteTransaction(id);
            } catch (e) {
                alert('Gagal menghapus transaksi di database. Coba lagi.');
                return;
            }
            setTransactions(p => p.filter(i => i.id !== id));
            return;
        }
        if (type === 'pocket') {
            if (!window.confirm('Yakin ingin menghapus kantong ini?')) return;
            try {
                await deletePocketRow(id);
            } catch (e) {
                alert('Gagal menghapus kantong di database. Coba lagi.');
                return;
            }
            setPockets(p => p.filter(i => i.id !== id));
        }
    };

    const handleCloseModal = () => setModalState({ type: null, mode: 'add' });

    const handleFormChange = (e: React.ChangeEvent<any>) => setForm((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleFilterChange = (e: React.ChangeEvent<any>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleTutupAnggaran = () => {
        if (!monthlyBudgetPocket) { return; }
        if (monthlyBudgetPocket.amount <= 0) {
            alert("Tidak ada sisa anggaran untuk disimpan.");
            return;
        }
        if (window.confirm(`Anda akan menyimpan sisa anggaran sebesar ${formatCurrency(monthlyBudgetPocket.amount)} ke kantong baru. Lanjutkan?`)) {
            handleCloseBudget(monthlyBudgetPocket, false);
        }
    };

    const expenseDonutData = useMemo(() => {
        const expenseByCategory = transactions
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
                return acc;
            }, {} as Record<string, number>);

        const colors = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'];
        return Object.entries(expenseByCategory)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
    }, [transactions]);

    const getTransactionSubDescription = (transaction: Transaction): string => {
        const isInternal = transaction.category === 'Transfer Internal' || transaction.category === 'Penutupan Anggaran' || transaction.method === 'Sistem';

        const project = transaction.projectId ? projects.find(p => p.id === transaction.projectId) : null;
        const projectText = project ? project.projectName : null;

        if (isInternal) {
            return projectText ? `Acara Pernikahan: ${projectText}` : '';
        }

        let sourceDestText = '';
        if (transaction.type === TransactionType.INCOME) {
            const card = cards.find(c => c.id === transaction.cardId);
            if (card) {
                sourceDestText = card.cardType === CardType.TUNAI
                    ? 'Masuk ke Tunai'
                    : `Masuk ke ${card.bankName} ${card.lastFourDigits !== 'CASH' ? `**** ${card.lastFourDigits}` : ''}`;
            }
        } else { // EXPENSE
            if (transaction.pocketId) {
                const pocket = pockets.find(p => p.id === transaction.pocketId);
                if (pocket) {
                    sourceDestText = `Dibayar dari kantong "${pocket.name}"`;
                }
            } else if (transaction.cardId) {
                const card = cards.find(c => c.id === transaction.cardId);
                if (card) {
                    sourceDestText = card.cardType === CardType.TUNAI
                        ? 'Dibayar dari Tunai'
                        : `Dibayar dari ${card.bankName} ${card.lastFourDigits !== 'CASH' ? `**** ${card.lastFourDigits}` : ''}`;
                }
            } else {
                sourceDestText = `Metode: ${transaction.method}`;
            }
        }

        if (sourceDestText && projectText) {
            return `${sourceDestText} • ${projectText}`;
        }

        return sourceDestText || projectText || '';
    };

    const handleDownloadReportCSV = () => {
        // Desired column order and localized values to match the provided example
        const headers = ['ID Transaksi', 'Tanggal', 'Deskripsi', 'Kategori', 'Jumlah', 'Jenis'];
        const data = [...reportTransactions]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(t => [
                t.id,
                new Date(t.date).toLocaleDateString('id-ID'),
                t.description,
                t.category || '-',
                // Keep as plain number for clean CSV numeric column
                Number(t.amount),
                t.type === TransactionType.INCOME ? 'Pemasukan' : 'Pengeluaran'
            ]);
        const clientName = reportFilters.client === 'all' ? 'Semua-Pengantin' : (reportClientOptions.find(c => c.id === reportFilters.client)?.name || 'Pengantin').replace(/\s+/g, '-');
        downloadCSV(headers, data, `Laporan-Keuangan-${clientName}-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleDownloadTransactionsCSV = () => {
        const headers = ['ID Transaksi', 'Tanggal', 'Deskripsi', 'Kategori', 'Jumlah', 'Jumlah (Numerik)', 'Jenis'];
        const data = [...filteredTransactions]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(t => [
                t.id,
                new Date(t.date).toLocaleDateString('id-ID'),
                t.description,
                t.category || '-',
                // Display currency for better readability in Excel
                formatCurrencyCSV(Number(t.amount)),
                Number(t.amount),
                t.type === TransactionType.INCOME ? 'Pemasukan' : 'Pengeluaran'
            ]);
        // Section: Summary for current filter
        data.push(['', '', '', '', '', '', '']);
        data.push(['', '', 'Ringkasan (Filter)', '', '', '', '']);
        data.push(['', '', 'Total Pemasukan (Filter)', '', formatCurrencyCSV(Number(filteredSummary.income)), Number(filteredSummary.income), '']);
        data.push(['', '', 'Total Pengeluaran (Filter)', '', formatCurrencyCSV(Number(filteredSummary.expense)), Number(filteredSummary.expense), '']);
        data.push(['', '', 'Laba/Rugi Bersih (Filter)', '', formatCurrencyCSV(Number(filteredSummary.net)), Number(filteredSummary.net), '']);

        // Section: Summary for all transactions
        const overallIncome = transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
        const overallExpense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
        const overallNet = overallIncome - overallExpense;
        data.push(['', '', '', '', '', '', '']);
        data.push(['', '', 'Ringkasan (Semua)', '', '', '', '']);
        data.push(['', '', 'Total Pemasukan (Semua)', '', formatCurrencyCSV(Number(overallIncome)), Number(overallIncome), '']);
        data.push(['', '', 'Total Pengeluaran (Semua)', '', formatCurrencyCSV(Number(overallExpense)), Number(overallExpense), '']);
        data.push(['', '', 'Laba/Rugi Bersih (Semua)', '', formatCurrencyCSV(Number(overallNet)), Number(overallNet), '']);
        const title = 'Pembiayaan/Transaksi';
        const today = new Date().toLocaleDateString('id-ID');
        const preface = [['', `${title} - ${today}`, '', '', '', '', ''], ['', '', '', '', '', '', '']];
        downloadCSV(headers, data, `Transaksi-${new Date().toISOString().split('T')[0]}.csv`, preface);
    };

    const handleDownloadProfitReportCSV = () => {
        const headers = ['ID Pengantin', 'Nama Pengantin', 'Total Pemasukan', 'Total Biaya Produksi', 'Laba Kotor'];
        const data = projectProfitabilityData.map(d => [
            d!.clientId,
            d!.clientName,
            d!.totalIncome,
            d!.totalCost,
            d!.profit
        ]);
        const period = `${profitReportFilters.month + 1}-${profitReportFilters.year}`;
        downloadCSV(headers, data, `Laporan-Laba-Acara Pernikahan-${period}-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'transactions':
                const CategoryButton = ({ type, categoryName, amount, isActive, onClick }: { type: TransactionType, categoryName: string, amount: number, isActive: boolean, onClick: () => void }) => (
                    <button
                        onClick={onClick}
                        className={`w-full flex justify-between items-center text-left p-3 rounded-lg text-sm transition-colors ${isActive
                            ? 'bg-blue-500/10 text-brand-accent font-semibold'
                            : 'text-brand-text-primary hover:bg-brand-input'
                            }`}
                    >
                        <span className="truncate">{categoryName}</span>
                        <span className={`font-medium ${amount > 0 ? (type === TransactionType.INCOME ? 'text-brand-success/80' : 'text-brand-danger/80') : 'text-brand-text-secondary'}`}>
                            {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(amount)}
                        </span>
                    </button>
                );

                const allIncomeTotal: number = Object.keys(categoryTotals.income).reduce((sum: number, key: string) => sum + categoryTotals.income[key], 0);
                const allExpenseTotal: number = Object.keys(categoryTotals.expense).reduce((sum: number, key: string) => sum + categoryTotals.expense[key], 0);

                return (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                        {/* Left Column: Category Filters & Budget */}
                        <div className="lg:col-span-1 space-y-6">
                            {monthlyBudgetPocket && (
                                <div className="bg-brand-surface p-4 rounded-2xl shadow-lg border border-brand-border">
                                    <h4 className="font-semibold text-gradient mb-2">{monthlyBudgetPocket.name}</h4>
                                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(monthlyBudgetPocket.amount)}</p>
                                    <p className="text-xs text-brand-text-secondary mt-1">dari {formatCurrency(monthlyBudgetPocket.goalAmount || 0)}</p>
                                    <button onClick={handleTutupAnggaran} className="w-full mt-3 button-secondary text-sm">Tutup & Simpan Sisa</button>
                                </div>
                            )}
                            <div className="bg-brand-surface p-4 rounded-2xl shadow-lg border border-brand-border">
                                <h4 className="font-semibold text-gradient mb-3 px-2">Pemasukan</h4>
                                <div className="space-y-1">
                                    <CategoryButton type={TransactionType.INCOME} categoryName="Semua" amount={allIncomeTotal} isActive={categoryFilter.type === TransactionType.INCOME && categoryFilter.category === 'Semua'} onClick={() => setCategoryFilter({ type: TransactionType.INCOME, category: 'Semua' })} />
                                    {Object.entries(categoryTotals.income).map(([name, amount]: [string, number]) => (
                                        <React.Fragment key={name}>
                                            <CategoryButton type={TransactionType.INCOME} categoryName={name} amount={amount} isActive={categoryFilter.type === TransactionType.INCOME && categoryFilter.category === name} onClick={() => setCategoryFilter({ type: TransactionType.INCOME, category: name })} />
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-brand-surface p-4 rounded-2xl shadow-lg border border-brand-border">
                                <h4 className="font-semibold text-gradient mb-3 px-2">Pengeluaran</h4>
                                <div className="space-y-1">
                                    <CategoryButton type={TransactionType.EXPENSE} categoryName="Semua" amount={allExpenseTotal} isActive={categoryFilter.type === TransactionType.EXPENSE && categoryFilter.category === 'Semua'} onClick={() => setCategoryFilter({ type: TransactionType.EXPENSE, category: 'Semua' })} />
                                    {Object.entries(categoryTotals.expense).map(([name, amount]: [string, number]) => (
                                        <React.Fragment key={name}>
                                            <CategoryButton type={TransactionType.EXPENSE} categoryName={name} amount={amount} isActive={categoryFilter.type === TransactionType.EXPENSE && categoryFilter.category === name} onClick={() => setCategoryFilter({ type: TransactionType.EXPENSE, category: name })} />
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Right Column: Main Content */}
                        <div className="lg:col-span-3 bg-brand-surface p-4 sm:p-6 rounded-2xl shadow-lg border border-brand-border">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end">
                                <input name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} placeholder="Cari deskripsi, kategori..." className="input-field !rounded-lg !border p-2.5 md:col-span-1" />
                                <input name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} type="date" className="input-field !rounded-lg !border p-2.5" />
                                <input name="dateTo" value={filters.dateTo} onChange={handleFilterChange} type="date" className="input-field !rounded-lg !border p-2.5" />
                                <div className="non-printable flex md:justify-end">
                                    <button onClick={handleDownloadTransactionsCSV} className="button-secondary inline-flex items-center gap-2 w-full md:w-auto justify-center">
                                        <DownloadIcon className="w-5 h-5" /> Unduh CSV
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-brand-bg rounded-xl">
                                <div><p className="text-sm text-brand-text-secondary">Total Pemasukan (Filter)</p><p className="text-lg font-bold text-brand-success">{formatCurrency(filteredSummary.income)}</p></div>
                                <div><p className="text-sm text-brand-text-secondary">Total Pengeluaran (Filter)</p><p className="text-lg font-bold text-brand-danger">{formatCurrency(filteredSummary.expense)}</p></div>
                                <div><p className="text-sm text-brand-text-secondary">Laba/Rugi Bersih (Filter)</p><p className="text-lg font-bold text-brand-text-light">{formatCurrency(filteredSummary.net)}</p></div>
                            </div>
                            {/* Mobile cards */}
                            <div className="md:hidden space-y-3">
                                {filteredTransactions.map(t => {
                                    const subDescription = getTransactionSubDescription(t);
                                    return (
                                        <div key={t.id} className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-semibold text-brand-text-light leading-tight">{t.description}</p>
                                                    {subDescription && <p className="text-xs text-brand-text-secondary mt-0.5">{subDescription}</p>}
                                                    <p className="text-[11px] text-brand-text-secondary mt-1">{new Date(t.date).toLocaleDateString('id-ID')}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-bold ${t.type === TransactionType.INCOME ? 'text-brand-success' : 'text-brand-danger'}`}>{formatCurrency(t.amount)}</p>
                                                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full bg-brand-bg text-brand-text-primary">{t.category || '-'}</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center justify-end gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal('transaction', 'edit', t); }} className="button-secondary text-xs !px-3 !py-2" title="Edit Transaksi" aria-label={`Edit transaksi ${t.description}`}><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete('transaction', t.id); }} className="button-secondary text-xs !px-3 !py-2" title="Hapus Transaksi" aria-label={`Hapus transaksi ${t.description}`}><Trash2Icon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredTransactions.length === 0 && <p className="text-center py-10 text-brand-text-secondary">Tidak ada transaksi yang cocok.</p>}
                            </div>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-brand-text-secondary uppercase"><tr><th className="p-3 text-left">Tanggal</th><th className="p-3 text-left">Deskripsi</th><th className="p-3 text-left">Kategori</th><th className="p-3 text-right">Jumlah</th><th className="p-3 text-center">Aksi</th></tr></thead>
                                    <tbody className="divide-y divide-brand-border">
                                        {filteredTransactions.map(t => {
                                            const subDescription = getTransactionSubDescription(t);
                                            return (
                                                <tr key={t.id} className="hover:bg-brand-bg">
                                                    <td className="p-3">{new Date(t.date).toLocaleDateString('id-ID')}</td>
                                                    <td className="p-3">
                                                        <p className="font-semibold text-brand-text-light">{t.description}</p>
                                                        {subDescription && <p className="text-xs text-brand-text-secondary">{subDescription}</p>}
                                                    </td>
                                                    <td className="p-3"><span className="px-2 py-1 text-xs bg-brand-bg text-brand-text-primary rounded-full">{t.category}</span></td>
                                                    <td className={`p-3 text-right font-semibold ${t.type === TransactionType.INCOME ? 'text-brand-success' : 'text-brand-danger'}`}>{formatCurrency(t.amount)}</td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center space-x-1">
                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal('transaction', 'edit', t); }} className="p-2 text-brand-text-secondary hover:bg-brand-input rounded-full"><PencilIcon className="w-4 h-4" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete('transaction', t.id); }} className="p-2 text-brand-text-secondary hover:bg-brand-input rounded-full"><Trash2Icon className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredTransactions.length === 0 && <p className="text-center py-10 text-brand-text-secondary">Tidak ada transaksi yang cocok.</p>}
                            </div>

                            {hasMore && filteredTransactions.length >= 10 && (
                                <div className="mt-8 flex justify-center pb-4">
                                    <button
                                        onClick={loadMoreTransactions}
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
                    </div>
                );
            case 'pockets':
                return (
                    <div className="widget-animate">
                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <StatCard icon={<ClipboardListIcon className="w-6 h-6" />} title="Total Dana di Kantong" value={formatCurrency(summary.pocketsTotal)} subtitle="Total dana yang dialokasikan." colorVariant="blue" />
                        </div>
                        {/* Mobile card list */}
                        <div className="md:hidden space-y-3">
                            {pockets.map(p => {
                                const sourceCard = p.sourceCardId ? cards.find(c => c.id === p.sourceCardId) : null;
                                const amount = p.amount;
                                const progress = p.goalAmount ? Math.min((amount / (p.goalAmount || 1)) * 100, 100) : 0;
                                return (
                                    <div key={p.id}>
                                        <PocketStatCard
                                            pocket={p}
                                            amount={amount}
                                            sourceCardName={sourceCard?.bankName || null}
                                            progressPercent={progress}
                                            onClick={() => setHistoryModalState({ type: 'pocket', item: p })}
                                            onWithdraw={() => handleOpenModal('transfer', 'add', { ...p, transferType: 'withdraw' })}
                                            onDeposit={() => handleOpenModal('transfer', 'add', { ...p, transferType: 'deposit' })}
                                        />
                                    </div>
                                );
                            })}
                            <button onClick={() => handleOpenModal('pocket', 'add')} className="w-full border-2 border-dashed border-brand-border rounded-2xl flex flex-col items-center justify-center text-brand-text-secondary hover:bg-brand-input hover:border-brand-accent hover:text-brand-accent transition-colors min-h-[140px]"><PlusIcon className="w-8 h-8" /><span className="mt-2 font-semibold">Buat Kantong Baru</span></button>
                        </div>
                        {/* Desktop grid */}
                        <div className="hidden md:grid grid-cols-2 gap-6">
                            {pockets.map(p => {
                                const sourceCard = p.sourceCardId ? cards.find(c => c.id === p.sourceCardId) : null;
                                const amount = p.amount;
                                return (
                                    <div key={p.id}>
                                        <PocketStatCard
                                            pocket={p}
                                            amount={amount}
                                            sourceCardName={sourceCard?.bankName || null}
                                            progressPercent={p.goalAmount ? Math.min((amount / (p.goalAmount || 1)) * 100, 100) : 0}
                                            onClick={() => setHistoryModalState({ type: 'pocket', item: p })}
                                            onWithdraw={() => handleOpenModal('transfer', 'add', { ...p, transferType: 'withdraw' })}
                                            onDeposit={() => handleOpenModal('transfer', 'add', { ...p, transferType: 'deposit' })}
                                            headerActions={(
                                                <div className="flex gap-1 non-printable">
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal('pocket', 'edit', p); }} className="bg-white/15 hover:bg-white/25 text-white rounded-full p-2 backdrop-blur-sm"><PencilIcon className="w-4 h-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete('pocket', p.id); }} className="bg-white/15 hover:bg-white/25 text-white rounded-full p-2 backdrop-blur-sm"><Trash2Icon className="w-4 h-4" /></button>
                                                </div>
                                            )}
                                        />
                                    </div>
                                );
                            })}
                            <button onClick={() => handleOpenModal('pocket', 'add')} className="border-2 border-dashed border-brand-border rounded-2xl flex flex-col items-center justify-center text-brand-text-secondary hover:bg-brand-input hover:border-brand-accent hover:text-brand-accent transition-colors min-h-[250px]"><PlusIcon className="w-8 h-8" /><span className="mt-2 font-semibold">Buat Kantong Baru</span></button>
                        </div>
                    </div>
                );
            case 'cards':
                return (
                    <div className="widget-animate space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            <StatCard icon={<CreditCardIcon className="w-6 h-6" />} title="Total Utang Kartu Kredit" value={formatCurrency(Math.abs(cardStats.creditDebt))} subtitle="Saldo negatif kartu kredit" colorVariant="pink" />
                            <StatCard icon={<DollarSignIcon className="w-6 h-6" />} title="Total Aset (Debit & Tunai)" value={formatCurrency(cardStats.debitAndCashAssets)} subtitle="Saldo kartu debit & kas" colorVariant="green" />
                            <StatCard icon={<TrendingUpIcon className="w-6 h-6" />} title="Kartu Paling Sering Digunakan" value={cardStats.mostUsedCardName} subtitle={`${cardStats.mostUsedCardTxCount} transaksi`} colorVariant="blue" />
                            <StatCard icon={<CashIcon className="w-6 h-6" />} title="Total Saldo Tunai" value={formatCurrency(cardStats.cashBalance)} subtitle="Uang kas yang tersedia" colorVariant="orange" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                            {cards.map(card => {
                                const connectedPockets = pockets.filter(p => p.sourceCardId === card.id);
                                return (
                                    <div key={card.id}>
                                        {card.cardType === CardType.TUNAI
                                            ? <CashWidget card={card} onClick={() => setHistoryModalState({ type: 'card', item: card })} onTopUp={() => handleOpenModal('topup-cash', 'add')} onEdit={() => handleOpenModal('card', 'edit', card)} connectedPockets={connectedPockets} />
                                            : <CardWidget card={card} onEdit={() => handleOpenModal('card', 'edit', card)} onDelete={() => handleDelete('card', card.id)} onClick={() => setHistoryModalState({ type: 'card', item: card })} connectedPockets={connectedPockets} />
                                        }
                                    </div>
                                );
                            })}
                            <button onClick={() => handleOpenModal('card', 'add')} className="group aspect-[1.586] border-2 border-dashed border-brand-border rounded-2xl flex flex-col items-center justify-center text-brand-text-secondary hover:bg-brand-input hover:border-brand-accent hover:text-brand-accent transition-all duration-300">
                                <div className="w-16 h-16 rounded-full bg-brand-bg group-hover:bg-brand-accent/10 flex items-center justify-center transition-colors">
                                    <PlusIcon className="w-8 h-8 transition-transform group-hover:scale-110" />
                                </div>
                                <span className="mt-4 font-semibold">Tambah Kartu / Akun</span>
                            </button>
                        </div>
                    </div>
                );
            case 'cashflow': return (
                <div className="space-y-6 widget-animate">
                    {/* Mobile summary */}
                    <div className="md:hidden grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-xs text-brand-text-secondary">Runway</p><p className="font-semibold">{cashflowMetrics.runway}</p></div>
                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-xs text-brand-text-secondary">Laba/Rugi</p><p className="font-semibold">{formatCurrency(filteredSummary.net)}</p></div>
                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-xs text-brand-text-secondary">Avg Pemasukan/bln</p><p className="font-semibold">{formatCurrency(cashflowMetrics.avgIncome)}</p></div>
                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-xs text-brand-text-secondary">Avg Pengeluaran/bln</p><p className="font-semibold">{formatCurrency(cashflowMetrics.avgExpense)}</p></div>
                    </div>
                    {/* Desktop summary */}
                    <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard icon={<ShieldIcon className="w-6 h-6" />} title="Ketahanan Keuangan (Runway)" value={cashflowMetrics.runway} subtitle={`Estimasi operasional berdasarkan burn rate. Burn Rate: ${formatCurrency(cashflowMetrics.burnRate)}/bln`} colorVariant="orange" />
                        <StatCard icon={<DollarSignIcon className="w-6 h-6" />} title="Total Laba/Rugi" value={formatCurrency(filteredSummary.net)} subtitle="Berdasarkan filter transaksi saat ini" colorVariant="purple" />
                        <StatCard icon={<TrendingUpIcon className="w-6 h-6" />} title="Rata-rata Pemasukan/bln" value={formatCurrency(cashflowMetrics.avgIncome)} subtitle="Selama periode data tersedia" colorVariant="green" />
                        <StatCard icon={<TrendingDownIcon className="w-6 h-6" />} title="Rata-rata Pengeluaran/bln" value={formatCurrency(cashflowMetrics.avgExpense)} subtitle="Selama periode data tersedia" colorVariant="pink" />
                    </div>
                    {/* Mobile month cards */}
                    <div className="md:hidden space-y-3">
                        {cashflowChartData.map(d => (
                            <div key={d.label} className="rounded-2xl bg-white/5 border border-brand-border p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-brand-text-light">{d.label}</p>
                                    <p className="text-[11px] text-brand-text-secondary">{formatCurrency(d.income)} • {formatCurrency(d.expense)}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold text-sm ${d.income - d.expense >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>{formatCurrency(d.income - d.expense)}</p>
                                    <p className="text-xs text-brand-text-secondary">Saldo {formatCurrency(d.balance)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Desktop charts & table */}
                    <div className="hidden md:grid grid-cols-2 gap-6">
                        <div className="col-span-2 bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border"><h4 className="text-lg font-bold text-gradient mb-4">Grafik Arus Kas</h4><InteractiveCashflowChart data={cashflowChartData} /></div>
                        <div className="col-span-2 bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border"><h4 className="text-lg font-bold text-gradient mb-4">Pengeluaran per Kategori</h4><DonutChart data={expenseDonutData} /></div>
                    </div>
                    <div className="hidden md:block bg-brand-surface p-6 rounded-2xl shadow-lg mt-6 border border-brand-border">
                        <h4 className="text-lg font-bold text-gradient mb-4">Data Arus Kas Bulanan</h4>
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase print-bg-slate bg-brand-input">
                                    <tr className="print-text-black">
                                        <th className="p-3 text-left">Periode</th>
                                        <th className="p-3 text-right">Pemasukan</th>
                                        <th className="p-3 text-right">Pengeluaran</th>
                                        <th className="p-3 text-right">Laba/Rugi</th>
                                        <th className="p-3 text-right">Saldo Akhir</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-border">
                                    {cashflowChartData.map(d => (
                                        <tr key={d.label}>
                                            <td className="p-3 font-semibold">{d.label}</td>
                                            <td className="p-3 text-right text-brand-success">{formatCurrency(d.income)}</td>
                                            <td className="p-3 text-right text-brand-danger">{formatCurrency(d.expense)}</td>
                                            <td className={`p-3 text-right font-semibold ${d.income - d.expense >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>{formatCurrency(d.income - d.expense)}</td>
                                            <td className="p-3 text-right font-bold text-brand-text-light">{formatCurrency(d.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
            case 'laporan':
                return (
                    <div className="space-y-6 printable-area widget-animate">
                        <div className="bg-brand-surface p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center non-printable border border-brand-border">
                            <h4 className="text-md font-semibold text-gradient whitespace-nowrap">Filter Laporan:</h4>
                            <select name="client" value={reportFilters.client} onChange={e => setReportFilters(p => ({ ...p, client: e.target.value }))} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto"><option value="all">Semua Pengantin</option>{reportClientOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                            <input type="date" name="dateFrom" value={reportFilters.dateFrom} onChange={e => setReportFilters(p => ({ ...p, dateFrom: e.target.value }))} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto" />
                            <input type="date" name="dateTo" value={reportFilters.dateTo} onChange={e => setReportFilters(p => ({ ...p, dateTo: e.target.value }))} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto" />
                            <div className="flex items-center gap-2 ml-auto">
                                <button onClick={handleDownloadReportCSV} className="button-secondary inline-flex items-center gap-2"><DownloadIcon className="w-5 h-5" />Unduh CSV</button>
                                <button onClick={() => window.print()} className="button-primary inline-flex items-center gap-2"><PrinterIcon className="w-5 h-5" />Cetak PDF</button>
                            </div>
                        </div>
                        {/* Mobile simple report */}
                        <div className="md:hidden space-y-3">
                            {generalReportMetrics && reportFilters.client === 'all' && (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Income</p><p className="font-semibold">{formatCurrency(generalReportMetrics.reportIncome)}</p></div>
                                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Expense</p><p className="font-semibold">{formatCurrency(generalReportMetrics.reportExpense)}</p></div>
                                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Net</p><p className="font-semibold">{formatCurrency(generalReportMetrics.reportIncome - generalReportMetrics.reportExpense)}</p></div>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-brand-border p-4">
                                        <h4 className="font-semibold mb-2">Transaksi</h4>
                                        <div className="space-y-2">
                                            {reportTransactions.map(t => (
                                                <div key={t.id} className="flex items-center justify-between text-sm">
                                                    <div><p className="font-medium">{t.description}</p><p className="text-[11px] text-brand-text-secondary">{new Date(t.date).toLocaleDateString('id-ID')} • {t.category}</p></div>
                                                    <p className={`font-semibold ${t.type === TransactionType.INCOME ? 'text-brand-success' : 'text-brand-danger'}`}>{formatCurrency(t.amount)}</p>
                                                </div>
                                            ))}
                                            {reportTransactions.length === 0 && <p className="text-sm text-brand-text-secondary">Tidak ada data.</p>}
                                        </div>
                                    </div>
                                </>
                            )}
                            {reportFilters.client !== 'all' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Income</p><p className="font-semibold">{formatCurrency(reportTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0))}</p></div>
                                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Biaya Produksi</p><p className="font-semibold">{formatCurrency(reportTransactions.filter(t => t.type === TransactionType.EXPENSE && PRODUCTION_COST_CATEGORIES.includes(t.category)).reduce((s, t) => s + t.amount, 0))}</p></div>
                                        <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Laba</p><p className="font-semibold">{formatCurrency(reportTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0) - reportTransactions.filter(t => t.type === TransactionType.EXPENSE && PRODUCTION_COST_CATEGORIES.includes(t.category)).reduce((s, t) => s + t.amount, 0))}</p></div>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-brand-border p-4">
                                        <h4 className="font-semibold mb-2">Transaksi</h4>
                                        <div className="space-y-2">
                                            {reportTransactions.map(t => (
                                                <div key={t.id} className="flex items-center justify-between text-sm">
                                                    <div><p className="font-medium">{t.description}</p><p className="text-[11px] text-brand-text-secondary">{new Date(t.date).toLocaleDateString('id-ID')} • {t.category}</p></div>
                                                    <p className={`font-semibold ${t.type === TransactionType.INCOME ? 'text-brand-success' : 'text-brand-danger'}`}>{formatCurrency(t.amount)}</p>
                                                </div>
                                            ))}
                                            {reportTransactions.length === 0 && <p className="text-sm text-brand-text-secondary">Tidak ada data.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Desktop report */}
                        {reportFilters.client !== 'all' ? (
                            <div className="hidden md:block"><ClientProfitabilityReport
                                transactions={reportTransactions}
                                clientName={reportClientOptions.find(c => c.id === reportFilters.client)?.name || ''}
                                periodText={`${reportFilters.dateFrom || ''} - ${reportFilters.dateTo || ''}`}
                                profile={profile}
                                projects={projects}
                            /></div>
                        ) : (
                            generalReportMetrics && <div className="hidden md:block"><GeneralFinancialReport
                                metrics={generalReportMetrics}
                                transactions={reportTransactions}
                                periodText={`${reportFilters.dateFrom || ''} - ${reportFilters.dateTo || ''}`}
                                profile={profile}
                            /></div>
                        )}
                    </div>
                );
            case 'laporanKartu':
                return <CardReportTab transactions={transactions} cards={cards} profile={profile} />;
            case 'labaAcara Pernikahan':
                const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i, name: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) }));
                const yearOptions: number[] = Array.from(new Set<number>(projects.map(p => new Date(p.date).getFullYear()))).sort((a: number, b: number) => b - a);

                return (
                    <div className="space-y-6 printable-area widget-animate">
                        <div className="bg-brand-surface p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center non-printable border border-brand-border">
                            <h4 className="text-md font-semibold text-gradient whitespace-nowrap">Filter Laporan Laba:</h4>
                            <select name="year" value={profitReportFilters.year} onChange={e => setProfitReportFilters(p => ({ ...p, year: Number(e.target.value) }))} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto">
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select name="month" value={profitReportFilters.month} onChange={e => setProfitReportFilters(p => ({ ...p, month: Number(e.target.value) }))} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto">
                                {monthOptions.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                            </select>
                            <div className="flex items-center gap-2 ml-auto">
                                <button onClick={handleDownloadProfitReportCSV} className="button-secondary inline-flex items-center gap-2"><DownloadIcon className="w-5 h-5" />Unduh CSV</button>
                                <button onClick={() => window.print()} className="button-primary inline-flex items-center gap-2"><PrinterIcon className="w-5 h-5" />Cetak PDF</button>
                            </div>
                        </div>
                        {/* Mobile summary + list */}
                        <div className="md:hidden space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Total Laba</p><p className="font-semibold">{formatCurrency(profitReportMetrics.totalProfit)}</p></div>
                                <div className="rounded-2xl bg-white/5 border border-brand-border p-3"><p className="text-[11px] text-brand-text-secondary">Avg/Acara Pernikahan</p><p className="font-semibold">{formatCurrency(profitReportMetrics.avgProfit)}</p></div>
                            </div>
                            <div className="rounded-2xl bg-white/5 border border-brand-border p-4">
                                <h4 className="font-semibold mb-2">Laba per Pengantin</h4>
                                <div className="space-y-2">
                                    {projectProfitabilityData.map(d => (
                                        <div key={d!.clientId} className="flex items-center justify-between text-sm">
                                            <div><p className="font-medium">{d!.clientName}</p><p className="text-[11px] text-brand-text-secondary">Income {formatCurrency(d!.totalIncome)} • Cost {formatCurrency(d!.totalCost)}</p></div>
                                            <p className={`font-semibold ${d!.profit >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>{formatCurrency(d!.profit)}</p>
                                        </div>
                                    ))}
                                    {projectProfitabilityData.length === 0 && <p className="text-sm text-brand-text-secondary">Tidak ada data untuk periode ini.</p>}
                                </div>
                            </div>
                        </div>
                        {/* Desktop summary + printable */}
                        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 non-printable">
                            <StatCard icon={<DollarSignIcon className="w-6 h-6" />} title="Total Laba Periode Ini" value={formatCurrency(profitReportMetrics.totalProfit)} colorVariant="blue" />
                            <StatCard icon={<UsersIcon className="w-6 h-6" />} title="Pengantin Paling Profit" value={profitReportMetrics.mostProfitableClient} colorVariant="green" />
                            <StatCard icon={<TrendingUpIcon className="w-6 h-6" />} title="Jumlah Acara Pernikahan Profit" value={`${profitReportMetrics.profitableProjectsCount} dari ${projectProfitabilityData.length}`} colorVariant="orange" />
                            <StatCard icon={<TargetIcon className="w-6 h-6" />} title="Rata-rata Laba/Acara Pernikahan" value={formatCurrency(profitReportMetrics.avgProfit)} colorVariant="purple" />
                        </div>
                        <div className="printable-report hidden md:block">
                            <div className="hidden print:block text-black mb-6">
                                <h1 className="text-xl font-bold">{profile.companyName}</h1>
                                <p className="text-sm">{profile.address}</p>
                                <div className="mt-4 pt-4 border-t-2 border-black">
                                    <h2>Laporan Laba per Pengantin</h2>
                                    <p>Periode: {monthOptions.find(m => m.value === profitReportFilters.month)?.name} {profitReportFilters.year}</p>
                                </div>
                            </div>
                            <div className="bg-brand-surface p-6 rounded-2xl shadow-lg mt-6 border border-brand-border print:shadow-none print:border-none print:p-0 print:mt-0">
                                <div className="print:hidden">
                                    <h3 className="text-lg font-bold mb-2 text-gradient">Laporan Laba per Pengantin</h3>
                                    <p className="text-sm text-brand-text-primary mb-4">Menampilkan profitabilitas untuk Acara Pernikahan yang dieksekusi pada <strong>{monthOptions.find(m => m.value === profitReportFilters.month)?.name} {profitReportFilters.year}</strong>.</p>
                                </div>
                                <div className="overflow-x-auto max-h-[500px] print:max-h-none print:overflow-visible">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs uppercase print-bg-slate bg-brand-input">
                                            <tr className="print-text-black">
                                                <th className="p-3 text-left">Pelanggan</th>
                                                <th className="p-3 text-right">Harga Package</th>
                                                <th className="p-3 text-right">Biaya Tambahan</th>
                                                <th className="p-3 text-right">Transport</th>
                                                <th className="p-3 text-right">Total Tagihan</th>
                                                <th className="p-3 text-right">Total Terbayar</th>
                                                <th className="p-3 text-right">Biaya Produksi</th>
                                                <th className="p-3 text-right">Laba Kotor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-border">
                                            {projectProfitabilityData.map(data => {
                                                const totalTagihan = (data as any).totalPackageRevenue + (data as any).totalCustomCosts + (data as any).totalTransportCosts;
                                                return (
                                                    <tr key={data!.clientId}>
                                                        <td className="p-3">
                                                            <p className="font-semibold text-brand-text-light">{data!.clientName}</p>
                                                            <p className="text-[10px] text-brand-text-secondary font-mono">{(data as any).projects.map((p: any) => p.packageName).join(', ')}</p>
                                                        </td>
                                                        <td className="p-3 text-right text-brand-text-secondary">{formatCurrency((data as any).totalPackageRevenue)}</td>
                                                        <td className="p-3 text-right text-orange-400 font-medium">+{formatCurrency((data as any).totalCustomCosts)}</td>
                                                        <td className="p-3 text-right text-brand-text-secondary">{formatCurrency((data as any).totalTransportCosts)}</td>
                                                        <td className="p-3 text-right font-bold text-brand-text-primary">{formatCurrency(totalTagihan)}</td>
                                                        <td className="p-3 text-right text-brand-success font-semibold">{formatCurrency(data!.totalIncome)}</td>
                                                        <td className="p-3 text-right text-brand-danger">{formatCurrency(data!.totalCost)}</td>
                                                        <td className={`p-3 text-right font-black ${data!.profit >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
                                                            {formatCurrency(data!.profit)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {projectProfitabilityData.length === 0 && (
                                                <tr><td colSpan={5} className="text-center p-8 text-brand-text-secondary">Tidak ada data Acara Pernikahan untuk periode ini.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    // --- REPORT SUB-COMPONENTS ---
    const GeneralFinancialReport: React.FC<{ metrics: any, transactions: Transaction[], periodText: string, profile: Profile }> = ({ metrics, transactions, periodText, profile }) => (
        <div className="printable-report space-y-6">
            {/* Print Header */}
            <div className="hidden print:block text-black mb-6">
                <h1 className="text-xl font-bold">{profile.companyName}</h1>
                <p className="text-sm">{profile.address}</p>
                <div className="mt-4 pt-4 border-t-2 border-black">
                    <h2>Laporan Keuangan Umum</h2>
                    <p>Periode: {periodText}</p>
                </div>
            </div>

            {/* Screen Header */}
            <div className="print:hidden">
                <h2 className="text-2xl font-bold mb-2 text-gradient">Laporan Keuangan Umum</h2>
                <p className="mb-6 text-brand-text-primary">Periode: {periodText}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 StatCard-container">
                <StatCard icon={<ArrowUpIcon className="w-6 h-6" />} title="Total Pemasukan" value={formatCurrency(metrics.reportIncome)} subtitle="Pemasukan periode ini" colorVariant="green" />
                <StatCard icon={<ArrowDownIcon className="w-6 h-6" />} title="Total Pengeluaran" value={formatCurrency(metrics.reportExpense)} subtitle="Pengeluaran periode ini" colorVariant="pink" />
                <StatCard icon={<DollarSignIcon className="w-6 h-6" />} title="Laba / Rugi Bersih" value={formatCurrency(metrics.reportIncome - metrics.reportExpense)} subtitle="Selisih pemasukan & pengeluaran" colorVariant="blue" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 charts-container">
                <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border chart-wrapper"><h3 className="text-lg font-bold text-gradient mb-4">Analisis Pemasukan</h3><DonutChart data={metrics.incomeDonut} /></div>
                <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border chart-wrapper"><h3 className="text-lg font-bold text-gradient mb-4">Analisis Pengeluaran</h3><DonutChart data={metrics.expenseDonut} /></div>
            </div>
            <div className="bg-brand-surface p-6 rounded-2xl shadow-lg mt-6 border border-brand-border">
                <h3 className="text-lg font-bold text-gradient mb-4">Rincian Semua Transaksi</h3>
                <div className="overflow-x-auto max-h-[500px] print:max-h-none print:overflow-visible"><TransactionTable transactions={transactions} /></div>
            </div>
        </div>
    );

    const ClientProfitabilityReport: React.FC<{ transactions: Transaction[], clientName: string, periodText: string, profile: Profile, projects: Project[] }> = ({ transactions, clientName, periodText, profile, projects }) => {
        const clientIncome = transactions.filter(t => t.type === TransactionType.INCOME);
        const clientCost = transactions.filter(t => t.type === TransactionType.EXPENSE && PRODUCTION_COST_CATEGORIES.includes(t.category));
        const totalIncome = clientIncome.reduce((sum, t) => sum + t.amount, 0);
        const totalCost = clientCost.reduce((sum, t) => sum + t.amount, 0);
        const profit = totalIncome - totalCost;

        // Breakdown based on project settings
        const relevantProjects = projects.filter(p => transactions.some(t => t.projectId === p.id));
        const baseProjectValue = relevantProjects.reduce((sum, p) => sum + (p.totalCost - (p.customCosts?.reduce((s, c) => s + c.amount, 0) || 0) - (Number(p.transportCost) || 0)), 0);
        const totalCustomCosts = relevantProjects.reduce((sum, p) => sum + (p.customCosts?.reduce((s, c) => s + c.amount, 0) || 0), 0);
        const totalTransportFees = relevantProjects.reduce((sum, p) => sum + (Number(p.transportCost) || 0), 0);

        return (
            <div className="printable-report space-y-6">
                {/* Print Header */}
                <div className="hidden print:block text-black mb-6">
                    <h1 className="text-xl font-bold">{profile.companyName}</h1>
                    <p className="text-sm">{profile.address}</p>
                    <div className="mt-4 pt-4 border-t-2 border-black">
                        <h2>Laporan Profitabilitas Pengantin</h2>
                        <p>Pengantin: {clientName} | Periode: {periodText}</p>
                    </div>
                </div>

                {/* Screen Header */}
                <div className="print:hidden">
                    <h2 className="text-2xl font-bold mb-2 text-gradient">Laporan Profitabilitas Pengantin</h2>
                    <p className="mb-6 text-brand-text-primary">Pengantin: <span className="font-semibold">{clientName}</span> | Periode: {periodText}</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 StatCard-container">
                    <StatCard icon={<ArrowUpIcon className="w-6 h-6" />} title="Total Pemasukan" value={formatCurrency(totalIncome)} iconBgColor="bg-brand-success/20" iconColor="text-brand-success" />
                    <StatCard icon={<ArrowDownIcon className="w-6 h-6" />} title="Total Biaya Produksi" value={formatCurrency(totalCost)} iconBgColor="bg-brand-danger/20" iconColor="text-brand-danger" />
                    <StatCard icon={<DollarSignIcon className="w-6 h-6" />} title="Laba Kotor" value={formatCurrency(profit)} />
                </div>

                {/* Project Breakdown Section */}
                <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border">
                    <h3 className="text-lg font-bold text-gradient mb-4">Konfigurasi Biaya Proyek</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-brand-bg rounded-xl border border-brand-border/50">
                            <p className="text-xs text-brand-text-secondary uppercase font-bold tracking-wider mb-1">Package Utama</p>
                            <p className="text-xl font-bold text-brand-text-light">{formatCurrency(baseProjectValue)}</p>
                        </div>
                        <div className="p-4 bg-brand-bg rounded-xl border border-brand-border/50">
                            <p className="text-xs text-orange-400 uppercase font-bold tracking-wider mb-1">Biaya Tambahan (Custom)</p>
                            <p className="text-xl font-bold text-orange-400">+{formatCurrency(totalCustomCosts)}</p>
                        </div>
                        <div className="p-4 bg-brand-bg rounded-xl border border-brand-border/50">
                            <p className="text-xs text-brand-text-secondary uppercase font-bold tracking-wider mb-1">Biaya Transport</p>
                            <p className="text-xl font-bold text-brand-text-light">{formatCurrency(totalTransportFees)}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border chart-wrapper">
                        <h3 className="text-lg font-bold text-gradient mb-4">Rincian Pemasukan dari Pengantin</h3>
                        <div className="overflow-x-auto max-h-[400px] print:max-h-none print:overflow-visible"><TransactionTable transactions={clientIncome} /></div>
                    </div>
                    <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border chart-wrapper">
                        <h3 className="text-lg font-bold text-gradient mb-4">Rincian Biaya Produksi</h3>
                        <div className="overflow-x-auto max-h-[400px] print:max-h-none print:overflow-visible"><TransactionTable transactions={clientCost} /></div>
                    </div>
                </div>
            </div>
        );
    }

    const CardReportTab: React.FC<{
        transactions: Transaction[];
        cards: Card[];
        profile: Profile;
    }> = ({ transactions, cards, profile }) => {
        const [filters, setFilters] = useState({ cardId: 'all', dateFrom: '', dateTo: '' });

        const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
            setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
        };

        const filteredTransactions = useMemo(() => {
            return transactions.filter(t => {
                const date = new Date(t.date);
                const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
                const to = filters.dateTo ? new Date(filters.dateTo) : null;
                if (from) from.setHours(0, 0, 0, 0);
                if (to) to.setHours(23, 59, 59, 999);

                const dateMatch = (!from || date >= from) && (!to || date <= to);
                const cardMatch = filters.cardId === 'all' || t.cardId === filters.cardId;

                return dateMatch && cardMatch;
            });
        }, [transactions, filters]);

        const reportStats = useMemo(() => {
            const income = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
            const expense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
            return { income, expense, net: income - expense };
        }, [filteredTransactions]);

        const expenseDonutData = useMemo(() => {
            const expenseByCategory = filteredTransactions
                .filter(t => t.type === TransactionType.EXPENSE)
                .reduce((acc, t) => {
                    acc[t.category] = (acc[t.category] || 0) + t.amount;
                    return acc;
                }, {} as Record<string, number>);

            const colors = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'];
            const entries = Object.entries(expenseByCategory as Record<string, number>) as [string, number][];
            return entries
                .sort(([, a], [, b]) => b - a)
                .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
        }, [filteredTransactions]);

        return (
            <div className="space-y-6 printable-area widget-animate">
                <div className="bg-brand-surface p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center non-printable border border-brand-border">
                    <h4 className="text-md font-semibold text-gradient whitespace-nowrap">Filter Laporan:</h4>
                    <select name="cardId" value={filters.cardId} onChange={handleFilterChange} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto">
                        <option value="all">Semua Kartu/Akun</option>
                        {cards.map(c => <option key={c.id} value={c.id}>{c.bankName} {c.lastFourDigits !== 'CASH' ? `**** ${c.lastFourDigits}` : '(Tunai)'}</option>)}
                    </select>
                    <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto" />
                    <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="input-field !rounded-lg !border p-2.5 w-full md:w-auto" />
                    <button onClick={() => window.print()} className="ml-auto button-primary inline-flex items-center gap-2"><PrinterIcon className="w-5 h-5" />Cetak</button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 StatCard-container">
                    <StatCard icon={<ArrowUpIcon className="w-6 h-6" />} title="Total Pemasukan" value={formatCurrency(reportStats.income)} iconBgColor="bg-brand-success/20" iconColor="text-brand-success" />
                    <StatCard icon={<ArrowDownIcon className="w-6 h-6" />} title="Total Pengeluaran" value={formatCurrency(reportStats.expense)} iconBgColor="bg-brand-danger/20" iconColor="text-brand-danger" />
                    <StatCard icon={<DollarSignIcon className="w-6 h-6" />} title="Arus Kas Bersih" value={formatCurrency(reportStats.net)} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border chart-wrapper">
                        <h3 className="text-lg font-bold text-gradient mb-4">Pengeluaran per Kategori</h3>
                        <DonutChart data={expenseDonutData} />
                    </div>
                    <div className="lg:col-span-3 bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border">
                        <h3 className="text-lg font-bold text-gradient mb-4">Rincian Transaksi</h3>
                        <div className="overflow-x-auto max-h-[400px]"><TransactionTable transactions={filteredTransactions} /></div>
                    </div>
                </div>
            </div>
        );
    };

    const statModalTitles: { [key: string]: string } = {
        assets: 'Rincian Total Aset',
        pockets: 'Rincian Dana di Kantong',
        income: `Pemasukan Bulan ${new Date().toLocaleString('id-ID', { month: 'long' })}`,
        expense: `Pengeluaran Bulan ${new Date().toLocaleString('id-ID', { month: 'long' })}`
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Kelola Keuangan Vendor" subtitle="Pantau kesehatan Keuangan bisnis Anda dari transaksi hingga proyeksi masa depan." icon={<DollarSignIcon className="w-6 h-6" />}>
                <div className="flex items-center gap-2 non-printable">
                    <button onClick={() => handleOpenModal('transaction', 'add')} className="button-secondary inline-flex items-center gap-2">
                        <PlusIcon className="w-5 h-5" />Tambah Transaksi
                    </button>
                </div>
            </PageHeader>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="widget-animate cursor-pointer transition-transform duration-200 hover:scale-105" style={{ animationDelay: '100ms' }} onClick={() => setActiveStatModal('assets')}>
                    <StatCard icon={<CreditCardIcon className="w-6 h-6" />} title="Total Aset" value={formatCurrency(summary.totalAssets)} subtitle="Total gabungan saldo di semua kartu & tunai Anda." />
                </div>
                <div className="widget-animate cursor-pointer transition-transform duration-200 hover:scale-105" style={{ animationDelay: '200ms' }} onClick={() => setActiveStatModal('pockets')}>
                    <StatCard icon={<ClipboardListIcon className="w-6 h-6" />} title="Dana di Kantong" value={formatCurrency(summary.pocketsTotal)} subtitle="Total dana yang dialokasikan di semua kantong." />
                </div>
                <div className="widget-animate cursor-pointer transition-transform duration-200 hover:scale-105" style={{ animationDelay: '300ms' }} onClick={() => setActiveStatModal('income')}>
                    <StatCard icon={<ArrowUpIcon className="w-6 h-6" />} title="Pemasukan Bulan Ini" value={formatCurrency(summary.totalIncomeThisMonth)} subtitle="Total pemasukan yang tercatat bulan ini." />
                </div>
                <div className="widget-animate cursor-pointer transition-transform duration-200 hover:scale-105" style={{ animationDelay: '400ms' }} onClick={() => setActiveStatModal('expense')}>
                    <StatCard icon={<ArrowDownIcon className="w-6 h-6" />} title="Pengeluaran Bulan Ini" value={formatCurrency(summary.totalExpenseThisMonth)} subtitle="Total pengeluaran yang tercatat bulan ini." />
                </div>
            </div>
            {/* Card Saya - selalu tampil untuk mempermudah melihat kartu */}
            <div className="widget-animate non-printable" style={{ animationDelay: '450ms' }}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gradient flex items-center gap-2">
                        <CreditCardIcon className="w-5 h-5" /> Card Saya
                    </h3>
                    <button onClick={() => setActiveTab('cards')} className="text-sm font-semibold text-brand-accent hover:underline">
                        Kelola Kartu &rarr;
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 overflow-x-auto pb-2">
                    {cards.map(card => {
                        const connectedPockets = pockets.filter(p => p.sourceCardId === card.id);
                        return (
                            <div key={card.id} className="min-w-[280px] max-w-full">
                                {card.cardType === CardType.TUNAI
                                    ? <CashWidget card={card} onClick={() => setHistoryModalState({ type: 'card', item: card })} onTopUp={() => handleOpenModal('topup-cash', 'add')} onEdit={() => handleOpenModal('card', 'edit', card)} connectedPockets={connectedPockets} />
                                    : <CardWidget card={card} onEdit={() => handleOpenModal('card', 'edit', card)} onDelete={() => handleDelete('card', card.id)} onClick={() => setHistoryModalState({ type: 'card', item: card })} connectedPockets={connectedPockets} />
                                }
                            </div>
                        );
                    })}
                    <button onClick={() => handleOpenModal('card', 'add')} className="min-w-[280px] border-2 border-dashed border-brand-border rounded-2xl flex flex-col items-center justify-center text-brand-text-secondary hover:bg-brand-input hover:border-brand-accent hover:text-brand-accent transition-all duration-300 min-h-[200px]">
                        <div className="w-14 h-14 rounded-full bg-brand-bg flex items-center justify-center">
                            <PlusIcon className="w-7 h-7" />
                        </div>
                        <span className="mt-3 font-semibold text-sm">Tambah Kartu / Akun</span>
                    </button>
                </div>
                {cards.length === 0 && (
                    <p className="text-center py-4 text-brand-text-secondary text-sm">Belum ada kartu/akun. Klik &quot;Tambah Kartu / Akun&quot; untuk mulai.</p>
                )}
            </div>
            {/* Desktop Tab Navigation */}
            <div className="hidden md:block border-b border-brand-border non-printable widget-animate" style={{ animationDelay: '500ms' }}>
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button onClick={() => setActiveTab('transactions')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'transactions' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><FileTextIcon className="w-5 h-5" />Transaksi</button>
                    <button onClick={() => setActiveTab('pockets')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'pockets' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><ClipboardListIcon className="w-5 h-5" />Kantong</button>
                    <button onClick={() => setActiveTab('cards')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'cards' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><CreditCardIcon className="w-5 h-5" />Kartu Saya</button>
                    <button onClick={() => setActiveTab('cashflow')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'cashflow' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><TrendingUpIcon className="w-5 h-5" />Arus Kas</button>
                    <button onClick={() => setActiveTab('laporan')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'laporan' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><BarChart2Icon className="w-5 h-5" />Laporan Umum</button>
                    <button onClick={() => setActiveTab('laporanKartu')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'laporanKartu' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><CreditCardIcon className="w-5 h-5" />Laporan Kartu</button>
                    <button onClick={() => setActiveTab('labaAcara Pernikahan')} className={`shrink-0 inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'labaAcara Pernikahan' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-light'}`}><DollarSignIcon className="w-5 h-5" />Laba Acara Pernikahan</button>
                </nav>
            </div>

            {/* Mobile Tab Navigation - Pills */}
            <div className="md:hidden non-printable widget-animate mb-4" style={{ animationDelay: '500ms' }}>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button onClick={() => setActiveTab('transactions')} className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${activeTab === 'transactions' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30' : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'}`}><FileTextIcon className="w-4 h-4" /><span>Transaksi</span></button>
                    <button onClick={() => setActiveTab('pockets')} className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${activeTab === 'pockets' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30' : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'}`}><ClipboardListIcon className="w-4 h-4" /><span>Kantong</span></button>
                    <button onClick={() => setActiveTab('cards')} className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${activeTab === 'cards' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30' : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'}`}><CreditCardIcon className="w-4 h-4" /><span>Kartu</span></button>
                    <button onClick={() => setActiveTab('cashflow')} className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${activeTab === 'cashflow' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30' : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'}`}><TrendingUpIcon className="w-4 h-4" /><span>Arus Kas</span></button>
                    <button onClick={() => setActiveTab('laporan')} className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${activeTab === 'laporan' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30' : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'}`}><BarChart2Icon className="w-4 h-4" /><span>Laporan</span></button>
                    <button onClick={() => setActiveTab('laporanKartu')} className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${activeTab === 'laporanKartu' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30' : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'}`}><CreditCardIcon className="w-4 h-4" /><span>Lap. Kartu</span></button>
                    <button onClick={() => setActiveTab('labaAcara Pernikahan')} className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${activeTab === 'labaAcara Pernikahan' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30' : 'bg-brand-surface text-brand-text-secondary border border-brand-border active:scale-95'}`}><DollarSignIcon className="w-4 h-4" /><span>Laba</span></button>
                </div>
            </div>
            <div className="widget-animate" style={{ animationDelay: '600ms' }}>{renderTabContent()}</div>

            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Panduan Halaman Keuangan">
                <div className="space-y-4 text-sm text-brand-text-primary">
                    <p>Halaman ini adalah pusat komando Keuangan bisnis Anda. Gunakan berbagai tab untuk mendapatkan gambaran lengkap.</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Transaksi:</strong> Catat semua pemasukan dan pengeluaran. Gunakan filter di sisi kiri untuk menganalisis berdasarkan kategori.</li>
                        <li><strong>Kantong:</strong> Buat "kantong" virtual untuk mengalokasikan dana, seperti tabungan alat atau anggaran operasional bulanan.</li>
                        <li><strong>Kartu Saya:</strong> Daftarkan semua akun bank, kartu kredit, dan kas tunai Anda untuk melacak saldo secara akurat.</li>
                        <li><strong>Arus Kas:</strong> Lihat grafik interaktif yang menunjukkan tren pemasukan, pengeluaran, dan saldo akhir Anda dari waktu ke waktu.</li>
                        <li><strong>Laporan:</strong> Hasilkan laporan keuangan profesional. Anda bisa memfilter berdasarkan pengantin dan rentang tanggal, lalu mencetaknya sebagai PDF.</li>
                    </ul>
                </div>
            </Modal>

            {modalState.type && <Modal
                isOpen={!!modalState.type}
                onClose={handleCloseModal}
                title={`${modalState.mode === 'add' ? 'Tambah' : 'Edit'} ${modalState.type === 'transaction' ? 'Transaksi' :
                    modalState.type === 'pocket' ? 'Kantong' :
                        modalState.type === 'card' ? 'Kartu/Akun' :
                            modalState.type === 'topup-cash' ? 'Top-up Tunai' :
                                (modalState.type === 'transfer' && form.type === 'withdraw') ? `Tarik Dana dari "${modalState.data?.name}"` :
                                    (modalState.type === 'transfer' && form.type === 'deposit') ? `Setor Dana ke "${modalState.data?.name}"` :
                                        'Transfer'
                    }`}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {modalState.type === 'transaction' && <>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="input-group"><select id="type" name="type" value={form.type} onChange={handleFormChange} className="input-field"><option value={TransactionType.EXPENSE}>Pengeluaran</option><option value={TransactionType.INCOME}>Pemasukan</option></select><label htmlFor="type" className="input-label">Jenis</label></div>
                            <div className="input-group"><input type="date" id="date" name="date" value={form.date} onChange={handleFormChange} className="input-field" placeholder=" " /><label htmlFor="date" className="input-label">Tanggal</label></div>
                        </div>
                        <div className="input-group"><input type="text" id="description" name="description" value={form.description} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="description" className="input-label">Deskripsi</label></div>
                        <div className="input-group">
                            <RupiahInput
                                id="amount"
                                name="amount"
                                value={String(form.amount ?? '')}
                                onChange={(raw) => setForm((prev: any) => ({ ...prev, amount: raw }))}
                                className="input-field"
                                placeholder=" "
                                required
                            />
                            <label htmlFor="amount" className="input-label">Jumlah (IDR)</label>
                        </div>
                        <div className="input-group"><select id="category" name="category" value={form.category} onChange={handleFormChange} className="input-field" required><option value="">Pilih Kategori...</option>{(form.type === TransactionType.INCOME ? profile.incomeCategories : profile.expenseCategories).map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select><label htmlFor="category" className="input-label">Kategori</label></div>
                        {form.type === TransactionType.INCOME ? (
                            <div className="input-group"><select id="cardId" name="cardId" value={form.cardId || ''} onChange={handleFormChange} className="input-field" required><option value="">Pilih Tujuan...</option>{cards.map(c => (<option key={c.id} value={c.id}>{c.cardHolderName} {c.cardType !== CardType.TUNAI ? `(${c.bankName} **** ${c.lastFourDigits})` : '(Tunai)'} (Saldo: {formatCurrency(c.balance)})</option>))}</select><label htmlFor="cardId" className="input-label">Setor Ke</label></div>
                        ) : (
                            <div className="input-group"><select id="sourceId" name="sourceId" value={form.sourceId} onChange={handleFormChange} className="input-field" required><option value="">Pilih Sumber...</option>{cards.map(c => (<option key={c.id} value={`card-${c.id}`}>{c.cardHolderName} {c.cardType !== CardType.TUNAI ? `(${c.bankName} **** ${c.lastFourDigits})` : '(Tunai)'} (Saldo: {formatCurrency(c.balance)})</option>))}{(pockets.filter(p => p.type === PocketType.EXPENSE).map(p => (<option key={p.id} value={`pocket-${p.id}`}>{p.name} (Sisa: {formatCurrency(p.amount)})</option>)))}</select><label htmlFor="sourceId" className="input-label">Sumber Dana</label></div>
                        )}

                        <div className="input-group flex gap-2">
                            <div className="flex-1 relative">
                                <select
                                    id="projectId"
                                    name="projectId"
                                    value={form.projectId || ''}
                                    onChange={handleFormChange}
                                    className="input-field"
                                >
                                    <option value="">Tidak Terkait Proyek</option>
                                    {projects
                                        .filter(p => {
                                            if (!transactionProjectMonthFilter) return true;
                                            if (!p.date) return true; // if project has no date, show it or hide it? Let's hide it if filtered. Or wait, maybe return true if no date? Let's assume projects have dates.
                                            const pDate = new Date(p.date);
                                            const [fYear, fMonth] = transactionProjectMonthFilter.split('-');
                                            return pDate.getFullYear() === parseInt(fYear) && (pDate.getMonth() + 1) === parseInt(fMonth);
                                        })
                                        .map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.projectName} ({p.clientName})
                                        </option>
                                    ))}
                                </select>
                                <label htmlFor="projectId" className="input-label">Terkait Proyek (Opsional)</label>
                            </div>
                            <div className="w-1/3 relative">
                                <input 
                                    type="month" 
                                    value={transactionProjectMonthFilter} 
                                    onChange={(e) => setTransactionProjectMonthFilter(e.target.value)} 
                                    className="input-field text-sm p-2 h-full"
                                    title="Filter Bulan Proyek"
                                />
                                <label className="input-label text-[10px]">Bulan Proyek</label>
                            </div>
                        </div>
                    </>}
                    {modalState.type === 'card' && <>
                        <div className="input-group"><select id="cardType" name="cardType" value={form.cardType} onChange={handleFormChange} className="input-field">{Object.values(CardType).map(ct => <option key={ct} value={ct}>{ct}</option>)}</select><label htmlFor="cardType" className="input-label">Jenis Akun</label></div>
                        <div className="input-group"><input type="text" id="cardHolderName" name="cardHolderName" value={form.cardHolderName} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="cardHolderName" className="input-label">{form.cardType === CardType.TUNAI ? 'Nama Akun Kas' : 'Nama Pemegang Kartu'}</label></div>
                        {modalState.mode === 'add' && (
                            <div className="input-group">
                                <RupiahInput
                                    id="initialBalance"
                                    name="initialBalance"
                                    value={String(form.initialBalance ?? '')}
                                    onChange={(raw) => setForm((prev: any) => ({ ...prev, initialBalance: raw }))}
                                    className="input-field"
                                    placeholder=" "
                                />
                                <label htmlFor="initialBalance" className="input-label">Saldo Awal (Opsional)</label>
                            </div>
                        )}

                        {form.cardType !== CardType.TUNAI ? (
                            <>
                                <div className="input-group"><input type="text" id="bankName" name="bankName" value={form.bankName} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="bankName" className="input-label">Nama Bank</label></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="input-group"><input type="text" id="lastFourDigits" name="lastFourDigits" value={form.lastFourDigits} onChange={handleFormChange} className="input-field" placeholder=" " maxLength={4} required /><label htmlFor="lastFourDigits" className="input-label">4 Digit Terakhir</label></div>
                                    <div className="input-group"><input type="text" id="expiryDate" name="expiryDate" value={form.expiryDate} onChange={handleFormChange} className="input-field" placeholder="MM/YY" /><label htmlFor="expiryDate" className="input-label">Kadaluwarsa</label></div>
                                </div>
                            </>
                        ) : (<div className="p-3 bg-brand-bg rounded-lg text-sm text-brand-text-secondary">Anda sedang membuat akun kas tunai. Detail lainnya akan diisi secara otomatis.</div>)}

                        {modalState.mode === 'edit' && (
                            <div className="p-4 bg-brand-bg rounded-lg mt-6">
                                <h4 className="font-semibold text-gradient mb-2">Penyesuaian Saldo (Opsional)</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Isi untuk menambah atau mengurangi saldo. Gunakan angka negatif untuk mengurangi (misal: -50000).</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="input-group !mt-0">
                                        <RupiahInput
                                            id="adjustmentAmount"
                                            name="adjustmentAmount"
                                            value={String(form.adjustmentAmount ?? '')}
                                            onChange={(raw) => setForm((prev: any) => ({ ...prev, adjustmentAmount: raw }))}
                                            className="input-field"
                                            placeholder=" "
                                            allowNegative
                                        />
                                        <label htmlFor="adjustmentAmount" className="input-label">Jumlah Penyesuaian</label>
                                    </div>
                                    <div className="input-group !mt-0"><input type="text" id="adjustmentReason" name="adjustmentReason" value={form.adjustmentReason} onChange={handleFormChange} className="input-field" placeholder=" " /><label htmlFor="adjustmentReason" className="input-label">Alasan (e.g., Koreksi)</label></div>
                                </div>
                            </div>
                        )}
                    </>}
                    {modalState.type === 'pocket' && <>
                        <div className="input-group"><input type="text" id="name" name="name" value={form.name} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="name" className="input-label">Nama Kantong</label></div>
                        <div className="input-group"><textarea id="description" name="description" value={form.description} onChange={handleFormChange} className="input-field" placeholder=" " rows={2} /><label htmlFor="description" className="input-label">Deskripsi</label></div>
                        <div className="input-group"><select id="sourceCardId" name="sourceCardId" value={form.sourceCardId} onChange={handleFormChange} className="input-field"><option value="">Pilih Kartu...</option>{cards.map(c => <option key={c.id} value={c.id}>{c.bankName} {c.cardType !== CardType.TUNAI && `**** ${c.lastFourDigits}`}</option>)}</select><label htmlFor="sourceCardId" className="input-label">Sumber Dana (Kartu)</label></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="input-group"><select id="icon" name="icon" value={form.icon} onChange={handleFormChange} className="input-field">{Object.keys(pocketIcons).map(i => <option key={i} value={i}>{i}</option>)}</select><label htmlFor="icon" className="input-label">Ikon</label></div>
                            <div className="input-group">
                                <select name="type" id="type" value={form.type} onChange={handleFormChange} className="input-field">
                                    {Object.values(PocketType).map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                </select>
                                <label htmlFor="type" className="input-label">Tipe Kantong</label>
                            </div>
                        </div>
                        {(form.type === PocketType.SAVING || form.type === PocketType.EXPENSE) && (
                            <div className="input-group">
                                <RupiahInput
                                    id="goalAmount"
                                    name="goalAmount"
                                    value={String(form.goalAmount ?? '')}
                                    onChange={(raw) => setForm((prev: any) => ({ ...prev, goalAmount: raw }))}
                                    className="input-field"
                                    placeholder=" "
                                />
                                <label htmlFor="goalAmount" className="input-label">Target Jumlah (Opsional)</label>
                            </div>
                        )}
                        {form.type === PocketType.LOCKED &&
                            <div className="input-group">
                                <input type="date" id="lockEndDate" name="lockEndDate" value={form.lockEndDate || ''} onChange={handleFormChange} className="input-field" placeholder=" " />
                                <label htmlFor="lockEndDate" className="input-label">Tgl. Kunci Berakhir (Opsional)</label>
                            </div>
                        }
                    </>}
                    {modalState.type === 'transfer' && <>
                        <div className="input-group">
                            <select id="fromCardId" name="fromCardId" value={form.fromCardId} onChange={handleFormChange} className="input-field" required>
                                <option value="">Pilih Kartu Sumber...</option>
                                {cards.filter(c => c.cardType !== CardType.TUNAI).map(c => <option key={c.id} value={c.id}>{c.bankName} **** {c.lastFourDigits} (Saldo: {formatCurrency(c.balance)})</option>)}
                            </select>
                            <label htmlFor="fromCardId" className="input-label">Sumber Dana</label>
                        </div>
                        <div className="input-group">
                            <RupiahInput
                                id="amount"
                                name="amount"
                                value={String(form.amount ?? '')}
                                onChange={(raw) => setForm((prev: any) => ({ ...prev, amount: raw }))}
                                className="input-field"
                                placeholder=" "
                                required
                            />
                            <label htmlFor="amount" className="input-label">Jumlah (IDR)</label>
                        </div>
                    </>}
                    {modalState.type === 'topup-cash' && <>
                        <div className="input-group">
                            <select id="fromCardId" name="fromCardId" value={form.fromCardId} onChange={handleFormChange} className="input-field" required>
                                <option value="">Pilih Kartu Sumber...</option>
                                {cards.filter(c => c.cardType !== CardType.TUNAI).map(c => <option key={c.id} value={c.id}>{c.bankName} **** {c.lastFourDigits} (Saldo: {formatCurrency(c.balance)})</option>)}
                            </select>
                            <label htmlFor="fromCardId" className="input-label">Ambil dari Kartu</label>
                        </div>
                        <div className="input-group">
                            <RupiahInput
                                id="amount"
                                name="amount"
                                value={String(form.amount ?? '')}
                                onChange={(raw) => setForm((prev: any) => ({ ...prev, amount: raw }))}
                                className="input-field"
                                placeholder=" "
                                required
                            />
                            <label htmlFor="amount" className="input-label">Jumlah (IDR)</label>
                        </div>
                    </>}
                    <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
                        <button type="button" onClick={handleCloseModal} className="button-secondary">Batal</button>
                        <button type="submit" className="button-primary">{modalState.mode === 'add' ? 'Simpan' : 'Update'}</button>
                    </div>
                </form>
            </Modal>}
            {historyModalState && <Modal
                isOpen={!!historyModalState}
                onClose={() => setHistoryModalState(null)}
                title={`Riwayat: ${historyModalState.type === 'card' ? (historyModalState.item as Card).cardHolderName : (historyModalState.item as FinancialPocket).name}`}
                size="3xl"
            >
                <div>
                    <div className="overflow-y-auto max-h-[60vh]">

                            <table className="w-full text-sm">
                                <thead className="text-xs text-brand-text-secondary uppercase">
                                    <tr>
                                        <th className="p-3 text-left">Tanggal</th>
                                        <th className="p-3 text-left">Deskripsi</th>
                                        <th className="p-3 text-left">Sumber/Tujuan</th>
                                        <th className="p-3 text-right">Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-border">
                                    {transactions
                                        .filter(t => (historyModalState.type === 'card' && t.cardId === historyModalState.item?.id) || (historyModalState.type === 'pocket' && t.pocketId === historyModalState.item?.id))
                                        .map(t => {
                                            const card = cards.find(c => c.id === t.cardId);
                                            let sourceDestText = '';
                                            if (t.category.includes('Transfer') || t.category.includes('Penutupan')) {
                                                if (t.description.includes('Setor ke')) {
                                                    sourceDestText = `Dari: ${card?.bankName || 'N/A'}`;
                                                } else if (t.description.includes('Tarik dari')) {
                                                    sourceDestText = `Ke: ${card?.bankName || 'N/A'}`;
                                                } else {
                                                    sourceDestText = 'Sistem Internal';
                                                }
                                            } else if (t.type === TransactionType.INCOME) {
                                                sourceDestText = `Ke: ${card?.bankName || 'N/A'}`;
                                            } else if (t.type === TransactionType.EXPENSE) {
                                                sourceDestText = `Dari: ${card?.bankName || 'N/A'}`;
                                            }
                                            return (
                                                <tr key={t.id} className="hover:bg-brand-bg">
                                                    <td className="p-3">{new Date(t.date).toLocaleDateString('id-ID')}</td>
                                                    <td className="p-3 font-semibold text-brand-text-light">{t.description}</td>
                                                    <td className="p-3 text-brand-text-secondary">{sourceDestText}</td>
                                                    <td className={`p-3 text-right font-semibold ${t.type === TransactionType.INCOME ? 'text-brand-success' : 'text-brand-danger'}`}>
                                                        {t.type === TransactionType.EXPENSE ? '-' : ''}{formatCurrency(t.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    {transactions.filter(t => (historyModalState.type === 'card' && t.cardId === historyModalState.item?.id) || (historyModalState.type === 'pocket' && t.pocketId === historyModalState.item?.id)).length === 0 &&
                                        <tr><td colSpan={4} className="text-center p-8 text-brand-text-secondary">Tidak ada riwayat transaksi.</td></tr>
                                    }
                                </tbody>
                            </table>
                    </div>
                </div>
            </Modal>}
            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Panduan Halaman Keuangan">
                <div className="space-y-4 text-sm text-brand-text-primary">
                    <p>Halaman ini adalah pusat komando Keuangan bisnis Anda. Gunakan berbagai tab untuk mendapatkan gambaran lengkap.</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Transaksi:</strong> Catat semua pemasukan dan pengeluaran. Gunakan filter di sisi kiri untuk menganalisis berdasarkan kategori.</li>
                        <li><strong>Kantong:</strong> Buat "kantong" virtual untuk mengalokasikan dana, seperti tabungan alat atau anggaran operasional bulanan.</li>
                        <li><strong>Kartu Saya:</strong> Daftarkan semua akun bank, kartu kredit, dan kas tunai Anda untuk melacak saldo secara akurat.</li>
                        <li><strong>Arus Kas:</strong> Lihat grafik interaktif yang menunjukkan tren pemasukan, pengeluaran, dan saldo akhir Anda dari waktu ke waktu.</li>
                        <li><strong>Laporan:</strong> Hasilkan laporan keuangan profesional. Anda bisa memfilter berdasarkan pengantin dan rentang tanggal, lalu mencetaknya sebagai PDF.</li>
                    </ul>
                </div>
            </Modal>
            <Modal isOpen={!!activeStatModal} onClose={() => setActiveStatModal(null)} title={activeStatModal ? statModalTitles[activeStatModal] : ''} size="2xl">
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {activeStatModal === 'assets' && (
                        <div className="space-y-3">
                            {cards.map(card => (
                                <div key={card.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <p className="font-semibold text-brand-text-light">{card.cardHolderName} {card.cardType !== CardType.TUNAI ? `(${card.bankName} **** ${card.lastFourDigits})` : '(Tunai)'}</p>
                                    <p className="font-semibold text-brand-text-light">{formatCurrency(card.balance)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeStatModal === 'pockets' && (
                        <div className="space-y-3">
                            {pockets.map(pocket => (
                                <div key={pocket.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <p className="font-semibold text-brand-text-light">{pocket.name}</p>
                                    <p className="font-semibold text-brand-text-light">{formatCurrency(pocket.amount)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeStatModal === 'income' && (
                        <div className="space-y-3">
                            {thisMonthIncome.length > 0 ? thisMonthIncome.map(tx => (
                                <div key={tx.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-brand-text-light">{tx.description}</p>
                                        <p className="text-xs text-brand-text-secondary">{new Date(tx.date).toLocaleDateString('id-ID')}</p>
                                    </div>
                                    <p className="font-semibold text-brand-success">{formatCurrency(tx.amount)}</p>
                                </div>
                            )) : <p className="text-center text-brand-text-secondary py-8">Tidak ada pemasukan bulan ini.</p>}
                        </div>
                    )}
                    {activeStatModal === 'expense' && (
                        <div className="space-y-3">
                            {thisMonthExpense.length > 0 ? thisMonthExpense.map(tx => (
                                <div key={tx.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-brand-text-light">{tx.description}</p>
                                        <p className="text-xs text-brand-text-secondary">{new Date(tx.date).toLocaleDateString('id-ID')}</p>
                                    </div>
                                    <p className="font-semibold text-brand-danger">{formatCurrency(tx.amount)}</p>
                                </div>
                            )) : <p className="text-center text-brand-text-secondary py-8">Tidak ada pengeluaran bulan ini.</p>}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Finance;
