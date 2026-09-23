import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { NewTodo, Todo, TodoStatus } from '../models/todo.model';

interface ApiListResponse {
  data: Todo[];
}
interface ApiItemResponse {
  data: Todo;
}

@Injectable({ providedIn: 'root' })
export class TodoService {
  private readonly apiUrl = `${environment.apiBaseUrl}/todos`;

  readonly todos = signal<Todo[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly totalCount = computed(() => this.todos().length);
  readonly remainingCount = computed(() => this.todos().filter((t) => t.status !== 'done').length);
  readonly doingCount = computed(() => this.todos().filter((t) => t.status === 'doing').length);
  readonly overdueCount = computed(() => this.todos().filter((t) => t.overdue).length);
  readonly dueSoonCount = computed(() => this.todos().filter((t) => t.due_soon).length);

  constructor(private http: HttpClient) {}

  async fetchTodos(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const res = await firstValueFrom(this.http.get<ApiListResponse>(this.apiUrl));
      this.todos.set(res.data);
    } catch (err) {
      this.errorMessage.set('ไม่สามารถโหลดรายการ Todo ได้ กรุณาตรวจสอบว่า API server เปิดอยู่');
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async addTodo(title: string, extra?: Omit<NewTodo, 'title'>): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) return;
    const body: NewTodo = { title: trimmed, ...extra };
    try {
      const res = await firstValueFrom(
        this.http.post<ApiItemResponse>(this.apiUrl, body)
      );
      this.todos.update((list) => [res.data, ...list]);
    } catch (err) {
      this.errorMessage.set('ไม่สามารถเพิ่มรายการได้');
      console.error(err);
    }
  }

  async setStatus(id: number, status: TodoStatus): Promise<void> {
    const prev = this.todos();
    this.todos.update((list) =>
      list.map((t) =>
        t.id === id
          ? { ...t, status, completed: status === 'done', overdue: false }
          : t
      )
    );
    try {
      const res = await firstValueFrom(
        this.http.patch<ApiItemResponse>(`${this.apiUrl}/${id}/status`, { status })
      );
      this.todos.update((list) => list.map((t) => (t.id === id ? res.data : t)));
    } catch (err) {
      this.todos.set(prev);
      this.errorMessage.set('ไม่สามารถอัปเดตสถานะได้');
      console.error(err);
    }
  }

  async toggleTodo(id: number): Promise<void> {
    const prev = this.todos();
    this.todos.update((list) =>
      list.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              status: !t.completed ? 'done' : 'todo',
            }
          : t
      )
    );
    try {
      const res = await firstValueFrom(
        this.http.patch<ApiItemResponse>(`${this.apiUrl}/${id}/toggle`, {})
      );
      this.todos.update((list) => list.map((t) => (t.id === id ? res.data : t)));
    } catch (err) {
      this.todos.set(prev);
      this.errorMessage.set('ไม่สามารถอัปเดตสถานะได้');
      console.error(err);
    }
  }

  async deleteTodo(id: number): Promise<void> {
    const prev = this.todos();
    this.todos.update((list) => list.filter((t) => t.id !== id));
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
    } catch (err) {
      this.todos.set(prev);
      this.errorMessage.set('ไม่สามารถลบรายการได้');
      console.error(err);
    }
  }
}