from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn
import json
from main import generate_study_roadmap_async

# Load environment variables at startup
load_dotenv()

app = FastAPI(title="Study Roadmap API", description="API for generating study roadmaps")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TopicRequest(BaseModel):
    topic: str


@app.post("/generate-roadmap-test/")
async def create_roadmap(request: TopicRequest):
    try:
        with open('output/java_roadmap.json', 'r') as f:
            roadmap = json.load(f)
        return {"status": "success", "topic": request.topic, "roadmap": roadmap}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating roadmap: {str(e)}")



@app.post("/generate-roadmap/")
async def create_roadmap(request: TopicRequest):
    try:
        # Call the async function to generate the roadmap
        roadmap = await generate_study_roadmap_async(request.topic)
        return {"status": "success", "topic": request.topic, "roadmap": roadmap}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating roadmap: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Welcome to the Study Roadmap API. Use POST /generate-roadmap/ to create a new roadmap."}

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=1337, reload=True) 