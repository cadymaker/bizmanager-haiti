'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/currency';

interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  purchase_price: number;
  sale_price: number;
  quantity: number;
  image_url: string | null;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: '', category: '', description: '',
    purchase_price: '', sale_price: '', quantity: '', image_url: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', session.user.id)
      .single();
    setCurrency(biz?.currency ?? 'HTG');

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', session.user.id)
      .order('name');
    setProducts(data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setForm({ name: '', category: '', description: '', purchase_price: '', sale_price: '', quantity: '', image_url: '' });
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(p: Product) {
    setForm({
      name: p.name,
      category: p.category ?? '',
      description: p.description ?? '',
      purchase_price: String(p.purchase_price),
      sale_price: String(p.sale_price),
      quantity: String(p.quantity),
      image_url: p.image_url ?? '',
    });
    setEditId(p.id);
    setShowForm(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMsg('Imaj la twò gwo (maksimòm 2MB).');
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setUploading(false); return; }

    const ext = file.name.split('.').pop();
    const fileName = `${session.user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('products')
      .upload(fileName, file, { upsert: true });

    if (upErr) {
      setMsg('Erè upload: ' + upErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('products').getPublicUrl(fileName);
    setForm(f => ({ ...f, image_url: urlData.publicUrl }));
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setMsg('Non pwodwi obligatwa.'); return; }

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const payload = {
      business_id: session.user.id,
      name: form.name,
      category: form.category || null,
      description: form.description || null,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      quantity: parseInt(form.quantity) || 0,
      image_url: form.image_url || null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }

    if (!error) {
      setMsg(editId ? 'Pwodwi modifye!' : 'Pwodwi ajoute!');
      resetForm();
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Efase "${name}" nan envantè a?`)) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    load();
  }

  const fmt = (n: number) => formatMoney(n, currency);

  const totalValue = products.reduce((s, p) => s + p.sale_price * p.quantity, 0);
  const lowStock = products.filter(p => p.quantity <= 5).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Envantè</h1>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          {showForm ? 'Fèmen' : '+ Nouvo pwodwi'}
        </button>
      </div>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Valè total stock (vant)</p>
          <p className="text-xl font-semibold mt-1">{fmt(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pwodwi ki prèske fini (≤5)</p>
          <p className={`text-xl font-semibold mt-1 ${lowStock > 0 ? 'text-orange-600' : 'text-green-600'}`}>{lowStock}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-medium text-gray-800">{editId ? 'Modifye pwodwi' : 'Ajoute nouvo pwodwi'}</h2>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.image_url ? (
                <img src={form.image_url} alt="Pwodwi" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400 text-center">Pa gen foto</span>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Foto pwodwi (opsyonèl)</label>
              <input type="file" accept="image/*" onChange={handleImageUpload}
                className="block mt-1 text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs hover:file:bg-blue-100" />
              {uploading && <p className="text-xs text-blue-600 mt-1">Ap upload...</p>}
              <p className="text-xs text-gray-400 mt-1">PNG, JPG — max 2MB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Non pwodwi *" required
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Kategori (ex: Bwason)"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          </div>
          <input placeholder="Deskripsyon (opsyonèl)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Pri acha</label>
              <input type="number" placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Pri vant</label>
              <input type="number" placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Kantite an stock</label>
              <input type="number" placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
          </div>
          <button type="submit" disabled={uploading}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {editId ? 'Anrejistre chanjman' : 'Ajoute pwodwi a'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Pwodwi</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Pri acha</th>
              <th className="px-4 py-3">Pri vant</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Aksyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chajman...</td></tr>
            )}
            {!loading && products.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Pa gen pwodwi toujou. Klike "+ Nouvo pwodwi".</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.category || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{fmt(p.purchase_price)}</td>
                <td className="px-4 py-3">{fmt(p.sale_price)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.quantity <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {p.quantity} {p.quantity <= 5 ? '⚠️' : ''}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(p)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                      Modifye
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200">
                      Efase
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}