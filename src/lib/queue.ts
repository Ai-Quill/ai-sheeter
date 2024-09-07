type Task = () => Promise<void>;

class Queue {
  private tasks: Task[] = [];
  private running = false;

  add(task: Task) {
    this.tasks.push(task);
    this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;

    while (this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (task) {
        await task();
      }
    }

    this.running = false;
  }
}

export const queue = new Queue();