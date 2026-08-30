import React, { useState, useEffect } from 'react';
import { InventoryItem, Project } from '../../types';
import { listInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../services/inventoryItems';
import { PlusIcon, TrashIcon, PencilIcon, BoxIcon } from 'lucide-react';
import Modal from '../../shared/ui/Modal';
import { supabase } from '../../lib/supabaseClient';

interface InventoryPageProps {
  projects?: Project[];
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ projects = [] }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [coverImage, setCoverImage] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await listInventoryItems();
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateInUse = (itemId: string) => {
    let inUse = 0;
    const activeProjects = projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan');
    activeProjects.forEach(project => {
      const itemInProject = project.inventoryItems?.find(i => i.itemId === itemId);
      if (itemInProject) {
        inUse += itemInProject.quantity;
      }
    });
    return inUse;
  };

  // Calculate usage by date for conflict detection
  const getUsageByDate = (itemId: string): Record<string, { count: number; projects: string[] }> => {
    const usageByDate: Record<string, { count: number; projects: string[] }> = {};
    const activeProjects = projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan');
    
    activeProjects.forEach(project => {
      const itemInProject = project.inventoryItems?.find(i => i.itemId === itemId);
      if (itemInProject) {
        const dateKey = new Date(project.date).toDateString();
        if (!usageByDate[dateKey]) {
          usageByDate[dateKey] = { count: 0, projects: [] };
        }
        usageByDate[dateKey].count += itemInProject.quantity;
        usageByDate[dateKey].projects.push(project.projectName);
      }
    });
    
    return usageByDate;
  };

  const handleOpenModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setCategory(item.category);
      setTotalQuantity(item.totalQuantity);
      setCoverImage(item.coverImage || '');
      setNotes(item.notes || '');
    } else {
      setEditingItem(null);
      setName('');
      setCategory('');
      setTotalQuantity(0);
      setCoverImage('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const updated = await updateInventoryItem(editingItem.id, {
          name, category, totalQuantity, coverImage, notes
        });
        setItems(items.map(i => i.id === updated.id ? updated : i));
      } else {
        const created = await createInventoryItem({
          name, category, totalQuantity, coverImage, notes
        });
        setItems([created, ...items]);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert('Gagal menyimpan data');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus item ini?')) return;
    try {
      await deleteInventoryItem(id);
      setItems(items.filter(i => i.id !== id));
    } catch (error) {
      alert('Gagal menghapus data');
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `inventory/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      setCoverImage(data.publicUrl);
    } catch (error) {
      alert('Gagal upload gambar');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center">Memuat inventaris...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Inventaris Dekorasi</h1>
          <p className="text-sm text-brand-text-secondary mt-1">Kelola stok barang dan properti dekorasi Anda.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-semibold hover:bg-brand-accent/90 transition-colors"
        >
          <PlusIcon className="w-5 h-5" /> Tambah Item
        </button>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => {
            const inUse = calculateInUse(item.id);
            const available = item.totalQuantity - inUse;
            const usageByDate = getUsageByDate(item.id);
            const conflictDates = Object.entries(usageByDate).filter(([_, data]) => data.count > item.totalQuantity);
            const hasConflict = conflictDates.length > 0;
            
            return (
              <div key={item.id} className={`bg-brand-surface border rounded-2xl overflow-hidden shadow-sm flex flex-col ${hasConflict ? 'border-red-300 ring-2 ring-red-200' : 'border-brand-border'}`}>
                {hasConflict && (
                  <div className="bg-red-500 text-white px-4 py-2 text-xs font-bold flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>KONFLIK JADWAL TERDETEKSI!</span>
                  </div>
                )}
                <div className="h-48 bg-gray-100 relative group">
                  {item.coverImage ? (
                    <img src={item.coverImage} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <BoxIcon className="w-10 h-10 mb-2 opacity-30" />
                      <span className="text-sm font-medium">No Image</span>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-brand-text-primary">{item.name}</h3>
                      <span className="inline-block px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-xs font-semibold rounded-md mt-1">{item.category}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-4 mb-4 text-center">
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium">Total</div>
                      <div className="font-bold text-gray-800">{item.totalQuantity}</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-100">
                      <div className="text-xs text-yellow-700 font-medium">Dipakai</div>
                      <div className="font-bold text-yellow-800">{inUse}</div>
                    </div>
                    <div className={`rounded-lg p-2 border ${available < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                      <div className={`text-xs font-medium ${available < 0 ? 'text-red-700' : 'text-green-700'}`}>Sisa</div>
                      <div className={`font-bold ${available < 0 ? 'text-red-800' : 'text-green-800'}`}>{available}</div>
                    </div>
                  </div>

                  {hasConflict && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-2">
                      <div className="font-bold text-red-900 flex items-center gap-2">
                        <span>⚠️</span> Konflik Tanggal:
                      </div>
                      {conflictDates.map(([dateKey, data]) => (
                        <div key={dateKey} className="pl-4 text-red-800">
                          <div className="font-semibold">📅 {new Date(dateKey).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                          <div>Digunakan: <span className="font-bold text-red-900">{data.count} unit</span> (Melebihi stok!)</div>
                          <div className="text-[10px] text-red-700 mt-1">Proyek: {data.projects.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex justify-end gap-2 pt-4 border-t border-brand-border">
                    <button onClick={() => handleOpenModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-brand-border rounded-2xl">
          <BoxIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-brand-text-secondary">Belum ada item inventaris.</p>
          <button onClick={() => handleOpenModal()} className="mt-4 text-brand-accent font-semibold hover:underline">
            Tambah Item Pertama
          </button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Item' : 'Tambah Item'} size="2xl">
        <form onSubmit={handleSave} className="space-y-4 p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-secondary mb-1">Nama Item</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-secondary mb-1">Kategori</label>
              <input type="text" required value={category} onChange={e => setCategory(e.target.value)} placeholder="Tenda, Kursi, dll"
                className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Total Stok</label>
            <input type="number" min="0" required value={totalQuantity} onChange={e => setTotalQuantity(parseInt(e.target.value))}
              className="w-full max-w-[200px] px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Gambar / Foto</label>
            <div className="flex items-center gap-4">
              {coverImage && <img src={coverImage} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-brand-border" />}
              <label className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors">
                {uploading ? 'Mengunggah...' : 'Upload Gambar'}
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={uploading} />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Catatan Tambahan (opsional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-brand-border">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold">Batal</button>
            <button type="submit" disabled={uploading} className="flex-1 px-4 py-2 bg-brand-accent text-white hover:bg-brand-accent/90 rounded-xl font-semibold disabled:opacity-50">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InventoryPage;
