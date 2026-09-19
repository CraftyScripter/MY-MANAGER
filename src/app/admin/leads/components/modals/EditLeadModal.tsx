"use client";
import { useState } from "react";
import type { Lead } from "../../types";
import { STATUS_OPTIONS } from "../../constants";

import DropdownSelect from "@/components/DropdownSelect";

export default function EditLeadModal({ lead, isNew, onClose, onSuccess, tabId }: {
  lead: Lead;
  isNew: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  tabId: string;
}) {
  const [formData, setFormData] = useState({
    businessName: lead.businessName,
    phone: lead.phone || "",
    email: lead.email || "",
    address: lead.address || "",
    website: lead.website || "",
    category: lead.category || "",
    rating: lead.rating?.toString() || "",
    reviews: lead.reviews?.toString() || "",
    status: lead.status,
    sourceUrl: lead.sourceUrl || "",
    notes: lead.notes || "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!formData.businessName.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        tabId,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        reviews: formData.reviews ? parseInt(formData.reviews, 10) : null,
      };

      const url = isNew ? "/api/admin/leads" : `/api/admin/leads/${lead.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        onSuccess(saved);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{isNew ? "Add Lead" : "Edit Lead"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">&times;</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Business Name *</label><input type="text" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Phone</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div className="col-span-2"><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Address</label><input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Website</label><input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Category</label><input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Rating</label><input type="number" step="0.1" min="0" max="5" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Reviews</label><input type="number" min="0" value={formData.reviews} onChange={(e) => setFormData({ ...formData, reviews: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div>
              <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Status</label>
              <DropdownSelect
                value={formData.status}
                onChange={(val) => setFormData({ ...formData, status: val })}
                options={STATUS_OPTIONS.map((s) => ({ label: s.label, value: s.value }))}
                size="md"
                align="left"
                className="w-full"
              />
            </div>
            <div className="col-span-2"><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Source URL</label><input type="url" value={formData.sourceUrl} onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" /></div>
            <div className="col-span-2"><label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 resize-none transition" /></div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={!formData.businessName.trim() || saving} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-sm">{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
