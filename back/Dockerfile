FROM python:3.9-slim

WORKDIR /app

# Устанавливаем системные зависимости в один слой и очищаем кэш
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Сначала копируем только requirements.txt
COPY requirements.txt .

# Устанавливаем зависимости с оптимизацией
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальные файлы
COPY . .

# Копируем модель (если она большая, рассмотрите вариант скачивания в рантайме)
COPY best.pt /app/best.pt

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]