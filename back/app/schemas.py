from pydantic import BaseModel

class PredictionResult(BaseModel):
    class_name: str
    confidence: float
    bbox: list[float]