import React, { useState, useMemo, useEffect } from 'react';
import PrintButton from '../../shared/ui/PrintButton';
import ContractDocument from '../../features/contracts/components/ContractDocument';
import { Contract, Client, Project, Profile, NavigationAction, Package } from '../../types';
import PageHeader from '../../layouts/PageHeader';
import Modal from '../../shared/ui/Modal';
import SignaturePad from '../../shared/ui/SignaturePad';
import StatCard from '../../shared/ui/StatCard';
import { PlusIcon, EyeIcon, PencilIcon, Trash2Icon, PrinterIcon, QrCodeIcon, FileTextIcon, ClockIcon, CheckSquareIcon, DollarSignIcon, DownloadIcon, CalendarIcon, UsersIcon, BriefcaseIcon, UserCheckIcon } from '../../constants';
import { createContract as createContractRow, updateContract as updateContractRow, deleteContract as deleteContractRow } from '../../services/contracts';

const formatCurrency = (amount: number, options?: {
    showDecimals?: boolean;
    compact?: boolean;
    currencySymbol?: boolean;
    thousandsSeparator?: boolean;
}) => {
    const { showDecimals = true, compact = false, currencySymbol = true, thousandsSeparator = true } = options || {};

    // Handle edge cases and provide flexible formatting
    if (!isFinite(amount)) {
        return currencySymbol ? 'Rp 0' : '0';
    }

    // Use manual formatting for better control over separators
    if (!thousandsSeparator) {
        const cleanAmount = Math.abs(amount);
        const numberPart = cleanAmount.toLocaleString('id-ID', {
            minimumFractionDigits: showDecimals ? 2 : 0,
            maximumFractionDigits: showDecimals ? 2 : 0
        });
        return currencySymbol ? `Rp ${numberPart}` : numberPart;
    }

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
        notation: compact ? 'compact' : 'standard'
    }).format(amount);
};

// Utility function for consistent currency display in documents
const formatDocumentCurrency = (amount: number) => {
    // Always show clean format for formal documents
    return formatCurrency(amount, { showDecimals: false });
};

// Utility function for display in tables/lists (no decimals for cleaner look)
const formatDisplayCurrency = (amount: number) => {
    return formatCurrency(amount, { showDecimals: false });
};

const formatDate = (dateString: string) => {
    if (!dateString) return '[Tanggal belum diisi]';
    return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
};

const initialFormState: Omit<Contract, 'id' | 'contractNumber' | 'clientId' | 'projectId' | 'createdAt'> = {
    signingDate: new Date().toISOString().split('T')[0],
    signingLocation: '',
    clientName1: '',
    clientAddress1: '',
    clientPhone1: '',
    clientName2: '',
    clientAddress2: '',
    clientPhone2: '',
    shootingDuration: '',
    guaranteedPhotos: '',
    albumDetails: '',
    digitalFilesFormat: 'JPG High-Resolution',
    otherItems: '',
    personnelCount: '',
    deliveryTimeframe: '30 hari kerja',
    dpDate: '',
    finalPaymentDate: '',
    cancellationPolicy: 'DP yang sudah dibayarkan tidak dapat dikembalikan.\nJika pembatalan dilakukan H-7 sebelum hari pelaksanaan, PIHAK KEDUA wajib membayar 50% dari total biaya.',
    jurisdiction: '',
    serviceTitle: '',
    pasal1Content: '',
    pasal2Content: '',
    pasal3Content: '',
    pasal4Content: '',
    pasal5Content: '',
    closingText: '',
    includeMeterai: false,
    meteraiPlacement: 'client'
};

const getSignatureStatus = (contract: Contract) => {
    if (contract.vendorSignature && contract.clientSignature) {
        return { text: 'Lengkap', color: 'bg-green-500/20 text-green-400', icon: <CheckSquareIcon className="w-4 h-4 text-green-500" /> };
    }
    if (contract.vendorSignature && !contract.clientSignature) {
        return { text: 'Menunggu TTD Klien', color: 'bg-blue-500/20 text-blue-400', icon: <ClockIcon className="w-4 h-4 text-blue-500" /> };
    }
    return { text: 'Menunggu TTD Anda', color: 'bg-yellow-500/20 text-yellow-400', icon: <ClockIcon className="w-4 h-4 text-yellow-500" /> };
};


interface ContractsProps {
    contracts: Contract[];
    setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
    clients: Client[];
    projects: Project[];
    profile: Profile;
    showNotification: (message: string) => void;
    initialAction: NavigationAction | null;
    setInitialAction: (action: NavigationAction | null) => void;
    packages: Package[];
    onSignContract: (contractId: string, signatureDataUrl: string, signer: 'vendor' | 'client') => void;
}

