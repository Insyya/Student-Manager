export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${API_BASE}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new ApiError(`Could not initialize secure session (${res.status})`, res.status);
  }
  const data = (await res.json()) as { csrf_token: string };
  csrfToken = data.csrf_token;
  return csrfToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", await ensureCsrfToken());
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && path.startsWith("/api/students")) {
      csrfToken = null;
      window.dispatchEvent(new Event("auth-expired"));
    }
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export type Student = { name: string; marks: number };
export type User = { id: number; email: string };
type AuthResponse = { user: User };

export type Statistics = {
  total_students: number;
  average_marks: number;
  highest_marks: number | null;
  lowest_marks: number | null;
  passed_students: number;
  failed_students: number;
};

export type RankingEntry = {
  rank: number;
  name: string;
  marks: number;
  grade: string;
};

export type SearchResult = {
  name: string;
  marks: number;
  grade: string;
};

export type AddStudentResponse = {
  message: string;
  student: SearchResult;
};

export type UpdateNameResponse = {
  message: string;
  old_name: string;
  new_name: string;
};

export type UpdateMarksResponse = {
  message: string;
  student: SearchResult;
};

export type DeleteStudentResponse = {
  message: string;
  name: string;
};

export const api = {
  getCurrentUser: async (): Promise<User | null> =>
    (await request<{ user: User | null }>("/api/auth/me")).user,

  signup: (email: string, password: string): Promise<AuthResponse> =>
    request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    }),

  login: (email: string, password: string): Promise<AuthResponse> =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: async (): Promise<void> => {
    await request("/api/auth/logout", { method: "POST" });
    csrfToken = null;
  },

  getStudents: (): Promise<Record<string, number>> =>
    request("/api/students"),

  getStatistics: (): Promise<Statistics> =>
    request("/api/students/statistics"),

  getRanking: (): Promise<RankingEntry[]> =>
    request("/api/students/ranking"),

  searchStudents: (name: string): Promise<SearchResult[]> =>
    request(`/api/students/search?name=${encodeURIComponent(name)}`),

  addStudent: (name: string, marks: number): Promise<AddStudentResponse> =>
    request("/api/students", {
      method: "POST",
      body: JSON.stringify({ name, marks }),
    }),

  updateName: (oldName: string, newName: string): Promise<UpdateNameResponse> =>
    request("/api/students/update-name", {
      method: "PUT",
      body: JSON.stringify({ old_name: oldName, new_name: newName }),
    }),

  updateMarks: (
    name: string,
    oldMarks: number,
    marks: number,
  ): Promise<UpdateMarksResponse> =>
    request("/api/students/update-marks", {
      method: "PUT",
      body: JSON.stringify({ name, old_marks: oldMarks, marks }),
    }),

  deleteStudent: (name: string): Promise<DeleteStudentResponse> =>
    request(`/api/students/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
};
