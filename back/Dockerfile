FROM python:3.9-slim

WORKDIR /app

# Устанавливаем только необходимые системные зависимости
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Копируем только requirements сначала
COPY requirements.txt .

# Устанавливаем зависимости по одной для лучшего контроля
RUN pip install --no-cache-dir torch==2.0.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cpu

# Устанавливаем остальные зависимости без фиксированных версий или с актуальными
RUN pip install --no-cache-dir \
    ultralytics \
    fastapi \
    uvicorn \
    pillow \
    numpy \
    opencv-python-headless \
    requests

# Копируем исходный код
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]