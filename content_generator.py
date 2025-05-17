import json
import os
import time
from openai import OpenAI

# Lesson content schema definition
LESSON_CONTENT_SCHEMA = {
    "name": "generate_lesson_content",
    "description": "Generates detailed educational content for a specific subtopic",
    "parameters": {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "A concise 1-2 sentence summary of the subtopic"
            },
            "content": {
                "type": "string",
                "description": "Detailed educational content (300+ words) about the subtopic. Explain everything a person  needs to learn about the subtopic."
            }
        },
        "required": ["description", "content"]
    }
}

class ContentGenerator:
    def __init__(self, api_key):
        """Initialize the ContentGenerator with an OpenAI API key"""
        self.client = OpenAI(api_key=api_key)
        self.output_dir = "output"
        os.makedirs(self.output_dir, exist_ok=True)
    
    def generate_lesson_content(self, topic, main_topic, subtopic):
        """Generate detailed lesson content for a specific subtopic"""
        subtopic_title = subtopic["title"]
        main_topic_title = main_topic["title"]
        
        print(f"Generating lesson content for: {subtopic_title}...")
        
        system_prompt = """You are an expert educator creating high-quality, comprehensive learning materials.

Your task is to create detailed lesson content for a specific topic. The content should be:

1. Educational and informative with accurate information
2. Well-structured with clear sections
3. Engaging and accessible to learners
4. Practical with real-world applications or examples
5. Comprehensive, covering key aspects of the topic"""
        
        prompt = f"""Create a detailed lesson on the subtopic "{subtopic_title}" within the main topic "{main_topic_title}" for the subject "{topic}".

Your lesson should include:

1. A clear introduction that defines the concept and its importance
2. Core principles and key components explained thoroughly
3. Real-world applications or examples that illustrate the concept
4. Common challenges or misconceptions addressed
5. Best practices or tips when applicable
6. Code examples or technical details if relevant to the subject
7. Connections to related concepts within the field
8. A brief summary that reinforces the key takeaways

The content should be approximately 300-500 words, technically accurate, and written at an appropriate level for someone learning this subject.
explain each subtopics this could have multiple subtopics
"""
        
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
                    tools=[{"type": "function", "function": LESSON_CONTENT_SCHEMA}],
                    tool_choice={"type": "function", "function": {"name": "generate_lesson_content"}}
                )
                
                # Extract the function arguments from the response
                function_args = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
                
                # Save result to nested directory structure
                subtopic_dir = f"{self.output_dir}/{topic.lower()}/{main_topic['id']}"
                os.makedirs(subtopic_dir, exist_ok=True)
                
                output_file = f"{subtopic_dir}/{subtopic['id']}_lesson.json"
                with open(output_file, "w") as f:
                    json.dump(function_args, f, indent=2)
                
                print(f"✅ Generated lesson content for: {subtopic_title}")
                return function_args
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Error generating content for {subtopic_title}: {str(e)}. Retrying ({attempt+1}/{max_retries})...")
                    time.sleep(2)  # Wait before retrying
                else:
                    print(f"Failed after {max_retries} attempts for {subtopic_title}: {str(e)}")
                    # Return minimal content as fallback
                    return {
                        "description": f"An overview of {subtopic_title} within {main_topic_title}.",
                        "content": f"Content generation failed for {subtopic_title}. Please try regenerating this content."
                    }
    
    def generate_all_lesson_content(self, topic, topic_structure):
        """Generate lesson content for all subtopics in the topic structure"""
        print(f"\n🔄 Generating lesson content for all subtopics in {topic}...")
        
        all_content = {}
        
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
                subtopic_id = subtopic["id"]
                
                # Generate lesson content
                lesson_content = self.generate_lesson_content(topic, main_topic, subtopic)
                
                # Store in our structure
                all_content[main_topic_id]["subtopics"][subtopic_id] = {
                    "title": subtopic["title"],
                    "description": lesson_content["description"],
                    "content": lesson_content["content"]
                }
                
                # Add a small delay to avoid rate limiting
                time.sleep(0.5)
        
        # Save the complete content structure
        output_file = f"{self.output_dir}/{topic.lower()}_content.json"
        with open(output_file, "w") as f:
            json.dump(all_content, f, indent=2)
        
        print(f"\n✅ All lesson content generated and saved to: {output_file}")
        return all_content 