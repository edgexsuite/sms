import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Library, Plus, Search, Download, Trash2, X } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  total_copies: number;
  available_copies: number;
  shelf_location: string;
  published_year: number | null;
}

const EMPTY: Omit<Book, 'id'> = {
  title: '', author: '', isbn: '', category: '', total_copies: 1, available_copies: 1, shelf_location: '', published_year: null,
};

export default function LibraryCatalog() {
  const { userRole } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchBooks();
  }, [userRole]);

  const fetchBooks = async () => {
    setLoading(true);
    const { data } = await supabase.from('library_books').select('*').eq('school_id', userRole!.school_id).order('title');
    setBooks(data || []);
    setLoading(false);
  };

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (b: Book) => { setForm({ title: b.title, author: b.author, isbn: b.isbn, category: b.category, total_copies: b.total_copies, available_copies: b.available_copies, shelf_location: b.shelf_location, published_year: b.published_year }); setEditId(b.id); setShowModal(true); };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    if (editId) {
      await supabase.from('library_books').update(form).eq('id', editId);
    } else {
      await supabase.from('library_books').insert({ ...form, school_id: userRole!.school_id });
    }
    setSaving(false);
    setShowModal(false);
    fetchBooks();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this book?')) return;
    await supabase.from('library_books').delete().eq('id', id);
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    b.isbn.includes(search)
  );

  const cols = [
    { header: 'Title', key: 'title' }, { header: 'Author', key: 'author' }, { header: 'ISBN', key: 'isbn' },
    { header: 'Category', key: 'category' }, { header: 'Total', key: 'total_copies' }, { header: 'Available', key: 'available_copies' },
    { header: 'Shelf', key: 'shelf_location' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Library className="w-6 h-6 text-amber-600" /> Book Catalog
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage the library's book collection.</p>
        </div>
        <div className="flex gap-2">
          {books.length > 0 && (
            <button onClick={() => exportToExcel('library-catalog', books, cols)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
            <Plus className="w-4 h-4" /> Add Book
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, author, or ISBN..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 shrink-0">
          <div className="text-center px-4 py-2 bg-amber-50 rounded-lg">
            <p className="text-xs text-gray-500">Total Books</p><p className="font-bold text-amber-700">{books.length}</p>
          </div>
          <div className="text-center px-4 py-2 bg-green-50 rounded-lg">
            <p className="text-xs text-gray-500">Available</p><p className="font-bold text-green-700">{books.reduce((s, b) => s + b.available_copies, 0)}</p>
          </div>
          <div className="text-center px-4 py-2 bg-red-50 rounded-lg">
            <p className="text-xs text-gray-500">Issued</p><p className="font-bold text-red-700">{books.reduce((s, b) => s + (b.total_copies - b.available_copies), 0)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Library className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p>{search ? 'No books found.' : 'No books in catalog yet. Add your first book.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Title / Author</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">ISBN</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Shelf</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Copies</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Available</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(b)}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{b.title}</p>
                    <p className="text-xs text-gray-400">{b.author}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{b.isbn || '—'}</td>
                  <td className="px-5 py-3">
                    {b.category && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">{b.category}</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{b.shelf_location || '—'}</td>
                  <td className="px-5 py-3 text-center text-gray-600">{b.total_copies}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${b.available_copies > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {b.available_copies}
                    </span>
                  </td>
                  <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => remove(b.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{editId ? 'Edit Book' : 'Add Book'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Author</label>
                  <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ISBN</label>
                  <input value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Science, Fiction"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Shelf Location</label>
                  <input value={form.shelf_location} onChange={e => setForm({ ...form, shelf_location: e.target.value })} placeholder="e.g. A-1-2"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Total Copies</label>
                  <input type="number" min="1" value={form.total_copies} onChange={e => setForm({ ...form, total_copies: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Available Copies</label>
                  <input type="number" min="0" value={form.available_copies} onChange={e => setForm({ ...form, available_copies: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving || !form.title.trim()}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
