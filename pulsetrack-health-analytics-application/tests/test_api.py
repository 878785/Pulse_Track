import tempfile
import unittest
from pathlib import Path

from app import create_app
from database import db
from services.health_service import health_service


class HealthApiTests(unittest.TestCase):
    def setUp(self):
        self.original_path = db.DATABASE_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        db.DATABASE_PATH = Path(self.temp_dir.name) / "test.db"
        db.DATA_DIR = Path(self.temp_dir.name)
        db.initialize_database()
        health_service.reload()
        self.client = create_app({"TESTING": True}).test_client()

    def tearDown(self):
        health_service.clear_records()
        db.DATABASE_PATH = self.original_path
        db.DATA_DIR = self.original_path.parent
        self.temp_dir.cleanup()

    def test_record_crud_and_analytics_stay_in_sync(self):
        payload = {"date": "2026-05-01", "steps": 8000, "calories": 2100, "sleep": 7.5}
        response = self.client.post("/api/records", json=payload)
        self.assertEqual(response.status_code, 201)
        self.assertIsInstance(response.json["record"]["id"], int)
        self.assertTrue(health_service.records.is_valid())
        health_service.reload()
        self.assertEqual(health_service.records.size, 1)

        updated = {**payload, "date": "2026-05-02", "steps": 9000}
        response = self.client.put("/api/records/2026-05-01", json=updated)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/records/2026-05-02").json["record"]["steps"], 9000)
        self.assertEqual(self.client.get("/api/dashboard/stats").json["totalSteps"], 9000)
        self.assertEqual(len(self.client.get("/api/calendar?year=2026&month=5").json["records"]), 1)

        response = self.client.delete("/api/records/2026-05-02")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/records").json["records"], [])
        self.assertTrue(health_service.records.is_valid())

    def test_jinja_pages_and_frontend_assets_are_served(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        for page in ("overview", "calendar", "records", "analytics", "visualizer", "export", "settings"):
            self.assertIn(('id="page-{}"'.format(page)).encode(), response.data)
        for path in ("/", "/records", "/calendar", "/analytics", "/data-structure", "/settings"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(b"PulseTrack", response.data)
        for path in ("/style.css", "/script.js", "/modules/linkedList.js"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()

    def test_validation_duplicate_and_bulk_import(self):
        payload = {"date": "2026-05-01", "steps": 8000, "calories": 2100, "sleep": 7.5}
        self.assertEqual(self.client.post("/api/records", json=payload).status_code, 201)
        self.assertEqual(self.client.post("/api/records", json=payload).status_code, 409)
        self.assertEqual(
            self.client.get("/api/records?search=2100").json["records"][0]["date"],
            "2026-05-01",
        )
        self.assertEqual(self.client.get("/api/records?search=missing").json["records"], [])

        invalid = {**payload, "date": "2026-02-30"}
        self.assertEqual(self.client.post("/api/records", json=invalid).status_code, 400)
        imported = self.client.post("/api/records/import", json={
            "records": [
                payload,
                {"date": "2026-05-02", "steps": 6000, "calories": 1700, "sleep": 8},
            ],
        })
        self.assertEqual(imported.status_code, 201)
        self.assertEqual(len(imported.json["added"]), 1)
        self.assertEqual(imported.json["duplicates"], ["2026-05-01"])
        self.assertTrue(health_service.records.is_valid())

        cleared = self.client.delete("/api/records")
        self.assertEqual(cleared.status_code, 200)
        self.assertEqual(health_service.records.size, 0)
        self.assertTrue(health_service.records.is_valid())


if __name__ == "__main__":
    unittest.main()
