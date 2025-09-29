FROM python:3.9-slim

WORKDIR /app

# Устанавливаем только необходимые системные зависимости
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Создаем .dockerignore на лету для критически важных файлов
RUN echo -e "__pycache__\n*.pyc\n*.pyo\n*.pyd\n.Python\nenv\n.venv\nvenv\n.git\n.gitignore\nREADME.md\nDockerfile\n.dockerignore" > /tmp/.dockerignore

# Копируем только requirements сначала
COPY requirements.txt .

# Устанавливаем CPU-only версии для экономии места
RUN pip install --no-cache-dir \
    torch==2.0.1 --index-url https://download.pytorch.org/whl/cpu \
    torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cpu \
    ultralytics==8.0.186 \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    pillow==10.1.0 \
    numpy==1.24.3 \
    opencv-python-headless==4.8.1.78 \
    requests==2.31.0

# Копируем исходный код
COPY . .

# Скачиваем модель при запуске (рекомендуется) или оставляем в образе
# COPY best.pt /app/best.pt

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]