export default class Registry<C extends { dispose(): void }> {
  private contents;

  constructor() {
    this.contents = new Map<string, C>();
  }

  dispose() {
    this.contents.forEach((v) => v.dispose());
  }

  register(name: string, contents: C) {
    if (this.contents.has(name)) this.contents.get(name)?.dispose();
    this.contents.set(name, contents);
  }

  value(name: string) {
    return this.contents.get(name);
  }

  delete(name: string) {
    this.contents.get(name)?.dispose();
    this.contents.delete(name);
  }

  keys() {
    return this.contents.keys();
  }
}
