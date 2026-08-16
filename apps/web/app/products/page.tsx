'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Package, Search, Store, X, User } from 'lucide-react';
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
  seller_name: string | null;
  seller_location: string | null;
  seller_image: string | null;
};

const displayUnit = (unit: string) => unit === 'litre' ? 'L' : unit;

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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

  // Lock background scroll while the modal is open, and allow Escape to close it
  useEffect(() => {
    if (!selectedProduct) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProduct(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedProduct]);

  return (
    <main className="min-h-screen bg-gray-50 pb-4">
      <section className="border-b border-green-100 bg-gradient-to-br from-green-700 to-emerald-600 px-4 py-6 text-white sm:py-9">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Store className="h-6 w-6" /></span><div><h1 className="text-2xl font-black sm:text-3xl">Products</h1><p className="text-sm text-green-50">Products listed directly by farmers and buyers</p></div></div>
          <label className="relative block max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products, categories, sellers or locations…" className="w-full rounded-2xl border-0 bg-white py-3.5 pl-12 pr-11 text-sm font-medium text-gray-900 shadow-lg outline-none ring-green-300 focus:ring-4" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </label>
        </div>
      </section>

      <section className="mx-auto max-w-6xl p-3 sm:p-6">
        {!loading && !error && <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">{products.length} product{products.length === 1 ? '' : 's'} found</p>}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}<button onClick={() => loadProducts(search)} className="ml-2 font-bold underline">Try again</button></div>
        : loading ? <div className="grid grid-cols-2 gap-3 sm:gap-5">{[1,2,3,4].map(item => <div key={item} className="overflow-hidden rounded-2xl bg-white"><div className="aspect-square animate-pulse bg-gray-200" /><div className="space-y-2 p-3"><div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" /><div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" /></div></div>)}</div>
        : products.length === 0 ? <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-5 py-16 text-center"><Package className="mx-auto mb-3 h-12 w-12 text-gray-300" /><h2 className="text-lg font-black text-gray-900">No products found</h2><p className="mt-1 text-sm text-gray-500">{search ? 'Try another product name, category, seller or location.' : 'Products will appear here after farmers or buyers add them.'}</p></div>
        : <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {products.map(product => (
            <article
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              role="button"
              tabIndex={0}
              onKeyDown={event => { if (event.key === 'Enter') setSelectedProduct(product); }}
              className="min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-square bg-green-50">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Package className="h-12 w-12 text-green-200" /></div>}</div>
              <div className="p-3 sm:p-4">
                {product.category && <p className="mb-1 truncate text-[10px] font-black uppercase tracking-wide text-green-700">{product.category}</p>}
                <h2 className="truncate text-sm font-black text-gray-900 sm:text-base">{product.name}</h2>
                <p className="mt-1 truncate text-base font-black text-green-700 sm:text-lg">₹{Number(product.price).toLocaleString('en-IN')}<span className="text-[10px] font-semibold text-gray-500"> / {Number(product.quantity || 1).toLocaleString()} {displayUnit(product.unit)}</span></p>
                <button
                  onClick={event => { event.stopPropagation(); router.push(`/farmer-profile?id=${product.user_id}`); }}
                  className="mt-3 flex w-full min-w-0 items-center gap-2 border-t border-gray-100 pt-3 text-left"
                >
                  <UserAvatar image={product.seller_image || ''} name={product.seller_name || 'Seller'} size={28} />
                  <span className="min-w-0"><span className="block truncate text-[11px] font-bold text-gray-800">{product.seller_name || 'Seller'}</span>{product.seller_location && <span className="flex items-center gap-0.5 truncate text-[9px] text-gray-500"><MapPin className="h-2.5 w-2.5 flex-shrink-0" />{product.seller_location}</span>}</span>
                </button>
              </div>
            </article>
          ))}
        </div>}
      </section>

      {/* Product detail modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="mb-[calc(76px+env(safe-area-inset-bottom))] max-h-[calc(90vh-76px-env(safe-area-inset-bottom))] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:mb-0 sm:max-h-[90vh] sm:rounded-3xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="relative">
              <div className="aspect-square w-full bg-green-50 sm:rounded-t-3xl">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover sm:rounded-t-3xl" />
                ) : (
                  <div className="grid h-full place-items-center"><Package className="h-16 w-16 text-green-200" /></div>
                )}
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {selectedProduct.category && (
                <p className="mb-1 text-xs font-black uppercase tracking-wide text-green-700">{selectedProduct.category}</p>
              )}
              <h2 className="text-xl font-black text-gray-900">{selectedProduct.name}</h2>
              <p className="mt-1 text-2xl font-black text-green-700">
                ₹{Number(selectedProduct.price).toLocaleString('en-IN')}
                <span className="text-xs font-semibold text-gray-500"> / {Number(selectedProduct.quantity || 1).toLocaleString()} {displayUnit(selectedProduct.unit)}</span>
              </p>

              {selectedProduct.description && (
                <p className="mt-4 text-sm leading-relaxed text-gray-600">{selectedProduct.description}</p>
              )}

              <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-500">
                  <User className="h-3.5 w-3.5" /> Listed by
                </p>
                <button
                  onClick={() => router.push(`/farmer-profile?id=${selectedProduct.user_id}`)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <UserAvatar image={selectedProduct.seller_image || ''} name={selectedProduct.seller_name || 'Seller'} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-gray-900">{selectedProduct.seller_name || 'Seller'}</span>
                    {selectedProduct.seller_location && (
                      <span className="flex items-center gap-1 truncate text-xs text-gray-500">
                        <MapPin className="h-3 w-3 flex-shrink-0" />{selectedProduct.seller_location}
                      </span>
                    )}
                  </span>
                  <span className="flex-shrink-0 rounded-full bg-green-700 px-3 py-1.5 text-xs font-bold text-white">View profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}