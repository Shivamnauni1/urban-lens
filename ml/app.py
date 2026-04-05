from fastapi import FastAPI, UploadFile, File, Form
import uvicorn
# import torch
# from torchvision import models, transforms
# from sklearn.cluster import DBSCAN
import random

app = FastAPI(title="UrbanLens ML Service")

@app.get("/")
def read_root():
    return {"status": "ML Service is running"}

@app.post("/predict")
async def predict_damage(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...)
):
    """
    Receives an image and coordinates from the Node.js backend.
    In the future, this will run:
    1. EfficientNet-B0 to classify damage and determine severity.
    2. Optional: Add to a pool of inputs to trigger DBSCAN clustering.
    """
    # Read image
    contents = await image.read()
    
    # --- MOCK CNN LOGIC ---
    # Imagine we pass 'contents' to our PyTorch EfficientNet model here
    damage_types = ["Pothole", "Crack", "Waterlogging", "None"]
    detected_type = random.choice(damage_types[:-1])  # Exclude 'None' for testing
    severity = random.randint(1, 5) if detected_type != "None" else 0
    # ----------------------
    
    return {
        "damageType": detected_type,
        "severity": severity,
        "latitude": latitude,
        "longitude": longitude,
        "filename": image.filename
    }

@app.post("/cluster")
async def run_clustering():
    """
    Endpoint to trigger DBSCAN clustering over recent reports.
    Node.js can call this via cron job or webhook.
    """
    # MOCK DBSCAN LOGIC
    num_clusters = random.randint(3, 10)
    return {"message": f"Clustering complete. Identified {num_clusters} damage zones"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
