import argparse
import os
from dotenv import load_dotenv
from topic_generator import TopicGenerator
from content_generator import ContentGenerator
from assessment_generator import AssessmentGenerator

def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Generate a study roadmap for any subject")
    parser.add_argument("--topic", type=str, help="Subject to generate a topic structure for")
    args = parser.parse_args()
    
    topic = args.topic
    if not topic:
        topic = input("Enter a subject to generate a topic structure for: ")
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables. Please check your .env file.")
    
    # Step 1: Generate topic structure
    print("\n🔍 STEP 1: Generating topic structure...")
    topic_generator = TopicGenerator(api_key)
    topic_structure = topic_generator.generate_topic_structure(topic)
    
    # Step 2: Generate lesson content for each subtopic
    print("\n📝 STEP 2: Generating lesson content...")
    content_generator = ContentGenerator(api_key)
    lesson_content = content_generator.generate_all_lesson_content(topic, topic_structure)
    
    # Step 3: Generate flashcards and quiz questions and build roadmap
    print("\n📚 STEP 3: Generating flashcards and quizzes...")
    assessment_generator = AssessmentGenerator(api_key)
    roadmap = assessment_generator.enhance_all_content(topic, topic_structure, lesson_content)
    
    print("\n✨ Success! Generated complete study roadmap with lessons, flashcards, and quizzes.")
    print(f"📂 Final roadmap saved to: output/{topic.lower()}_roadmap.json")

if __name__ == "__main__":
    main()

