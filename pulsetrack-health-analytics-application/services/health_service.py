"""Coordinates SQLite persistence with the in-memory circular linked list."""

import threading

from database import db
from structures import CircularLinkedList


class HealthService:
    def __init__(self):
        db.initialize_database()
        self.records = CircularLinkedList()
        self.lock = threading.RLock()
        self.reload()

    def reload(self):
        with self.lock:
            self.records.clear()
            for record in db.fetch_all_records():
                self.records.add_record(record)

    def get_all_records(self):
        with self.lock:
            return self.records.get_all_records()

    def search_records(self, query):
        term = query.strip().casefold()
        with self.lock:
            results = []
            current = self.records.head
            for _ in range(self.records.size):
                values = (current.date, current.steps, current.calories, current.sleep)
                if any(term in str(value).casefold() for value in values):
                    results.append(current.to_record())
                current = current.next
            return results

    def get_record(self, date):
        with self.lock:
            node = self.records.search_record(date)
            return node.to_record() if node else None

    def add_record(self, record):
        with self.lock:
            node = self.records.add_record(record)
            try:
                node.id = db.insert_record(record)
            except Exception:
                self.records.delete_record(record["date"])
                raise
            return node.to_record()

    def update_record(self, date, record):
        with self.lock:
            node = self.records.search_record(date)
            if node is None:
                return None
            old_record = node.to_record()
            updated = self.records.update_record(date, record)
            try:
                if not db.update_record(old_record["id"], record):
                    self.reload()
                    return None
            except Exception:
                self.reload()
                raise
            updated.id = old_record["id"]
            return updated.to_record()

    def delete_record(self, date):
        with self.lock:
            node = self.records.delete_record(date)
            if node is None:
                return None
            try:
                if not db.delete_record(node.id):
                    self.reload()
                    return None
            except Exception:
                self.reload()
                raise
            return node.to_record()

    def clear_records(self):
        with self.lock:
            db.delete_all_records()
            self.records.clear()

    def stats(self):
        records = self.get_all_records()
        count = len(records)
        if not count:
            return {
                "count": 0, "totalSteps": 0, "totalCalories": 0, "totalSleep": 0,
                "avgSteps": 0, "avgCalories": 0, "avgSleep": 0,
                "maxSteps": 0, "minSteps": 0, "maxCalories": 0, "minCalories": 0,
                "maxSleep": 0, "minSleep": 0, "bestDate": None,
            }
        steps = [record["steps"] for record in records]
        calories = [record["calories"] for record in records]
        sleep = [record["sleep"] for record in records]
        return {
            "count": count,
            "totalSteps": sum(steps),
            "totalCalories": sum(calories),
            "totalSleep": round(sum(sleep), 1),
            "avgSteps": round(sum(steps) / count),
            "avgCalories": round(sum(calories) / count),
            "avgSleep": round(sum(sleep) / count, 1),
            "maxSteps": max(steps),
            "minSteps": min(steps),
            "maxCalories": max(calories),
            "minCalories": min(calories),
            "maxSleep": max(sleep),
            "minSleep": min(sleep),
            "bestDate": records[steps.index(max(steps))]["date"],
        }


health_service = HealthService()
