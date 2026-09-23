export type TodoStatus = 'todo' | 'doing' | 'done';

export interface Todo {
  id: number;
  title: string;
  category: string;
  due_date: string | null;
  status: TodoStatus;
  overdue: boolean;
  due_soon: boolean;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewTodo {
  title: string;
  category?: string;
  due_date?: string | null;
  status?: TodoStatus;
}