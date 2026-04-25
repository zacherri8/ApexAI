from app.schemas.predict import PredictedFinish, PredictionRequest, PredictionResponse


class PredictorService:
    def predict(self, payload: PredictionRequest) -> PredictionResponse:
        scored = []
        for driver in payload.drivers:
            score = (
                (110 - driver.qualifying_position * 4)
                + (driver.momentum_score * 0.35)
                + (driver.tyre_management * 0.25)
                + (driver.reliability * 0.20)
            )
            scored.append((score, driver))
        scored.sort(key=lambda item: item[0], reverse=True)
        predicted_order = [
            PredictedFinish(
                position=index + 1,
                driver=driver.name,
                team=driver.team,
                score=round(score, 2),
            )
            for index, (score, driver) in enumerate(scored)
        ]
        return PredictionResponse(race_name=payload.race_name, predicted_order=predicted_order)
