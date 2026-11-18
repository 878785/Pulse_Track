"""Analytics projections built from the circular linked list records."""

from datetime import date, timedelta

from services.health_service import health_service


def records_in_range(start=None, end=None):
    records = health_service.get_all_records()
    if start:
        records = [record for record in records if record["date"] >= start]
    if end:
        records = [record for record in records if record["date"] <= end]
    return records


def analytics(start=None, end=None):
    records = records_in_range(start, end)
    return {
        "records": records,
        "stats": _stats(records),
        "from": start,
        "to": end,
    }


def calendar_records(year, month):
    prefix = "{:04d}-{:02d}-".format(year, month)
    return [record for record in health_service.get_all_records() if record["date"].startswith(prefix)]


def _stats(records):
    count = len(records)
    steps = [record["steps"] for record in records]
    calories = [record["calories"] for record in records]
    sleep = [record["sleep"] for record in records]
    if not count:
        return {"count": 0, "totalSteps": 0, "totalCalories": 0, "avgSleep": 0}
    return {
        "count": count,
        "totalSteps": sum(steps),
        "totalCalories": sum(calories),
        "avgSleep": round(sum(sleep) / count, 1),
    }
