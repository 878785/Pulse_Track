"""PulseTrack Flask application."""

from pathlib import Path

from flask import Flask, abort, render_template, send_from_directory
from jinja2 import ChoiceLoader, FileSystemLoader

from database.db import initialize_database

initialize_database()

from routes.analytics_routes import analytics_bp
from routes.calendar_routes import calendar_bp
from routes.dashboard_routes import dashboard_bp
from routes.data_structure_routes import data_structure_bp
from routes.records_routes import records_bp
from routes.settings_routes import settings_bp


ROOT_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = ROOT_DIR / "templates"


def create_app(test_config=None):
    app = Flask(__name__, template_folder=str(TEMPLATE_DIR))
    app.config.update(JSON_SORT_KEYS=False)
    if test_config:
        app.config.update(test_config)
    app.jinja_loader = ChoiceLoader([
        FileSystemLoader(str(TEMPLATE_DIR)),
        FileSystemLoader(str(ROOT_DIR)),
    ])
    initialize_database()

    for blueprint in (
        dashboard_bp,
        records_bp,
        analytics_bp,
        calendar_bp,
        data_structure_bp,
        settings_bp,
    ):
        app.register_blueprint(blueprint)

    @app.get("/")
    def dashboard():
        return render_template("dashboard.html", initial_page="overview")

    @app.get("/<page>")
    def application_page(page):
        pages = {
            "dashboard": "overview",
            "records": "records",
            "calendar": "calendar",
            "analytics": "analytics",
            "data-structure": "visualizer",
            "export": "export",
            "settings": "settings",
        }
        if page not in pages:
            abort(404)
        return render_template("dashboard.html", initial_page=pages[page])

    @app.get("/style.css")
    def stylesheet():
        return send_from_directory(ROOT_DIR, "style.css")

    @app.get("/script.js")
    def application_script():
        return send_from_directory(ROOT_DIR, "script.js")

    @app.get("/modules/<path:filename>")
    def application_modules(filename):
        return send_from_directory(ROOT_DIR / "modules", filename)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
