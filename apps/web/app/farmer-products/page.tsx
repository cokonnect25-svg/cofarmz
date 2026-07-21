'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, ImagePlus, Package, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

type Product = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  price: number | string;
  unit: string;
  quantity: number | string | null;
  image_url: string | null;
};

const emptyForm = {
  name: '', category: '', description: '', price: '', unit: 'kg', quantity: '', image_url: '',
};

export default function FarmerProductsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/farmer-products?userId=${encodeURIComponent(user.id)}`));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (!authLoading && !user?.id) setLoading(false);
  }, [authLoading, user?.id]);

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > 10 * 1024 * 1024) return setError('Image must be smaller than 10MB.');

    setUploading(true);
    setError('');
    try {
      const data = new FormData();
      data.append('file', file);
      const response = await fetch(getApiUrl('/api/upload'), { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Image upload failed');
      setForm(current => ({ ...current, image_url: result.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const addProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id || saving || uploading) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(getApiUrl('/api/farmer-products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, user_id: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add product');
      setProducts(current => [data, ...current]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add product');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!user?.id || !confirm(`Delete ${product.name}?`)) return;
    try {
      const response = await fetch(getApiUrl(`/api/farmer-products?id=${product.id}&userId=${encodeURIComponent(user.id)}`), { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete product');
      setProducts(current => current.filter(item => item.id !== product.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete product');
    }
  };

  if (authLoading) return <div className="min-h-screen bg-gray-50 grid place-items-center"><div className="h-9 w-9 rounded-full border-4 border-green-600 border-t-transparent animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="rounded-full p-2 text-gray-700 hover:bg-gray-100" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
            <div><h1 className="text-lg font-black text-gray-900">My Products</h1><p className="text-xs text-gray-500">{products.length} product{products.length === 1 ? '' : 's'} listed</p></div>
          </div>
          <button onClick={() => { setError(''); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Product</span>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl p-4 sm:p-6">
        {error && !showForm && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {!user?.id ? (
          <div className="rounded-3xl border border-gray-200 bg-white px-5 py-16 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h2 className="text-xl font-black text-gray-900">Sign in to manage products</h2>
            <button onClick={() => router.push('/login')} className="mt-5 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white">Go to sign in</button>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-24"><div className="h-9 w-9 rounded-full border-4 border-green-600 border-t-transparent animate-spin" /></div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-green-300 bg-white px-5 py-16 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-green-100 text-green-700"><Package className="h-8 w-8" /></div>
            <h2 className="text-xl font-black text-gray-900">No products yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">Add products you grow or sell so they are easy to manage from your farmer profile.</p>
            <button onClick={() => setShowForm(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add your first product</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(product => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="aspect-[4/3] bg-green-50">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-green-300"><Package className="h-14 w-14" /></div>}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-black text-gray-900">{product.name}</h2>{product.category && <p className="mt-0.5 text-xs font-semibold text-green-700">{product.category}</p>}</div><button onClick={() => deleteProduct(product)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${product.name}`}><Trash2 className="h-4 w-4" /></button></div>
                  {product.description && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{product.description}</p>}
                  <div className="mt-4 flex items-end justify-between"><p className="text-lg font-black text-green-700">₹{Number(product.price).toLocaleString('en-IN')}<span className="text-xs font-semibold text-gray-500">/{product.unit}</span></p>{product.quantity != null && <p className="text-xs font-semibold text-gray-500">{Number(product.quantity).toLocaleString()} {product.unit} available</p>}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
          <form onSubmit={addProduct} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black text-gray-900">Add Product</h2><p className="text-sm text-gray-500">Enter the product details and add a photo.</p></div><button type="button" onClick={() => setShowForm(false)} disabled={saving} className="rounded-full p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>

            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="relative mb-5 flex aspect-[16/8] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-green-300 bg-green-50 text-green-700">
              {form.image_url ? <><img src={form.image_url} alt="Product preview" className="h-full w-full object-cover" /><span className="absolute bottom-3 right-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold shadow"><Camera className="mr-1 inline h-4 w-4" /> Change photo</span></> : <div className="text-center"><ImagePlus className="mx-auto mb-2 h-8 w-8" /><p className="text-sm font-bold">{uploading ? 'Uploading image…' : 'Add product image'}</p><p className="mt-1 text-xs text-green-600">JPG, PNG or WebP · max 10MB</p></div>}
            </button>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={uploadImage} className="hidden" />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-bold text-gray-700">Product name *<input required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Organic tomatoes" className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 font-normal outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" /></label>
              <label className="text-sm font-bold text-gray-700">Category<input maxLength={100} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Vegetables" className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 font-normal outline-none focus:border-green-500" /></label>
              <label className="text-sm font-bold text-gray-700">Unit<select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 font-normal outline-none focus:border-green-500"><option value="kg">kg</option><option value="quintal">quintal</option><option value="tonne">tonne</option><option value="piece">piece</option><option value="dozen">dozen</option><option value="litre">litre</option><option value="bag">bag</option></select></label>
              <label className="text-sm font-bold text-gray-700">Price per unit (₹) *<input required min="0" step="0.01" type="number" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 font-normal outline-none focus:border-green-500" /></label>
              <label className="text-sm font-bold text-gray-700">Available quantity<input min="0" step="0.01" type="number" inputMode="decimal" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="Optional" className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-3 font-normal outline-none focus:border-green-500" /></label>
              <label className="sm:col-span-2 text-sm font-bold text-gray-700">Description<textarea rows={3} maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Quality, variety, harvest or delivery details…" className="mt-1.5 w-full resize-none rounded-xl border border-gray-300 px-3 py-3 font-normal outline-none focus:border-green-500" /></label>
            </div>
            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-5 flex gap-3"><button type="button" onClick={() => setShowForm(false)} disabled={saving} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700">Cancel</button><button type="submit" disabled={saving || uploading} className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Adding…' : 'Add Product'}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
