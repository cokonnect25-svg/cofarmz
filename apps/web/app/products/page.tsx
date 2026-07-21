'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Package, Search, Store, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import UserAvatar from '@/app/components/UserAvatar';

type Product = {
  id: number;
  user_id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | string;
  unit: string;
  quantity: number | string | null;
  image_url: string | null;
  farmer_name: string | null;
  farmer_location: string | null;
  farmer_image: string | null;
};

const displayUnit = (unit: string) => unit === 'litre' ? 'L' : unit;

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async (term = '') => {
    setLoading(true);
    setError('');
    try {
      const suffix = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : '';
      const response = await fetch(getApiUrl(`/api/farmer-products${suffix}`));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadProducts(search), 300);
    return () => window.clearTimeout(timer);
  }, [search, loadProducts]);

  return (
    <main className="min-h-screen bg-gray-50 pb-4">
      <section className="border-b border-green-100 bg-gradient-to-br from-green-700 to-emerald-600 px-4 py-6 text-white sm:py-9">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Store className="h-6 w-6" /></span><div><h1 className="text-2xl font-black sm:text-3xl">Farmer Products</h1><p className="text-sm text-green-50">Fresh products listed directly by farmers</p></div></div>
          <label className="relative block max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products, categories, farmers or locations…" className="w-full rounded-2xl border-0 bg-white py-3.5 pl-12 pr-11 text-sm font-medium text-gray-900 shadow-lg outline-none ring-green-300 focus:ring-4" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </label>
        </div>
      </section>

      <section className="mx-auto max-w-6xl p-3 sm:p-6">
        {!loading && !error && <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">{products.length} product{products.length === 1 ? '' : 's'} found</p>}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}<button onClick={() => loadProducts(search)} className="ml-2 font-bold underline">Try again</button></div>
        : loading ? <div className="grid grid-cols-2 gap-3 sm:gap-5">{[1,2,3,4].map(item => <div key={item} className="overflow-hidden rounded-2xl bg-white"><div className="aspect-square animate-pulse bg-gray-200" /><div className="space-y-2 p-3"><div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" /><div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" /></div></div>)}</div>
        : products.length === 0 ? <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-5 py-16 text-center"><Package className="mx-auto mb-3 h-12 w-12 text-gray-300" /><h2 className="text-lg font-black text-gray-900">No products found</h2><p className="mt-1 text-sm text-gray-500">{search ? 'Try another product name, category, farmer or location.' : 'Farmer products will appear here after they are added.'}</p></div>
        : <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {products.map(product => (
            <article key={product.id} className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="aspect-square bg-green-50">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Package className="h-12 w-12 text-green-200" /></div>}</div>
              <div className="p-3 sm:p-4">
                {product.category && <p className="mb-1 truncate text-[10px] font-black uppercase tracking-wide text-green-700">{product.category}</p>}
                <h2 className="truncate text-sm font-black text-gray-900 sm:text-base">{product.name}</h2>
                <p className="mt-1 truncate text-base font-black text-green-700 sm:text-lg">₹{Number(product.price).toLocaleString('en-IN')}<span className="text-[10px] font-semibold text-gray-500"> / {Number(product.quantity || 1).toLocaleString()} {displayUnit(product.unit)}</span></p>
                <button onClick={() => router.push(`/farmer-profile?id=${product.user_id}`)} className="mt-3 flex w-full min-w-0 items-center gap-2 border-t border-gray-100 pt-3 text-left">
                  <UserAvatar image={product.farmer_image || ''} name={product.farmer_name || 'Farmer'} size={28} />
                  <span className="min-w-0"><span className="block truncate text-[11px] font-bold text-gray-800">{product.farmer_name || 'Farmer'}</span>{product.farmer_location && <span className="flex items-center gap-0.5 truncate text-[9px] text-gray-500"><MapPin className="h-2.5 w-2.5 flex-shrink-0" />{product.farmer_location}</span>}</span>
                </button>
              </div>
            </article>
          ))}
        </div>}
      </section>
    </main>
  );
}
