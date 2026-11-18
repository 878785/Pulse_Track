from flask import Blueprint, jsonify

from services.health_service import health_service


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/api/dashboard/stats")
def dashboard_stats():
    return jsonify(health_service.stats())
