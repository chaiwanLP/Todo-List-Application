import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TodoService } from './services/todo.service';
import { TodoStatus } from './models/todo.model';

type Filter = 'all' | 'todo' | 'doing' | 'due-soon' | 'overdue' | 'done';
type SortBy = 'due-first' | 'newest' | 'oldest' | 'active-first';

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  readonly todoService = inject(TodoService);
  readonly newTitle = signal('');
  readonly newCategory = signal('');
  readonly newDueDate = signal('');
  readonly newDueTime = signal('');
  readonly filter = signal<Filter>('all');
  readonly search = signal('');
  readonly sortBy = signal<SortBy>('due-first');
  readonly darkMode = signal(false);
  readonly pageSize = 10;
  readonly page = signal(1);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  @HostListener('window:keydown', ['$event'])
  focusSearch(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    const typing =
      el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
    if (e.key === '/' && !typing) {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
    if (e.key === 'Escape' && this.search()) {
      this.search.set('');
      this.searchInput?.nativeElement.blur();
    }
  }

  constructor() {
    this.darkMode.set(
      typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches === true,
    );
    effect(() => {
      document.documentElement.classList.toggle('dark', this.darkMode());
    });
    // เปลี่ยนกรอง/ค้น/เรียง -> กลับหน้า 1
    effect(() => {
      this.filter();
      this.search();
      this.sortBy();
      this.page.set(1);
    });
  }

  readonly doneCount = computed(
    () => this.todoService.totalCount() - this.todoService.remainingCount(),
  );
  readonly progress = computed(() => {
    const total = this.todoService.totalCount();
    if (total === 0) return 0;
    return Math.round((this.doneCount() / total) * 100);
  });
  readonly categories = computed(() => {
    const set = new Map<string, number>();
    for (const t of this.todoService.todos()) {
      const c = (t.category || 'ทั่วไป').trim() || 'ทั่วไป';
      set.set(c, (set.get(c) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  });
  readonly filteredTodos = computed(() => {
    const q = this.search().trim().toLowerCase();
    let todos = this.todoService.todos();
    const f = this.filter();
    if (f === 'todo') todos = todos.filter((t) => t.status === 'todo');
    if (f === 'doing') todos = todos.filter((t) => t.status === 'doing');
    if (f === 'done') todos = todos.filter((t) => t.status === 'done');
    if (f === 'overdue') todos = todos.filter((t) => t.overdue);
    if (f === 'due-soon') todos = todos.filter((t) => t.due_soon);
    if (q) {
      todos = todos.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q),
      );
    }
    const sorted = [...todos];
    const dueVal = (d: string | null) => (d ? new Date(d).getTime() : Number.MAX_SAFE_INTEGER);
    switch (this.sortBy()) {
      case 'oldest':
        sorted.sort((a, b) => a.id - b.id);
        break;
      case 'active-first':
        sorted.sort(
          (a, b) => Number(a.status === 'done') - Number(b.status === 'done') || b.id - a.id,
        );
        break;
      case 'newest':
        sorted.sort((a, b) => b.id - a.id);
        break;
      default:
        sorted.sort((a, b) => dueVal(a.due_date) - dueVal(b.due_date) || b.id - a.id);
        break;
    }
    return sorted;
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredTodos().length / this.pageSize)),
  );
  readonly currentPage = computed(() => Math.min(Math.max(1, this.page()), this.totalPages()));
  readonly pagedTodos = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredTodos().slice(start, start + this.pageSize);
  });
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, 2, cur - 1, cur, cur + 1, total - 1, total]);
    return [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  });
  readonly showingFrom = computed(() =>
    this.filteredTodos().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1,
  );
  readonly showingTo = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredTodos().length),
  );

  goToPage(n: number): void {
    this.page.set(Math.min(Math.max(1, n), this.totalPages()));
  }

  ngOnInit(): void {
    void this.todoService.fetchTodos();
  }

  private buildDueIso(): string | null {
    if (!this.newDueDate()) return null;
    const time = this.newDueTime() || '23:59';
    const d = new Date(`${this.newDueDate()}T${time}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  addTodo(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    const payload = {
      category: this.newCategory().trim(),
      due_date: this.buildDueIso(),
    };
    void this.todoService.addTodo(title, payload).then(() => {
      this.newTitle.set('');
      this.newCategory.set('');
      this.newDueDate.set('');
      this.newDueTime.set('');
    });
  }

  setStatus(id: number, status: TodoStatus): void {
    void this.todoService.setStatus(id, status);
  }

  formatDue(iso: string | null): string {
    if (!iso) return 'ไม่มีกำหนด';
    const d = new Date(iso);
    return d.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async clearCompleted(): Promise<void> {
    const done = this.todoService.todos().filter((t) => t.status === 'done');
    for (const t of done) {
      await this.todoService.deleteTodo(t.id);
    }
  }
}
