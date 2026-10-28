import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  AuthorizedSignatory,
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  STANDARD_DESIGNATIONS,
  fetchSchoolSignatories,
  saveSchoolSignatories,
} from '../../lib/signatoryUtils';
import { uploadFile } from '../../lib/uploadUtils';
import {
  FileSignature,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  Star,
  Shield,
  HelpCircle,
  Save,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function AuthorizedSignatories() {
  const { userRole } = useAuth();
  const [signatories, setSignatories] = useState<AuthorizedSignatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    designation: string;
    customDesignation: string;
    phone: string;
    email: string;
    signature_url: string;
    stamp_url: string;
    is_active: boolean;
    applies_to: DocumentType[];
    is_default_for: DocumentType[];
  }>({
    name: '',
    designation: 'Director',
    customDesignation: '',
    phone: '',
    email: '',
    signature_url: '',
    stamp_url: '',
    is_active: true,
    applies_to: ['appointment_letter', 'experience_certificate'],
    is_default_for: ['appointment_letter'],
  });

  const [uploadingSig, setUploadingSig] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      loadSignatories();
    }
  }, [userRole?.school_id]);

  const loadSignatories = async () => {
    setLoading(true);
    const data = await fetchSchoolSignatories(userRole!.school_id);
    setSignatories(data);
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      designation: 'Director',
      customDesignation: '',
      phone: '',
      email: '',
      signature_url: '',
      stamp_url: '',
      is_active: true,
      applies_to: ['appointment_letter', 'experience_certificate'],
      is_default_for: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sig: AuthorizedSignatory) => {
    setEditingId(sig.id);
    const isStandard = STANDARD_DESIGNATIONS.includes(sig.designation);
    setFormData({
      name: sig.name,
      designation: isStandard ? sig.designation : 'Other',
      customDesignation: isStandard ? '' : sig.designation,
      phone: sig.phone || '',
      email: sig.email || '',
      signature_url: sig.signature_url || '',
      stamp_url: sig.stamp_url || '',
      is_active: sig.is_active,
      applies_to: sig.applies_to || [],
      is_default_for: sig.is_default_for || [],
    });
    setIsModalOpen(true);
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userRole?.school_id) return;
    setUploadingSig(true);
    try {
      const url = await uploadFile('school-assets', `${userRole.school_id}/signatures/${Date.now()}_${file.name}`, file);
      setFormData(prev => ({ ...prev, signature_url: url }));
    } catch (err: any) {
      alert('Failed to upload signature image: ' + err.message);
    } finally {
      setUploadingSig(false);
    }
  };

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userRole?.school_id) return;
    setUploadingStamp(true);
    try {
      const url = await uploadFile('school-assets', `${userRole.school_id}/stamps/${Date.now()}_${file.name}`, file);
      setFormData(prev => ({ ...prev, stamp_url: url }));
    } catch (err: any) {
      alert('Failed to upload stamp image: ' + err.message);
    } finally {
      setUploadingStamp(false);
    }
  };

  const handleToggleAppliesTo = (docType: DocumentType) => {
    setFormData(prev => {
      const exists = prev.applies_to.includes(docType);
      const nextApplies = exists
        ? prev.applies_to.filter(d => d !== docType)
        : [...prev.applies_to, docType];

      // If removed from applies_to, also remove from is_default_for
      const nextDefault = exists
        ? prev.is_default_for.filter(d => d !== docType)
        : prev.is_default_for;

      return { ...prev, applies_to: nextApplies, is_default_for: nextDefault };
    });
  };

  const handleToggleDefault = (docType: DocumentType) => {
    setFormData(prev => {
      const exists = prev.is_default_for.includes(docType);
      const nextDefault = exists
        ? prev.is_default_for.filter(d => d !== docType)
        : [...prev.is_default_for, docType];

      // Automatically ensure it's in applies_to as well
      const nextApplies = prev.applies_to.includes(docType)
        ? prev.applies_to
        : [...prev.applies_to, docType];

      return { ...prev, is_default_for: nextDefault, applies_to: nextApplies };
    });
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter signatory name');
      return;
    }

    const finalDesignation = formData.designation === 'Other'
      ? (formData.customDesignation.trim() || 'Authorized Signatory')
      : formData.designation;

    const newId = editingId || `sig_${Date.now()}`;

    // If this signatory is marked default for some document types, unset other signatories for those defaults
    let updatedList = signatories.map(s => {
      if (s.id === editingId) return null; // will be replaced
      const cleanedDefaults = s.is_default_for?.filter(d => !formData.is_default_for.includes(d)) || [];
      return { ...s, is_default_for: cleanedDefaults };
    }).filter(Boolean) as AuthorizedSignatory[];

    const newEntry: AuthorizedSignatory = {
      id: newId,
      name: formData.name.trim(),
      designation: finalDesignation,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      signature_url: formData.signature_url,
      stamp_url: formData.stamp_url,
      is_active: formData.is_active,
      applies_to: formData.applies_to,
      is_default_for: formData.is_default_for,
      created_at: editingId ? undefined : new Date().toISOString(),
    };

    if (editingId) {
      updatedList = signatories.map(s => (s.id === editingId ? newEntry : {
        ...s,
        is_default_for: s.is_default_for?.filter(d => !formData.is_default_for.includes(d)) || []
      }));
    } else {
      updatedList.push(newEntry);
    }

    setSaving(true);
    const res = await saveSchoolSignatories(userRole!.school_id, updatedList);
    setSaving(false);

    if (res.success) {
      setSignatories(updatedList);
      setIsModalOpen(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert('Failed to save signatory: ' + (res.error?.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    const item = signatories.find(s => s.id === id);
    if (!confirm(`Are you sure you want to delete ${item?.name || 'this signatory'}?`)) return;

    const updatedList = signatories.filter(s => s.id !== id);
    setSaving(true);
    const res = await saveSchoolSignatories(userRole!.school_id, updatedList);
    setSaving(false);

    if (res.success) {
      setSignatories(updatedList);
    } else {
      alert('Failed to delete signatory: ' + (res.error?.message || ''));
    }
  };

  const handleToggleActive = async (id: string) => {
    const updatedList = signatories.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s);
    setSaving(true);
    const res = await saveSchoolSignatories(userRole!.school_id, updatedList);
    setSaving(false);

    if (res.success) {
      setSignatories(updatedList);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileSignature className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Authorized Signatories</h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Configure school authorities (Director, Principal, Admin, Accountant) who sign official appointment letters,
            experience certificates, fee challans, and credentials. Removes any hardcoded names across the system.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Check className="w-4 h-4" /> Saved!
            </span>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Signatory
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading authorized signatories...
          </div>
        ) : signatories.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <FileSignature className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Authorized Signatories Configured</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Add your school's Director, Principal, or Management personnel to ensure their exact names and designations appear on all printed contracts, certificates, and challans.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
            >
              <Plus className="w-4 h-4" /> Add First Signatory
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-black text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Signatory Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Digital Signature</th>
                  <th className="py-3 px-4">Applies To</th>
                  <th className="py-3 px-4">Default Role</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {signatories.map((sig) => (
                  <tr key={sig.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-black flex items-center justify-center text-xs">
                          {sig.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 text-sm leading-tight">{sig.name}</p>
                          {(sig.phone || sig.email) && (
                            <p className="text-[10px] text-slate-400 font-normal">
                              {[sig.phone, sig.email].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px]">
                        {sig.designation}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {sig.signature_url ? (
                        <div className="h-8 max-w-[100px] border border-slate-200 rounded p-1 bg-white flex items-center justify-center">
                          <img src={sig.signature_url} alt="Signature" className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">None (Physical)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(sig.applies_to || []).map((doc) => (
                          <span
                            key={doc}
                            className="text-[9.5px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md"
                          >
                            {DOCUMENT_TYPE_LABELS[doc] || doc}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(sig.is_default_for || []).map((doc) => (
                          <span
                            key={doc}
                            className="inline-flex items-center gap-1 text-[9.5px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md"
                          >
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            Default {DOCUMENT_TYPE_LABELS[doc] || doc}
                          </span>
                        ))}
                        {(!sig.is_default_for || sig.is_default_for.length === 0) && (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(sig.id)}
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full cursor-pointer transition ${
                          sig.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        {sig.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(sig)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-indigo-600 transition"
                          title="Edit Signatory"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sig.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"
                          title="Delete Signatory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide">
                  {editingId ? 'Edit Authorized Signatory' : 'Add Authorized Signatory'}
                </h3>
                <p className="text-[11px] text-indigo-100">Configure name, title and document authorizations</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ayesha Malik or Tariq Mehmood"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-indigo-600"
                />
              </div>

              {/* Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Designation / Title <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.designation}
                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-indigo-600"
                  >
                    {STANDARD_DESIGNATIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="Other">Other (Custom Title)...</option>
                  </select>
                </div>

                {formData.designation === 'Other' && (
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Custom Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Managing Trustee"
                      value={formData.customDesignation}
                      onChange={e => setFormData({ ...formData, customDesignation: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-indigo-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0300-1234567"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Signature Upload */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  Digital Signature Image (Optional)
                </label>
                <div className="flex items-center gap-3">
                  {formData.signature_url ? (
                    <div className="h-10 w-24 border border-slate-200 rounded bg-white p-1 flex items-center justify-center shrink-0">
                      <img src={formData.signature_url} alt="Signature" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : null}
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    {uploadingSig ? 'Uploading...' : formData.signature_url ? 'Change Signature' : 'Upload PNG'}
                    <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                  </label>
                  {formData.signature_url && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, signature_url: '' })}
                      className="text-xs text-red-500 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Tip: A transparent PNG signature automatically prints above the signature line on appointment letters and certificates.
                </p>
              </div>

              {/* Applies to Documents */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Document Authorizations (Applies To)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map(doc => {
                    const isChecked = formData.applies_to.includes(doc);
                    return (
                      <label
                        key={doc}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                          isChecked ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAppliesTo(doc)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{DOCUMENT_TYPE_LABELS[doc]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Default For */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Set as Primary Default Signatory For:
                </label>
                <div className="space-y-1.5">
                  {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map(doc => {
                    const isDefault = formData.is_default_for.includes(doc);
                    return (
                      <label
                        key={doc}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          isDefault ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isDefault}
                            onChange={() => handleToggleDefault(doc)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Default for {DOCUMENT_TYPE_LABELS[doc]}</span>
                        </div>
                        {isDefault && <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700">Active Signatory Status</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase transition ${
                    formData.is_active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {formData.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Signatory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
