import React, { useState, useMemo, useEffect } from 'react';
import { Package, AddOn, Project, PhysicalItem, Profile, REGIONS, Region, DurationOption } from '../../types';
import PageHeader from '../../layouts/PageHeader';
import Modal from '../../shared/ui/Modal';
import { PencilIcon, Trash2Icon, PlusIcon, Share2Icon, FileTextIcon, CameraIcon, ChevronDownIcon, PackageIcon } from '../../constants';
import RupiahInput from '../../shared/form/RupiahInput';
import { createPackage as createPackageRow, updatePackage as updatePackageRow, deletePackage as deletePackageRow } from '../../services/packages';
import { createAddOn as createAddOnRow, updateAddOn as updateAddOnRow, deleteAddOn as deleteAddOnRow } from '../../services/addOns';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}
const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

const emptyPackageForm = {
    name: '',
    price: '',
    category: '',
    region: '' as '' | Region,
    processingTime: '',
    photographers: '',
    videographers: '',
    physicalItems: [{ name: '', price: '' as string | number }],
    digitalItems: [''],
    coverImage: '',
    durationOptions: [{ label: '', price: '' as string | number, default: true }],
};
const emptyAddOnForm = { name: '', price: '', region: '' };

interface PackagesProps {
    packages: Package[];
    setPackages: React.Dispatch<React.SetStateAction<Package[]>>;
    addOns: AddOn[];
    setAddOns: React.Dispatch<React.SetStateAction<AddOn[]>>;
    projects: Project[];
    profile: Profile;
}

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});


