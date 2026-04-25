from app.schemas.strategy import StrategyRequest, StrategyResponse


class StrategyService:
    def generate_strategy(self, payload: StrategyRequest) -> StrategyResponse:
        is_late_stint = payload.tyre_age >= 18
        pit_window = (
            f"Box between laps {payload.lap + 1}-{payload.lap + 3}"
            if is_late_stint
            else f"Stay out until laps {payload.lap + 4}-{payload.lap + 7}"
        )
        tyre_advice = (
            "Protect the rear tyres through traction zones and reduce wheelspin on corner exit."
            if payload.tyre_compound.lower() in {"soft", "medium"}
            else "Lean on the tyre durability and extend the stint if traffic remains manageable."
        )
        push_mode = (
            "Push on the out-lap and cover the undercut risk."
            if payload.position <= 3 and is_late_stint
            else "Conserve through sector three and build a stronger final stint."
        )
        rationale = [
            f"Tyre age at {payload.tyre_age} laps is {'high' if is_late_stint else 'stable'} for the current stint.",
            f"Fuel load at {payload.fuel_load:.1f} kg supports a {'lighter' if payload.fuel_load < 45 else 'heavier'} race phase.",
            f"Weather input '{payload.weather}' suggests {'caution on tyre warmup' if 'cool' in payload.weather.lower() else 'normal operating conditions'}.",
        ]
        if payload.grand_prix and payload.session and payload.year:
            rationale.insert(
                0,
                f"Session context locked to {payload.grand_prix} {payload.year} ({payload.session}), so the pit wall call stays anchored to the selected F1 weekend.",
            )
        recommendation = f"{payload.driver}: {push_mode} {tyre_advice}"
        return StrategyResponse(
            recommendation=recommendation,
            pit_window=pit_window,
            tyre_advice=tyre_advice,
            push_mode=push_mode,
            rationale=rationale,
        )
