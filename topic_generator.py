import json
import os
import time
from openai import OpenAI

# Topic structure schema definition
TOPIC_STRUCTURE_SCHEMA = {
    "name": "generate_topic_structure",
    "description": "Generates a structured breakdown of topics and subtopics for a given subject",
    "parameters": {
        "type": "object",
        "properties": {
            "topics": {
                "type": "array",
                "description": "Array of main topics that represent major domains or categories",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "Unique identifier for the main topic"
                        },
                        "title": {
                            "type": "string",
                            "description": "Title of the main topic"
                        },
                        "subtopics": {
                            "type": "array",
                            "description": "Array of subtopics related to this main topic",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {
                                        "type": "string",
                                        "description": "Unique identifier for the subtopic"
                                    },
                                    "title": {
                                        "type": "string",
                                        "description": "Title of the subtopic - must be a specific concept, term, or method"
                                    }
                                },
                                "required": ["id", "title"]
                            }
                        }
                    },
                    "required": ["id", "title", "subtopics"]
                }
            }
        },
        "required": ["topics"]
    }
}

class TopicGenerator:
    def __init__(self, api_key):
        """Initialize the TopicGenerator with an OpenAI API key"""
        self.client = OpenAI(api_key=api_key)
        self.output_dir = "output"
        os.makedirs(self.output_dir, exist_ok=True)
    
    def generate_topic_structure(self, topic):
        """Generate main topics and subtopics for a given subject using function calling"""
        print(f"Getting main topics and subtopics for '{topic}'...")
        
        system_prompt = """You are an expert curriculum designer.

Your task is to generate a detailed and structured topic breakdown for a given subject.

🧠 Instructions:
1. Divide the subject into main topics that represent major domains or categories.
2. Under each main topic, generate detailed subtopics.
3. Subtopics should focus on **individual concepts**, **terms**, **classes**, **tools**, or **methods** — not broad chapter titles.

📌 Examples:
- "Lists" is too broad → Split into: "ArrayList", "LinkedList", "Array vs List", "List operations"
- "Cell Biology" is too generic → Split into: "Nucleus", "Mitochondria", "Golgi Apparatus", "Cell Membrane Transport"

🎯 Each subtopic must:
- Be a **standalone learning unit**
- Represent a concrete concept or feature
- Be suitable for content, flashcards, and quizzes
- Be something a student could Google individually"""
        
        prompt = f"""Generate a detailed and structured topic breakdown for: {topic}

Create 7-9 main topics that comprehensively cover the subject from beginner to advanced concepts.
For each main topic, provide exactly 5-10 specific subtopics that are concrete individual concepts.
Each subtopic should be specific enough to be taught in a single lesson (e.g., 'HashMap Implementation' rather than just 'Maps').
Cover both fundamental concepts and advanced applications.
Ensure subtopics are balanced in specificity and scope across all main topics.
Assign proper IDs to main topics (main-1, main-2, etc.) and subtopics (main-1-1, main-1-2, etc.)."""
        
        # Maximum retries for API calls
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model="gpt-3.5-turbo-0125",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    tools=[{"type": "function", "function": TOPIC_STRUCTURE_SCHEMA}],
                    tool_choice={"type": "function", "function": {"name": "generate_topic_structure"}}
                )
                
                # Extract the function arguments from the response
                function_args = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
                
                # Save result
                output_file = f"{self.output_dir}/{topic.lower()}_structure.json"
                with open(output_file, "w") as f:
                    json.dump(function_args, f, indent=2)
                    
                print(f"✅ Generated {len(function_args['topics'])} main topics with subtopics")
                print(f"✅ Saved to: {output_file}")
                
                # Print summary
                print("\n📋 Topic Structure Summary:")
                for i, main_topic in enumerate(function_args["topics"]):
                    print(f"\n{i+1}. {main_topic['title']}")
                    for j, subtopic in enumerate(main_topic["subtopics"]):
                        print(f"   {i+1}.{j+1}. {subtopic['title']}")
                
                return function_args
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Error: {str(e)}. Retrying ({attempt+1}/{max_retries})...")
                    time.sleep(2)  # Wait before retrying
                else:
                    print(f"Failed after {max_retries} attempts: {str(e)}")
                    raise 