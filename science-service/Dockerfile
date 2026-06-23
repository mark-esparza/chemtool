# Science service container (P0).
FROM python:3.11-slim

WORKDIR /app

# RDKit wheels on PyPI are self-contained, so no system chem libs are required.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY data ./data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
