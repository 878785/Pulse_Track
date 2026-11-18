from datetime import date

from flask import Blueprint, jsonify, request

from services.analytics_service import calendar_records
from services.health_service import health_service


calendar_bp = Blueprint("calendar", __name__)


@calendar_bp.get("/api/calendar")
def calendar_data():
    try:
        year = int(request.args.get("year", date.today().year))
        month = int(request.args.get("month", date.today().month))
        if not 1 <= month <= 12 or not 1 <= year <= 9999:
            raise ValueError
    except ValueError:
        return jsonify({"error": "Provide a valid year and month."}), 400
    return jsonify({"year": year, "month": month, "records": calendar_records(year, month)})


@calendar_bp.get("/api/calendar/<record_date>")
def calendar_day(record_date):
    record = health_service.get_record(record_date)
    return jsonify({"record": record})
