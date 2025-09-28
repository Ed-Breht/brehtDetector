import io
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image
from ultralytics import YOLO
from fastapi.middleware.cors import CORSMiddleware
import os
import cv2

app = FastAPI(title="YOLOv8 Object Detection API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Для разработки, в production укажите конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Загрузка модели при старте приложения
model_path = os.getenv("MODEL_PATH", "best.pt")
model = YOLO(model_path)

# Цвета для каждого класса
class_colors = {
    0: (0, 0, 255),    # Defect - Красный
    1: (255, 0, 0),    # Welding Line - Синий
    2: (0, 255, 0),    # Workpiece - Зеленый
}

@app.get("/")
def read_root():
    return {"message": "YOLOv8 Object Detection API"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Проверка формата файла
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Чтение изображения
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Конвертация в numpy array для OpenCV
        image_np = np.array(image)
        image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        # Предсказание
        results = model.predict(image_np)
        
        # Собираем все bounding boxes для сортировки
        boxes = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                confidence = float(box.conf[0])
                cls_id = int(box.cls[0])
                boxes.append((x1, y1, x2, y2, confidence, cls_id))
        
        # Сортируем: сначала НЕ Defect, потом Defect (Defect будет поверх)
        boxes.sort(key=lambda x: x[5] == 0)
        
        # Отрисовка bounding boxes в правильном порядке
        for x1, y1, x2, y2, confidence, cls_id in boxes:
            color = class_colors.get(cls_id, (0, 255, 0))  # Зеленый по умолчанию
            
            # Рисуем прямоугольник
            cv2.rectangle(image_np, (x1, y1), (x2, y2), color, 2)
            
            # Добавляем текст только для Defect (класс 0)
            if cls_id == 0:
                label = f"{model.names[cls_id]} {confidence:.2f}"
                cv2.putText(image_np, label, (x1, y1 - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Конвертация обратно в PIL Image
        image_np = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
        result_image = Image.fromarray(image_np)
        
        # Сохранение в буфер
        img_byte_arr = io.BytesIO()
        result_image.save(img_byte_arr, format='JPEG')
        img_byte_arr.seek(0)
        
        # Возвращаем изображение
        return StreamingResponse(img_byte_arr, media_type="image/jpeg")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))