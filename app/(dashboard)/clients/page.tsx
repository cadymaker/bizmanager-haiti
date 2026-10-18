'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { Client } from '@/types';
import { formatMoney } from '@/lib/currency';

const OPEN_STATUSES = ['sent', 'partial'];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [currency, setCurrency] = useState('HTG');

  // Modifye
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState('');

  // Efase
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{ debt: number; invoiceCount: number } | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('business_name, currency')
      .eq('id', ctx.businessId)
      .single();
    setBusinessName(biz?.business_name ?? '');
    setCurrency(biz?.currency ?? 'HTG');

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('name');
    setClients(data ?? []);
    setLoading(false);
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) return;

    const { error } = await supabase.from('clients').insert({
      business_id: ctx.businessId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    });

    if (!error) {
      setForm({ name: '', phone: '', address: '' });
      flash('Kliyan ajoute ak siksè!');
      loadClients();
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  function sendReminder(c: Client) {
    const phone = (c.phone ?? '').replace(/[^0-9]/g, '');
    const montan = formatMoney(c.total_debt, currency);
    const mesaj = `Bonjou ${c.name}! Sa se yon ti rapèl zanmitay: ou gen yon balans ki rete pou peye ki se ${montan}. Mèsi anpil pou konfyans ou. — ${businessName}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mesaj)}`, '_blank');
  }

  // ===== Modifye =====
  function openEdit(c: Client) {
    setEditClient(c);
    setEditForm({ name: c.name ?? '', phone: c.phone ?? '', address: c.address ?? '' });
    setEditErr('');
  }

  function closeEdit() {
    if (savingEdit) return;
    setEditClient(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editClient) return;
    if (!editForm.name.trim()) { setEditErr('Non kliyan an obligatwa.'); return; }

    setSavingEdit(true);
    setEditErr('');
    const supabase = createClient();

    const { error } = await supabase
      .from('clients')
      .update({
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
      })
      .eq('id', editClient.id);

    setSavingEdit(false);

    if (error) {
      setEditErr('Erè: ' + error.message);
      return;
    }

    setEditClient(null);
    flash('Kliyan modifye!');
    loadClients();
  }

  // ===== Efase =====
  async function openDelete(c: Client) {
    setDeleteClient(c);
    setDeleteInfo(null);
    setDeleteErr('');
    setCheckingDelete(true);

    const supabase = createClient();

    // Tcheke dèt reyèl la ak kantite fakti dirèkteman nan fakti yo
    const { data: invs, error } = await supabase
      .from('invoices')
      .select('balance_due, status')
      .eq('client_id', c.id);

    setCheckingDelete(false);

    if (error) {
      setDeleteErr('Erè: ' + error.message);
      return;
    }

    const debt = (invs ?? [])
      .filter((i: any) => OPEN_STATUSES.includes(i.status))
      .reduce((s: number, i: any) => s + Number(i.balance_due || 0), 0);

    setDeleteInfo({
      debt: Math.max(debt, Number(c.total_debt || 0)),
      invoiceCount: (invs ?? []).length,
    });
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteClient(null);
  }

  async function confirmDelete() {
    if (!deleteClient || !deleteInfo || deleteInfo.debt > 0) return;

    setDeleting(true);
    setDeleteErr('');
    const supabase = createClient();

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', deleteClient.id);

    setDeleting(false);

    if (error) {
      setDeleteErr('Erè: ' + error.message);
      return;
    }

    const name = deleteClient.name;
    setDeleteClient(null);
    flash(`"${name}" efase.`);
    loadClients();
  }

  const fmt = (n: number) => formatMoney(n, currency);
  const msgIsError = msg.startsWith('Erè');

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Kliyan / Dèt</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium text-gray-800 mb-3">Ajoute nouvo kliyan</h2>
        {msg && (
          <div className={`text-sm rounded-lg p-2 mb-3 ${msgIsError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {msg}
          </div>
        )}
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
          <input placeholder="Non kliyan *" required
            className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Telefòn"
            className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Adrès"
            className="flex-1 min-w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Ajoute
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">Konsèy: ajoute telefòn kliyan an (+509...) pou w ka voye rapèl WhatsApp.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Non</th>
              <th className="px-4 py-3">Telefòn</th>
              <th className="px-4 py-3">Adrès</th>
              <th className="px-4 py-3">Dèt</th>
              <th className="px-4 py-3">Rapèl</th>
              <th className="px-4 py-3">Aksyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chajman...</td></tr>
            )}
            {!loading && clients.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Pa gen kliyan toujou.</td></tr>
            )}
            {clients.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.address || '—'}</td>
                <td className={`px-4 py-3 font-medium ${c.total_debt > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {c.total_debt > 0 ? fmt(c.total_debt) : 'Soldé'}
                </td>
                <td className="px-4 py-3">
                  {c.total_debt > 0 && c.phone && (
                    <button onClick={() => sendReminder(c)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 whitespace-nowrap">
                      Rapèl WhatsApp
                    </button>
                  )}
                  {c.total_debt > 0 && !c.phone && (
                    <span className="text-xs text-gray-400">Pa gen telefòn</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(c)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                      Modifye
                    </button>
                    <button onClick={() => openDelete(c)}
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

      {/* ===== MODAL MODIFYE ===== */}
      {editClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeEdit}>
          <form onSubmit={saveEdit}
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Modifye kliyan</h2>
              <button type="button" onClick={closeEdit}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium">Non kliyan *</label>
              <input autoFocus required
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Telefòn</label>
              <input placeholder="+509..."
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Adrès</label>
              <input
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
            </div>

            {editErr && (
              <div className="text-sm rounded-lg p-2 bg-red-50 text-red-700">{editErr}</div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={closeEdit} disabled={savingEdit}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                Anile
              </button>
              <button type="submit" disabled={savingEdit}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingEdit ? 'Ap anrejistre...' : 'Anrejistre'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== MODAL EFASE ===== */}
      {deleteClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeDelete}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Efase {deleteClient.name}?</h2>

            {checkingDelete && (
              <p className="text-sm text-gray-500">Ap verifye fakti kliyan an...</p>
            )}

            {!checkingDelete && deleteInfo && deleteInfo.debt > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 space-y-1">
                <p className="font-medium">Ou pa ka efase kliyan sa a.</p>
                <p>
                  Li dwe toujou <strong>{fmt(deleteInfo.debt)}</strong>. Anrejistre peman yo oswa
                  regle fakti l yo anvan, apre sa w ap ka efase l.
                </p>
              </div>
            )}

            {!checkingDelete && deleteInfo && deleteInfo.debt <= 0 && deleteInfo.invoiceCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
                <p>
                  Kliyan sa a gen <strong>{deleteInfo.invoiceCount}</strong> fakti.
                  Fakti yo ap <strong>rete</strong>, epi vant yo ap toujou konte nan rapò yo,
                  men non kliyan an p ap parèt sou yo ankò.
                </p>
              </div>
            )}

            {!checkingDelete && deleteInfo && deleteInfo.debt <= 0 && deleteInfo.invoiceCount === 0 && (
              <p className="text-sm text-gray-600">
                Kliyan sa a pa gen okenn fakti. Li pral efase nèt.
              </p>
            )}

            {deleteErr && (
              <div className="mt-3 text-sm rounded-lg p-2 bg-red-50 text-red-700">{deleteErr}</div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={closeDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                {deleteInfo && deleteInfo.debt > 0 ? 'Fèmen' : 'Anile'}
              </button>
              {deleteInfo && deleteInfo.debt <= 0 && (
                <button onClick={confirmDelete} disabled={deleting || checkingDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {deleting ? 'Ap efase...' : 'Efase'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}