import { GoogleGenAI, Type } from "@google/genai";

export type TaskScope = "PERSONAL" | "CLIENT";

export type TaskCategory =
  | "DEVELOPMENT"
  | "SOCIAL_MEDIA"
  | "LEAD_GENERATION"
  | "OPERATIONS"
  | "UI_UX_DESIGN"
  | "PERSONAL_ADMIN";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface SubTask {
  step: number;
  title: string;
  completed: boolean;
}

export interface ParsedTaskResult {
  title: string;
  description?: string;
  scope: TaskScope;
  category: TaskCategory;
  priority: TaskPriority;
  due_date: string | null;
  assignee_ids: string[];
  sub_tasks: SubTask[];
}

export interface TaskParsingContext {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  workspace?: {
    id: string;
    name?: string;
  };
  currentTime?: string;
}

const taskSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Concise, professional task title summarizing the objective",
    },
    description: {
      type: Type.STRING,
      description: "Brief contextual summary of the task requirements and intent",
    },
    scope: {
      type: Type.STRING,
      enum: ["PERSONAL", "CLIENT"],
      description:
        "PERSONAL if the task is an individual errand, private task, or self-assigned personal work. CLIENT for client projects, business deliverables, or shared work.",
    },
    category: {
      type: Type.STRING,
      enum: [
        "DEVELOPMENT",
        "SOCIAL_MEDIA",
        "LEAD_GENERATION",
        "OPERATIONS",
        "UI_UX_DESIGN",
        "PERSONAL_ADMIN",
      ],
      description: "Functional domain of the task",
    },
    priority: {
      type: Type.STRING,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      description:
        "Priority inferred from urgency words like 'asap', 'jaldi', 'urgent', 'priority', or deadline proximity",
    },
    due_date: {
      type: Type.STRING,
      description:
        "Resolved absolute ISO 8601 UTC timestamp string (e.g. 2026-09-21T17:00:00Z), or empty string if no deadline mentioned",
    },
    assignee_ids: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Array of matching user IDs strictly selected from the provided Team Members and Current User list",
    },
    sub_tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.INTEGER, description: "1-based step index" },
          title: { type: Type.STRING, description: "Specific actionable subtask step" },
          completed: { type: Type.BOOLEAN, description: "Default to false" },
        },
        required: ["step", "title", "completed"],
      },
      description:
        "Decomposed 2 to 6 step chronological breakdown required to complete the task",
    },
  },
  required: ["title", "scope", "category", "priority", "assignee_ids", "sub_tasks"],
};

export async function parseTaskWithGemini(
  input: string,
  context: TaskParsingContext
): Promise<ParsedTaskResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const referenceTime = context.currentTime || new Date().toISOString();

  // Format team members and user context for prompt
  const membersContext = context.teamMembers
    .map((m) => `- ID: "${m.id}", Name: "${m.name}", Email: "${m.email}", Role: "${m.role}"`)
    .join("\n");

  const workspaceInfo = context.workspace
    ? `- ID: "${context.workspace.id}", Name: "${context.workspace.name || "Default Workspace"}"`
    : `- ID: "default", Name: "Current Workspace"`;

  const prompt = `
You are an expert project management and task decomposition AI.
Your job is to parse natural language task descriptions (which may be in English, Hindi, Hinglish, or mixed) and extract structured task attributes with high-fidelity step decomposition.

### System & Time Context
- Current Reference Timestamp: ${referenceTime}
- Current Logged-in User: ID: "${context.currentUser.id}", Name: "${context.currentUser.name}", Email: "${context.currentUser.email}", Role: "${context.currentUser.role}"

### Active Workspace Information
${workspaceInfo}

### Active Workspace Team Members
${membersContext || "(No other team members in workspace)"}

### Extraction & Resolution Rules
1. **Assignee Resolution**:
   - Match names, first names, or nicknames in the input to the exact IDs in the Active Workspace Team Members or Current User.
   - Example: If input says "Rohit ko assign karo" and there is a member with Name "Rohit Sharma" (ID "usr_123"), set assignee_ids: ["usr_123"].
   - If self-assigned ("mujhe assign karo", "assign to me", "mera task"), use the current user ID ("${context.currentUser.id}").
   - If no assignee is mentioned, default to ["${context.currentUser.id}"].
2. **Scope**:
   - Set to "PERSONAL" if the task mentions personal work, personal errands (e.g. passport, doctor, personal bills, personal admin), or "mera personal task".
   - Set to "CLIENT" for any work done for a client, company, project, social media campaign, code development, etc.
   - IMPORTANT: If scope is "PERSONAL", assignee_ids MUST strictly be ["${context.currentUser.id}"].
3. **Deadline / Due Date Resolution**:
   - Relative deadlines like "kal" (tomorrow), "parso" (day after tomorrow), "aaj sham 5 baje" (today 5 PM), "kal sham 5 PM" (tomorrow 5 PM), "by Friday", etc., MUST be resolved relative to the Current Reference Timestamp (${referenceTime}).
   - Convert to ISO 8601 UTC string format (e.g. "2026-09-21T11:30:00Z" or "2026-09-21T17:00:00Z").
   - If no deadline is mentioned, return empty string "".
4. **Step Decomposition (sub_tasks)**:
   - Decompose the overall task into 2 to 6 concrete, logical, chronological steps.
   - Each step should have "step" (1, 2, 3...), "title" (actionable description in clear English), and "completed" (false).
5. **Category & Priority**:
   - Infer category from domain: DEVELOPMENT, SOCIAL_MEDIA, LEAD_GENERATION, OPERATIONS, UI_UX_DESIGN, PERSONAL_ADMIN.
   - Infer priority: URGENT (if urgent/asap/emergency), HIGH, MEDIUM (default), LOW.

### User Natural Language Input:
"${input}"
`.trim();

  // Robust candidate models with fallback (fast, high rate-limit, lowest-cost lite models first)
  const candidateModels = [
    "gemini-1.5-flash-8b",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
  ];
  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: taskSchema,
          temperature: 0.2,
        },
      });

      if (!response.text) {
        throw new Error("Empty response from Gemini API");
      }

      const parsed: ParsedTaskResult = JSON.parse(response.text);

      // Post-processing & sanitization
      const validMemberIds = new Set([
        ...context.teamMembers.map((m) => m.id),
        context.currentUser.id,
      ]);

      // Enforce personal scope isolation
      if (parsed.scope === "PERSONAL") {
        parsed.assignee_ids = [context.currentUser.id];
      } else {
        // Filter assignee IDs to only those belonging to current workspace
        parsed.assignee_ids = (parsed.assignee_ids || []).filter((id) =>
          validMemberIds.has(id)
        );
        if (parsed.assignee_ids.length === 0) {
          parsed.assignee_ids = [context.currentUser.id];
        }
      }

      // Sanitize due_date
      if (
        parsed.due_date &&
        typeof parsed.due_date === "string" &&
        parsed.due_date.trim().length > 0
      ) {
        parsed.due_date = parsed.due_date.trim();
      } else {
        parsed.due_date = null;
      }

      // Ensure subtasks are properly indexed
      if (Array.isArray(parsed.sub_tasks)) {
        parsed.sub_tasks = parsed.sub_tasks.map((st, idx) => ({
          step: typeof st.step === "number" ? st.step : idx + 1,
          title: String(st.title || `Step ${idx + 1}`),
          completed: Boolean(st.completed),
        }));
      } else {
        parsed.sub_tasks = [];
      }

      return parsed;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} failed, trying fallback if available:`, (err as Error)?.message || err);
    }
  }

  throw lastError || new Error("Failed to generate structured task with Gemini");
}
