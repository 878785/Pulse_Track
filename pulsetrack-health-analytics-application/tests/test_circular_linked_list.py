import unittest

from structures.circular_linked_list import CircularLinkedList


def record(day, **values):
    return {
        "date": "2026-03-{:02d}".format(day),
        "steps": values.get("steps", 5000),
        "calories": values.get("calories", 1800),
        "sleep": values.get("sleep", 7.5),
    }


class CircularLinkedListTests(unittest.TestCase):
    def setUp(self):
        self.records = CircularLinkedList()

    def test_empty_and_single_node_circle(self):
        self.assertTrue(self.records.is_valid())
        self.assertEqual(self.records.traverse(), [])
        node = self.records.add_record(record(1))
        self.assertIs(node.next, node)
        self.assertTrue(self.records.is_valid())
        self.records.delete_record(node.date)
        self.assertIsNone(self.records.head)
        self.assertTrue(self.records.is_valid())

    def test_delete_head_middle_and_tail_keeps_circle_closed(self):
        for day in (1, 2, 3, 4):
            self.records.add_record(record(day))
        self.assertTrue(self.records.is_valid())

        self.records.delete_record("2026-03-02")
        self.assertEqual(
            [item["date"] for item in self.records.traverse()],
            ["2026-03-01", "2026-03-03", "2026-03-04"],
        )
        self.assertTrue(self.records.is_valid())

        self.records.delete_record("2026-03-04")
        self.assertEqual(self.records.tail.date, "2026-03-03")
        self.assertTrue(self.records.is_valid())

        self.records.delete_record("2026-03-01")
        self.assertEqual(self.records.head.date, "2026-03-03")
        self.assertTrue(self.records.is_valid())

        self.records.delete_record("2026-03-03")
        self.assertEqual(self.records.size, 0)
        self.assertTrue(self.records.is_valid())

    def test_search_update_duplicate_and_traversal(self):
        first = self.records.add_record(record(1))
        second = self.records.add_record(record(2))
        self.assertIs(self.records.search_record(second.date), second)
        self.assertIsNotNone(self.records.update_record(first.date, record(1, steps=9000)))
        self.assertEqual(self.records.search_record(first.date).steps, 9000)
        with self.assertRaises(ValueError):
            self.records.add_record(record(2))
        self.assertEqual(len(self.records.traverse()), 2)
        self.assertTrue(self.records.is_valid())


if __name__ == "__main__":
    unittest.main()
