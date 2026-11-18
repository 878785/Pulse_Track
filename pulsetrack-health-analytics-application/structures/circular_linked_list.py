"""Circular singly linked list used for live health-record management."""


class HealthRecordNode:
    def __init__(self, record):
        self.id = record.get("id")
        self.date = record["date"]
        self.steps = record["steps"]
        self.calories = record["calories"]
        self.sleep = record["sleep"]
        self.next = None

    def to_record(self):
        return {
            "id": self.id,
            "date": self.date,
            "steps": self.steps,
            "calories": self.calories,
            "sleep": self.sleep,
        }


class CircularLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.size = 0

    def add_record(self, record):
        if self.search_record(record["date"]):
            raise ValueError("A health record already exists for this date.")
        node = HealthRecordNode(record)
        if self.head is None:
            node.next = node
            self.head = self.tail = node
        else:
            node.next = self.head
            self.tail.next = node
            self.tail = node
        self.size += 1
        return node

    def search_record(self, key):
        if self.head is None:
            return None
        current = self.head
        for _ in range(self.size):
            if current.date == key or current.id == key:
                return current
            current = current.next
        return None

    def update_record(self, key, record):
        node = self.search_record(key)
        if node is None:
            return None
        duplicate = self.search_record(record["date"])
        if duplicate is not None and duplicate is not node:
            raise ValueError("A health record already exists for this date.")
        node.date = record["date"]
        node.steps = record["steps"]
        node.calories = record["calories"]
        node.sleep = record["sleep"]
        return node

    def delete_record(self, key):
        if self.head is None:
            return None
        previous = self.tail
        current = self.head
        for _ in range(self.size):
            if current.date == key or current.id == key:
                if self.size == 1:
                    self.head = self.tail = None
                else:
                    previous.next = current.next
                    if current is self.head:
                        self.head = current.next
                    if current is self.tail:
                        self.tail = previous
                    self.tail.next = self.head
                self.size -= 1
                current.next = None
                return current
            previous, current = current, current.next
        return None

    def traverse(self):
        records = []
        current = self.head
        for _ in range(self.size):
            records.append(current.to_record())
            current = current.next
        return records

    def get_all_records(self):
        return self.traverse()

    def clear(self):
        self.head = self.tail = None
        self.size = 0

    def is_valid(self):
        if self.size == 0:
            return self.head is None and self.tail is None
        if self.head is None or self.tail is None:
            return False
        current = self.head
        for _ in range(self.size):
            if current is None:
                return False
            current = current.next
        return current is self.head and self.tail.next is self.head
