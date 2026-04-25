from fastapi.testclient import TestClient

from app.main import app


def _login(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "demo", "password": "demo123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_healthcheck() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_predict_endpoint() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/predict",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "race_name": "Silverstone GP",
                "drivers": [
                    {
                        "name": "Driver A",
                        "team": "Team A",
                        "qualifying_position": 1,
                        "momentum_score": 90,
                        "tyre_management": 88,
                        "reliability": 95,
                    },
                    {
                        "name": "Driver B",
                        "team": "Team B",
                        "qualifying_position": 4,
                        "momentum_score": 84,
                        "tyre_management": 80,
                        "reliability": 86,
                    },
                ],
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["predicted_order"][0]["driver"] == "Driver A"


def test_metadata_endpoint() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.get("/api/v1/metadata", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        body = response.json()
        assert "source" in body
        assert "season" in body
        assert "available_sessions" in body
        assert "featured_race_context" in body
        assert len(body["featured_race_context"]["podium"]) == 3
        if body["source"] == "fastf1":
            assert len(body["drivers"]) >= 4
            assert len(body["races"]) >= 2
        else:
            assert body["source"] == "fastf1-unavailable"
            assert body["drivers"] == []
            assert body["races"] == []


def test_login_and_me() -> None:
    with TestClient(app) as client:
        token = _login(client)

        me_response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_response.status_code == 200
        assert me_response.json()["username"] == "demo"


def test_profile_update() -> None:
    with TestClient(app) as client:
        token = _login(client)

        profile_response = client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "full_name": "Apex Strategist",
                "role": "Telemetry Engineer",
                "favorite_team": "Ferrari",
                "favorite_driver": "Charles Leclerc",
                "location": "New Delhi, India",
                "profile_image": "data:image/png;base64,abc123",
                "bio": "I track braking traces, tyre fade, and late-race overcut windows.",
            },
        )
        assert profile_response.status_code == 200
        body = profile_response.json()
        assert body["full_name"] == "Apex Strategist"
        assert body["favorite_driver"] == "Charles Leclerc"
        assert body["profile_image"] == "data:image/png;base64,abc123"


def test_protected_route_requires_auth() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/metadata")
        assert response.status_code == 401


def test_chat_endpoint_uses_race_context() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Who won the featured race?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["context"]) >= 2
        assert "Featured race:" in body["context"][0]


def test_chat_endpoint_answers_tyre_question_with_tyre_guidance() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Why are soft tyres better than hard tyres?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "warm up faster" in body["answer"].lower()
        assert "grip" in body["answer"].lower()
        assert "won silverstone" not in body["answer"].lower()
        assert not any(item.startswith("Featured race:") for item in body["context"])


def test_chat_endpoint_answers_general_f1_question_independently() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "What is DRS in Formula 1?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "drag reduction system" in body["answer"].lower()
        assert "silverstone" not in body["answer"].lower()
        assert not any(item.startswith("Featured race:") for item in body["context"])


def test_chat_endpoint_answers_driver_identity_question() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Who is Lando Norris?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "lando norris" in body["answer"].lower()
        assert "mclaren" in body["answer"].lower()
        assert "tyre degradation" not in body["answer"].lower()


def test_chat_endpoint_answers_team_question() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Who drives for Ferrari?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "ferrari" in body["answer"].lower()
        assert "charles leclerc" in body["answer"].lower()


def test_chat_endpoint_answers_team_alias_question() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Who drives for Merc?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "mercedes" in body["answer"].lower()
        assert any(driver_name in body["answer"].lower() for driver_name in ("george russell", "lewis hamilton", "kimi antonelli"))


def test_chat_endpoint_answers_surname_only_driver_question() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Which team does Verstappen drive for?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "max verstappen" in body["answer"].lower()
        assert "red bull" in body["answer"].lower()


def test_chat_endpoint_answers_race_date_question() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "When is the Monaco Grand Prix?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "monaco grand prix" in body["answer"].lower()
        assert "2025-05-25" in body["answer"]


def test_chat_endpoint_answers_race_alias_question() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "When is the Italian GP?", "year": 2025},
        )
        assert response.status_code == 200
        body = response.json()
        assert "italian grand prix" in body["answer"].lower()
        assert "2025" in body["answer"]


