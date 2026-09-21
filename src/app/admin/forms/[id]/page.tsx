"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DropdownSelect from "@/components/DropdownSelect";

interface SchemaField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "number" | "select" | "url";
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select type
}

interface FormProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  useDefaultSchema: boolean;
  isActive: boolean;
  createdAt: string;
  schema: { fields: SchemaField[] } | null;
  apiKey: { apiKey: string; isActive: boolean; lastUsed: string | null } | null;
  _count: { submissions: number };
}

interface Submission {
  id: string;
  data: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
  emailVerified: boolean | null;
  emailMx: string | null;
  createdAt: string;
}

const DEFAULT_FIELDS: SchemaField[] = [
  { key: "name", label: "Full Name", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "tel", required: false },
  { key: "message", label: "Message", type: "textarea", required: true },
  { key: "subject", label: "Subject", type: "text", required: false },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "textarea", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "url", label: "URL" },
];

export default function FormProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<FormProject | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"submissions" | "schema" | "settings" | "embed">("submissions");

  // Schema editor state
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [savingSchema, setSavingSchema] = useState(false);

  // Settings state
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectActive, setProjectActive] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // API Key state
  const [showApiKey, setShowApiKey] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);

  // Confirm modal states
  const [confirmAction, setConfirmAction] = useState<{ type: "resetSchema" | "rotateKey" | "deleteSubmission"; id?: string } | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/forms/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setSchemaFields(data.project.schema?.fields || [...DEFAULT_FIELDS]);
        setProjectName(data.project.name);
        setProjectDesc(data.project.description || "");
        setProjectActive(data.project.isActive);
      } else {
        router.push("/admin/forms");
      }
    } catch (err) {
      console.error("Failed to fetch project:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  const fetchSubmissions = useCallback(
    async (page = 1) => {
      try {
        const res = await fetch(
          `/api/admin/forms/projects/${projectId}/submissions?page=${page}&limit=50`
        );
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data.submissions || []);
          setPagination(data.pagination);
        }
      } catch (err) {
        console.error("Failed to fetch submissions:", err);
      }
    },
    [projectId]
  );

  useEffect(() => {
    fetchProject();
    fetchSubmissions();
  }, [fetchProject, fetchSubmissions]);

  // Schema management
  const addField = () => {
    const newKey = `field_${Date.now()}`;
    setSchemaFields([
      ...schemaFields,
      { key: newKey, label: "New Field", type: "text", required: false },
    ]);
  };

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const updated = [...schemaFields];
    updated[index] = { ...updated[index], ...updates };
    setSchemaFields(updated);
  };

  const removeField = (index: number) => {
    setSchemaFields(schemaFields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...schemaFields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setSchemaFields(newFields);
  };

  const saveSchema = async () => {
    setSavingSchema(true);
    try {
      const res = await fetch(`/api/admin/forms/projects/${projectId}/schema`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: schemaFields, useDefaultSchema: false }),
      });
      if (res.ok) fetchProject();
    } catch (err) {
      console.error("Failed to save schema:", err);
    } finally {
      setSavingSchema(false);
    }
  };

  const resetToDefault = async () => {
    setConfirmAction({ type: "resetSchema" });
  };

  const confirmResetSchema = async () => {
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/admin/forms/projects/${projectId}/schema`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSchemaFields([...DEFAULT_FIELDS]);
        fetchProject();
      }
    } catch (err) {
      console.error("Failed to reset schema:", err);
    }
  };

  // Settings
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/admin/forms/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: projectDesc,
          isActive: projectActive,
        }),
      });
      if (res.ok) fetchProject();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  // API Key
  const rotateApiKey = async () => {
    setConfirmAction({ type: "rotateKey" });
  };

  const confirmRotateKey = async () => {
    setConfirmAction(null);
    setRotatingKey(true);
    try {
      const res = await fetch(`/api/admin/forms/projects/${projectId}/api-key`, {
        method: "POST",
      });
      if (res.ok) fetchProject();
    } catch (err) {
      console.error("Failed to rotate API key:", err);
    } finally {
      setRotatingKey(false);
    }
  };

  const toggleApiKey = async (isActive: boolean) => {
    try {
      await fetch(`/api/admin/forms/projects/${projectId}/api-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      fetchProject();
    } catch (err) {
      console.error("Failed to toggle API key:", err);
    }
  };

  const deleteSubmission = async (submissionId: string) => {
    setConfirmAction({ type: "deleteSubmission", id: submissionId });
  };

  const confirmDeleteSubmission = async () => {
    if (!confirmAction?.id) return;
    const submissionId = confirmAction.id;
    setConfirmAction(null);
    try {
      await fetch(
        `/api/admin/forms/projects/${projectId}/submissions?submissionId=${submissionId}`,
        { method: "DELETE" }
      );
      fetchSubmissions(pagination.page);
      fetchProject();
    } catch (err) {
      console.error("Failed to delete submission:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  const effectiveFields = project.useDefaultSchema ? DEFAULT_FIELDS : schemaFields;
  const endpointUrl = `/api/forms/${project.slug}/submit`;
  const fullEndpointUrl = typeof window !== "undefined" ? `${window.location.origin}${endpointUrl}` : endpointUrl;

  // Get all unique keys from submissions for dynamic columns
  const submissionKeys = Array.from(
    new Set(submissions.flatMap((s) => Object.keys(s.data)))
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/forms" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition">
          FormBridge
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-white font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{project.name}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {project._count.submissions} submissions · Endpoint:{" "}
            <code className="text-[11px] bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded font-mono">
              {endpointUrl}
            </code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              project.isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {project.isActive ? "Active" : "Inactive"}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              project.useDefaultSchema
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
            }`}
          >
            {project.useDefaultSchema ? "Default Schema" : "Custom Schema"}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {[
          { key: "submissions", label: "Submissions", count: project._count.submissions },
          { key: "schema", label: "Schema Builder" },
          { key: "embed", label: "Embed & API" },
          { key: "settings", label: "Settings" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-100 dark:bg-zinc-800">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Submissions Tab */}
      {activeTab === "submissions" && (
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No submissions yet</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Submit a test form using the endpoint URL to see data here
              </p>
            </div>
          ) : (
            <>
              {/* Submissions Table */}
              <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto admin-scroll">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">
                          Date
                        </th>
                        {effectiveFields.map((field) => (
                          <th
                            key={field.key}
                            className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400"
                          >
                            {field.label}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">
                          Email Verified
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => (
                        <tr
                          key={sub.id}
                          className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition"
                        >
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                            {new Date(sub.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          {effectiveFields.map((field) => (
                            <td key={field.key} className="px-4 py-3 text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate">
                              {sub.data[field.key] || (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            {sub.emailVerified !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  sub.emailVerified
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-red-500/10 text-red-500"
                                }`}
                              >
                                {sub.emailVerified ? "✓ Verified" : "✗ Failed"}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteSubmission(sub.id)}
                              className="p-1 text-zinc-400 hover:text-red-500 rounded transition cursor-pointer"
                              title="Delete submission"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1}–
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                      {pagination.total}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => fetchSubmissions(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => fetchSubmissions(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Schema Builder Tab */}
      {activeTab === "schema" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Schema Fields</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Define what fields your form submissions will contain
                </p>
              </div>
              <div className="flex gap-2">
                {project.useDefaultSchema && (
                  <button
                    onClick={resetToDefault}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Reset to Default
                  </button>
                )}
                <button
                  onClick={addField}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
                >
                  + Add Field
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {schemaFields.map((field, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                  {/* Drag handle & move buttons */}
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button
                      onClick={() => moveField(index, "up")}
                      disabled={index === 0}
                      className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveField(index, "down")}
                      disabled={index === schemaFields.length - 1}
                      className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Key</label>
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => updateField(index, { key: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Label</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Type</label>
                      <DropdownSelect
                        value={field.type}
                        onChange={(val) =>
                          updateField(index, { type: val as SchemaField["type"] })
                        }
                        options={FIELD_TYPES}
                        size="sm"
                        accentColor="blue"
                        align="left"
                        minWidth="140px"
                        className="w-full"
                        buttonClassName="w-full justify-between bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(index, { required: e.target.checked })}
                          className="rounded border-zinc-300 dark:border-zinc-700"
                        />
                        Required
                      </label>
                      <button
                        onClick={() => removeField(index)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition cursor-pointer ml-auto"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Select options editor */}
                  {field.type === "select" && (
                    <div className="w-full mt-2">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                        Options (comma separated)
                      </label>
                      <input
                        type="text"
                        value={field.options?.join(", ") || ""}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Option 1, Option 2, Option 3"
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={saveSchema}
                disabled={savingSchema}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
              >
                {savingSchema ? "Saving..." : "Save Schema"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embed & API Tab */}
      {activeTab === "embed" && (
        <div className="space-y-4">
          {/* Endpoint URL */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">API Endpoint</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-700 dark:text-zinc-300 font-mono break-all">
                POST {fullEndpointUrl}
              </code>
              <button
                onClick={() => copyToClipboard(fullEndpointUrl)}
                className="px-4 py-3 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          {/* cURL Example */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">cURL Example</h3>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -X POST ${fullEndpointUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${project.apiKey?.apiKey || "YOUR_API_KEY"}" \\
  -d '${JSON.stringify(
    Object.fromEntries(effectiveFields.map((f) => [f.key, f.type === "email" ? "john@example.com" : f.type === "tel" ? "+1234567890" : `Test ${f.label}`])),
    null,
    2
  )}'`}
            </pre>
            <button
              onClick={() =>
                copyToClipboard(`curl -X POST ${fullEndpointUrl} -H "Content-Type: application/json" -H "X-Api-Key: ${project.apiKey?.apiKey || "YOUR_API_KEY"}" -d '${JSON.stringify(Object.fromEntries(effectiveFields.map((f) => [f.key, f.type === "email" ? "john@example.com" : f.type === "tel" ? "+1234567890" : `Test ${f.label}`])))}'`)
              }
              className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Copy cURL Command
            </button>
          </div>

          {/* JavaScript Example */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">JavaScript / Fetch</h3>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
{`const response = await fetch("${fullEndpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": "${project.apiKey?.apiKey || "YOUR_API_KEY"}",
  },
  body: JSON.stringify({
    ${effectiveFields.map((f) => `    ${f.key}: "${f.type === "email" ? "john@example.com" : f.type === "tel" ? "+1234567890" : `Your ${f.label.toLowerCase()}`}"}`).join(",\n")}
  }),
});

const data = await response.json();
console.log(data);`}
            </pre>
          </div>

          {/* HTML Form Embed */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">HTML Form (Auto-submit)</h3>
            <p className="text-xs text-zinc-500 mb-3">
              Copy this HTML to embed a form on any website. It will auto-submit to your FormBridge endpoint.
            </p>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
{`<form action="${fullEndpointUrl}" method="POST">
  <input type="hidden" name="_json" value="true" />
${effectiveFields
  .map(
    (f) =>
      `  <label>${f.label}${f.required ? " *" : ""}</label>\n  <${
        f.type === "textarea" ? `textarea name="${f.key}"${f.required ? " required" : ""}></textarea>` :
        f.type === "select" ? `select name="${f.key}"${f.required ? " required" : ""}>\n${(f.options || []).map(o => `    <option value="${o}">${o}</option>`).join("\n")}\n  </select>` :
        `input type="${f.type}" name="${f.key}"${f.required ? " required" : ""} placeholder="${f.placeholder || f.label}"}`
      }`
  )
  .join("\n\n")}
  <button type="submit">Submit</button>
</form>`}
            </pre>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          {/* General Settings */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">General Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={projectActive}
                    onChange={(e) => setProjectActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-200 dark:bg-zinc-700 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {projectActive ? "Project is active" : "Project is disabled"}
                </span>
              </div>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">API Key</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Current Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-700 dark:text-zinc-300 font-mono">
                    {showApiKey
                      ? project.apiKey?.apiKey || "No key"
                      : project.apiKey?.apiKey
                          ? "•".repeat(20) + project.apiKey.apiKey.slice(-8)
                          : "No key"}
                  </code>
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    {showApiKey ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => copyToClipboard(project.apiKey?.apiKey || "")}
                    className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  </button>
                </div>
              </div>
              {project.apiKey?.lastUsed && (
                <p className="text-xs text-zinc-500">
                  Last used: {new Date(project.apiKey.lastUsed).toLocaleString()}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleApiKey(!project.apiKey?.isActive)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    project.apiKey?.isActive
                      ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20"
                  }`}
                >
                  {project.apiKey?.isActive ? "Disable Key" : "Enable Key"}
                </button>
                <button
                  onClick={rotateApiKey}
                  disabled={rotatingKey}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer disabled:opacity-50"
                >
                  {rotatingKey ? "Generating..." : "Rotate Key"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white text-center mb-2">
              {confirmAction.type === "resetSchema" && "Reset Schema?"}
              {confirmAction.type === "rotateKey" && "Rotate API Key?"}
              {confirmAction.type === "deleteSubmission" && "Delete Submission?"}
            </h2>
            <p className="text-sm text-zinc-500 text-center mb-6">
              {confirmAction.type === "resetSchema" && "This will remove all custom fields and reset to default schema."}
              {confirmAction.type === "rotateKey" && "The old API key will stop working immediately. A new key will be generated."}
              {confirmAction.type === "deleteSubmission" && "Are you sure you want to delete this submission? This action cannot be undone."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer">Cancel</button>
              <button
                onClick={() => {
                  if (confirmAction.type === "resetSchema") confirmResetSchema();
                  else if (confirmAction.type === "rotateKey") confirmRotateKey();
                  else if (confirmAction.type === "deleteSubmission") confirmDeleteSubmission();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
