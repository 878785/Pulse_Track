from datetime import date

from flask import Blueprint, jsonify, request

from services.analytics_service import analytics


analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/api/analytics")
def analytics_data():
    start = request.args.get("from")
    end = request.args.get("to")
    try:
        if start:
            date.fromisoformat(start)
        if end:
            date.fromisoformat(end)
    except ValueError:
        return jsonify({"error": "Dates must use the YYYY-MM-DD format."}), 400
    if start and end and start > end:
        return jsonify({"error": "The start date must be on or before the end date."}), 400
    return jsonify(analytics(start, end))