def test_replay_endpoint_returns_dataset() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.get(
            "/api/v1/replay?year=2025&grand_prix=Monza&session=R",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["eventName"]
        assert body["source"] in {"fastf1", "fastf1-unavailable"}
        if body["telemetryAvailable"]:
            assert body["durationMs"] > 0
            assert len(body["drivers"]) >= 2
            assert len(body["frames"]) > 2
            assert "positions" in body["frames"][0]
            assert body["drivers"][0]["code"]
            assert body["durationMs"] <= 240000
        else:
            assert body["frames"] == []


def test_telemetry_endpoint_uses_fastf1_or_honest_unavailable_state() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.get(
            "/api/v1/telemetry?year=2024&grand_prix=Australian%20Grand%20Prix&session=Q&drivers=Charles%20Leclerc",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["source"] in {"fastf1", "fastf1-unavailable"}
        if body["source"] == "fastf1":
            assert body["series"]
            assert body["notice"] is None
        else:
            assert body["series"] == []
            assert body["notice"]


def test_metadata_explicit_year_does_not_mix_seeded_calendar_when_fastf1_fails() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.get(
            "/api/v1/metadata?year=2022",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        if body["source"] == "fastf1-unavailable":
            assert body["races"] == []
        else:
            assert body["season"] == 2022
            assert all("2022" in race["date"] or race["date"] == "" for race in body["races"])


def test_calendar_endpoint_returns_selected_year_schedule_without_seed_mix() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.get(
            "/api/v1/calendar?year=2022",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["season"] == 2022
        if body["source"] == "fastf1":
            assert body["races"]
            assert all("2022" in race["date"] or race["date"] == "" for race in body["races"])
        else:
            assert body["source"] == "fastf1-unavailable"
            assert body["races"] == []


def test_weekend_context_endpoint_returns_fastf1_or_honest_fallback() -> None:
    with TestClient(app) as client:
        token = _login(client)
        response = client.get(
            "/api/v1/weekend-context?year=2024&grand_prix=Australian Grand Prix&session=Q",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["season"] == 2024
        assert body["grand_prix"] == "Australian Grand Prix"
        assert body["session"] == "Q"
        assert body["available_sessions"]
        assert len(body["insights"]) >= 1
        if body["source"] == "fastf1":
            assert len(body["drivers"]) >= 5
            assert body["notice"] is None
        else:
            assert body["source"] in {"fastf1-season", "fastf1-unavailable"}


def test_history_tracks_generated_items() -> None:
    with TestClient(app) as client:
        token = _login(client)
        headers = {"Authorization": f"Bearer {token}"}

        client.post(
            "/api/v1/strategy",
            headers=headers,
            json={
                "driver": "Lando Norris",
                "lap": 20,
                "position": 2,
                "tyre_compound": "Medium",
                "tyre_age": 15,
                "fuel_load": 40,
                "weather": "Dry",
                "year": 2025,
                "grand_prix": "Silverstone",
                "session": "R",
            },
        )
        client.post(
            "/api/v1/report",
            headers=headers,
            json={
                "race_name": "Silverstone Grand Prix",
                "winning_driver": "Lando Norris",
                "podium": ["Lando Norris", "Max Verstappen", "Charles Leclerc"],
                "headline_events": ["Late undercut won track position"],
                "weather": "Dry running",
                "key_stat": "Top-three split by strategy timing",
            },
        )
        client.post(
            "/api/v1/predict",
            headers=headers,
            json={
                "race_name": "Silverstone Grand Prix",
                "drivers": [
                    {
                        "name": "Driver A",
                        "team": "Team A",
                        "qualifying_position": 1,
                        "momentum_score": 90,
                        "tyre_management": 88,
                        "reliability": 95,
                    },
                    {
                        "name": "Driver B",
                        "team": "Team B",
                        "qualifying_position": 4,
                        "momentum_score": 84,
                        "tyre_management": 80,
                        "reliability": 86,
                    },
                ],
            },
        )
        client.post(
            "/api/v1/chat",
            headers=headers,
            json={"question": "Who won the featured race?", "year": 2025},
        )

        history_response = client.get("/api/v1/history", headers=headers)
        assert history_response.status_code == 200
        history = history_response.json()["activities"]
        assert any(item["activity_type"] == "strategy" for item in history)
        assert any(item["activity_type"] == "report" for item in history)
        assert any(item["activity_type"] == "prediction" for item in history)
        assert any(item["activity_type"] == "chat" for item in history)
