import React, { useState, useEffect } from 'react';
import { VendorProfile, VendorPortfolio, PortfolioImage } from '../../types';
import { getVendorProfile, createOrUpdateVendorProfile, uploadVendorImage } from '../../services/vendorProfile';
import {
  listVendorPortfolios, createVendorPortfolio, deleteVendorPortfolio,
  uploadPortfolioCover, uploadPortfolioImages, updateVendorPortfolio, getVendorPortfolio
} from '../../services/vendorPortfolios';
import { SaveIcon, UploadCloudIcon, XIcon, PlusIcon, TrashIcon, CameraIcon, PencilIcon, EyeIcon } from 'lucide-react';
import Modal from '../../shared/ui/Modal';

// ─── Edit Portfolio Modal ─────────────────────────────────────────────────────
interface EditPortfolioModalProps {
  portfolio: VendorPortfolio;
  onClose: () => void;
  onUpdated: (updated: VendorPortfolio) => void;
}

const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({ portfolio, onClose, onUpdated }) => {
  const [title, setTitle] = useState(portfolio.title);
  const [category, setCategory] = useState(portfolio.category);
  const [images, setImages] = useState<PortfolioImage[]>(portfolio.images || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await updateVendorPortfolio(portfolio.id, { title, category, images });
      onUpdated(updated);
      onClose();
    } catch {
      alert('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploading(true);
      const uploaded = await uploadPortfolioImages(portfolio.id, Array.from(e.target.files));
      const refreshed = await getVendorPortfolio(portfolio.id);
      if (refreshed) setImages(refreshed.images || []);
    } catch {
      alert('Gagal upload gambar');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imgId: string) => {
    if (!confirm('Hapus gambar ini?')) return;
    const newImages = images.filter(i => i.id !== imgId);
    setImages(newImages);
    await updateVendorPortfolio(portfolio.id, { images: newImages });
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit Portofolio`} size="4xl">
      <form onSubmit={handleSave} className="space-y-5 p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Judul Proyek</label>
            <input
              type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              placeholder="Contoh: Budi & Sinta Wedding"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Kategori</label>
            <input
              type="text" required value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              placeholder="Contoh: Prewedding, Wedding..."
            />
          </div>
        </div>

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-brand-text-secondary">
              Gambar-gambar ({images.length})
            </span>
            <label className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-brand-input border border-brand-border rounded-lg hover:bg-brand-border transition-colors">
              <PlusIcon className="w-3.5 h-3.5" />
              {uploading ? 'Mengunggah...' : 'Tambah Gambar'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} disabled={uploading} />
            </label>
          </div>

          {images.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden group border border-brand-border">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-brand-border rounded-xl text-brand-text-secondary text-sm">
              Belum ada gambar. Klik "Tambah Gambar" untuk upload.
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-brand-border">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold">
            Batal
          </button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-brand-accent text-white hover:bg-brand-accent/90 rounded-xl font-semibold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Main VendorProfilePage ───────────────────────────────────────────────────
const VendorProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Partial<VendorProfile>>({
    hero_title: '',
    hero_subtitle: '',
    whatsapp_number: '',
  });
  const [portfolios, setPortfolios] = useState<VendorPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ title: '', category: '' });
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [uploadingPortfolioId, setUploadingPortfolioId] = useState<string | null>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<VendorPortfolio | null>(null);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const [profileData, portfoliosData] = await Promise.all([
        getVendorProfile(),
        listVendorPortfolios()
      ]);
      if (profileData) setProfile(profileData);
      setPortfolios(portfoliosData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await createOrUpdateVendorProfile(profile);
      setMessage('Profil berhasil disimpan');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const url = await uploadVendorImage(e.target.files[0], 'vendor/hero');
      setProfile(prev => ({ ...prev, hero_image_url: url }));
    } catch { alert('Gagal upload gambar'); }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolio.title.trim() || !newPortfolio.category.trim()) return;
    try {
      setIsCreatingPortfolio(true);
      const created = await createVendorPortfolio({
        title: newPortfolio.title.trim(),
        category: newPortfolio.category.trim(),
        images: []
      } as any);
      setPortfolios([created, ...portfolios]);
      setIsCreateModalOpen(false);
      setNewPortfolio({ title: '', category: '' });
    } catch (err: any) {
      alert(err?.message || 'Gagal membuat portofolio');
    } finally {
      setIsCreatingPortfolio(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    if (!confirm('Yakin ingin menghapus portofolio ini beserta semua gambarnya?')) return;
    try {
      await deleteVendorPortfolio(id);
      setPortfolios(portfolios.filter(p => p.id !== id));
    } catch { alert('Gagal menghapus portofolio'); }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploadingPortfolioId(id);
      const url = await uploadPortfolioCover(id, e.target.files[0]);
      setPortfolios(portfolios.map(p => p.id === id ? { ...p, cover_image_url: url } : p));
    } catch { alert('Gagal upload cover'); }
    finally { setUploadingPortfolioId(null); }
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploadingPortfolioId(id);
      const uploaded = await uploadPortfolioImages(id, Array.from(e.target.files));
      setPortfolios(portfolios.map(p => p.id === id ? { ...p, images: [...(p.images || []), ...uploaded] } : p));
    } catch { alert('Gagal upload gambar'); }
    finally { setUploadingPortfolioId(null); }
  };

  if (loading) return <div className="p-8 flex items-center gap-3 text-brand-text-secondary"><div className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"/>Memuat...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Profil Vendor</h1>
          <p className="text-sm text-brand-text-secondary mt-1">Kelola tampilan halaman profil publik vendor Anda.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#/profile"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 border border-brand-border text-brand-text-primary rounded-xl font-semibold hover:bg-brand-input transition-colors text-sm"
          >
            <EyeIcon className="w-4 h-4" />
            Lihat Publik
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-semibold hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
          >
            <SaveIcon className="w-5 h-5" />
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium ${message.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message}
        </div>
      )}

      {/* ─── Hero Section ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <h2 className="text-lg font-bold text-brand-text-primary border-b border-brand-border pb-4">Hero Section</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-secondary mb-1">Judul Hero</label>
              <input type="text" value={profile.hero_title || ''} onChange={e => setProfile({ ...profile, hero_title: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none"
                placeholder="Contoh: Capture Your Best Moments" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-secondary mb-1">Sub-judul / Deskripsi</label>
              <textarea value={profile.hero_subtitle || ''} onChange={e => setProfile({ ...profile, hero_subtitle: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none min-h-[100px]"
                placeholder="Contoh: Jasa dokumentasi pernikahan terbaik..." />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Gambar Hero (Background)</label>
            {profile.hero_image_url ? (
              <div className="relative aspect-video rounded-xl overflow-hidden group">
                <img src={profile.hero_image_url} alt="Hero" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className="cursor-pointer px-4 py-2 bg-white text-gray-900 font-semibold rounded-lg">
                    Ganti Gambar
                    <input type="file" accept="image/*" className="hidden" onChange={handleHeroImageUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-brand-border rounded-xl cursor-pointer hover:bg-brand-input/50 transition-colors">
                <UploadCloudIcon className="w-8 h-8 text-brand-text-secondary mb-2" />
                <span className="text-sm font-medium text-brand-text-secondary">Pilih Gambar Hero</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleHeroImageUpload} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* ─── Kontak ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <h2 className="text-lg font-bold text-brand-text-primary border-b border-brand-border pb-4">Kontak</h2>
        <div>
          <label className="block text-sm font-medium text-brand-text-secondary mb-1">Nomor WhatsApp (dengan kode negara)</label>
          <input type="text" value={profile.whatsapp_number || ''} onChange={e => setProfile({ ...profile, whatsapp_number: e.target.value })}
            className="w-full max-w-md px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none"
            placeholder="Contoh: +6281234567890" />
          <p className="text-xs text-brand-text-secondary mt-1">Nomor ini akan digunakan untuk tombol direct WA di profil publik.</p>
        </div>
      </div>

      {/* ─── Portofolio Proyek ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-brand-text-primary">Portofolio Proyek</h2>
            <p className="text-sm text-brand-text-secondary mt-0.5">{portfolios.length} portofolio</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg font-semibold hover:bg-brand-accent/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Tambah Portofolio
          </button>
        </div>

        {portfolios.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {portfolios.map(portfolio => (
              <div key={portfolio.id} className="border border-brand-border rounded-xl overflow-hidden shadow-sm flex flex-col group">
                {/* Cover */}
                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                  {portfolio.cover_image_url ? (
                    <img src={portfolio.cover_image_url} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <CameraIcon className="w-8 h-8 mb-2 opacity-40" />
                      <span className="text-xs">No Cover</span>
                    </div>
                  )}
                  {/* Hover overlay for cover upload */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium">
                      {uploadingPortfolioId === portfolio.id ? 'Mengunggah...' : '📷 Ganti Cover'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadCover(e, portfolio.id)} disabled={uploadingPortfolioId === portfolio.id} />
                    </label>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex-grow flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-brand-text-primary line-clamp-1">{portfolio.title}</h3>
                      <span className="inline-block px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-xs font-semibold rounded-md mt-1">{portfolio.category}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex gap-2">
                    <label className="flex-1 cursor-pointer text-center bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      {uploadingPortfolioId === portfolio.id ? 'Uploading...' : `📸 Upload Gambar (${portfolio.images?.length || 0})`}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUploadImages(e, portfolio.id)} disabled={uploadingPortfolioId === portfolio.id} />
                    </label>
                    <button
                      onClick={() => setEditingPortfolio(portfolio)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <PencilIcon className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeletePortfolio(portfolio.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-brand-text-secondary border-2 border-dashed border-brand-border rounded-xl">
            <CameraIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Belum ada portofolio.</p>
            <p className="text-sm mt-1">Klik "Tambah Portofolio" untuk mulai.</p>
          </div>
        )}
      </div>

      {/* ─── Modal Tambah Portofolio ─── */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Tambah Portofolio Baru">
        <form onSubmit={handleCreatePortfolio} className="space-y-4 p-2">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Judul Proyek</label>
            <input type="text" required value={newPortfolio.title} onChange={e => setNewPortfolio({ ...newPortfolio, title: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              placeholder="Contoh: Budi & Sinta Wedding" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Kategori / Layanan</label>
            <input type="text" required value={newPortfolio.category} onChange={e => setNewPortfolio({ ...newPortfolio, category: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              placeholder="Contoh: Prewedding / Wedding / Engagement" />
          </div>
          <div className="flex gap-3 pt-4 border-t border-brand-border">
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold">Batal</button>
            <button type="submit" disabled={isCreatingPortfolio} className="flex-1 px-4 py-2 bg-brand-accent text-white hover:bg-brand-accent/90 rounded-xl font-semibold disabled:opacity-50">
              {isCreatingPortfolio ? 'Menyimpan...' : 'Buat Portofolio'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Portfolio Modal ─── */}
      {editingPortfolio && (
        <EditPortfolioModal
          portfolio={editingPortfolio}
          onClose={() => setEditingPortfolio(null)}
          onUpdated={(updated) => {
            setPortfolios(portfolios.map(p => p.id === updated.id ? updated : p));
            setEditingPortfolio(null);
          }}
        />
      )}
    </div>
  );
};

export default VendorProfilePage;
