from flask import Blueprint, jsonify

from database.db import record_count


settings_bp = Blueprint("settings", __name__)


@settings_bp.get("/api/settings")
def settings_info():
    return jsonify({"database": "SQLite", "recordCount": record_count(), "themeStorage": "Browser local storage"})
