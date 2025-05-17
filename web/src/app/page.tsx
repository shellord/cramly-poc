"use client";

import { useState } from "react";
import axios from "axios";

interface RoadmapResult {
  status: string;
  topic: string;
  roadmap: Record<string, unknown>;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RoadmapResult | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      console.log("Sending request to generate roadmap for:", topic.trim());

      // Try to use the proxy first, then fall back to direct connection if needed
      let response;
      try {
        response = await axios.post(
          "/api/generate-roadmap/",
          {
            topic: topic.trim(),
          },
          { timeout: 10000 } // 10 second timeout
        );
      } catch (proxyError) {
        console.log(
          "Proxy request failed, trying direct connection:",
          proxyError
        );
        // Try direct connection as fallback
        response = await axios.post(
          "http://localhost:8000/generate-roadmap/",
          {
            topic: topic.trim(),
          },
          { timeout: 60000 } // 60 second timeout for direct connection
        );
      }

      console.log("Received response:", response.data);
      setResult(response.data);
    } catch (err: unknown) {
      console.error("Error generating roadmap:", err);
      let errorMessage = "Failed to generate roadmap. ";

      if (axios.isAxiosError(err)) {
        if (err.code === "ECONNABORTED") {
          errorMessage +=
            "Request timed out. The topic may be too complex or the server is busy.";
        } else if (err.code === "ERR_NETWORK") {
          errorMessage +=
            "Network error. Please check if the API server is running at http://localhost:8000.";
        } else if (err.response) {
          errorMessage +=
            err.response.data?.detail || `Server error: ${err.response.status}`;
        } else {
          errorMessage += err.message;
        }
      } else if (err instanceof Error) {
        errorMessage += err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 pb-20 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold">Cramly - AI Study Roadmap</h1>
          <p className="text-lg max-w-[600px]">
            Generate personalized study plans, flashcards, and quizzes for any
            topic
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="topic" className="block text-sm font-medium mb-2">
                Enter a Topic to Study
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Machine Learning, Biology, European History"
                className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className="bg-blue-600 text-white font-medium py-3 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Roadmap"
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              Study Roadmap for: {result.topic}
            </h2>
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(result.roadmap, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">How it works:</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Enter any topic you want to learn about</li>
            <li>
              Our AI analyzes the topic and creates a structured learning plan
            </li>
            <li>
              Get a complete roadmap with lessons, flashcards, and quizzes
            </li>
            <li>Start learning with a personalized path</li>
          </ol>
        </div>
      </main>

      <footer className="mt-12 flex gap-[24px] flex-wrap items-center justify-center">
        <span>© {new Date().getFullYear()} Cramly. All rights reserved.</span>
        <a
          className="text-blue-500 hover:underline"
          href="https://github.com/yourusername/cramly"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </footer>
    </div>
  );
}
