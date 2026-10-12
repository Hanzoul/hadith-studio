# Chromium + Python preinstalled (Ubuntu 24.04)
FROM mcr.microsoft.com/playwright/python:v1.56.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 curl bzip2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# speech models (timing only): Whisper-small + Silero VAD
RUN mkdir -p /models && cd /models \
 && curl -fsSL -o silero_vad.onnx https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx \
 && curl -fsSL -o w.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2 \
 && tar xjf w.tar.bz2 && rm w.tar.bz2 \
 && rm -f sherpa-onnx-whisper-small/small-encoder.onnx sherpa-onnx-whisper-small/small-decoder.onnx && rm -rf sherpa-onnx-whisper-small/test_wavs
COPY . .
ENV MODELS_DIR=/models DATA_DIR=/data PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
