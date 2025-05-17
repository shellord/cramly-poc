import json
import os
import time
import asyncio
import aiofiles
from openai import AsyncOpenAI

# Assessment content schema definition
ASSESSMENT_SCHEMA = {
    "name": "generate_assessments",
    "description": "Generates flashcards and quiz questions based on a lesson's content",
    "parameters": {
        "type": "object",
        "properties": {
            "flashcards": {
                "type": "array",
                "description": "A set of flashcards with questions and answers based on the lesson content",
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string", 
                            "description": "A question about a key concept from the lesson"
                        },
                        "answer": {
                            "type": "string",
                            "description": "A clear, accurate answer to the question"
                        }
                    },
                    "required": ["question", "answer"]
                }
            },
            "quiz": {
                "type": "array",
                "description": "A set of multiple choice questions based on the lesson content",
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "A question testing understanding of the lesson content"
                        },
                        "options": {
                            "type": "array",
                            "description": "Four possible answer options labeled A through D",
                            "items": {
                                "type": "string"
                            },
                            "minItems": 4,
                            "maxItems": 4
                        },
                        "correct": {
                            "type": "string",
                            "description": "The letter of the correct answer (A, B, C, or D)",
                            "enum": ["A", "B", "C", "D"]
                        }
                    },
                    "required": ["question", "options", "correct"]
                }
            }
        },
        "required": ["flashcards", "quiz"]
    }
}

