# 📚 Cramly – AI-Powered Study Planner

Cramly is an AI-driven tool that helps students and learners convert raw study materials like PDFs, syllabi, or notes into organized, interactive study content. It intelligently generates structured study roadmaps, flashcards, and quizzes to streamline the learning process.

---

## 🚀 Features

- 📄 **Upload Study Material**: Upload PDFs or text content.
- 🧠 **AI-Powered Analysis**: Extracts topics and subtopics using LLMs.
- 📌 **Roadmap Generation**: Creates a sequential study plan.
- 🎴 **Flashcard Creation**: Generates question-answer pairs for quick review.
- ❓ **Quiz Generation**: Builds multiple-choice and short-answer quizzes.
- 🔎 **Semantic Search (optional)**: Ask questions directly from your uploaded content.

## 🌐 API Usage

Cramly provides a REST API for generating study roadmaps:

### Start the API server:

```
python api.py
```

### API Endpoints:

- **GET /**: Welcome message and API information
- **POST /generate-roadmap/**: Generate a study roadmap for a topic
  - Request body: `{"topic": "Your Study Topic"}`
  - Returns: JSON object with the complete roadmap

### Example API Request:

```bash
curl -X 'POST' \
  'http://localhost:8000/generate-roadmap/' \
  -H 'Content-Type: application/json' \
  -d '{"topic": "Machine Learning"}'
```

The API also provides interactive documentation at `http://localhost:8000/docs`.
