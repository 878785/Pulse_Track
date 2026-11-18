from flask import Blueprint, jsonify

from services.health_service import health_service


data_structure_bp = Blueprint("data_structure", __name__)


@data_structure_bp.get("/api/data-structure")
def structure_info():
    records = health_service.get_all_records()
    return jsonify({
        "name": "Circular Singly Linked List",
        "head": records[0]["date"] if records else None,
        "tail": records[-1]["date"] if records else None,
        "size": len(records),
        "circular": health_service.records.is_valid(),
        "records": records,
    })