const Packages: React.FC<PackagesProps> = ({ packages, setPackages, addOns, setAddOns, projects, profile }) => {
    const [packageFormData, setPackageFormData] = useState<any>(emptyPackageForm);
    const [packageEditMode, setPackageEditMode] = useState<string | null>(null);
    const [regionFilter, setRegionFilter] = useState<'' | Region>('');

    const [addOnFormData, setAddOnFormData] = useState(emptyAddOnForm);
    const [addOnEditMode, setAddOnEditMode] = useState<string | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [expandedDurationIndex, setExpandedDurationIndex] = useState<number | null>(null);

    const publicPackagesUrl = useMemo(() => {
        // A more robust solution would involve getting the vendor's unique ID
        const vendorId = 'VEN001'; // Placeholder for the default vendor
        return `${window.location.origin}${window.location.pathname}#/public-packages/${vendorId}`;
    }, []);

    const copyPackagesLinkToClipboard = () => {
        navigator.clipboard.writeText(publicPackagesUrl).then(() => {
            alert('Tautan halaman Package berhasil disalin!');
        });
    };

    // Duration Options Handlers
    const handleDurationOptionChange = (index: number, field: string, value: string | number | boolean | string[] | { name: string; price: number }[]) => {
        const list = [...packageFormData.durationOptions];
        if (field === 'default') {
            list.forEach((opt: any, i: number) => { opt.default = i === index ? Boolean(value) : false; });
        } else {
            (list[index] as any)[field] = value;
        }
        setPackageFormData((prev: any) => ({ ...prev, durationOptions: list }));
    };
    const addDurationOption = () => {
        setPackageFormData((prev: any) => ({ ...prev, durationOptions: [...(prev.durationOptions || []), { label: '', price: '' }] }));
    };
    const removeDurationOption = (index: number) => {
        const list = [...packageFormData.durationOptions];
        list.splice(index, 1);
        const final = list.length > 0 ? list : [{ label: '', price: '' }];
        if (!final.some((o: any) => o.default)) final[0].default = true;
        setPackageFormData((prev: any) => ({ ...prev, durationOptions: final }));
        if (expandedDurationIndex === index) setExpandedDurationIndex(null);
        else if (expandedDurationIndex !== null && expandedDurationIndex > index) setExpandedDurationIndex(expandedDurationIndex - 1);
    };
    const handleDurationDigitalItemChange = (optIndex: number, itemIndex: number, value: string) => {
        const list = [...packageFormData.durationOptions];
        const opt = list[optIndex] as any;
        if (!opt.digitalItems) opt.digitalItems = [''];
        opt.digitalItems = [...opt.digitalItems];
        opt.digitalItems[itemIndex] = value;
        setPackageFormData((prev: any) => ({ ...prev, durationOptions: list }));
    };
    const addDurationDigitalItem = (optIndex: number) => {
        const list = [...packageFormData.durationOptions];
        const opt = list[optIndex] as any;
        if (!opt.digitalItems) opt.digitalItems = [''];
        opt.digitalItems = [...opt.digitalItems, ''];
        setPackageFormData((prev: any) => ({ ...prev, durationOptions: list }));
    };
    const removeDurationDigitalItem = (optIndex: number, itemIndex: number) => {
        const list = [...packageFormData.durationOptions];
        const opt = list[optIndex] as any;
        if (opt.digitalItems && opt.digitalItems.length > 1) {
            opt.digitalItems = opt.digitalItems.filter((_: any, i: number) => i !== itemIndex);
            setPackageFormData((prev: any) => ({ ...prev, durationOptions: list }));
        }
    };
    const handleDurationPhysicalItemChange = (optIndex: number, itemIndex: number, field: 'name' | 'price', value: string | number) => {
        const list = [...packageFormData.durationOptions];
        const opt = list[optIndex] as any;
        if (!opt.physicalItems) opt.physicalItems = [{ name: '', price: 0 }];
        opt.physicalItems = [...opt.physicalItems];
        (opt.physicalItems[itemIndex] as any)[field] = field === 'price' ? Number(value) : value;
        setPackageFormData((prev: any) => ({ ...prev, durationOptions: list }));
    };
    const addDurationPhysicalItem = (optIndex: number) => {
        const list = [...packageFormData.durationOptions];
        const opt = list[optIndex] as any;
        if (!opt.physicalItems) opt.physicalItems = [];
        opt.physicalItems = [...opt.physicalItems, { name: '', price: 0 }];
        setPackageFormData((prev: any) => ({ ...prev, durationOptions: list }));
    };
    const removeDurationPhysicalItem = (optIndex: number, itemIndex: number) => {
        const list = [...packageFormData.durationOptions];
        const opt = list[optIndex] as any;
        if (opt.physicalItems && opt.physicalItems.length > 1) {
            opt.physicalItems = opt.physicalItems.filter((_: any, i: number) => i !== itemIndex);
            setPackageFormData((prev: any) => ({ ...prev, durationOptions: list }));
        }
    };

    const packagesByCategory = useMemo(() => {
        const grouped: Record<string, Package[]> = {};
        const filtered = regionFilter ? packages.filter(p => (p.region ? p.region.toLowerCase() === regionFilter.toLowerCase() : false)) : packages;
        for (const pkg of filtered) {
            const category = pkg.category || 'Tanpa Kategori';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(pkg);
        }
        return grouped;
    }, [packages, regionFilter]);

    const packagesByRegionCategory = useMemo(() => {
        // Only used when no regionFilter applied: show separate boxes per region
        const byRegion: Record<string, Record<string, Package[]>> = {};
        const label = (r?: string | null) => r === 'vendor' ? 'Vendor' : r === 'jabodetabek' ? 'Jabodetabek' : r === 'banten' ? 'Banten' : 'Tanpa Wilayah';
        for (const pkg of packages) {
            const rl = label(pkg.region as any);
            if (!byRegion[rl]) byRegion[rl] = {};
            const cat = pkg.category || 'Tanpa Kategori';
            if (!byRegion[rl][cat]) byRegion[rl][cat] = [];
            byRegion[rl][cat].push(pkg);
        }
        return byRegion;
    }, [packages]);
    // removed combined region view

    const existingRegions = useMemo(() => {
        const set = new Set<string>();
        for (const p of packages) {
            if (p.region && String(p.region).trim() !== '') set.add(String(p.region));
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [packages]);
    const unionRegions = useMemo(() => {
        const baseValues = REGIONS.map(r => r.value.toLowerCase());
        const extra = existingRegions.filter(er => !baseValues.includes(er.toLowerCase()));
        return [
            ...REGIONS.map(r => ({ value: r.value, label: r.label })),
            ...extra.map(er => ({ value: er, label: titleCase(er) })),
        ];
    }, [existingRegions]);


    // --- Package Handlers ---
    const handlePackageInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setPackageFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const file = e.target.files[0];
                // Check file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    alert('Ukuran file tidak boleh melebihi 2MB');
                    e.target.value = ''; // Reset the input
                    return;
                }
                // Check file type
                if (!file.type.match('image.*')) {
                    alert('Hanya file gambar yang diperbolehkan');
                    e.target.value = ''; // Reset the input
                    return;
                }
                const base64 = await toBase64(file);
                setPackageFormData((prev: any) => ({ ...prev, coverImage: base64 }));
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('Terjadi kesalahan saat mengunggah gambar. Silakan coba lagi.');
                e.target.value = ''; // Reset the input
            }
        }
    };

    const handlePhysicalItemChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const list = [...packageFormData.physicalItems];
        list[index] = { ...list[index], [name]: value };
        setPackageFormData((prev: any) => ({ ...prev, physicalItems: list }));
    };

    const addPhysicalItem = () => {
        setPackageFormData((prev: any) => ({ ...prev, physicalItems: [...prev.physicalItems, { name: '', price: '' }] }));
    };

    const removePhysicalItem = (index: number) => {
        const list = [...packageFormData.physicalItems];
        list.splice(index, 1);
        setPackageFormData((prev: any) => ({ ...prev, physicalItems: list }));
    };

    const handleDigitalItemChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const list = [...packageFormData.digitalItems];
        list[index] = value;
        setPackageFormData((prev: any) => ({ ...prev, digitalItems: list }));
    };

    const addDigitalItem = () => {
        setPackageFormData((prev: any) => ({ ...prev, digitalItems: [...prev.digitalItems, ''] }));
    };

    const removeDigitalItem = (index: number) => {
        const list = [...packageFormData.digitalItems];
        list.splice(index, 1);
        setPackageFormData((prev: any) => ({ ...prev, digitalItems: list }));
    };


    const handlePackageCancelEdit = () => {
        setPackageEditMode(null);
        setPackageFormData(emptyPackageForm);
    }

    const handlePackageEdit = (pkg: Package) => {
        setPackageEditMode(pkg.id);
        setPackageFormData({
            name: pkg.name,
            price: pkg.price.toString(),
            category: pkg.category,
            region: (pkg.region || '') as any,
            processingTime: '',
            photographers: pkg.photographers && pkg.videographers
                ? `${pkg.photographers} & ${pkg.videographers}`
                : (pkg.photographers || pkg.videographers || ''),
            videographers: '',
            physicalItems: pkg.physicalItems.length > 0 ? pkg.physicalItems.map(item => ({ ...item, price: item.price.toString() })) : [{ name: '', price: '' }],
            digitalItems: pkg.digitalItems.length > 0 ? pkg.digitalItems : [''],
            coverImage: pkg.coverImage || '',
            durationOptions: (pkg.durationOptions && pkg.durationOptions.length > 0)
                ? pkg.durationOptions.map(o => ({
                    label: o.label,
                    price: o.price.toString(),
                    default: o.default,
                    photographers: o.photographers && o.videographers
                        ? `${o.photographers} & ${o.videographers}`
                        : (o.photographers || o.videographers || ''),
                    videographers: '',
                    processingTime: '',
                    digitalItems: o.digitalItems && o.digitalItems.length > 0 ? o.digitalItems : [''],
                    physicalItems: o.physicalItems && o.physicalItems.length > 0 ? o.physicalItems.map((p: PhysicalItem) => ({ ...p, price: p.price })) : [{ name: '', price: 0 }],
                }))
                : [{ label: '', price: '' as string | number, default: true }],
        });
    }

    const handlePackageDelete = async (pkgId: string) => {
        const isPackageInUse = projects.some(p => p.packageId === pkgId);
        if (isPackageInUse) {
            alert("Package ini tidak dapat dihapus karena sedang digunakan oleh satu atau lebih Acara Pernikahan. Hapus atau ubah Acara Pernikahan tersebut terlebih dahulu.");
            return;
        }

        if (!window.confirm("Apakah Anda yakin ingin menghapus Package ini?")) return;
        try {
            await deletePackageRow(pkgId);
            setPackages(prev => prev.filter(p => p.id !== pkgId));
        } catch (e) {
            alert('Gagal menghapus Package di database. Coba lagi.');
        }
    }

    const handlePackageSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const hasValidOptionsPre = Array.isArray(packageFormData.durationOptions) && packageFormData.durationOptions.some((o: any) => String(o.label || '').trim() !== '' && String(o.price || '') !== '');
        if (!packageFormData.name || (!hasValidOptionsPre && !packageFormData.price)) {
            alert('Nama Package wajib diisi. Jika tidak mengisi Opsi Durasi, maka Harga (IDR) wajib diisi.');
            return;
        }

        // Determine final base price: if duration options exist, base price mirrors the default option
        const hasValidOptions = Array.isArray(packageFormData.durationOptions) && packageFormData.durationOptions.some((o: any) => String(o.label || '').trim() !== '' && String(o.price || '') !== '');
        const defaultOption = hasValidOptions ? (packageFormData.durationOptions.find((o: any) => o.default) || packageFormData.durationOptions.find((o: any) => String(o.label || '').trim() !== '' && String(o.price || '') !== '')) : null;
        const computedBasePrice = defaultOption ? Number(defaultOption.price || 0) : Number(packageFormData.price || 0);

        const packageData: Omit<Package, 'id'> = {
            name: packageFormData.name,
            price: computedBasePrice,
            category: packageFormData.category,
            region: packageFormData.region ? String(packageFormData.region).trim().toLowerCase() : undefined,
            processingTime: '',
            photographers: packageFormData.photographers,
            videographers: '',
            physicalItems: packageFormData.physicalItems
                .filter((item: PhysicalItem) => typeof item.name === 'string' && item.name.trim() !== '')
                .map((item: { name: string, price: string | number }) => ({ ...item, name: item.name, price: Number(item.price || 0) })),
            digitalItems: packageFormData.digitalItems.filter((item: string) => item.trim() !== ''),
            coverImage: packageFormData.coverImage,
            durationOptions: Array.isArray(packageFormData.durationOptions)
                ? packageFormData.durationOptions
                    .filter((opt: any) => String(opt.label || '').trim() !== '' && Number(opt.price) >= 0)
                    .map((opt: any): DurationOption => {
                        const base = { label: String(opt.label).trim(), price: Number(opt.price), default: !!opt.default };
                        const filteredDigital = opt.digitalItems?.filter((d: string) => d?.trim?.()) || [];
                        const filteredPhysical = opt.physicalItems?.filter((p: any) => p?.name?.trim?.()).map((p: any) => ({ name: p.name, price: Number(p.price || 0) })) || [];
                        const hasDetails = opt.photographers?.trim() || filteredDigital.length > 0 || filteredPhysical.length > 0;
                        if (hasDetails) {
                            return {
                                ...base,
                                photographers: opt.photographers?.trim() || undefined,
                                videographers: undefined,
                                processingTime: undefined,
                                digitalItems: filteredDigital.length > 0 ? filteredDigital : undefined,
                                physicalItems: filteredPhysical.length > 0 ? filteredPhysical : undefined,
                            } as DurationOption;
                        }
                        return base as DurationOption;
                    })
                : undefined,
        };

        try {
            if (packageEditMode !== 'new' && packageEditMode) {
                try {
                    const updated = await updatePackageRow(packageEditMode, packageData);
                    setPackages(prev => prev.map(p => p.id === packageEditMode ? updated : p));
                } catch (e: any) {
                    console.warn('[Supabase][packages.update] gagal, fallback create. Detail:', e);
                    // Kemungkinan Package lama hanya lokal (belum ada row di DB). Coba create baru lalu replace di state.
                    const created = await createPackageRow(packageData as any);
                    setPackages(prev => prev.map(p => p.id === packageEditMode ? created : p));
                }
            } else {
                const created = await createPackageRow(packageData as any);
                setPackages(prev => [...prev, created]);
            }
        } catch (err: any) {
            console.error('[Supabase][packages.save] error:', err);
            alert(`Gagal menyimpan Package ke database. ${err?.message || 'Coba lagi.'}`);
            return;
        }

        handlePackageCancelEdit();
    };

    // --- AddOn Handlers ---
    const handleAddOnInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAddOnFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddOnSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addOnFormData.name || !addOnFormData.price) {
            alert('Nama Add-On dan Harga tidak boleh kosong.');
            return;
        }

        const addOnData: Omit<AddOn, 'id'> = {
            name: addOnFormData.name,
            price: Number(addOnFormData.price),
            region: addOnFormData.region ? String(addOnFormData.region).trim().toLowerCase() : undefined,
        };

        try {
            if (addOnEditMode) {
                try {
                    const updated = await updateAddOnRow(addOnEditMode, addOnData);
                    setAddOns(prev => prev.map(a => a.id === addOnEditMode ? updated : a));
                } catch (e: any) {
                    console.warn('[Supabase][addOns.update] gagal, fallback create. Detail:', e);
                    const created = await createAddOnRow(addOnData as any);
                    setAddOns(prev => prev.map(a => a.id === addOnEditMode ? created : a));
                }
            } else {
                const created = await createAddOnRow(addOnData as any);
                setAddOns(prev => [...prev, created]);
            }
        } catch (err: any) {
            console.error('[Supabase][addOns.save] error:', err);
            alert(`Gagal menyimpan add-on ke database. ${err?.message || 'Coba lagi.'}`);
            return;
        }

        handleAddOnCancelEdit();
    };

    const handleAddOnCancelEdit = () => {
        setAddOnEditMode(null);
        setAddOnFormData(emptyAddOnForm);
    }

    const handleAddOnEdit = (addOn: AddOn) => {
        setAddOnEditMode(addOn.id);
        setAddOnFormData({
            name: addOn.name,
            price: addOn.price.toString(),
            region: (addOn.region || '') as any,
        });
    }

    const handleAddOnDelete = async (addOnId: string) => {
        const isAddOnInUse = projects.some(p => p.addOns.some(a => a.id === addOnId));
        if (isAddOnInUse) {
            alert("Add-on ini tidak dapat dihapus karena sedang digunakan oleh satu atau lebih Acara Pernikahan. Hapus atau ubah Acara Pernikahan tersebut terlebih dahulu.");
            return;
        }

        if (!window.confirm("Apakah Anda yakin ingin menghapus add-on ini?")) return;
        try {
            await deleteAddOnRow(addOnId);
            setAddOns(prev => prev.filter(p => p.id !== addOnId));
        } catch (e) {
            alert('Gagal menghapus add-on di database. Coba lagi.');
        }
    };

    return (
        <div className="space-y-6 md:space-y-8 animate-fade-in pb-8">
            <PageHeader title="Package Vendor" subtitle="Kelola portofolio Package, opsi durasi, dan item tambahan (add-ons)." icon={<PackageIcon className="w-6 h-6" />}>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setIsInfoModalOpen(true)} className="button-secondary !py-2 !px-3 text-xs md:text-sm">Panduan</button>
                    <button onClick={() => setIsShareModalOpen(true)} className="button-secondary !py-2 !px-3 text-xs md:text-sm inline-flex items-center gap-2">
                        <Share2Icon className="w-4 h-4" /> Bagikan
                    </button>
                    <button onClick={() => setPackageEditMode('new')} className="button-primary !py-2 !px-4 text-xs md:text-sm inline-flex items-center gap-2 whitespace-nowrap">
                        <PlusIcon className="w-4 h-4 md:w-5 md:h-5" /> Tambah Package
                    </button>
                </div>
            </PageHeader>
            <div className="flex flex-wrap gap-2 pb-2">
                <button
                    onClick={() => setRegionFilter('')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${regionFilter === '' ? 'bg-brand-accent text-white border-brand-accent shadow-md' : 'glass-card text-brand-text-secondary hover:text-brand-text-light hover:bg-white/50 border-brand-border/50'}`}
                >
                    Semua
                </button>
                {unionRegions.map(r => (
                    <button
                        key={r.value}
                        onClick={() => setRegionFilter(r.value as any)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${regionFilter === (r.value as any) ? 'bg-brand-accent text-white border-brand-accent shadow-md' : 'glass-card text-brand-text-secondary hover:text-brand-text-light hover:bg-white/50 border-brand-border/50'}`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    {(Object.entries(packagesByCategory) as [string, Package[]][]).map(([category, pkgs]) => (
                        <div key={category}>
                            <h3 className="text-lg md:text-xl font-bold text-gradient mb-3 md:mb-4">{category}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                {pkgs.map(pkg => (
                                    <div key={pkg.id} className="glass-card card-hover-lift rounded-3xl flex flex-col overflow-hidden border border-brand-border/50 group">
                                        {pkg.coverImage ? (
                                            <div className="h-32 md:h-44 overflow-hidden relative">
                                                <img src={pkg.coverImage} alt={pkg.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent"></div>
                                            </div>
                                        ) : (
                                            <div className="h-32 md:h-44 bg-brand-input/50 flex flex-col items-center justify-center relative overflow-hidden text-brand-text-secondary/50">
                                                <CameraIcon className="w-10 md:w-12 h-10 md:h-12 mb-2 opacity-50" />
                                                <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">Tanpa Cover</span>
                                            </div>
                                        )}
                                        <div className="p-4 md:p-5 flex-grow flex flex-col bg-brand-surface/40">
                                            <h4 className="font-bold text-base md:text-lg text-brand-text-light flex items-start justify-between gap-2">
                                                <span className="line-clamp-2">{pkg.name}</span>
                                            </h4>

                                            <div className="mt-3 mb-4 p-3 bg-brand-bg/50 rounded-xl border border-brand-border/40">
                                                <p className="text-xl md:text-2xl font-bold text-brand-text-light">
                                                    {pkg.durationOptions && pkg.durationOptions.length > 0 ? (
                                                        <span className="block text-xs md:text-sm font-semibold text-brand-text-secondary space-y-1">
                                                            {pkg.durationOptions.map((o, i) => (
                                                                <span key={i} className="block flex justify-between items-center border-b border-brand-border/30 pb-1 last:border-0 last:pb-0">
                                                                    <span className="opacity-80 truncate pr-2">{o.label}</span>
                                                                    <span className="text-brand-accent flex-shrink-0">{formatCurrency(o.price)}</span>
                                                                </span>
                                                            ))}
                                                        </span>
                                                    ) : (
                                                        <span className="text-brand-accent">{formatCurrency(pkg.price)}</span>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="text-xs space-y-3 flex-grow bg-white/30 p-3 rounded-xl border border-white/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                                {pkg.processingTime && (
                                                    <p className="flex justify-between items-center pb-2 border-b border-brand-border/40">
                                                        <span className="text-brand-text-secondary font-medium uppercase tracking-wider text-[9px]">Pengerjaan</span>
                                                        <span className="font-semibold text-brand-text-light">{pkg.processingTime}</span>
                                                    </p>
                                                )}
                                                {(pkg.photographers || pkg.videographers) && (
                                                    <div className="pb-2 border-b border-brand-border/40">
                                                        <h5 className="font-semibold text-brand-text-secondary text-[9px] uppercase tracking-wider mb-1">Tim</h5>
                                                        <p className="font-medium text-brand-text-light">{[pkg.photographers, pkg.videographers].filter(Boolean).join(' & ')}</p>
                                                    </div>
                                                )}
                                                {pkg.digitalItems.length > 0 && (
                                                    <div className="pb-2 border-b border-brand-border/40 last:border-0 last:pb-0">
                                                        <h5 className="font-semibold text-brand-text-secondary text-[9px] uppercase tracking-wider mb-1.5">Deskripsi Package</h5>
                                                        <ul className="space-y-1">
                                                            {pkg.digitalItems.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-1.5 text-brand-text-light font-medium before:content-[''] before:w-1 before:h-1 before:bg-brand-accent/50 before:rounded-full before:mt-1.5 text-[10px] md:text-xs leading-tight">
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {pkg.physicalItems.length > 0 && (
                                                    <div className="pt-1">
                                                        <h5 className="font-semibold text-brand-text-secondary text-[9px] uppercase tracking-wider mb-1.5">Vendor (Allpackage)</h5>
                                                        <ul className="space-y-1">
                                                            {pkg.physicalItems.map((item, i) => (
                                                                <li key={i} className="flex justify-between items-center text-brand-text-light font-medium bg-brand-surface/50 px-2 py-1 rounded-md border border-brand-border/30 text-[10px] md:text-xs">
                                                                    <span className="truncate pr-2 opacity-90">{item.name}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2 mt-4 pt-4 border-t border-brand-border/50">
                                                <button onClick={() => handlePackageEdit(pkg)} className="button-secondary flex-1 text-xs py-2 shadow-sm">
                                                    <PencilIcon className="w-4 h-4" /> Edit Package
                                                </button>
                                                <button onClick={() => handlePackageDelete(pkg.id)} className="button-secondary !p-2 md:!p-2.5 text-brand-text-secondary hover:text-red-600 hover:border-red-300 hover:bg-red-50 flex-shrink-0" title="Hapus Package" aria-label={`Hapus Package ${pkg.name}`}><Trash2Icon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
                    <div className="glass-card rounded-3xl border border-brand-border/50 flex flex-col shadow-sm">
                        <div className="p-4 md:p-5 border-b border-brand-border/50 bg-brand-surface/60 rounded-t-3xl backdrop-blur-md">
                            <h3 className="font-bold text-lg text-gradient flex items-center gap-2">
                                <PlusIcon className="w-5 h-5 text-brand-accent" /> Layanan Tambahan
                            </h3>
                            <p className="text-xs text-brand-text-secondary mt-1">Kelola ekstra Add-Ons.</p>
                        </div>

                        <div className="p-2 md:p-3 space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar bg-brand-surface/20">
                            {(regionFilter ? addOns.filter(a => a.region === regionFilter) : addOns).map(addon => (
                                <div key={addon.id} className="group flex justify-between items-center bg-white/60 hover:bg-white border border-brand-border/30 p-3 rounded-xl transition-all shadow-sm">
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <span className="text-sm font-semibold text-brand-text-light truncate">{addon.name}</span>
                                        <span className="text-xs font-bold text-brand-accent mt-0.5">{formatCurrency(addon.price)}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button onClick={() => handleAddOnEdit(addon)} className="p-2 rounded-lg text-brand-text-secondary hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit Add-On" aria-label={`Edit Add-On ${addon.name}`}><PencilIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleAddOnDelete(addon.id)} className="p-2 rounded-lg text-brand-text-secondary hover:bg-red-50 hover:text-red-600 transition-colors" title="Hapus Add-On" aria-label={`Hapus Add-On ${addon.name}`}><Trash2Icon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                            {(!regionFilter ? addOns : addOns.filter(a => a.region === regionFilter)).length === 0 && (
                                <div className="text-center py-8 text-brand-text-secondary/50 text-sm">
                                    Belum ada add-on untuk wilayah ini.
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleAddOnSubmit} className="p-4 md:p-5 border-t border-brand-border/50 bg-brand-surface/40 rounded-b-3xl space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-text-secondary/70 mb-2">{addOnEditMode ? 'Edit Add-On' : 'Tambah Add-On Baru'}</h4>
                            <div className="input-group">
                                <input type="text" id="addOnName" name="name" value={addOnFormData.name} onChange={handleAddOnInputChange} className="input-field bg-white/80" placeholder=" " required />
                                <label htmlFor="addOnName" className="input-label">Nama Add-On</label>
                            </div>
                            <div className="input-group">
                                <RupiahInput id="addOnPrice" value={addOnFormData.price.toString()} onChange={(raw) => setAddOnFormData(prev => ({ ...prev, price: raw }))} className="input-field bg-white/80" placeholder=" " required />
                                <label htmlFor="addOnPrice" className="input-label">Harga (IDR)</label>
                            </div>
                            <div className="input-group">
                                <input
                                    type="text"
                                    id="addOnRegion"
                                    name="region"
                                    list="region-suggestions"
                                    value={addOnFormData.region}
                                    onChange={handleAddOnInputChange}
                                    className="input-field bg-white/80"
                                    placeholder=" "
                                />
                                <label htmlFor="addOnRegion" className="input-label">Wilayah (opsional)</label>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {unionRegions.map(r => (
                                    <button type="button" key={r.value} onClick={() => setAddOnFormData(prev => ({ ...prev, region: r.value }))} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors border ${addOnFormData.region === r.value ? 'bg-brand-accent text-white border-brand-accent shadow-sm' : 'bg-white border-brand-border border-dashed text-brand-text-secondary hover:border-brand-accent/50'}`}>{r.label}</button>
                                ))}
                                {addOnFormData.region && (
                                    <button type="button" onClick={() => setAddOnFormData(prev => ({ ...prev, region: '' }))} className="px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-red-50 border-red-200 text-brand-danger">Kosongkan</button>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                {addOnEditMode && <button type="button" onClick={handleAddOnCancelEdit} className="button-secondary flex-1 py-2 text-xs">Batal</button>}
                                <button type="submit" className="button-primary flex-[2] py-2 text-xs shadow-md">{addOnEditMode ? 'Simpan' : 'Tambah'}</button>
                            </div>
                        </form>
                    </div>
                </aside>
            </div>

            <Modal isOpen={packageEditMode !== null} onClose={handlePackageCancelEdit} title={packageEditMode === 'new' ? 'Tambah Package Baru' : 'Edit Package'} size="3xl">
                <form onSubmit={handlePackageSubmit} className="space-y-5 md:space-y-6 max-h-[70vh] overflow-y-auto pr-2 pb-4 form-compact form-compact--ios-scale">
                    {/* Section 1: Informasi Dasar */}
                    <section className="bg-white/40 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border/40">
                        <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border/40 pb-2 mb-4">Informasi Dasar Package</h4>
                        <p className="text-xs text-brand-text-secondary mb-4">Masukkan nama dan harga Package layanan Anda. Nama harus jelas dan menarik untuk pengantin.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="input-group"><input type="text" name="name" value={packageFormData.name} onChange={handlePackageInputChange} className="input-field" placeholder=" " required /><label className="input-label">Nama Package</label></div>
                            {(() => {
                                const hasValidOptions = Array.isArray(packageFormData.durationOptions) && packageFormData.durationOptions.some((o: any) => String(o.label || '').trim() !== '' && String(o.price || '') !== '');
                                if (hasValidOptions) {
                                    const def = packageFormData.durationOptions.find((o: any) => o.default) || packageFormData.durationOptions.find((o: any) => String(o.label || '').trim() !== '' && String(o.price || '') !== '');
                                    return (
                                        <div className="input-group">
                                            <input type="text" className="input-field" value={def ? `${def.label}: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(def.price || 0))}` : 'Mengikuti opsi durasi default'} disabled placeholder=" " />
                                            <label className="input-label">Harga (mengikuti opsi default)</label>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="input-group">
                                        <RupiahInput value={packageFormData.price.toString()} onChange={(raw) => setPackageFormData((prev: any) => ({ ...prev, price: raw }))} className="input-field" placeholder=" " required />
                                        <label className="input-label">Harga (IDR)</label>
                                    </div>
                                );
                            })()}
                        </div>
                    </section>

                    {/* Section 2: Opsi Durasi */}
                    <section className="bg-white/40 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border/40">
                        <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border/40 pb-2 mb-4">Opsi Durasi & Harga (Opsional)</h4>
                        <p className="text-xs text-brand-text-secondary mb-3">Tambahkan variasi durasi seperti 2 Jam, 4 Jam, 8 Jam, Full Day dengan harga berbeda. Klik untuk mengisi detail masing-masing opsi.</p>
                        {packageFormData.durationOptions?.map((opt: any, index: number) => (
                            <div key={index} className="mt-2 border border-brand-border/40 bg-white/40 rounded-xl overflow-hidden shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center p-3 border-b border-brand-border/30 bg-brand-surface/40">
                                    <input type="text" value={opt.label} onChange={e => handleDurationOptionChange(index, 'label', e.target.value)} className="input-field md:col-span-2 bg-white/80" placeholder="Label (cth: 8 Jam / Full Day)" />
                                    <RupiahInput value={opt.price.toString()} onChange={(raw) => handleDurationOptionChange(index, 'price', raw)} className="input-field md:col-span-2 bg-white/80" placeholder="Harga" />
                                    <div className="flex items-center justify-end gap-1 md:gap-2">
                                        <label className="flex items-center gap-1 text-sm text-brand-text-secondary"><input type="radio" name="durationDefault" checked={!!opt.default} onChange={() => handleDurationOptionChange(index, 'default', true)} /> Default</label>
                                        <button type="button" onClick={() => setExpandedDurationIndex(expandedDurationIndex === index ? null : index)} className="p-1.5 rounded hover:bg-brand-input text-brand-accent" title="Detail Package">
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${expandedDurationIndex === index ? 'rotate-180' : ''}`} />
                                        </button>
                                        <button type="button" onClick={() => removeDurationOption(index)} className="p-2 text-brand-danger"><Trash2Icon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                {expandedDurationIndex === index && (
                                    <div className="p-3 border-t border-brand-border bg-brand-surface space-y-3">
                                        <p className="text-xs font-semibold text-brand-accent">Detail {opt.label || 'opsi ini'} (ditampilkan saat pengantin memilih)</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="input-group"><input type="text" value={opt.photographers || ''} onChange={e => handleDurationOptionChange(index, 'photographers', e.target.value)} className="input-field" placeholder=" " /><label className="input-label">Jumlah Tim</label></div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-brand-text-secondary mb-1">Deskripsi Package</p>
                                            {(opt.digitalItems || ['']).map((item: string, i: number) => (
                                                <div key={i} className="flex gap-2 mt-1">
                                                    <input type="text" value={item} onChange={e => handleDurationDigitalItemChange(index, i, e.target.value)} className="input-field flex-grow text-sm" placeholder="Deskripsi item..." />
                                                    <button type="button" onClick={() => removeDurationDigitalItem(index, i)} className="p-2 text-brand-danger"><Trash2Icon className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addDurationDigitalItem(index)} className="text-xs font-semibold text-brand-accent mt-1">+ Tambah Deskripsi</button>
                                        </div>
                                        <div>
                                            <p className="text-xs text-brand-text-secondary mb-1">Vendor (Allpackage)</p>
                                            {(opt.physicalItems || [{ name: '', price: 0 }]).map((item: any, i: number) => (
                                                <div key={i} className="flex gap-2 mt-1">
                                                    <input type="text" value={item.name || ''} onChange={e => handleDurationPhysicalItemChange(index, i, 'name', e.target.value)} className="input-field flex-grow text-sm" placeholder="Nama vendor/item" />
                                                    <button type="button" onClick={() => removeDurationPhysicalItem(index, i)} className="p-2 text-brand-danger"><Trash2Icon className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addDurationPhysicalItem(index)} className="text-xs font-semibold text-brand-accent mt-1">+ Tambah Vendor</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addDurationOption} className="text-sm font-semibold text-brand-accent mt-3">+ Tambah Opsi Durasi</button>
                    </section>

                    {/* Section 3: Kategori & Wilayah */}
                    <section className="bg-white/40 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border/40">
                        <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border/40 pb-2 mb-4">Kategori & Wilayah</h4>
                        <p className="text-xs text-brand-text-secondary mb-4">Pilih kategori Package dan tentukan wilayah layanan. Wilayah membantu pengantin menemukan Package yang sesuai dengan lokasi mereka.</p>
                        <div className="input-group">
                            <select name="category" value={packageFormData.category} onChange={handlePackageInputChange} className="input-field" required>
                                <option value="">Pilih kategori...</option>
                                {(profile?.packageCategories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <label className="input-label">Kategori</label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="input-group">
                                <input
                                    type="text"
                                    name="region"
                                    list="region-suggestions"
                                    value={packageFormData.region}
                                    onChange={handlePackageInputChange}
                                    className="input-field"
                                    placeholder=" "
                                />
                                <label className="input-label">Wilayah (opsional)</label>
                                <datalist id="region-suggestions">
                                    {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </datalist>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[...REGIONS.map(r => r.value), ...existingRegions.filter(er => !REGIONS.some(r => r.value === er))].map(val => (
                                        <button type="button" key={val} onClick={() => setPackageFormData((prev: any) => ({ ...prev, region: val }))} className={`px-2 py-1 rounded-full text-xs border ${packageFormData.region === val ? 'bg-brand-accent text-white border-brand-accent' : 'bg-brand-bg border-brand-border text-brand-text-secondary hover:text-brand-text-light'}`}>{val.replace(/\b\w/g, c => c.toUpperCase())}</button>
                                    ))}
                                    {packageFormData.region && (
                                        <button type="button" onClick={() => setPackageFormData((prev: any) => ({ ...prev, region: '' }))} className="px-2 py-1 rounded-full text-xs border bg-brand-bg border-brand-border text-brand-danger">Kosongkan</button>
                                    )}
                                </div>
                            </div>
                            <div className="md:col-span-2" />
                        </div>
                    </section>

                    {/* Section 4: Detail Tim */}
                    <section className="bg-white/40 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border/40">
                        <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border/40 pb-2 mb-4">Detail Tim</h4>
                        <p className="text-xs text-brand-text-secondary mb-4">Informasi tentang jumlah tim yang akan ditugaskan untuk Package ini.</p>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="input-group"><input type="text" name="photographers" value={packageFormData.photographers} onChange={handlePackageInputChange} className="input-field" placeholder=" " /><label className="input-label">Jumlah Tim</label></div>
                        </div>
                    </section>

                    {/* Section 5: Cover Image */}
                    <section className="bg-white/40 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border/40">
                        <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border/40 pb-2 mb-4">Gambar Sampul</h4>
                        <p className="text-xs text-brand-text-secondary mb-4">Upload gambar menarik untuk mempromosikan Package Anda di halaman publik.</p>
                        <div className="input-group"><label className="input-label !static !-top-4 !text-brand-accent">Cover Image</label><input type="file" onChange={handleCoverImageChange} className="input-field" accept="image/*" /></div>
                    </section>

                    {/* Section 6: Deskripsi Package */}
                    <section className="bg-white/40 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border/40">
                        <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border/40 pb-2 mb-4">Deskripsi Package</h4>
                        <p className="text-xs text-brand-text-secondary mb-3">Daftar item atau rincian layanan yang akan diterima pengantin.</p>
                        {packageFormData.digitalItems.map((item: string, index: number) => (
                            <div key={index} className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mt-2">
                                <input type="text" value={item} onChange={e => handleDigitalItemChange(index, e)} className="input-field flex-grow" placeholder="Contoh: Deskripsi detail layanan atau item" />
                                <button type="button" onClick={() => removeDigitalItem(index)} className="button-secondary !px-3 !py-2 text-brand-danger self-end md:self-center"><Trash2Icon className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <button type="button" onClick={addDigitalItem} className="text-sm font-semibold text-brand-accent mt-3">+ Tambah Item Deskripsi</button>
                    </section>

                    {/* Section 7: Vendor */}
                    <section className="bg-white/40 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border md:border-0 border-brand-border/40">
                        <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-brand-border/40 pb-2 mb-4">Vendor (Allpackage)</h4>
                        <p className="text-xs text-brand-text-secondary mb-3">Keterangan allpackage dan daftar vendor eksternal jika ada.</p>
                        {packageFormData.physicalItems.map((item: { name: string, price: string | number }, index: number) => (
                            <div key={index} className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mt-2">
                                <input type="text" name="name" value={item.name} onChange={e => handlePhysicalItemChange(index, e)} className="input-field flex-grow" placeholder="Nama Vendor/Item" />
                                <button type="button" onClick={() => removePhysicalItem(index)} className="button-secondary !px-3 !py-2 text-brand-danger self-end md:self-center"><Trash2Icon className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <button type="button" onClick={addPhysicalItem} className="text-sm font-semibold text-brand-accent mt-3">+ Tambah Vendor</button>
                    </section>

                    <div className="flex flex-col md:flex-row justify-end items-stretch md:items-center gap-3 pt-4 mt-6 border-t border-brand-border/40 sticky -bottom-4 md:bottom-0 bg-white/90 md:bg-white/80 backdrop-blur-xl p-4 -mx-4 md:p-3 md:mx-0 z-10 rounded-b-2xl md:rounded-b-none shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                        <button type="button" onClick={handlePackageCancelEdit} className="button-secondary w-full md:w-auto order-2 md:order-1 shadow-sm min-w-[100px] py-2 md:py-2.5">Batal</button>
                        <button type="submit" className="button-primary w-full md:w-auto order-1 md:order-2 shadow-md min-w-[120px] py-2 md:py-2.5">{packageEditMode === 'new' ? 'Simpan Package' : 'Update Package'}</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Tautan Booking per Wilayah">
                <div className="space-y-4">
                    <p className="text-sm text-brand-text-secondary mb-4">
                        Bagikan tautan booking khusus untuk setiap wilayah. Setiap tautan akan menampilkan Package dan add-ons yang sesuai dengan wilayah tersebut.
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                        {unionRegions.map(r => (
                            <div key={r.value} className="space-y-2">
                                <div className="input-group">
                                    <input
                                        type="text"
                                        readOnly
                                        value={`${window.location.origin}${window.location.pathname}#/public-booking?region=${r.value}`}
                                        className="input-field !bg-brand-input text-xs sm:text-sm"
                                        onClick={(e) => {
                                            e.currentTarget.select();
                                            navigator.clipboard.writeText(e.currentTarget.value);
                                        }}
                                    />
                                    <label className="input-label">Booking - {r.label}</label>
                                </div>
                                <p className="text-xs text-brand-text-secondary pl-1">
                                    Tautan khusus untuk wilayah {r.label}. Klik untuk menyalin.
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Panduan Halaman Package">
                <div className="space-y-4 text-sm text-brand-text-primary">
                    <p>Halaman ini adalah tempat Anda membuat dan mengelola semua penawaran produk Anda.</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Package:</strong> Kolom utama di kiri menampilkan semua Package layanan Anda, dikelompokkan berdasarkan kategori. Anda dapat menambah, mengedit, atau menghapus Package.</li>
                        <li><strong>Add-Ons:</strong> Kolom di kanan adalah untuk item tambahan yang bisa dipilih pengantin, seperti drone, MUA, dll.</li>
                        <li><strong>Cover Image:</strong> Anda bisa menambahkan gambar sampul untuk setiap Package agar lebih menarik secara visual di halaman publik.</li>
                        <li><strong>Bagikan Halaman Package:</strong> Gunakan tombol di kanan atas untuk mendapatkan tautan ke halaman publik yang menampilkan semua Package Anda, siap untuk dibagikan kepada calon pengantin.</li>
                        <li><strong>Kategori:</strong> Kategori untuk Package dapat dikelola di halaman <strong>Pengaturan &gt; Kustomisasi Kategori</strong>.</li>
                    </ul>
                </div>
            </Modal>
        </div>
    );
};

export default Packages;