class AssessmentGenerator:
    def __init__(self, api_key):
        """Initialize the AssessmentGenerator with an OpenAI API key"""
        self.client = AsyncOpenAI(api_key=api_key)
        self.output_dir = "output"
        os.makedirs(self.output_dir, exist_ok=True)
        self.semaphore = asyncio.Semaphore(10)  # Limit to 10 concurrent requests
    
    async def generate_assessments(self, topic, main_topic, subtopic, lesson_content):
        """Generate flashcards and quiz questions for a specific subtopic based on its lesson content"""
        subtopic_title = subtopic["title"]
        main_topic_title = main_topic["title"]
        
        print(f"Generating assessments for: {subtopic_title}...")
        
        system_prompt = """You are an expert educator specializing in creating high-quality assessment materials.

Your task is to create flashcards and quiz questions that:
1. Test key concepts and information directly from the lesson content
2. Cover the most important points from the lesson
3. Range from basic recall to application of concepts
4. Are clear, unambiguous, and properly formatted
5. Have accurate answers that match the information in the lesson"""
        
        prompt = f"""Create flashcards and quiz questions based specifically on this lesson content about "{subtopic_title}":

LESSON DESCRIPTION:
{lesson_content["description"]}

LESSON CONTENT:
{lesson_content["content"]}

Create:
1. 3-5 flashcards with questions and answers - these should test recall of key definitions, concepts, and facts presented in the lesson
2. 2-3 multiple choice questions - these should test deeper understanding and application of the material

IMPORTANT:
- Only include information that appears in the lesson content
- Questions should match the level and terminology used in the lesson
- For multiple choice questions, ensure one option is clearly correct while the others are plausible but incorrect
- Make the incorrect options realistic but clearly wrong to someone who understood the lesson
- Format multiple choice options as complete sentences that grammatically complete the question stem"""
        
        # Maximum retries for API calls
        max_retries = 3
        
        async with self.semaphore:  # Limit concurrent requests
            for attempt in range(max_retries):
                try:
                    response = await self.client.chat.completions.create(
                        model="gpt-3.5-turbo-0125",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        tools=[{"type": "function", "function": ASSESSMENT_SCHEMA}],
                        tool_choice={"type": "function", "function": {"name": "generate_assessments"}}
                    )
                    
                    # Extract the function arguments from the response
                    function_args = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
                    
                    # Save result to nested directory structure
                    subtopic_dir = f"{self.output_dir}/{topic.lower()}/{main_topic['id']}"
                    os.makedirs(subtopic_dir, exist_ok=True)
                    
                    output_file = f"{subtopic_dir}/{subtopic['id']}_assessments.json"
                    async with aiofiles.open(output_file, "w") as f:
                        await f.write(json.dumps(function_args, indent=2))
                    
                    print(f"✅ Generated {len(function_args['flashcards'])} flashcards and {len(function_args['quiz'])} quiz questions for: {subtopic_title}")
                    return function_args
                    
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"Error generating assessments for {subtopic_title}: {str(e)}. Retrying ({attempt+1}/{max_retries})...")
                        await asyncio.sleep(2)  # Wait before retrying
                    else:
                        print(f"Failed after {max_retries} attempts for {subtopic_title}: {str(e)}")
                        # Return minimal content as fallback
                        return {
                            "flashcards": [
                                {"question": f"What is {subtopic_title}?", "answer": f"See lesson content for details on {subtopic_title}."},
                                {"question": f"Why is {subtopic_title} important?", "answer": f"It's a key concept in {main_topic_title}."}
                            ],
                            "quiz": [
                                {
                                    "question": f"Which of the following best describes {subtopic_title}?",
                                    "options": [
                                        "A specific concept in the subject",
                                        "Unrelated to the subject",
                                        "Too broad to define",
                                        "None of the above"
                                    ],
                                    "correct": "A"
                                }
                            ]
                        }
    
    async def enhance_all_content(self, topic, topic_structure, lesson_content):
        """Generate assessments for all subtopics and integrate with lesson content"""
        print(f"\n🔄 Generating flashcards and quizzes for all subtopics in {topic}...")
        
        # Create a roadmap structure with flashcards and quizzes
        roadmap = {"roadmap": []}
        tasks = []
        
        # Process each main topic and its subtopics
        for main_topic in topic_structure["topics"]:
            main_topic_id = main_topic["id"]
            main_topic_title = main_topic["title"]
            
            # Create main topic node
            main_topic_node = {
                "id": main_topic_id,
                "type": "main_topic",
                "title": main_topic_title,
                "description": f"Study guide for {main_topic_title}",
                "children": []
            }
            
            print(f"\nProcessing main topic: {main_topic_title}...")
            
            # Process each subtopic
            for subtopic in main_topic["subtopics"]:
                # Add task to process subtopic
                task = self.process_subtopic(topic, main_topic, subtopic, main_topic_node, lesson_content)
                tasks.append(task)
            
            # Add main topic to roadmap
            roadmap["roadmap"].append(main_topic_node)
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks)
        
        # Save the complete roadmap
        output_file = f"{self.output_dir}/{topic.lower()}_roadmap.json"
        async with aiofiles.open(output_file, "w") as f:
            await f.write(json.dumps(roadmap, indent=2))
        
        print(f"\n✅ Complete roadmap with all content and assessments saved to: {output_file}")
        return roadmap
    
    async def process_subtopic(self, topic, main_topic, subtopic, main_topic_node, lesson_content):
        """Process a single subtopic and update the main_topic_node"""
        subtopic_id = subtopic["id"]
        subtopic_title = subtopic["title"]
        
        # Get the existing lesson content
        subtopic_content = lesson_content[main_topic["id"]]["subtopics"].get(subtopic_id, {})
        if not subtopic_content:
            print(f"Warning: No lesson content found for {subtopic_title}, skipping assessments...")
            return
        
        # Generate assessments based on the lesson content
        assessments = await self.generate_assessments(topic, main_topic, subtopic, subtopic_content)
        
        # Create subtopic node with content and assessments
        subtopic_node = {
            "id": subtopic_id,
            "type": "topic",
            "title": subtopic_title,
            "description": subtopic_content.get("description", ""),
            "content": subtopic_content.get("content", ""),
            "children": [
                {
                    "id": f"{subtopic_id}-1",
                    "type": "flashcards",
                    "title": "Flashcards",
                    "cards": assessments["flashcards"]
                },
                {
                    "id": f"{subtopic_id}-2",
                    "type": "quiz",
                    "title": "Quiz",
                    "questions": assessments["quiz"]
                }
            ]
        }
        
        # Add subtopic node to main topic
        main_topic_node["children"].append(subtopic_node)

# For compatibility with synchronous code
def sync_wrapper(async_func):
    """Wrapper to call async functions from synchronous code"""
    def wrapper(*args, **kwargs):
        return asyncio.run(async_func(*args, **kwargs))
    return wrapper

# Create synchronous versions of the async methods
AssessmentGenerator.enhance_all_content_sync = sync_wrapper(AssessmentGenerator.enhance_all_content) 