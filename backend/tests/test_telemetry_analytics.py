from app.services.fastf1_service import FastF1Service


def _point(index: int, distance: float, speed: float, brake: float, throttle: float, steering: float, time_scale: float) -> dict:
    return {
        "time": round(index * time_scale, 3),
        "distance": distance,
        "speed": speed,
        "throttle": throttle,
        "brake": brake,
        "gear": 4,
        "drs": 0,
        "rpm": 11000,
        "steering": steering,
    }


def _synthetic_points(time_scale: float, speed_offset: float = 0.0) -> list[dict]:
    points: list[dict] = []
    for index in range(34):
        distance = index * 30.0
        if 150 <= distance <= 330:
            phase = abs(distance - 240) / 90
            speed = 95 + phase * 70 + speed_offset
            brake = 35 if distance < 240 else 5
            throttle = 25 if distance < 270 else 65
            steering = 32
        elif 540 <= distance <= 720:
            phase = abs(distance - 630) / 90
            speed = 130 + phase * 75 + speed_offset
            brake = 20 if distance < 630 else 2
            throttle = 35 if distance < 660 else 80
            steering = -28
        else:
            speed = 255 + speed_offset
            brake = 0
            throttle = 95
            steering = 2
        points.append(_point(index, distance, speed, brake, throttle, steering, time_scale))
    return points


def _series(label: str, lap_time: float, time_scale: float, speed_offset: float = 0.0) -> dict:
    points = _synthetic_points(time_scale, speed_offset)
    return {
        "series_key": label.lower().replace(" ", "-"),
        "label": label,
        "driver": label.split(" L")[0],
        "team": "Test Team",
        "color": "#ffffff",
        "lap_number": 1,
        "lap_time_seconds": lap_time,
        "compound": "Soft",
        "is_reference": False,
        "points": points,
        "metrics": {
            "series_key": label.lower().replace(" ", "-"),
            "label": label,
            "driver": label.split(" L")[0],
            "team": "Test Team",
            "color": "#ffffff",
            "lap_number": 1,
            "compound": "Soft",
            "tyre_life": 3,
            "fastest_lap_seconds": lap_time,
            "sector_1_seconds": lap_time / 3,
            "sector_2_seconds": lap_time / 3,
            "sector_3_seconds": lap_time / 3,
            "top_speed": max(point["speed"] for point in points),
            "average_speed": sum(point["speed"] for point in points) / len(points),
            "average_throttle": sum(point["throttle"] for point in points) / len(points),
            "brake_pct": 25.0,
            "drs_pct": 0.0,
            "top_rpm": 11000,
            "average_rpm": 11000,
            "gear_changes": 8,
        },
        "lap_samples": [lap_time, lap_time + 0.08, lap_time + 0.12],
    }


def test_corner_breakdown_adds_names_confidence_and_quality() -> None:
    service = FastF1Service(None)
    breakdown = service._build_corner_breakdown([_series("Reference L1", 90.0, 0.25)], "Silverstone Grand Prix")

    assert breakdown
    assert breakdown[0]["corner"] == "T1"
    assert breakdown[0]["official_corner_name"] == "Abbey"
    assert "Abbey" in breakdown[0]["corner_label"]
    assert breakdown[0]["confidence_score"] > 50
    assert breakdown[0]["segmentation_quality"] in {"medium", "high"}


def test_benchmark_rankings_and_pair_deltas_are_backend_owned() -> None:
    service = FastF1Service(None)
    series = [
        _series("Reference L1", 90.0, 0.25, 2.0),
        _series("Comparison L2", 91.2, 0.27, -2.0),
    ]
    breakdown = service._build_corner_breakdown(series, "Silverstone Grand Prix")
    rankings = service._build_benchmark_rankings(series, breakdown)
    pair_deltas = service._build_pair_deltas(series, breakdown)

    assert [row["overall_rank"] for row in rankings] == [1, 2]
    assert rankings[1]["lap_delta_to_best"] == 1.2
    assert rankings[1]["braking_rank"] in {1, 2}
    assert rankings[1]["main_loss_corner"]

    pair = next(
        item
        for item in pair_deltas
        if item["reference_label"] == "Reference L1" and item["comparison_label"] == "Comparison L2"
    )
    assert pair["lap_delta"] == 1.2
    assert pair["corner_deltas"]
    assert pair["biggest_loss_corner"]


def test_empty_telemetry_bundle_carries_diagnostics_and_cache_metadata() -> None:
    bundle = FastF1Service._empty_telemetry_bundle(
        "session_unavailable",
        ["FastF1 could not load the selected session."],
        "2026:test:q:drivers=all:laps=fastest",
    )
    cached = FastF1Service._mark_telemetry_cache_hit(bundle)

    assert bundle["unavailable_reason"] == "session_unavailable"
    assert bundle["cache_metadata"]["diagnostics"]
    assert cached["cache_metadata"]["cache_hit"] is True
