"""Health-record pages and JSON API."""

import re
from datetime import date
from math import isfinite

from flask import Blueprint, jsonify, request

from database import db
from services.health_service import health_service


records_bp = Blueprint("records", __name__)


def _validate_record(payload):
    if not isinstance(payload, dict):
        return None, "A JSON object is required."
    record_date = payload.get("date")
    if not isinstance(record_date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", record_date):
        return None, "Date must use the YYYY-MM-DD format."
    try:
        date.fromisoformat(record_date)
    except ValueError:
        return None, "Date must be a real date in YYYY-MM-DD format."
    values = {}
    for field, maximum, integer in (
        ("steps", 200000, True),
        ("calories", 20000, True),
        ("sleep", 24, False),
    ):
        value = payload.get(field)
        if isinstance(value, bool):
            return None, "{} must be a number.".format(field.capitalize())
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None, "{} must be a number.".format(field.capitalize())
        if not isfinite(number) or number < 0 or number > maximum:
            return None, "{} must be between 0 and {}.".format(field.capitalize(), maximum)
        if integer and not number.is_integer():
            return None, "{} must be a whole number.".format(field.capitalize())
        values[field] = int(number) if integer else round(number, 1)
    return {"date": record_date, **values}, None


@records_bp.get("/api/records")
def list_records():
    query = request.args.get("search", "").strip()
    records = health_service.search_records(query) if query else health_service.get_all_records()
    return jsonify({"records": records})


@records_bp.get("/api/records/<record_date>")
def get_record(record_date):
    record = health_service.get_record(record_date)
    if record is None:
        return jsonify({"error": "Record not found."}), 404
    return jsonify({"record": record})


@records_bp.post("/api/records")
def create_record():
    payload, error = _validate_record(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400
    if health_service.get_record(payload["date"]):
        return jsonify({"error": "A health record already exists for this date."}), 409
    try:
        record = health_service.add_record(payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 409
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({"record": record}), 201


@records_bp.put("/api/records/<record_date>")
def update_record(record_date):
    payload, error = _validate_record(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400
    if health_service.get_record(record_date) is None:
        return jsonify({"error": "Record not found."}), 404
    existing = health_service.get_record(payload["date"])
    if existing is not None and payload["date"] != record_date:
        return jsonify({"error": "A health record already exists for this date."}), 409
    try:
        record = health_service.update_record(record_date, payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 409
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({"record": record})


@records_bp.delete("/api/records/<record_date>")
def remove_record(record_date):
    try:
        record = health_service.delete_record(record_date)
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    if record is None:
        return jsonify({"error": "Record not found."}), 404
    return jsonify({"record": record})


@records_bp.delete("/api/records")
def clear_records():
    try:
        health_service.clear_records()
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({"deleted": True})


@records_bp.post("/api/records/import")
def import_records():
    body = request.get_json(silent=True)
    items = body.get("records") if isinstance(body, dict) else None
    if not isinstance(items, list):
        return jsonify({"error": "Expected a JSON object with a records array."}), 400
    added, duplicates, invalid = [], [], []
    for index, item in enumerate(items):
        record, error = _validate_record(item)
        if error:
            invalid.append({"index": index, "date": item.get("date", "—") if isinstance(item, dict) else "—", "error": error})
            continue
        if health_service.get_record(record["date"]):
            duplicates.append(record["date"])
            continue
        try:
            added.append(health_service.add_record(record))
        except Exception as error:
            return jsonify({"error": str(error), "added": added}), 500
    return jsonify({"added": added, "duplicates": duplicates, "invalid": invalid}), 201


@records_bp.get("/api/settings/storage")
def storage_info():
    try:
        size = db.DATABASE_PATH.stat().st_size
    except FileNotFoundError:
        size = 0
    return jsonify({
        "database": "SQLite",
        "path": str(db.DATABASE_PATH),
        "bytes": size,
        "kb": round(size / 1024, 1),
        "count": db.record_count(),
        "lastSaved": db.last_saved_at(),
    })
