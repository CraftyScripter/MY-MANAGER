"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import DropdownSelect, { DropdownOption } from "@/components/DropdownSelect";

interface SubTask {
  step: number;
  title: string;
  completed: boolean;
}

interface TaskItem {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  description: string | null;
  scope: "PERSONAL" | "CLIENT";
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  due_date: string | null;
  assignee_ids: string[];
  sub_tasks: SubTask[];
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const CATEGORIES = [
  { value: "DEVELOPMENT", label: "Development", icon: "💻", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { value: "SOCIAL_MEDIA", label: "Social Media", icon: "📱", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20" },
  { value: "LEAD_GENERATION", label: "Lead Generation", icon: "🎯", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  { value: "OPERATIONS", label: "Operations", icon: "⚙️", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "UI_UX_DESIGN", label: "UI/UX Design", icon: "🎨", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  { value: "PERSONAL_ADMIN", label: "Personal Admin", icon: "🔒", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low", icon: "🟢", badge: "LOW", badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "MEDIUM", label: "Medium", icon: "🟡", badge: "MED", badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { value: "HIGH", label: "High", icon: "🟠", badge: "HIGH", badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30", color: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20" },
  { value: "URGENT", label: "Urgent", icon: "🔴", badge: "CRITICAL", badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30", color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20" },
];

const SAMPLE_PROMPTS = [
  {
    icon: "🎨",
    tag: "Instagram Post",
    tagClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    title: "Client Instagram Post",
    prompt: "Client X ke liye Instagram post design karna hai, Rohit ko assign karo, kal sham 5 PM tak complete chahiye",
  },
  {
    icon: "🛂",
    tag: "Personal",
    tagClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    title: "Passport Renewal",
    prompt: "Mera personal task hai: passport renewal form submit karna, next Monday tak",
  },
  {
    icon: "💳",
    tag: "Bug Fix",
    tagClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    title: "Checkout 500 Error",
    prompt: "Website checkout payment gateway error fix karna hai, high priority",
  },
  {
    icon: "📊",
    tag: "Reporting",
    tagClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    title: "Weekly Analytics",
    prompt: "Weekly client analytics report compile karo aur Friday 3 PM tak share karo",
  },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // View Mode: Grid Cards or Kanban Board
  const [viewMode, setViewMode] = useState<"grid" | "kanban">("grid");

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  // Filter & Search State
  const [activeTab, setActiveTab] = useState<"ALL" | "CLIENT" | "PERSONAL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Modal State for Side-by-Side Task Creator / Review / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalScope, setModalScope] = useState<"PERSONAL" | "CLIENT">("CLIENT");
  const [modalCategory, setModalCategory] = useState("OPERATIONS");
  const [modalPriority, setModalPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [modalDueDate, setModalDueDate] = useState<string>("");
  const [modalAssignees, setModalAssignees] = useState<string[]>([]);
  const [modalSubTasks, setModalSubTasks] = useState<SubTask[]>([]);
  const [modalStatus, setModalStatus] = useState<"TODO" | "IN_PROGRESS" | "DONE">("TODO");
  const [isSaving, setIsSaving] = useState(false);

  // Expand/collapse subtasks on cards
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Toast message
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, membersRes] = await Promise.all([
        fetch("/api/v1/tasks"),
        fetch("/api/v1/tasks/members"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
        }
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
      showToast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle AI Parse
  const handleAiParse = async (promptToUse?: string) => {
    const text = promptToUse !== undefined ? promptToUse : aiPrompt;
    if (!text || text.trim().length === 0) return;

    try {
      setIsAiParsing(true);
      setAiError(null);

      const res = await fetch("/api/v1/tasks/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse task with AI");
      }

      const parsed = data.task;

      // Populate right-side form with parsed result
      setModalTitle(parsed.title || "");
      setModalDescription(parsed.description || "");
      setModalScope(parsed.scope || "CLIENT");
      setModalCategory(parsed.category || "OPERATIONS");
      setModalPriority(parsed.priority || "MEDIUM");

      // Format due date for datetime-local input
      if (parsed.due_date) {
        const d = new Date(parsed.due_date);
        if (!isNaN(d.getTime())) {
          const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setModalDueDate(iso);
        } else {
          setModalDueDate("");
        }
      } else {
        setModalDueDate("");
      }

      setModalAssignees(parsed.assignee_ids || (currentUser ? [currentUser.id] : []));
      setModalSubTasks(parsed.sub_tasks || []);
      setModalStatus("TODO");

      showToast("Task decomposed! Review details and confirm on the right.");
    } catch (err) {
      console.error("AI parse error:", err);
      setAiError((err as Error).message || "AI parsing failed. Please try again.");
    } finally {
      setIsAiParsing(false);
    }
  };

  // Open Unified Modal for New Task / AI Creation
  const openNewTaskModal = (focusAi = false) => {
    setEditingTaskId(null);
    setModalTitle("");
    setModalDescription("");
    setModalScope("CLIENT");
    setModalCategory("OPERATIONS");
    setModalPriority("MEDIUM");
    setModalDueDate("");
    setModalAssignees(currentUser ? [currentUser.id] : []);
    setModalSubTasks([
      { step: 1, title: "Requirement analysis & setup", completed: false },
      { step: 2, title: "Execution & delivery", completed: false },
    ]);
    setModalStatus("TODO");
    setAiError(null);
    setIsModalOpen(true);

    if (focusAi) {
      setTimeout(() => {
        aiInputRef.current?.focus();
      }, 150);
    }
  };

  // Open Modal to Edit existing Task
  const openEditTaskModal = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setModalTitle(task.title);
    setModalDescription(task.description || "");
    const isPersonal = task.scope === "PERSONAL" || task.is_private;
    setModalScope(isPersonal ? "PERSONAL" : "CLIENT");
    setModalCategory(task.category);
    setModalPriority(task.priority);

    if (task.due_date) {
      const d = new Date(task.due_date);
      if (!isNaN(d.getTime())) {
        const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setModalDueDate(iso);
      } else {
        setModalDueDate("");
      }
    } else {
      setModalDueDate("");
    }

    setModalAssignees(task.assignee_ids);
    setModalSubTasks(task.sub_tasks || []);
    setModalStatus(task.status as "TODO" | "IN_PROGRESS" | "DONE");
    setAiError(null);
    setIsModalOpen(true);
  };

  // Save Task (Create or Update)
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      showToast("Please enter a task title", "error");
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        title: modalTitle.trim(),
        description: modalDescription.trim() || null,
        scope: modalScope,
        category: modalCategory,
        priority: modalPriority,
        due_date: modalDueDate ? new Date(modalDueDate).toISOString() : null,
        assignee_ids: modalScope === "PERSONAL" ? (currentUser ? [currentUser.id] : []) : modalAssignees,
        sub_tasks: modalSubTasks.filter((st) => st.title.trim().length > 0),
        status: modalStatus,
      };

      let res: Response;
      if (editingTaskId) {
        res = await fetch(`/api/v1/tasks/${editingTaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/v1/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save task");
      }

      showToast(editingTaskId ? "Task updated successfully!" : "Task created successfully!");
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Save task error:", err);
      showToast((err as Error).message || "Failed to save task", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Subtask Completion directly from card
  const handleToggleSubtask = async (taskId: string, stepIndex: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedSubTasks = task.sub_tasks.map((st, idx) =>
      idx === stepIndex ? { ...st, completed: !st.completed } : st
    );

    const completedCount = updatedSubTasks.filter((st) => st.completed).length;
    let newStatus = task.status;
    if (completedCount === updatedSubTasks.length && updatedSubTasks.length > 0) {
      newStatus = "DONE";
    } else if (completedCount > 0 && task.status === "TODO") {
      newStatus = "IN_PROGRESS";
    }

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, sub_tasks: updatedSubTasks, status: newStatus }
          : t
      )
    );

    try {
      await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subTasks: updatedSubTasks,
          status: newStatus,
        }),
      });
    } catch (err) {
      console.error("Failed to update subtask:", err);
      fetchData();
    }
  };

  // Update Task Status
  const handleStatusChange = async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "DONE") => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      fetchData();
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    setConfirmDeleteTask(taskId);
  };

  const confirmDeleteTaskAction = async () => {
    if (!confirmDeleteTask) return;
    const taskId = confirmDeleteTask;
    setConfirmDeleteTask(null);

    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      showToast("Task deleted successfully");
    } catch (err) {
      console.error("Delete task error:", err);
      showToast("Failed to delete task", "error");
      fetchData();
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tab filter
      const isPersonal = t.scope === "PERSONAL" || t.is_private;
      if (activeTab === "CLIENT" && isPersonal) return false;
      if (activeTab === "PERSONAL" && !isPersonal) return false;

      // Status filter
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;

      // Priority filter
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = (t.description || "").toLowerCase().includes(q);
        const matchesSubtasks = t.sub_tasks.some((st) =>
          st.title.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesDesc && !matchesSubtasks) return false;
      }

      return true;
    });
  }, [tasks, activeTab, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const personal = tasks.filter((t) => t.scope === "PERSONAL" || t.is_private).length;
    return { total, inProgress, done, personal };
  }, [tasks]);

  // Dropdown Options for Modal (Site Theme)
  const modalScopeOptions: DropdownOption[] = [
    {
      label: "Client Deliverable (Shared)",
      value: "CLIENT",
      icon: "🏢",
      badge: "SHARED",
      badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30",
      description: "Visible to active workspace team members",
    },
    {
      label: "Personal Task (Private 🔒)",
      value: "PERSONAL",
      icon: "🔒",
      badge: "PRIVATE",
      badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30",
      description: "Only visible to you, strictly hidden from others",
    },
  ];

  const modalCategoryOptions: DropdownOption[] = CATEGORIES.map((c) => ({
    label: c.label,
    value: c.value,
    icon: c.icon,
  }));

  const modalPriorityOptions: DropdownOption[] = PRIORITIES.map((p) => ({
    label: p.label,
    value: p.value,
    icon: p.icon,
    badge: p.badge,
    badgeClass: p.badgeClass,
  }));

  // Dropdown Options for Filter Toolbar
  const statusOptions: DropdownOption[] = [
    { label: "All Statuses", value: "ALL" },
    { label: "To Do", value: "TODO", icon: "⚪" },
    { label: "In Progress", value: "IN_PROGRESS", icon: "🔵" },
    { label: "Completed", value: "DONE", icon: "🟢" },
  ];

  const priorityOptions: DropdownOption[] = [
    { label: "All Priorities", value: "ALL" },
    { label: "Urgent", value: "URGENT", icon: "🔴", badge: "CRITICAL", badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30" },
    { label: "High", value: "HIGH", icon: "🟠", badge: "HIGH", badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30" },
    { label: "Medium", value: "MEDIUM", icon: "🟡", badge: "MED", badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30" },
    { label: "Low", value: "LOW", icon: "🟢", badge: "LOW", badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" },
  ];

  const categoryOptions: DropdownOption[] = [
    { label: "All Categories", value: "ALL" },
    ...CATEGORIES.map((c) => ({ label: c.label, value: c.value, icon: c.icon })),
  ];

  // Dropdown Options for Task Card Status Changer
  const cardStatusOptions: DropdownOption[] = [
    { label: "To Do", value: "TODO", icon: "⚪", badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700" },
    { label: "In Progress", value: "IN_PROGRESS", icon: "🔵", badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30" },
    { label: "Completed", value: "DONE", icon: "🟢", badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" },
  ];

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setCategoryFilter("ALL");
    setSearchQuery("");
  };

  // Helper for quick deadlines
  const setQuickDeadline = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setModalDueDate(formatted);
  };

  // Render a Single Task Card (Shared between Grid & Kanban views)
  const renderTaskCard = (task: TaskItem) => {
    const cat = CATEGORIES.find((c) => c.value === task.category) || {
      label: task.category,
      icon: "📌",
      color: "bg-zinc-800 text-zinc-300 border-zinc-700",
    };
    const prio = PRIORITIES.find((p) => p.value === task.priority) || {
      label: task.priority,
      icon: "⚪",
      color: "bg-zinc-800 text-zinc-300 border-zinc-700",
    };

    const completedSteps = task.sub_tasks.filter((st) => st.completed).length;
    const totalSteps = task.sub_tasks.length;
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const isExpanded = Boolean(expandedTasks[task.id]);

    // Format Due Date
    let dueDateDisplay: { text: string; isOverdue: boolean } | null = null;
    if (task.due_date) {
      const d = new Date(task.due_date);
      if (!isNaN(d.getTime())) {
        const now = new Date();
        const isOverdue = d.getTime() < now.getTime() && task.status !== "DONE";
        dueDateDisplay = {
          text: d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          isOverdue,
        };
      }
    }

    const priorityBorderColor =
      task.priority === "URGENT"
        ? "border-t-rose-500"
        : task.priority === "HIGH"
        ? "border-t-orange-500"
        : task.priority === "MEDIUM"
        ? "border-t-amber-500"
        : "border-t-emerald-500";

    return (
      <div
        key={task.id}
        className={`group rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 p-5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md space-y-4 border-t-2 ${priorityBorderColor}`}
      >
        <div className="space-y-3">
          {/* Card Header Badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {task.scope === "PERSONAL" || task.is_private ? (
                <span className="text-[11px] px-2.5 py-0.5 rounded-lg font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  PERSONAL
                </span>
              ) : (
                <span className="text-[11px] px-2.5 py-0.5 rounded-lg font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                  <span>🏢</span>
                  CLIENT
                </span>
              )}

              <span className={`text-[11px] px-2 py-0.5 rounded-lg font-medium border flex items-center gap-1 ${cat.color}`}>
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </span>
            </div>

            <span className={`text-[11px] px-2 py-0.5 rounded-lg font-semibold border flex items-center gap-1 ${prio.color}`}>
              <span>{prio.icon}</span>
              <span>{prio.label}</span>
            </span>
          </div>

          {/* Title & Description */}
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Due Date & Assignees */}
          <div className="flex items-center justify-between text-xs pt-1 text-zinc-500 dark:text-zinc-400">
            {dueDateDisplay ? (
              <div
                className={`flex items-center gap-1.5 ${
                  dueDateDisplay.isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{dueDateDisplay.text}</span>
                {dueDateDisplay.isOverdue && <span className="text-[10px] uppercase tracking-wider">(Overdue)</span>}
              </div>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-600">No deadline</span>
            )}

            {/* Assignee initials */}
            <div className="flex items-center -space-x-1.5">
              {task.assignee_ids.map((id) => {
                const m = members.find((mem) => mem.id === id);
                const initial = m ? m.name.charAt(0).toUpperCase() : "U";
                return (
                  <div
                    key={id}
                    title={m ? `${m.name} (${m.role})` : id}
                    className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-[10px] font-bold text-white flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-sm"
                  >
                    {initial}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Decomposition Checklist (Collapsible) */}
          {totalSteps > 0 && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2">
              <button
                onClick={() =>
                  setExpandedTasks((prev) => ({ ...prev, [task.id]: !isExpanded }))
                }
                className="w-full flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    Subtasks ({completedSteps}/{totalSteps})
                  </span>
                  <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {isExpanded ? "Hide ▲" : "Show ▼"}
                </span>
              </button>

              {isExpanded && (
                <div className="space-y-1.5 pt-1">
                  {task.sub_tasks.map((st, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white cursor-pointer group/st p-1.5 rounded-lg hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={() => handleToggleSubtask(task.id, idx)}
                        className="mt-0.5 rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-white dark:focus:ring-offset-zinc-900 cursor-pointer"
                      />
                      <span
                        className={`flex-1 transition-all ${
                          st.completed ? "line-through text-zinc-400 dark:text-zinc-500" : ""
                        }`}
                      >
                        {st.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer: Status & Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
          {/* Site-Themed Dropdown for Status */}
          <DropdownSelect
            value={task.status}
            onChange={(val) =>
              handleStatusChange(task.id, val as "TODO" | "IN_PROGRESS" | "DONE")
            }
            options={cardStatusOptions}
            size="sm"
            align="left"
            minWidth="130px"
            buttonClassName={`!text-[11px] !font-semibold !px-2.5 !h-7.5 !rounded-lg border ${
              task.status === "DONE"
                ? "!bg-emerald-50 dark:!bg-emerald-950/40 !text-emerald-700 dark:!text-emerald-400 !border-emerald-200 dark:!border-emerald-500/30"
                : task.status === "IN_PROGRESS"
                ? "!bg-sky-50 dark:!bg-sky-950/40 !text-sky-700 dark:!text-sky-400 !border-sky-200 dark:!border-sky-500/30"
                : "!bg-zinc-100 dark:!bg-zinc-900 !text-zinc-700 dark:!text-zinc-300 !border-zinc-200 dark:!border-zinc-700/80"
            }`}
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => openEditTaskModal(task)}
              title="Edit Task"
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => handleDeleteTask(task.id)}
              title="Delete Task"
              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            toast.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              : "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          {toast.type === "error" ? (
            <svg className="w-5 h-5 text-rose-500 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Confirm Delete Task Modal */}
      {confirmDeleteTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white text-center mb-2">Delete Task?</h2>
            <p className="text-sm text-zinc-500 text-center mb-6">Are you sure you want to delete this task? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteTask(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer">Cancel</button>
              <button onClick={confirmDeleteTaskAction} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 shadow-sm">
              <svg className="w-6 h-6 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
                Task Management
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 font-semibold tracking-wide">
                  AI-Powered
                </span>
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                Natural language task creation with step decomposition & strict multi-tenant isolation
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Generate with AI & New Task */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => openNewTaskModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer active:scale-97"
          >
            <svg className="w-4 h-4 text-pink-200 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Generate with AI</span>
          </button>

          <button
            onClick={() => openNewTaskModal(false)}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer active:scale-97 shadow-xs"
          >
            <svg className="w-4 h-4 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Total Tasks</span>
            <span className="text-zinc-400 dark:text-zinc-600 text-sm">📋</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1.5">{metrics.total}</div>
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 shadow-xs hover:border-sky-500/30 transition-colors">
          <div className="text-xs font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center justify-between">
            <span>In Progress</span>
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
          </div>
          <div className="text-2xl font-bold text-sky-600 dark:text-sky-300 mt-1.5">{metrics.inProgress}</div>
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 shadow-xs hover:border-emerald-500/30 transition-colors">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Completed</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-sm">✓</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-1.5">{metrics.done}</div>
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 shadow-xs hover:border-purple-500/30 transition-colors">
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center justify-between">
            <span>Personal (Private)</span>
            <span className="text-purple-600 dark:text-purple-400 text-sm">🔒</span>
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-300 mt-1.5">{metrics.personal}</div>
        </div>
      </div>

      {/* Consolidated Toolbar: Scope Tabs + Search + Dropdown Filters + View Toggle */}
      <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmented Control Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-950/80 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "ALL"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              All Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab("CLIENT")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "CLIENT"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Client Deliverables ({tasks.filter((t) => t.scope === "CLIENT").length})
            </button>
            <button
              onClick={() => setActiveTab("PERSONAL")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "PERSONAL"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Personal Only ({metrics.personal})
            </button>
          </div>

          {/* Search Bar & Dropdown Filters (Unified Right Group) */}
          <div className="flex items-center gap-2.5 flex-wrap lg:flex-nowrap flex-1 lg:justify-end">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs min-w-[180px]">
              <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, subtasks..."
                className="w-full pl-9 pr-7 py-1.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 h-9 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Dropdown (Site-Themed) */}
            <DropdownSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="Status"
              size="md"
              minWidth="140px"
              accentColor="indigo"
              buttonClassName="text-xs font-medium"
            />

            {/* Priority Dropdown (Site-Themed) */}
            <DropdownSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={priorityOptions}
              placeholder="Priority"
              size="md"
              minWidth="145px"
              accentColor="indigo"
              buttonClassName="text-xs font-medium"
            />

            {/* Category Dropdown (Site-Themed) */}
            <DropdownSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              placeholder="Category"
              size="md"
              minWidth="160px"
              accentColor="indigo"
              buttonClassName="text-xs font-medium"
            />

            {/* View Switcher: Grid vs Kanban */}
            <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid Cards View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                title="Kanban Board View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "kanban"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </button>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                title="Reset all filters"
                className="h-9 px-2.5 rounded-xl bg-white hover:bg-zinc-50 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-700/80 transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Task List / Grid / Kanban View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500 space-y-3">
          <svg className="w-9 h-9 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Loading workspace tasks...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-zinc-900/40 border border-zinc-200/90 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-200">No tasks found</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL" || priorityFilter !== "ALL"
                ? "Try adjusting your filters or search query."
                : "Create your first task or use AI natural language creation in seconds."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => openNewTaskModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-97"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Generate with AI</span>
            </button>
            <button
              onClick={() => openNewTaskModal(false)}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-transparent text-xs font-medium transition-colors cursor-pointer active:scale-97 shadow-xs"
            >
              + Create Manually
            </button>
          </div>
        </div>
      ) : viewMode === "kanban" ? (
        /* Kanban Board View (3 Columns) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: To Do */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">To Do</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {filteredTasks.filter((t) => t.status === "TODO").length}
              </span>
            </div>
            <div className="space-y-4">
              {filteredTasks
                .filter((t) => t.status === "TODO")
                .map((task) => renderTaskCard(task))}
              {filteredTasks.filter((t) => t.status === "TODO").length === 0 && (
                <div className="text-center py-8 border border-dashed border-zinc-300 dark:border-zinc-800/60 rounded-2xl text-xs text-zinc-400 dark:text-zinc-600">
                  No tasks to do
                </div>
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-900/60 border border-sky-200 dark:border-sky-900/30 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">In Progress</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40">
                {filteredTasks.filter((t) => t.status === "IN_PROGRESS").length}
              </span>
            </div>
            <div className="space-y-4">
              {filteredTasks
                .filter((t) => t.status === "IN_PROGRESS")
                .map((task) => renderTaskCard(task))}
              {filteredTasks.filter((t) => t.status === "IN_PROGRESS").length === 0 && (
                <div className="text-center py-8 border border-dashed border-zinc-300 dark:border-zinc-800/60 rounded-2xl text-xs text-zinc-400 dark:text-zinc-600">
                  No tasks in progress
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-900/60 border border-emerald-200 dark:border-emerald-900/30 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Completed</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                {filteredTasks.filter((t) => t.status === "DONE").length}
              </span>
            </div>
            <div className="space-y-4">
              {filteredTasks
                .filter((t) => t.status === "DONE")
                .map((task) => renderTaskCard(task))}
              {filteredTasks.filter((t) => t.status === "DONE").length === 0 && (
                <div className="text-center py-8 border border-dashed border-zinc-300 dark:border-zinc-800/60 rounded-2xl text-xs text-zinc-400 dark:text-zinc-600">
                  No completed tasks yet
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map((task) => renderTaskCard(task))}
        </div>
      )}

      {/* Unified Side-by-Side Task Creator & AI Copilot Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 lg:p-6 overflow-y-auto">
          <div className="relative w-full max-w-5xl xl:max-w-6xl bg-white dark:bg-zinc-950/95 border border-zinc-200 dark:border-zinc-800/90 rounded-3xl shadow-2xl shadow-indigo-950/20 dark:shadow-indigo-950/40 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Top Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 shadow-sm">
                  <svg className="w-5 h-5 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    {editingTaskId ? "Edit Task" : "Task Creator & AI Copilot"}
                    {!editingTaskId && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 font-semibold tracking-wide uppercase">
                        AI-POWERED
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {editingTaskId
                      ? "Update attributes or modify subtask checklist"
                      : "Describe your task naturally on the left or customize directly on the right"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Side-by-Side Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800/80 overflow-y-auto flex-1">
              {/* Left Column: AI Assistant (42%) */}
              <div className="lg:col-span-5 p-6 bg-slate-50/80 dark:bg-zinc-950/80 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 font-semibold text-sm">
                      <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-300 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent font-bold">
                        AI Task Copilot
                      </span>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 font-medium">
                      🌐 EN / HI / Hinglish
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Type your task naturally. Gemini will decompose it into chronological subtasks, resolve assignees, and set priorities on the right.
                  </p>

                  <div className="space-y-2">
                    <textarea
                      ref={aiInputRef}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          handleAiParse();
                        }
                      }}
                      rows={4}
                      placeholder="e.g. Client X ke liye Instagram post design karna hai, Rohit ko assign karo, kal sham 5 PM tak complete chahiye..."
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-xs sm:text-sm resize-none shadow-xs"
                    />

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-[10px] text-zinc-600 dark:text-zinc-400">Ctrl</kbd>
                        <span>+</span>
                        <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-[10px] text-zinc-600 dark:text-zinc-400">Enter</kbd>
                        <span>to decompose</span>
                      </span>
                      <span>{aiPrompt.length} chars</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAiParse()}
                      disabled={isAiParsing || !aiPrompt.trim()}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
                    >
                      {isAiParsing ? (
                        <>
                          <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Decomposing with AI...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span>Decompose & Auto-Fill</span>
                        </>
                      )}
                    </button>
                  </div>

                  {aiError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-3 py-2 rounded-xl">
                      {aiError}
                    </p>
                  )}

                  {/* Sleek Quick Prompts */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Quick Prompts
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {SAMPLE_PROMPTS.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setAiPrompt(item.prompt);
                            handleAiParse(item.prompt);
                          }}
                          className="text-left p-2.5 rounded-xl bg-white dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800/90 hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-all cursor-pointer group flex items-start gap-2.5 shadow-xs"
                        >
                          <span className="text-base shrink-0 group-hover:scale-110 transition-transform">
                            {item.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                {item.title}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium border shrink-0 ${item.tagClass}`}>
                                {item.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                              {item.prompt}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Feature Highlights */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/60 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span>Automatic step decomposition checklist</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span>Context-aware team member assignment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span>Relative date & time resolution</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Task Form (58%) */}
              <div className="lg:col-span-7 p-6 bg-white dark:bg-zinc-950 flex flex-col justify-between space-y-5 overflow-y-auto">
                <form onSubmit={handleSaveTask} className="space-y-4.5">
                  {/* Task Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={modalTitle}
                      onChange={(e) => setModalTitle(e.target.value)}
                      placeholder="e.g. Design Instagram Post for Client X"
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all shadow-xs"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Description / Context
                    </label>
                    <textarea
                      rows={2}
                      value={modalDescription}
                      onChange={(e) => setModalDescription(e.target.value)}
                      placeholder="Brief summary or context..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 resize-none transition-all shadow-xs"
                    />
                  </div>

                  {/* Scope & Category (Site-Themed DropdownSelect) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                        <span>Scope</span>
                        <span className="text-[10px] text-zinc-500 font-normal lowercase">
                          (personal is private)
                        </span>
                      </label>
                      <DropdownSelect
                        value={modalScope}
                        onChange={(v) => setModalScope(v as "PERSONAL" | "CLIENT")}
                        options={modalScopeOptions}
                        size="lg"
                        align="left"
                        accentColor="indigo"
                        className="w-full"
                        buttonClassName="text-xs sm:text-sm font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Category
                      </label>
                      <DropdownSelect
                        value={modalCategory}
                        onChange={setModalCategory}
                        options={modalCategoryOptions}
                        size="lg"
                        align="left"
                        accentColor="indigo"
                        className="w-full"
                        buttonClassName="text-xs sm:text-sm font-medium"
                      />
                    </div>
                  </div>

                  {/* Priority & Due Date (Site-Themed DropdownSelect) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Priority
                      </label>
                      <DropdownSelect
                        value={modalPriority}
                        onChange={(v) => setModalPriority(v as any)}
                        options={modalPriorityOptions}
                        size="lg"
                        align="left"
                        accentColor="indigo"
                        className="w-full"
                        buttonClassName="text-xs sm:text-sm font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Due Date & Time
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              const tmrw = new Date();
                              tmrw.setDate(tmrw.getDate() + 1);
                              tmrw.setHours(17, 0, 0, 0);
                              const pad = (n: number) => String(n).padStart(2, "0");
                              setModalDueDate(`${tmrw.getFullYear()}-${pad(tmrw.getMonth() + 1)}-${pad(tmrw.getDate())}T17:00`);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                          >
                            Tomorrow 5 PM
                          </button>
                          <span className="text-zinc-400 dark:text-zinc-600">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              const in3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                              in3.setHours(18, 0, 0, 0);
                              const pad = (n: number) => String(n).padStart(2, "0");
                              setModalDueDate(`${in3.getFullYear()}-${pad(in3.getMonth() + 1)}-${pad(in3.getDate())}T18:00`);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                          >
                            +3 Days
                          </button>
                        </div>
                      </div>
                      <input
                        type="datetime-local"
                        value={modalDueDate}
                        onChange={(e) => setModalDueDate(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Assignees (Hidden if PERSONAL) */}
                  {modalScope === "CLIENT" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                        <span>Assignee(s)</span>
                        <span className="text-[10px] text-zinc-500 font-normal">
                          {modalAssignees.length} selected
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 max-h-32 overflow-y-auto">
                        {members.map((m) => {
                          const isSelected = modalAssignees.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setModalAssignees((prev) => prev.filter((id) => id !== m.id));
                                } else {
                                  setModalAssignees((prev) => [...prev, m.id]);
                                }
                              }}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? "bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500 shadow-xs"
                                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200 shadow-xs"
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">
                                {m.name.charAt(0).toUpperCase()}
                              </span>
                              <span>{m.name}</span>
                              <span className="text-[10px] text-zinc-500">({m.role})</span>
                              {isSelected && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Subtasks & Step Decomposition */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Subtasks & Steps ({modalSubTasks.length})</span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
                          Chronological breakdown
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setModalSubTasks((prev) => [
                            ...prev,
                            { step: prev.length + 1, title: "", completed: false },
                          ])
                        }
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium cursor-pointer flex items-center gap-1 hover:underline"
                      >
                        <span>+ Add Step</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {modalSubTasks.map((st, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                        >
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <input
                            type="text"
                            value={st.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModalSubTasks((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, title: val } : item
                                )
                              );
                            }}
                            placeholder={`Step ${idx + 1} action...`}
                            className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setModalSubTasks((prev) => prev.filter((_, i) => i !== idx))
                            }
                            title="Remove step"
                            className="opacity-60 group-hover:opacity-100 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-transparent text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50 active:scale-98"
                    >
                      {isSaving ? "Saving..." : editingTaskId ? "Update Task" : "Confirm & Save Task"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
