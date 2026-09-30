/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class DLLNode<K> {
  public key: K;
  public prev: DLLNode<K> | null = null;
  public next: DLLNode<K> | null = null;

  constructor(key: K) {
    this.key = key;
  }
}

/**
 * DoublyLinkedList maintaining O(1) head insertion, node removal,
 * and node move-to-head for LRU Cache policy.
 */
export class DoublyLinkedList<K> {
  private head: DLLNode<K>;
  private tail: DLLNode<K>;
  private _size: number = 0;

  constructor() {
    // Sentinel dummy head and tail nodes
    this.head = new DLLNode<K>(null as unknown as K);
    this.tail = new DLLNode<K>(null as unknown as K);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  public get size(): number {
    return this._size;
  }

  public addToHead(node: DLLNode<K>): void {
    node.next = this.head.next;
    node.prev = this.head;
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
    this._size++;
  }

  public removeNode(node: DLLNode<K>): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = null;
    this._size = Math.max(0, this._size - 1);
  }

  public moveToHead(node: DLLNode<K>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  public removeTail(): DLLNode<K> | null {
    if (this._size === 0 || this.tail.prev === this.head) {
      return null;
    }
    const realTail = this.tail.prev;
    if (realTail) {
      this.removeNode(realTail);
      return realTail;
    }
    return null;
  }

  public getTail(): DLLNode<K> | null {
    if (this._size === 0 || this.tail.prev === this.head) {
      return null;
    }
    return this.tail.prev;
  }

  public getHead(): DLLNode<K> | null {
    if (this._size === 0 || this.head.next === this.tail) {
      return null;
    }
    return this.head.next;
  }

  public toArray(): K[] {
    const result: K[] = [];
    let curr = this.head.next;
    while (curr && curr !== this.tail) {
      result.push(curr.key);
      curr = curr.next;
    }
    return result;
  }

  public clear(): void {
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this._size = 0;
  }
}