const Contracts: React.FC<ContractsProps> = ({ contracts, setContracts, clients, projects, profile, showNotification, initialAction, setInitialAction, packages, onSignContract }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    // Form specific state
    const [formData, setFormData] = useState(initialFormState);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const availableProjects = useMemo(() => {
        return projects.filter(p => p.clientId === selectedClientId);
    }, [selectedClientId, projects]);
    
    // Auto-populate form when project is selected
    useEffect(() => {
        if (selectedProjectId) {
            const project = projects.find(p => p.id === selectedProjectId);
            const client = clients.find(c => c.id === project?.clientId);
            if (project && client) {
                const pkg = packages.find(p => p.id === project.packageId); 
                const clientNames = client.name.split(/&|,/);
                setFormData(prev => ({
                    ...prev,
                    clientName1: prev.clientName1 || clientNames[0]?.trim() || client.name,
                    clientPhone1: prev.clientPhone1 || client.phone,
                    clientAddress1: prev.clientAddress1 || project.location,
                    clientName2: prev.clientName2 || clientNames[1]?.trim() || '',
                    clientPhone2: prev.clientPhone2 || client.phone,
                    clientAddress2: prev.clientAddress2 || project.location,
                    jurisdiction: prev.jurisdiction || project.location.split(',')[1]?.trim() || project.location.split(',')[0]?.trim() || 'Indonesia',
                    signingLocation: prev.signingLocation || profile.address,
                    dpDate: prev.dpDate || (project.amountPaid > 0 ? new Date().toISOString().split('T')[0] : ''),
                    finalPaymentDate: prev.finalPaymentDate || (project.date ? new Date(new Date(project.date).setDate(new Date(project.date).getDate() - 7)).toISOString().split('T')[0] : ''),
                    shootingDuration: prev.shootingDuration || pkg?.photographers || 'Sesuai detail paket',
                    guaranteedPhotos: prev.guaranteedPhotos || pkg?.digitalItems.find(item => item.toLowerCase().includes('foto')) || 'Sesuai detail paket',
                    albumDetails: prev.albumDetails || pkg?.physicalItems.find(item => item.name.toLowerCase().includes('album'))?.name || 'Sesuai detail paket',
                    otherItems: prev.otherItems || project.addOns.map(a => a.name).join(', ') || 'Sesuai detail paket',
                    personnelCount: prev.personnelCount || `${pkg?.photographers ? '1+' : '0'} Tim Dekorasi, ${pkg?.videographers ? '1+' : '0'} Tim Pendukung`,
                    deliveryTimeframe: prev.deliveryTimeframe || pkg?.processingTime || '30 hari kerja',
                    serviceTitle: prev.serviceTitle || `JASA ${project.projectType.toUpperCase()}`,
                    pasal1Content: prev.pasal1Content || `1.1 PIHAK PERTAMA sepakat untuk memberikan jasa ${project.projectType.toLowerCase()} kepada PIHAK KEDUA.\n\n1.2 Pelaksanaan pekerjaan dilakukan pada:\n• Tanggal Acara : ${new Date(project.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n• Lokasi Acara : ${project.location}\n\n1.3 Rincian layanan yang diberikan oleh PIHAK PERTAMA meliputi:\n• ${pkg?.photographers || 'Sesuai paket'}\n• ${pkg?.digitalItems.find(item => item.toLowerCase().includes('foto')) || 'Sesuai paket'}\n• ${pkg?.physicalItems.find(item => item.name.toLowerCase().includes('album'))?.name || 'Sesuai paket'}\n\n1.4 Layanan tambahan yang disepakati:\n• ${project.addOns.map(a => a.name).join(', ') || '-'}\n\n1.5 Segala perubahan layanan di luar yang tercantum dalam perjanjian ini harus disepakati oleh kedua belah pihak.`,
                    pasal2Content: prev.pasal2Content || `2.1 Total biaya jasa yang disepakati oleh kedua belah pihak adalah sebesar:\nRp ${project.totalCost.toLocaleString('id-ID')}\n\n2.2 Sistem pembayaran dilakukan dengan ketentuan sebagai berikut:\n\na. Uang Muka (DP)\nSebesar Rp ${project.amountPaid.toLocaleString('id-ID')} dibayarkan pada tanggal ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.\n\nb. Pelunasan\nSisa pembayaran wajib dilunasi paling lambat pada tanggal ${project.date ? new Date(new Date(project.date).setDate(new Date(project.date).getDate() - 7)).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'} atau sebelum hari pelaksanaan acara.\n\n2.3 Pembayaran dianggap sah setelah dana diterima oleh PIHAK PERTAMA.`,
                    pasal3Content: prev.pasal3Content || `3.1 DP yang sudah dibayarkan tidak dapat dikembalikan.\n\n3.2 Jika pembatalan dilakukan H-7 sebelum hari pelaksanaan, PIHAK KEDUA wajib membayar 50% dari total biaya.\n\n3.3 Apabila pembatalan dilakukan oleh PIHAK PERTAMA karena alasan yang tidak dapat dihindari, maka PIHAK PERTAMA wajib mengembalikan seluruh pembayaran yang telah diterima.`,
                    pasal4Content: prev.pasal4Content || `4.1 Waktu pengerjaan dan pengiriman hasil dekorasi adalah maksimal ${pkg?.processingTime || '30 hari kerja'} setelah acara berlangsung.\n\n4.2 Tim yang akan bertugas pada acara PIHAK KEDUA: ${pkg?.photographers ? '1+' : '0'} Tim Dekorasi, ${pkg?.videographers ? '1+' : '0'} Tim Pendukung.\n\n4.3 PIHAK PERTAMA berhak menggunakan sebagian hasil dekorasi sebagai portofolio atau media promosi, kecuali apabila PIHAK KEDUA menyatakan keberatan secara tertulis.`,
                    pasal5Content: prev.pasal5Content || `5.1 Perjanjian ini berlaku sejak tanggal ditandatangani oleh kedua belah pihak.\n\n5.2 Segala hal yang belum diatur dalam perjanjian ini akan diselesaikan secara musyawarah dan mufakat.\n\n5.3 Apabila terjadi perselisihan yang tidak dapat diselesaikan secara musyawarah, maka kedua belah pihak sepakat untuk menyelesaikannya melalui jalur hukum di wilayah ${project.location.split(',')[1]?.trim() || project.location.split(',')[0]?.trim() || 'Indonesia'}.`,
                    closingText: prev.closingText || `Demikian Surat Perjanjian Kerja Sama ini dibuat dengan sebenar-benarnya dalam keadaan sadar dan tanpa paksaan. Perjanjian ini dibuat dalam dua rangkap yang masing-masing mempunyai kekuatan hukum yang sama.`
                }));
            }
        }
    }, [selectedProjectId, projects, clients, packages, profile.address]);

    const handleOpenModal = (mode: 'add' | 'edit' | 'view', contract?: Contract) => {
        if (mode === 'view' && contract) {
            setSelectedContract(contract);
            setIsViewModalOpen(true);
        } else {
            setModalMode(mode);
            if (mode === 'edit' && contract) {
                setSelectedContract(contract);
                setSelectedClientId(contract.clientId);
                setSelectedProjectId(contract.projectId);
                
                // Ensure no null values are passed to form inputs to avoid uncontrolled/controlled warnings
                const editFormData = { ...initialFormState };
                Object.keys(initialFormState).forEach(key => {
                    const val = (contract as any)[key];
                    (editFormData as any)[key] = (val === null || val === undefined) ? '' : val;
                });
                setFormData(editFormData);
            } else {
                setSelectedContract(null);
                setSelectedClientId(initialAction?.id || '');
                setSelectedProjectId('');
                setFormData(initialFormState);
                if (initialAction && initialAction.type === 'CREATE_CONTRACT_FOR_CLIENT' && initialAction.id) {
                    setSelectedClientId(initialAction.id);
                }
            }
            setIsFormModalOpen(true);
        }
    };

    const handleDownloadPDFWithoutTTD = async () => {
        if (!selectedContract) return;
        const project = projects.find(p => p.id === selectedContract.projectId);
        if (!project) return;

        const tempWrapper = document.createElement('div');
        tempWrapper.style.position = 'fixed';
        tempWrapper.style.left = '-99999px';
        tempWrapper.style.top = '0';
        tempWrapper.style.width = '800px';
        tempWrapper.style.background = 'white';

        document.body.appendChild(tempWrapper);

        try {
            const ReactDOM = await import('react-dom/client');
            const root = ReactDOM.createRoot(tempWrapper);
            root.render(
                <ContractDocument
                    id="contract-content-to-print-no-ttd"
                    contract={selectedContract}
                    project={project}
                    profile={profile}
                    hideSignatures
                />
            );

            // give React a tick to paint
            await new Promise((r) => setTimeout(r, 50));

            const element = tempWrapper.querySelector('#contract-content-to-print-no-ttd') as HTMLElement | null;
            if (!element) return;

            const opt = {
                margin: [15, 15, 20, 15] as [number, number, number, number],
                filename: `kontrak-${selectedContract.contractNumber || 'digital'}-tanpa-ttd.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                pagebreak: { mode: ['css', 'legacy'] },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    windowWidth: 800,
                },
                jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
            };

            try {
                const html2pdf = (await import('html2pdf.js')).default;
                html2pdf().set(opt).from(element).save();
            } catch (err) {
                console.error('Failed to generate PDF:', err);
                window.print();
            }

            // Cleanup React root
            try { root.unmount(); } catch {}
        } finally {
            try { document.body.removeChild(tempWrapper); } catch {}
        }
    };
    
    useEffect(() => {
        if (initialAction) {
            if (initialAction.type === 'CREATE_CONTRACT_FOR_CLIENT' && initialAction.id) {
                handleOpenModal('add');
            }
            if (initialAction.type === 'VIEW_CONTRACT' && initialAction.id) {
                const contractToView = contracts.find(c => c.id === initialAction.id);
                if (contractToView) handleOpenModal('view', contractToView);
            }
            setInitialAction(null);
        }
    }, [initialAction, contracts]);


    const handleCloseModal = () => {
        setIsFormModalOpen(false);
        setIsViewModalOpen(false);
        setSelectedContract(null);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedProjectId) {
            showNotification('Harap pilih proyek terlebih dahulu.');
            return;
        }

        try {
            if (modalMode === 'add') {
                const contractCount = contracts.length + 1;
                const contractNumber = `VP/CTR/${new Date().getFullYear()}/${String(contractCount).padStart(3, '0')}`;
                const payload = {
                    contractNumber,
                    clientId: selectedClientId,
                    projectId: selectedProjectId,
                    ...formData,
                } as Omit<Contract, 'id' | 'createdAt'>;
                const created = await createContractRow(payload);
                // Ensure uniqueness by id to avoid duplicate keys when realtime INSERT also arrives
                setContracts(prev => {
                    const exists = prev.some(c => c.id === created.id);
                    if (exists) {
                        return prev.map(c => (c.id === created.id ? created : c));
                    }
                    return [created, ...prev];
                });
                showNotification('Kontrak baru berhasil dibuat.');
            } else if (selectedContract) {
                const patch = {
                    ...formData,
                    clientId: selectedClientId,
                    projectId: selectedProjectId,
                } as Partial<Contract>;
                try {
                    const updated = await updateContractRow(selectedContract.id, patch);
                    setContracts(prev => prev.map(c => c.id === selectedContract.id ? updated : c));
                    showNotification('Kontrak berhasil diperbarui.');
                } catch (err: any) {
                    console.warn('[Supabase][contracts.update] gagal, fallback create. Detail:', err);
                    const payload = {
                        contractNumber: selectedContract.contractNumber,
                        clientId: selectedClientId,
                        projectId: selectedProjectId,
                        ...formData,
                    } as Omit<Contract, 'id' | 'createdAt'>;
                    const created = await createContractRow(payload);
                    setContracts(prev => prev.map(c => c.id === selectedContract.id ? created : c));
                    showNotification('Kontrak baru berhasil dibuat (fallback).');
                }
            }
            handleCloseModal();
        } catch (err: any) {
            console.error('[Supabase][contracts.save] error:', err);
            alert(`Gagal menyimpan kontrak ke database. ${err?.message || 'Coba lagi.'}`);
        }
    };

    const handleDelete = async (contractId: string) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus kontrak ini?")) return;
        try {
            await deleteContractRow(contractId);
            setContracts(prev => prev.filter(c => c.id !== contractId));
            showNotification('Kontrak berhasil dihapus.');
        } catch (err: any) {
            console.error('[Supabase][contracts.delete] error:', err);
            alert(`Gagal menghapus kontrak di database. ${err?.message || 'Coba lagi.'}`);
        }
    };
    
    const handleSaveSignature = async (signatureDataUrl: string) => {
        console.log('handleSaveSignature called with signature:', signatureDataUrl.substring(0, 50) + '...');
        if (selectedContract) {
            try {
                console.log('Updating contract signature for contract ID:', selectedContract.id);
                const updated = await updateContractRow(selectedContract.id, { vendorSignature: signatureDataUrl });
                console.log('Contract updated successfully:', updated);
                onSignContract(selectedContract.id, signatureDataUrl, 'vendor');
                setSelectedContract(updated);
                setContracts(prev => prev.map(c => c.id === updated.id ? updated : c));
                console.log('Signature saved successfully');
            } catch (err: any) {
                console.error('[Supabase][contracts.signature] error:', err);
                alert(`Gagal menyimpan tanda tangan ke database. ${err?.message || 'Coba lagi.'}`);
            }
        } else {
            console.warn('No selected contract found for signature save');
        }
        setIsSignatureModalOpen(false);
    };

    const handleDownloadPDF = async () => {
        if (!selectedContract) return;
        const element = document.getElementById('contract-content-to-print');
        if (!element) return;

        const opt = {
            margin: [15, 15, 20, 15] as [number, number, number, number], // top, left, bottom, right in mm
            filename: `kontrak-${selectedContract.contractNumber || 'digital'}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            pagebreak: { mode: ['css', 'legacy'] },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                windowWidth: 800,
            },
            jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            html2pdf().set(opt).from(element).save();
        } catch (err) {
            console.error('Failed to generate PDF:', err);
            window.print();
        }
    };

    const stats = useMemo(() => {
        const waitingForClient = contracts.filter(c => c.vendorSignature && !c.clientSignature).length;
        const waitingForVendor = contracts.filter(c => !c.vendorSignature).length;
        const totalValue = contracts.reduce((sum, c) => {
            const project = projects.find(p => p.id === c.projectId);
            return sum + (project?.totalCost || 0);
        }, 0);
        return { waitingForClient, waitingForVendor, totalValue };
    }, [contracts, projects]);
    
    const renderContractBody = (contract: Contract) => {
        const project = projects.find(p => p.id === contract.projectId);
        if (!project) return <p>Data proyek tidak ditemukan.</p>;

        return (
            <ContractDocument 
                id="contract-content-to-print"
                contract={contract} 
                project={project} 
                profile={profile} 
            />
        );
    };


    
    return (
        <div className="space-y-6">
            <PageHeader title="Kontrak" subtitle="Buat, kelola, dan arsipkan semua kontrak kerja Anda." icon={<FileTextIcon className="w-6 h-6" />}>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsInfoModalOpen(true)} className="button-secondary">Pelajari Halaman Ini</button>
                    <button onClick={() => handleOpenModal('add')} className="button-primary inline-flex items-center gap-2">
                        <PlusIcon className="w-5 h-5"/> Buat Kontrak
                    </button>
                </div>
            </PageHeader>

            <div className="grid grid-cols-2 gap-6">
                <StatCard icon={<FileTextIcon className="w-6 h-6"/>} title="Total Kontrak" value={contracts.length.toString()} subtitle="Semua kontrak terdaftar" colorVariant="blue" />
                <StatCard icon={<ClockIcon className="w-6 h-6"/>} title="Menunggu TTD Klien" value={stats.waitingForClient.toString()} subtitle="Kontrak belum ditandatangani" colorVariant="orange" />
                <StatCard icon={<DollarSignIcon className="w-6 h-6"/>} title="Total Nilai Terkontrak" value={formatDisplayCurrency(stats.totalValue)} subtitle="Nilai keseluruhan kontrak" colorVariant="green" />
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block bg-brand-surface p-4 rounded-xl shadow-lg border border-brand-border">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-brand-text-secondary uppercase">
                            <tr>
                                <th className="px-4 py-3">No. Kontrak</th>
                                <th className="px-4 py-3">Klien & Proyek</th>
                                <th className="px-4 py-3">Tgl. Penandatanganan</th>
                                <th className="px-4 py-3">Status TTD</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                            {contracts.map(contract => {
                                const client = clients.find(c => c.id === contract.clientId);
                                const project = projects.find(p => p.id === contract.projectId);
                                const signatureStatus = getSignatureStatus(contract);
                                return (
                                    <tr key={contract.id} className="hover:bg-brand-bg">
                                        <td className="px-4 py-3 font-mono text-xs">{contract.contractNumber}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-brand-text-light">{client?.name || contract.clientName1}</p>
                                            <p className="text-xs text-brand-text-secondary">{project?.projectName || 'N/A'}</p>
                                        </td>
                                        <td className="px-4 py-3">{formatDate(contract.signingDate)}</td>
                                        <td className="px-4 py-3"><span className={`px-2 py-1 text-xs font-medium rounded-full ${signatureStatus.color}`}>{signatureStatus.text}</span></td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center space-x-1">
                                                <button onClick={() => handleOpenModal('view', contract)} className="p-2 text-brand-text-secondary hover:bg-brand-input rounded-full" title="Lihat"><EyeIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleOpenModal('edit', contract)} className="p-2 text-brand-text-secondary hover:bg-brand-input rounded-full" title="Edit"><PencilIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleDelete(contract.id)} className="p-2 text-brand-text-secondary hover:bg-brand-input rounded-full" title="Hapus"><Trash2Icon className="w-5 h-5"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {contracts.length === 0 ? (
                    <div className="bg-brand-surface p-8 rounded-xl text-center border border-brand-border">
                        <FileTextIcon className="w-12 h-12 text-brand-text-secondary mx-auto mb-3 opacity-50" />
                        <p className="text-brand-text-secondary">Belum ada kontrak. Klik tombol "Buat Kontrak" untuk memulai.</p>
                    </div>
                ) : (
                    contracts.map(contract => {
                        const client = clients.find(c => c.id === contract.clientId);
                        const project = projects.find(p => p.id === contract.projectId);
                        const signatureStatus = getSignatureStatus(contract);
                        return (
                            <div key={contract.id} className="bg-brand-surface rounded-xl shadow-lg border border-brand-border overflow-hidden">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-4 border-b border-brand-border">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <p className="text-xs text-brand-text-secondary uppercase tracking-wide mb-1">No. Kontrak</p>
                                            <p className="font-mono text-sm font-semibold text-brand-text-light">{contract.contractNumber}</p>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${signatureStatus.color}`}>
                                            {signatureStatus.icon}
                                            {signatureStatus.text}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4 space-y-3">
                                    {/* Client & Project Info */}
                                    <div>
                                        <p className="text-xs text-brand-text-secondary mb-1">Klien</p>
                                        <p className="font-semibold text-brand-text-light">{client?.name || contract.clientName1}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-brand-text-secondary mb-1">Proyek</p>
                                        <p className="text-sm text-brand-text-primary">{project?.projectName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-brand-text-secondary mb-1">Tanggal Penandatanganan</p>
                                        <p className="text-sm text-brand-text-primary">{formatDate(contract.signingDate)}</p>
                                    </div>
                                    
                                    {/* Project Value */}
                                    {project && (
                                        <div className="pt-2 border-t border-brand-border">
                                            <p className="text-xs text-brand-text-secondary mb-1">Nilai Kontrak</p>
                                            <p className="text-lg font-bold text-brand-accent">{formatDisplayCurrency(project.totalCost)}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="p-3 bg-brand-bg border-t border-brand-border">
                                    <div className="grid grid-cols-4 gap-2">
                                        <button 
                                            onClick={() => handleOpenModal('view', contract)} 
                                            className="flex flex-col items-center justify-center p-2 text-brand-text-secondary hover:text-brand-accent hover:bg-brand-input rounded-lg transition-colors"
                                            title="Lihat"
                                        >
                                            <EyeIcon className="w-5 h-5 mb-1"/>
                                            <span className="text-xs">Lihat</span>
                                        </button>
                                        <button 
                                            onClick={() => handleOpenModal('edit', contract)} 
                                            className="flex flex-col items-center justify-center p-2 text-brand-text-secondary hover:text-blue-400 hover:bg-brand-input rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <PencilIcon className="w-5 h-5 mb-1"/>
                                            <span className="text-xs">Edit</span>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(contract.id)} 
                                            className="flex flex-col items-center justify-center p-2 text-brand-text-secondary hover:text-red-400 hover:bg-brand-input rounded-lg transition-colors"
                                            title="Hapus"
                                        >
                                            <Trash2Icon className="w-5 h-5 mb-1"/>
                                            <span className="text-xs">Hapus</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Panduan Halaman Kontrak">
                 <div className="space-y-4 text-sm text-brand-text-primary">
                    <p>Halaman ini adalah pusat arsip digital untuk semua perjanjian kerja Anda.</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Buat Kontrak:</strong> Klik tombol "Buat Kontrak" untuk membuka formulir. Pilih klien dan proyek yang relevan, dan sebagian besar data akan terisi otomatis.</li>
                        <li><strong>E-Signature:</strong> Setelah kontrak dibuat, Anda dapat menandatanganinya secara digital. Klien juga dapat melakukan hal yang sama melalui Portal Klien mereka.</li>
                        <li><strong>Lacak Status:</strong> Pantau dengan mudah kontrak mana yang sudah lengkap, mana yang menunggu tanda tangan Anda, dan mana yang menunggu tanda tangan klien.</li>
                        <li><strong>Bagikan Portal:</strong> Gunakan ikon QR code untuk membagikan tautan Portal Klien, tempat mereka dapat melihat dan menandatangani kontrak.</li>
                    </ul>
                </div>
            </Modal>
            
            <Modal isOpen={isFormModalOpen} onClose={handleCloseModal} title={modalMode === 'add' ? 'Buat Kontrak Baru' : 'Edit Kontrak'} size="4xl">
                <form onSubmit={handleSubmit} className="space-y-4 form-compact form-compact--ios-scale">
                    <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-6 mb-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center">
                                <FileTextIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-base font-black text-brand-text-light tracking-tight">Pilih Klien & Proyek</h4>
                                <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest">Langkah pertama untuk membuat kontrak</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="input-group">
                                <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="input-field" required>
                                    <option value="">Pilih Klien...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <label className="input-label">Klien</label>
                            </div>
                            <div className="input-group">
                                <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="input-field" required disabled={!selectedClientId}>
                                    <option value="">{selectedClientId ? 'Pilih Proyek...' : 'Pilih Klien Dahulu'}</option>
                                    {availableProjects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                                </select>
                                <label className="input-label">Proyek</label>
                            </div>
                        </div>
                    </div>
                    
                    <div className="max-h-[55vh] overflow-y-auto pr-4 space-y-8 custom-scrollbar">
                        {/* Section: Penandatanganan */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-brand-border/50 pb-3">
                                <CalendarIcon className="w-5 h-5 text-indigo-500" />
                                <h4 className="text-sm font-black text-brand-text-light uppercase tracking-tight">Detail Penandatanganan</h4>
                            </div>
                            <p className="text-[10px] font-medium text-brand-text-secondary leading-relaxed">Tentukan kapan dan di mana kontrak ini akan ditandatangani.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="input-group"><input type="date" name="signingDate" value={formData.signingDate} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Tanggal TTD</label></div>
                                <div className="input-group"><input type="text" name="signingLocation" value={formData.signingLocation} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Lokasi TTD</label></div>
                            </div>
                            <div className="input-group mt-4">
                                <input type="text" name="serviceTitle" value={formData.serviceTitle} onChange={handleFormChange} className="input-field" placeholder=" "/>
                                <label className="input-label">Judul Layanan (Contoh: JASA CORPORATE / EVENT)</label>
                            </div>
                        </div>

                        {/* Section: Pihak Klien 1 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-brand-border/50 pb-3">
                                <UserCheckIcon className="w-5 h-5 text-blue-500" />
                                <h4 className="text-sm font-black text-brand-text-light uppercase tracking-tight">Pihak Klien 1</h4>
                            </div>
                            <p className="text-[10px] font-medium text-brand-text-secondary leading-relaxed">Informasi lengkap klien pertama untuk kontrak resmi.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="input-group"><input type="text" name="clientName1" value={formData.clientName1} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Nama Klien 1</label></div>
                                 <div className="input-group"><input type="text" name="clientPhone1" value={formData.clientPhone1} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Telepon Klien 1</label></div>
                            </div>
                            <div className="input-group"><input type="text" name="clientAddress1" value={formData.clientAddress1} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Alamat Klien 1</label></div>
                        </div>
                        
                        {/* Section: Pihak Klien 2 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-brand-border/50 pb-3">
                                <UsersIcon className="w-5 h-5 text-purple-500" />
                                <h4 className="text-sm font-black text-brand-text-light uppercase tracking-tight">Pihak Klien 2 (Opsional)</h4>
                            </div>
                            <p className="text-[10px] font-medium text-brand-text-secondary leading-relaxed">Isi jika ada klien kedua (misal: pasangan pengantin).</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="input-group"><input type="text" name="clientName2" value={formData.clientName2} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Nama Klien 2</label></div>
                                 <div className="input-group"><input type="text" name="clientPhone2" value={formData.clientPhone2} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Telepon Klien 2</label></div>
                            </div>
                            <div className="input-group"><input type="text" name="clientAddress2" value={formData.clientAddress2} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Alamat Klien 2</label></div>
                        </div>

                        {/* Section: Ruang Lingkup */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-brand-border/50 pb-3">
                                <BriefcaseIcon className="w-5 h-5 text-amber-500" />
                                <h4 className="text-sm font-black text-brand-text-light uppercase tracking-tight">Ruang Lingkup Pekerjaan</h4>
                            </div>
                            <p className="text-[10px] font-medium text-brand-text-secondary leading-relaxed">Detail layanan, durasi, rincian teknis, dan informasi dekorasi lainnya.</p>
                            <div className="flex items-center gap-3 bg-brand-bg border border-brand-border/50 rounded-xl p-3">
                                <input
                                    id="includeMeterai"
                                    type="checkbox"
                                    checked={!!formData.includeMeterai}
                                    onChange={(e) => setFormData(prev => ({ ...prev, includeMeterai: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="includeMeterai" className="text-xs font-semibold text-brand-text-primary">
                                    Tambahkan Meterai (10.000)
                                </label>
                            </div>

                            {!!formData.includeMeterai && (
                                <div className="bg-brand-bg border border-brand-border/50 rounded-xl p-3">
                                    <div className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Penempatan Meterai</div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <label className="flex items-center gap-2 text-xs font-semibold text-brand-text-primary">
                                            <input
                                                type="radio"
                                                name="meteraiPlacement"
                                                value="client"
                                                checked={(formData.meteraiPlacement || 'client') === 'client'}
                                                onChange={() => setFormData(prev => ({ ...prev, meteraiPlacement: 'client' }))}
                                            />
                                            Hanya TTD Klien
                                        </label>
                                        <label className="flex items-center gap-2 text-xs font-semibold text-brand-text-primary">
                                            <input
                                                type="radio"
                                                name="meteraiPlacement"
                                                value="both"
                                                checked={formData.meteraiPlacement === 'both'}
                                                onChange={() => setFormData(prev => ({ ...prev, meteraiPlacement: 'both' }))}
                                            />
                                            Dua sisi (Vendor + Klien)
                                        </label>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="input-group"><input type="text" name="shootingDuration" value={formData.shootingDuration} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Durasi Pengerjaan</label></div>
                                <div className="input-group"><input type="text" name="guaranteedPhotos" value={formData.guaranteedPhotos} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Jumlah Item Dekorasi</label></div>
                                <div className="input-group"><input type="text" name="albumDetails" value={formData.albumDetails} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Detail Album</label></div>
                                <div className="input-group"><input type="text" name="otherItems" value={formData.otherItems} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Item Lainnya</label></div>
                                <div className="input-group"><input type="text" name="personnelCount" value={formData.personnelCount} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Jumlah Personel</label></div>
                                <div className="input-group"><input type="text" name="deliveryTimeframe" value={formData.deliveryTimeframe} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Waktu Pengerjaan</label></div>
                            </div>
                        </div>
                                      {/* Section: Isi Kontrak (Pasal-Pasal) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-brand-border/50 pb-3">
                                <FileTextIcon className="w-5 h-5 text-brand-accent" />
                                <h4 className="text-sm font-black text-brand-text-light uppercase tracking-tight">Isi & Pasal Kontrak (Custome Text)</h4>
                            </div>
                            <p className="text-[10px] font-medium text-brand-text-secondary leading-relaxed">Sesuaikan kata-kata pada setiap pasal kontrak di bawah ini. Jangan hapus jika tidak diperlukan.</p>
                            
                            <div className="space-y-6">
                                <div className="input-group">
                                    <textarea name="pasal1Content" value={formData.pasal1Content} onChange={handleFormChange} className="input-field min-h-[150px] text-xs font-mono" placeholder=" "></textarea>
                                    <label className="input-label">PASAL 1 — RUANG LINGKUP PEKERJAAN</label>
                                </div>
                                <div className="input-group">
                                    <textarea name="pasal2Content" value={formData.pasal2Content} onChange={handleFormChange} className="input-field min-h-[150px] text-xs font-mono" placeholder=" "></textarea>
                                    <label className="input-label">PASAL 2 — BIAYA DAN SISTEM PEMBAYARAN</label>
                                </div>
                                <div className="input-group">
                                    <textarea name="pasal3Content" value={formData.pasal3Content} onChange={handleFormChange} className="input-field min-h-[120px] text-xs font-mono" placeholder=" "></textarea>
                                    <label className="input-label">PASAL 3 — KETENTUAN PEMBATALAN</label>
                                </div>
                                <div className="input-group">
                                    <textarea name="pasal4Content" value={formData.pasal4Content} onChange={handleFormChange} className="input-field min-h-[120px] text-xs font-mono" placeholder=" "></textarea>
                                    <label className="input-label">PASAL 4 — KETENTUAN PELAKSANAAN PEKERJAAN</label>
                                </div>
                                <div className="input-group">
                                    <textarea name="pasal5Content" value={formData.pasal5Content} onChange={handleFormChange} className="input-field min-h-[120px] text-xs font-mono" placeholder=" "></textarea>
                                    <label className="input-label">PASAL 5 — KETENTUAN UMUM</label>
                                </div>
                                <div className="input-group">
                                    <textarea name="closingText" value={formData.closingText} onChange={handleFormChange} className="input-field min-h-[80px] text-xs font-mono" placeholder=" "></textarea>
                                    <label className="input-label">KALIMAT PENUTUP</label>
                                </div>
                            </div>
                        </div>

                        {/* Section: Pembayaran & Hukum (Technical Fields) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-brand-border/50 pb-3">
                                <DollarSignIcon className="w-5 h-5 text-emerald-500" />
                                <h4 className="text-sm font-black text-brand-text-light uppercase tracking-tight">Data Teknis Pembayaran</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="input-group"><input type="date" name="dpDate" value={formData.dpDate} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Tanggal DP</label></div>
                                <div className="input-group"><input type="date" name="finalPaymentDate" value={formData.finalPaymentDate} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Tanggal Pelunasan</label></div>
                            </div>
                            <div className="input-group">
                                <textarea name="cancellationPolicy" value={formData.cancellationPolicy} onChange={handleFormChange} className="input-field min-h-[100px]" placeholder=" "></textarea>
                                <label className="input-label">Kebijakan Pembatalan</label>
                            </div>
                            <div className="input-group"><input type="text" name="jurisdiction" value={formData.jurisdiction} onChange={handleFormChange} className="input-field" placeholder=" "/><label className="input-label">Wilayah Hukum</label></div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
                        <button type="button" onClick={handleCloseModal} className="button-secondary">Batal</button>
                        <button type="submit" className="button-primary">{modalMode === 'add' ? 'Simpan' : 'Update'}</button>
                    </div>
                </form>
            </Modal>
            
            <Modal isOpen={isViewModalOpen} onClose={handleCloseModal} title="Detail Kontrak" size="4xl">
                {selectedContract && (
                    <div>
                        <div className="max-h-[65vh] overflow-y-auto border border-brand-border rounded-lg bg-white">
                            {renderContractBody(selectedContract)}
                        </div>
                        <div className="mt-4 flex flex-wrap justify-between items-center gap-3 non-printable border-t border-brand-border pt-4">
                            <div className="text-sm space-y-1">
                                <p className={`font-semibold ${selectedContract.vendorSignature || profile.signatureBase64 ? 'text-green-500' : 'text-yellow-500'}`}>
                                    TTD Vendor: {selectedContract.vendorSignature || profile.signatureBase64 ? '✓ Sudah' : '◷ Belum'}
                                </p>
                                <p className={`font-semibold ${selectedContract.clientSignature ? 'text-green-500' : 'text-yellow-500'}`}>
                                    TTD Klien: {selectedContract.clientSignature ? '✓ Sudah' : '◷ Belum'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {/* WhatsApp Send Button */}
                                <button
                                    onClick={() => {
                                        const client = clients.find(c => c.id === selectedContract.clientId);
                                        if (client) {
                                            const path = window.location.pathname.replace(/index\.html$/, '');
                                            const url = `${window.location.origin}${path}#/portal/contract/${selectedContract.id}`;
                                            const message = `Halo ${client.name || selectedContract.clientName1}, berikut adalah tautan kontrak digital Anda dari ${profile.companyName}: ${url}%0A%0AMohon segera ditinjau dan ditandatangani. Terima kasih!`;
                                            window.open(`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
                                        } else {
                                            showNotification('Nomor telepon klien atau link portal tidak tersedia.');
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 text-sm font-medium transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    Kirim ke WA
                                </button>
                                {/* Copy share link */}
                                <button
                                    onClick={() => {
                                        const path = window.location.pathname.replace(/index\.html$/, '');
                                        const url = `${window.location.origin}${path}#/portal/contract/${selectedContract.id}`;
                                        navigator.clipboard.writeText(url);
                                        showNotification('Tautan kontrak berhasil disalin!');
                                    }}
                                    className="button-secondary inline-flex items-center gap-2 text-sm"
                                >
                                    🔗 Salin Link
                                </button>
                                {!selectedContract.vendorSignature && (
                                    <button
                                        onClick={() => setIsSignatureModalOpen(true)}
                                        className="button-primary inline-flex items-center gap-2 text-sm"
                                    >
                                        ✍️ Tanda Tangani
                                    </button>
                                )}
                                <button
                                    onClick={handleDownloadPDF}
                                    className="button-primary bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-2 text-sm transition-all shadow-md active:scale-95"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    <span>Unduh PDF</span>
                                </button>

                                <button
                                    onClick={handleDownloadPDFWithoutTTD}
                                    className="button-secondary inline-flex items-center gap-2 text-sm"
                                    title="Unduh PDF untuk ditandatangani manual"
                                >
                                    <PrinterIcon className="w-4 h-4" />
                                    <span>Unduh PDF Tanpa TTD</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
            
             <Modal isOpen={isSignatureModalOpen} onClose={() => setIsSignatureModalOpen(false)} title="Bubuhkan Tanda Tangan Anda">
                <SignaturePad onClose={() => setIsSignatureModalOpen(false)} onSave={handleSaveSignature} />
            </Modal>
        </div>
    );
};
export default Contracts;