import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TodoService } from './services/todo.service';

type Filter = 'all' | 'active' | 'done';
type SortBy = 'newest' | 'oldest' | 'active-first';

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  readonly todoService = inject(TodoService);
  readonly newTitle = signal('');
  readonly filter = signal<Filter>('all');
  readonly search = signal('');
  readonly sortBy = signal<SortBy>('newest');
  readonly darkMode = signal(false);

  constructor() {
    this.darkMode.set(
      typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    );
    effect(() => {
      document.documentElement.classList.toggle('dark', this.darkMode());
    });
  }

  readonly doneCount = computed(
    () => this.todoService.totalCount() - this.todoService.remainingCount()
  );
  readonly progress = computed(() => {
    const total = this.todoService.totalCount();
    if (total === 0) return 0;
    return Math.round((this.doneCount() / total) * 100);
  });
  readonly filteredTodos = computed(() => {
    const q = this.search().trim().toLowerCase();
    let todos = this.todoService.todos();
    if (this.filter() === 'active') todos = todos.filter((t) => !t.completed);
    if (this.filter() === 'done') todos = todos.filter((t) => t.completed);
    if (q) todos = todos.filter((t) => t.title.toLowerCase().includes(q));
    const sorted = [...todos];
    switch (this.sortBy()) {
      case 'oldest':
        sorted.sort((a, b) => a.id - b.id);
        break;
      case 'active-first':
        sorted.sort((a, b) => Number(a.completed) - Number(b.completed) || b.id - a.id);
        break;
      default:
        sorted.sort((a, b) => b.id - a.id);
        break;
    }
    return sorted;
  });

  ngOnInit(): void {
    void this.todoService.fetchTodos();
  }

  addTodo(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    void this.todoService.addTodo(title).then(() => this.newTitle.set(''));
  }

  async clearCompleted(): Promise<void> {
    const done = this.todoService.todos().filter((t) => t.completed);
    for (const t of done) {
      await this.todoService.deleteTodo(t.id);
    }
  }
}
