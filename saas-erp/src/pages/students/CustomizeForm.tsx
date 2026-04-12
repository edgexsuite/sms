import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Plus, Trash2, Save, Layout, ToggleLeft } from 'lucide-react';

interface CustomField {
  id?: string;
  field_label: string;
  field_type: string;
  section_name: string;
  is_required: boolean;
  options: string[]; // parsed from jsonb
}

export default function CustomizeForm() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'visibility' | 'custom_fields'>('visibility');

  // Built-in sections visibility config
  const [sectionsConfig, setSectionsConfig] = useState({
    parent_info: true,
    admission_info: true,
    medical_info: true,
    insurance_info: true
  });

  // Custom Fields array
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  
  // New Field Form
  const [newField, setNewField] = useState<CustomField>({
    field_label: '',
    field_type: 'text',
    section_name: 'basic_info',
    is_required: false,
    options: []
  });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchFormSettings();
      fetchCustomFields();
    }
  }, [userRole]);

  const fetchFormSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('form_settings')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('form_name', 'student_admission')
        .single();

      if (data && data.sections_config) {
        setSectionsConfig({ ...sectionsConfig, ...data.sections_config });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('form_name', 'student_admission')
        .order('created_at', { ascending: true });

      if (data) {
        setCustomFields(data.map(d => ({
          ...d,
          options: d.options ? JSON.parse(d.options) : []
        })));
      }
    } catch (err) {
      console.error('Error fetching custom fields:', err);
    }
  };

  const handleSaveVisibility = async () => {
    setLoading(true);
    try {
      // Upsert logic
      const { data: existing } = await supabase
        .from('form_settings')
        .select('id')
        .eq('school_id', userRole?.school_id)
        .eq('form_name', 'student_admission')
        .single();

      if (existing) {
        await supabase.from('form_settings').update({ sections_config: sectionsConfig }).eq('id', existing.id);
      } else {
        await supabase.from('form_settings').insert([{
          school_id: userRole?.school_id,
          form_name: 'student_admission',
          sections_config: sectionsConfig
        }]);
      }
      alert('Section visibility updated successfully!');
    } catch (err) {
      alert('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async () => {
    if (!newField.field_label.trim()) return alert('Please enter a field label');
    
    try {
      const { data, error } = await supabase.from('custom_fields').insert([{
        school_id: userRole?.school_id,
        form_name: 'student_admission',
        section_name: newField.section_name,
        field_label: newField.field_label,
        field_type: newField.field_type,
        is_required: newField.is_required,
        options: newField.field_type === 'select' ? JSON.stringify(newField.options) : null
      }]).select().single();

      if (error) throw error;
      
      setCustomFields([...customFields, { ...newField, id: data.id }]);
      setNewField({ field_label: '', field_type: 'text', section_name: 'basic_info', is_required: false, options: [] });
    } catch (err) {
      alert('Failed to add custom field.');
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom field? Existing data will not be shown on the form anymore.')) return;

    try {
      await supabase.from('custom_fields').delete().eq('id', id);
      setCustomFields(customFields.filter(f => f.id !== id));
    } catch (err) {
      alert('Failed to delete field.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" /> Form Customizer
          </h1>
          <p className="text-gray-500 text-sm mt-1">Configure exactly how your student admission form looks and operates.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button 
            className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'visibility' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('visibility')}
          >
            Built-in Section Visibility
          </button>
          <button 
            className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'custom_fields' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('custom_fields')}
          >
            Custom Field Builder
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'visibility' ? (
            <div className="space-y-6 max-w-2xl">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                <Layout className="w-5 h-5 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-800">Toggle which core sections appear on your school's admission form. Standard fields like "Student Name" and "Roll Number" cannot be disabled.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-semibold text-gray-900">Parental Information</h4>
                    <p className="text-sm text-gray-500">Father's details, Mother's details, Qualifications, and Employment variables.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={sectionsConfig.parent_info} onChange={(e) => setSectionsConfig({...sectionsConfig, parent_info: e.target.checked})} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-semibold text-gray-900">Admission Details (Previous Schooling)</h4>
                    <p className="text-sm text-gray-500">Fields asking for Last School Attended, Reason for Choosing, Remarks.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={sectionsConfig.admission_info} onChange={(e) => setSectionsConfig({...sectionsConfig, admission_info: e.target.checked})} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-semibold text-gray-900">Medical Information</h4>
                    <p className="text-sm text-gray-500">Detailed health block tracking eyesights, allergies, contagious diseases, etc.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={sectionsConfig.medical_info} onChange={(e) => setSectionsConfig({...sectionsConfig, medical_info: e.target.checked})} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-semibold text-gray-900">Insurance Opt-In</h4>
                    <p className="text-sm text-gray-500">Checkbox asking parents to opt-in for an insurance plan.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={sectionsConfig.insurance_info} onChange={(e) => setSectionsConfig({...sectionsConfig, insurance_info: e.target.checked})} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button onClick={handleSaveVisibility} disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Save className="w-4 h-4" /> Save Visibilities
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Build New Field Form */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-gray-400" /> Create New Field
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Field Label *</label>
                    <input type="text" value={newField.field_label} onChange={(e) => setNewField({...newField, field_label: e.target.value})} placeholder="e.g. Household Income" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Render As (Type)</label>
                    <select value={newField.field_type} onChange={(e) => setNewField({...newField, field_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white">
                      <option value="text">Short Text</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown Select</option>
                      <option value="checkbox">Checkbox (True/False)</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Place In Section</label>
                    <select value={newField.section_name} onChange={(e) => setNewField({...newField, section_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white">
                      <option value="basic_info">Student Basic Info</option>
                      <option value="parent_info">Parent Information</option>
                      <option value="medical_info">Medical Information</option>
                    </select>
                  </div>
                  <div className="md:col-span-1 flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={newField.is_required} onChange={(e) => setNewField({...newField, is_required: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                      Required Field
                    </label>
                  </div>
                </div>
                
                {/* Dynamic Options for Select Type */}
                {newField.field_type === 'select' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Dropdown Options (Comma Separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Red, Blue, Green" 
                      value={newField.options.join(', ')} 
                      onChange={(e) => setNewField({...newField, options: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm" 
                    />
                  </div>
                )}
                
                <div className="mt-6">
                  <button onClick={handleAddField} className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors">
                    Add Custom Field
                  </button>
                </div>
              </div>

              {/* List of custom fields */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-4">Your Custom Fields</h3>
                {customFields.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-gray-200 border-dashed rounded-lg">
                    <p className="text-sm text-gray-500">No custom fields created yet. The form will only show standard built-in columns.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 font-medium text-gray-700">Label</th>
                          <th className="p-3 font-medium text-gray-700">Type</th>
                          <th className="p-3 font-medium text-gray-700">Appears In</th>
                          <th className="p-3 font-medium text-gray-700">Required</th>
                          <th className="p-3 font-medium text-gray-700 text-right">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {customFields.map((field) => (
                          <tr key={field.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-900">{field.field_label}</td>
                            <td className="p-3">
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-mono tracking-wide uppercase">
                                {field.field_type} {field.field_type === 'select' && `[${field.options.length} options]`}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600 capitalize">{(field.section_name || '').replace('_', ' ')}</td>
                            <td className="p-3">
                              {field.is_required ? <span className="text-red-600 font-medium text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}
                            </td>
                            <td className="p-3 text-right">
                              <button onClick={() => handleDeleteField(field.id!)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
