import json
import os
import time
import asyncio
import aiofiles
from openai import AsyncOpenAI

class ContentGenerator:
    def __init__(self, api_key):
        """Initialize the ContentGenerator with an OpenAI API key"""
        self.client = AsyncOpenAI(api_key=api_key)
        self.output_dir = "output"
        os.makedirs(self.output_dir, exist_ok=True)
        self.semaphore = asyncio.Semaphore(10)  # Limit to 10 concurrent requests
    
    async def generate_lesson_content(self, topic, main_topic, subtopic):
        """Generate detailed lesson content for a specific subtopic using raw prompting"""
        subtopic_title = subtopic["title"]
        subtopic_description = subtopic["description"]
        main_topic_title = main_topic["title"]
        
        print(f"Generating lesson content for: {subtopic_title}...")
        
        system_prompt = """You are an expert educator creating high-quality, comprehensive learning materials.

Your task is to create detailed lesson content for a specific topic. The content should be:

1. Educational and informative with accurate information
2. Well-structured with clear sections
3. Engaging and accessible to learners
4. Practical with real-world applications or examples
5. Comprehensive, covering key aspects of the topic

Format your response as follows:
CONTENT: [Detailed educational content (300+ words)]"""
        
        prompt = f"""Create a detailed lesson on the subtopic "{subtopic_title}" within the main topic "{main_topic_title}" for the subject "{topic}".

Subtopic description: {subtopic_description}

Your lesson should include:

1. A clear introduction that defines the concept and its importance
2. Core principles and key components explained thoroughly
3. Real-world applications or examples that illustrate the concept
4. Common challenges or misconceptions addressed
5. Best practices or tips when applicable
6. Code examples or technical details if relevant to the subject
7. Connections to related concepts within the field
8. A brief summary that reinforces the key takeaways
9. If the subtopic is broad, break it into 2-3 clearly defined sections with headings. Explain each with examples and structured explanations.

The content should be approximately 300-500 words, technically accurate, and written at an appropriate level for someone learning this subject.
Format your response to start with the detailed content of the lesson. Keep the format clean as this will be stored as learning material.
"""
        
        # Maximum retries for API calls
        max_retries = 3
        
        async with self.semaphore:  # Limit concurrent requests
            for attempt in range(max_retries):
                try:
                    response = await self.client.chat.completions.create(
                        model="gpt-4.1-nano",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ]
                    )
                    
                    # Extract the content from the response
                    content_text = response.choices[0].message.content
                    
                    # Process the response to extract the content
                    if "CONTENT:" in content_text:
                        content = content_text.split("CONTENT:")[1].strip()
                    else:
                        content = content_text.strip()
                    
                    # Create result structure
                    lesson_content = {
                        "description": subtopic_description,
                        "content": content
                    }
                    
                    # Save result to nested directory structure
                    subtopic_dir = f"{self.output_dir}/{topic.lower()}/{main_topic['id']}"
                    os.makedirs(subtopic_dir, exist_ok=True)
                    
                    output_file = f"{subtopic_dir}/{subtopic['id']}_lesson.json"
                    async with aiofiles.open(output_file, "w") as f:
                        await f.write(json.dumps(lesson_content, indent=2))
                    
                    print(f"✅ Generated lesson content for: {subtopic_title}")
                    return lesson_content
                    
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"Error generating content for {subtopic_title}: {str(e)}. Retrying ({attempt+1}/{max_retries})...")
                        await asyncio.sleep(2)  # Wait before retrying
                    else:
                        print(f"Failed after {max_retries} attempts for {subtopic_title}: {str(e)}")
                        # Return minimal content as fallback
                        return {
                            "description": subtopic_description,
                            "content": f"Content generation failed for {subtopic_title}. Please try regenerating this content."
                        }
    
    async def generate_all_lesson_content(self, topic, topic_structure):
        """Generate lesson content for all subtopics in the topic structure"""
        print(f"\n🔄 Generating lesson content for all subtopics in {topic}...")
        
        all_content = {}
        tasks = []
        
        # Process each main topic and its subtopics
        for main_topic in topic_structure["topics"]:
            main_topic_id = main_topic["id"]
            all_content[main_topic_id] = {
                "title": main_topic["title"],
                "subtopics": {}
            }
            
            print(f"\nProcessing main topic: {main_topic['title']}...")
            
            # Process each subtopic
            for subtopic in main_topic["subtopics"]:
                # Create a task for each subtopic
                task = self.process_subtopic(topic, main_topic, subtopic, all_content)
                tasks.append(task)
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks)
        
        # Save the complete content structure
        output_file = f"{self.output_dir}/{topic.lower()}_content.json"
        async with aiofiles.open(output_file, "w") as f:
            await f.write(json.dumps(all_content, indent=2))
        
        print(f"\n✅ All lesson content generated and saved to: {output_file}")
        return all_content
    
    async def process_subtopic(self, topic, main_topic, subtopic, all_content):
        """Process a single subtopic and update the all_content dictionary"""
        subtopic_id = subtopic["id"]
        main_topic_id = main_topic["id"]
        
        # Generate lesson content
        lesson_content = await self.generate_lesson_content(topic, main_topic, subtopic)
        
        # Store in our structure
        all_content[main_topic_id]["subtopics"][subtopic_id] = {
            "title": subtopic["title"],
            "description": lesson_content["description"],
            "content": lesson_content["content"]
        }

# For compatibility with synchronous code
def sync_wrapper(async_func):
    """Wrapper to call async functions from synchronous code"""
    def wrapper(*args, **kwargs):
        return asyncio.run(async_func(*args, **kwargs))
    return wrapper

# Create synchronous versions of the async methods
ContentGenerator.generate_all_lesson_content_sync = sync_wrapper(ContentGenerator.generate_all_lesson_content) 