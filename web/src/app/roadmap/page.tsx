"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import axios from "axios";

// Interface definitions
export interface Root {
  roadmap: Roadmap[];
}

export interface Roadmap {
  id: string;
  type: string;
  title: string;
  description: string;
  children: Children[];
}

export interface Children {
  id: string;
  type: string;
  title: string;
  description: string;
  content: string;
  children: Children2[];
}

export interface Children2 {
  id: string;
  type: string;
  title: string;
  cards?: Card[];
  questions?: Question[];
}

export interface Card {
  question?: string;
  answer?: string;
}

export interface Question {
  question: string;
  options: string[];
  correct: string;
}

// Define a node type for our roadmap visualization
type RoadmapNode = {
  id: string;
  title: string;
  type: "main_topic" | "topic" | "flashcards" | "quiz";
  parentId: string | null;
  description?: string;
  content?: string;
  cards?: Card[];
  questions?: Question[];
  completed?: boolean;
  locked?: boolean;
};

export default function RoadmapPage() {
  const [roadmapData, setRoadmapData] = useState<Root | null>(null);
  const [roadmapNodes, setRoadmapNodes] = useState<RoadmapNode[]>([]);
  const [activeNode, setActiveNode] = useState<RoadmapNode | null>(null);
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  // Process roadmap data into nodes
  const processRoadmapData = (data: Root) => {
    if (!data.roadmap || data.roadmap.length === 0) {
      setIsLoading(false);
      return;
    }

    setRoadmapData(data);
    const nodes: RoadmapNode[] = [];

    // Process all main topics and their children
    data.roadmap.forEach((mainTopic) => {
      // Add main topic as a node
      nodes.push({
        id: mainTopic.id,
        title: mainTopic.title,
        type: "main_topic" as const,
        parentId: null,
        description: mainTopic.description,
        completed: false,
        locked: false,
      });

      // Add topics, flashcards, and quizzes as nodes
      if (mainTopic.children && Array.isArray(mainTopic.children)) {
        mainTopic.children.forEach((topic) => {
          // Add the topic node (topic itself has content)
          nodes.push({
            id: topic.id,
            title: topic.title,
            type: "topic" as const,
            parentId: mainTopic.id,
            description: topic.description,
            content: topic.content,
            completed: false,
            locked: false,
          });

          // Add nodes for flashcards and quizzes (children of topics)
          if (topic.children && Array.isArray(topic.children)) {
            topic.children.forEach((child) => {
              if (child.type === "flashcards" && child.cards) {
                nodes.push({
                  id: child.id,
                  title: child.title,
                  type: "flashcards" as const,
                  parentId: topic.id,
                  cards: child.cards,
                  completed: false,
                  locked: false,
                });
              } else if (child.type === "quiz" && child.questions) {
                nodes.push({
                  id: child.id,
                  title: child.title,
                  type: "quiz" as const,
                  parentId: topic.id,
                  questions: child.questions,
                  completed: false,
                  locked: false,
                });
              }
            });
          }
        });
      }
    });

    // Sort nodes to ensure proper order based on IDs
    nodes.sort((a, b) => {
      // Handle undefined or non-string ids
      const aId = typeof a.id === "string" ? a.id : "";
      const bId = typeof b.id === "string" ? b.id : "";

      // Extract numeric parts from IDs for sorting
      const aIdParts = aId.split("-").map((part) => {
        const num = parseInt(part.replace(/\D/g, "") || "0");
        return isNaN(num) ? 0 : num;
      });
      const bIdParts = bId.split("-").map((part) => {
        const num = parseInt(part.replace(/\D/g, "") || "0");
        return isNaN(num) ? 0 : num;
      });

      // Compare each part
      for (let i = 0; i < Math.min(aIdParts.length, bIdParts.length); i++) {
        if (aIdParts[i] !== bIdParts[i]) {
          return aIdParts[i] - bIdParts[i];
        }
      }

      // If the common parts match, the shorter ID comes first
      return aIdParts.length - bIdParts.length;
    });

    setRoadmapNodes(nodes);
    setIsLoading(false);
  };

  const generateRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError("");

    try {
      console.log("Sending request to generate roadmap for:", topic.trim());

      const response = await axios.post(
        "http://localhost:1337/generate-roadmap-test/",
        {
          topic: topic.trim(),
        },
        { timeout: 60000 } // 60 second timeout
      );

      console.log("Received response:", response.data);

      // Update the roadmap data
      if (response.data && response.data.roadmap) {
        // Get the roadmap data based on structure
        const roadmapContent = Array.isArray(response.data.roadmap)
          ? response.data.roadmap
          : Array.isArray(response.data.roadmap.roadmap)
          ? response.data.roadmap.roadmap
          : [];

        // Create new roadmap data structure matching the expected format
        const newRoadmapData: Root = {
          roadmap: roadmapContent.map((mainTopic: any) => ({
            id:
              mainTopic.id || `main-${Math.random().toString(36).substr(2, 9)}`,
            type: mainTopic.type || "main_topic",
            title: mainTopic.title || "",
            description:
              mainTopic.description || `Study guide for ${response.data.topic}`,
            children: Array.isArray(mainTopic.children)
              ? mainTopic.children
              : [],
          })),
        };

        // If roadmapContent was empty, add a fallback structure
        if (newRoadmapData.roadmap.length === 0) {
          newRoadmapData.roadmap = [
            {
              id: "main-1",
              type: "main_topic",
              title: response.data.topic || "Java",
              description: `Study guide for ${response.data.topic || "Java"}`,
              children: [],
            },
          ];
        }

        console.log("Processed roadmap data:", newRoadmapData);
        setRoadmapData(newRoadmapData);
        processRoadmapData(newRoadmapData);
      }
    } catch (error) {
      console.error("Error generating roadmap:", error);
      let errorMessage = "Failed to generate roadmap. ";

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          errorMessage +=
            "Request timed out. The topic may be too complex or the server is busy.";
        } else if (error.code === "ERR_NETWORK") {
          errorMessage +=
            "Network error. Please check if the API server is running at http://localhost:1337.";
        } else if (error.response) {
          errorMessage +=
            error.response.data?.detail ||
            `Server error: ${error.response.status}`;
        } else {
          errorMessage += error.message;
        }
      } else if (error instanceof Error) {
        errorMessage += error.message;
      }

      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNodeClick = (node: RoadmapNode) => {
    setActiveNode(activeNode?.id === node.id ? null : node);
    setShowAnswer(false);
    setActiveFlashcardIndex(0);
  };

  const handleNextFlashcard = () => {
    if (
      activeNode?.cards &&
      activeFlashcardIndex < activeNode.cards.length - 1
    ) {
      setActiveFlashcardIndex(activeFlashcardIndex + 1);
      setShowAnswer(false);
    }
  };

  const handlePreviousFlashcard = () => {
    if (activeNode?.cards && activeFlashcardIndex > 0) {
      setActiveFlashcardIndex(activeFlashcardIndex - 1);
      setShowAnswer(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    if (activeNode && activeNode.questions) {
      setQuizAnswers({
        ...quizAnswers,
        [`${activeNode.id}-${questionIndex}`]: answer,
      });
    }
  };

  const getNodeColor = (node: RoadmapNode) => {
    const colors = {
      main_topic: "bg-purple-500 dark:bg-purple-600",
      topic: "bg-blue-500 dark:bg-blue-600",
      flashcards: "bg-indigo-500 dark:bg-indigo-600",
      quiz: "bg-green-500 dark:bg-green-600",
    };

    if (node.completed) {
      return "bg-gray-400 dark:bg-gray-600";
    }

    return colors[node.type] || "bg-gray-500";
  };

  const getNodeIcon = (node: RoadmapNode) => {
    switch (node.type) {
      case "main_topic":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        );
      case "topic":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 14l9-5-9-5-9 5 9 5z"></path>
            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998a12.078 12.078 0 01.665-6.479L12 14z"></path>
          </svg>
        );
      case "flashcards":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <path d="M12 10v4"></path>
            <path d="M12 18h.01"></path>
          </svg>
        );
      case "quiz":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
          </svg>
        );
      default:
        return null;
    }
  };

  // Get child nodes of a given parent node
  const getChildNodes = (parentId: string | null): RoadmapNode[] => {
    return roadmapNodes.filter((node) => node.parentId === parentId);
  };

  // Get main topics (nodes with null parentId)
  const getMainTopics = (): RoadmapNode[] => {
    return roadmapNodes.filter((node) => node.parentId === null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 font-[family-name:var(--font-geist-sans)]">
      <header className="bg-white dark:bg-gray-800 shadow-sm py-4 px-8 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {roadmapData?.roadmap[0]?.title || "Cramly Learning Path"}
          </h1>
          <Link
            href="/"
            className="text-blue-600 hover:underline flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Roadmap Generation Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Generate a New Learning Roadmap
            </h2>
            <form
              onSubmit={generateRoadmap}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="flex-1">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a topic to study (e.g., Machine Learning, History of Rome)"
                  className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  disabled={isGenerating}
                />
              </div>
              <button
                type="submit"
                disabled={isGenerating || !topic.trim()}
                className="bg-blue-600 text-white font-medium py-3 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
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

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {roadmapNodes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <h3 className="text-xl text-gray-700 dark:text-gray-300 mb-6">
                No roadmap available yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Generate your first learning roadmap by entering a topic above.
              </p>
              <div className="inline-block p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="text-blue-700 dark:text-blue-300 font-medium">
                  Example topics: Machine Learning, History of Rome, JavaScript
                  Fundamentals
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Two-column layout for roadmap and content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Full Roadmap View - Left column (8 of 12 columns on large screens) */}
                <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                    Complete Learning Roadmap
                  </h2>

                  {/* Main topics */}
                  <div className="space-y-12">
                    {getMainTopics().map((mainTopic) => (
                      <div
                        key={mainTopic.id}
                        className="border-b border-gray-200 dark:border-gray-700 pb-8 last:border-0"
                      >
                        <div className="flex items-center gap-4 mb-6">
                          <div
                            className={`
                            w-14 h-14 rounded-full flex items-center justify-center
                            ${getNodeColor(mainTopic)} text-white
                            shadow-lg
                          `}
                          >
                            {getNodeIcon(mainTopic)}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {mainTopic.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 text-sm">
                              {mainTopic.description}
                            </p>
                          </div>
                        </div>

                        {/* Topics under this main topic */}
                        <div className="ml-10 space-y-8">
                          {getChildNodes(mainTopic.id).map((topic) => (
                            <div key={topic.id} className="relative">
                              {/* Vertical line connecting topics */}
                              <div className="absolute top-0 bottom-0 left-7 w-0.5 bg-blue-200 dark:bg-blue-700"></div>

                              <div className="flex gap-6">
                                <div className="z-10">
                                  <div
                                    className={`
                                      w-14 h-14 rounded-full flex items-center justify-center
                                      ${getNodeColor(
                                        topic
                                      )} text-white cursor-pointer
                                      transform transition-all hover:scale-105
                                      ${
                                        activeNode?.id === topic.id
                                          ? "ring-4 ring-blue-400 dark:ring-blue-300"
                                          : ""
                                      }
                                    `}
                                    onClick={() => handleNodeClick(topic)}
                                  >
                                    {getNodeIcon(topic)}
                                  </div>
                                </div>

                                <div className="flex-1">
                                  <h4
                                    className="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                                    onClick={() => handleNodeClick(topic)}
                                  >
                                    {topic.title}
                                  </h4>
                                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                                    {topic.description}
                                  </p>

                                  {/* Topic children (flashcards, quizzes) */}
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {getChildNodes(topic.id).map((child) => (
                                      <button
                                        key={child.id}
                                        className={`
                                          flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                                          ${
                                            child.type === "flashcards"
                                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                              : ""
                                          }
                                          ${
                                            child.type === "quiz"
                                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                              : ""
                                          }
                                          hover:opacity-80 transition-opacity
                                          ${
                                            activeNode?.id === child.id
                                              ? "ring-2 ring-offset-1 ring-blue-400 dark:ring-blue-300"
                                              : ""
                                          }
                                        `}
                                        onClick={() => handleNodeClick(child)}
                                      >
                                        {getNodeIcon(child)}
                                        <span>{child.title}</span>
                                        {child.completed && (
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content Display Panel - Right column (4 of 12 columns on large screens) */}
                <div className="lg:col-span-5">
                  {activeNode ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm sticky top-24">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {activeNode.title}
                        </h3>
                        <button
                          onClick={() => setActiveNode(null)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {activeNode.type === "topic" && (
                        <div>
                          {activeNode.description && (
                            <p className="text-gray-600 dark:text-gray-300 mb-4 italic">
                              {activeNode.description}
                            </p>
                          )}
                          <div className="prose prose-sm md:prose lg:prose-lg dark:prose-invert max-w-none overflow-auto">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw, rehypeHighlight]}
                            >
                              {activeNode.content || ""}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {activeNode.type === "flashcards" && activeNode.cards && (
                        <div className="mt-4">
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 min-h-[200px] relative">
                            <div className="absolute top-2 right-2 text-sm text-gray-500 dark:text-gray-400">
                              {activeFlashcardIndex + 1} /{" "}
                              {activeNode.cards.length}
                            </div>

                            <div className="flex flex-col items-center justify-center">
                              <div className="text-center mb-4">
                                <div className="text-lg font-medium mb-4">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                                  >
                                    {activeNode.cards[activeFlashcardIndex]
                                      .question || ""}
                                  </ReactMarkdown>
                                </div>

                                <button
                                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                                  onClick={() => setShowAnswer(!showAnswer)}
                                >
                                  {showAnswer ? "Show Answer" : "Show Question"}
                                </button>
                              </div>

                              <div className="flex gap-4 mt-6">
                                <button
                                  className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50"
                                  onClick={handlePreviousFlashcard}
                                  disabled={activeFlashcardIndex === 0}
                                >
                                  Previous
                                </button>
                                <button
                                  className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50"
                                  onClick={handleNextFlashcard}
                                  disabled={
                                    activeFlashcardIndex ===
                                    activeNode.cards.length - 1
                                  }
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeNode.type === "quiz" && activeNode.questions && (
                        <div className="mt-4 space-y-6">
                          {activeNode.questions.map((question, qIndex) => (
                            <div
                              key={qIndex}
                              className="border dark:border-gray-700 rounded-lg p-4"
                            >
                              <div className="text-lg font-medium mb-3">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  rehypePlugins={[rehypeRaw]}
                                >
                                  {question.question}
                                </ReactMarkdown>
                              </div>
                              <div className="space-y-2">
                                {question.options.map((option, oIndex) => (
                                  <div
                                    key={oIndex}
                                    className="flex items-center"
                                  >
                                    <input
                                      type="radio"
                                      id={`question-${qIndex}-option-${oIndex}`}
                                      name={`question-${qIndex}`}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                      checked={
                                        quizAnswers[
                                          `${activeNode.id}-${qIndex}`
                                        ] === String.fromCharCode(65 + oIndex)
                                      }
                                      onChange={() =>
                                        handleAnswerSelect(
                                          qIndex,
                                          String.fromCharCode(65 + oIndex)
                                        )
                                      }
                                    />
                                    <label
                                      htmlFor={`question-${qIndex}-option-${oIndex}`}
                                      className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                      <span className="mr-1">
                                        {String.fromCharCode(65 + oIndex)}.
                                      </span>
                                      <span className="inline">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          rehypePlugins={[rehypeRaw]}
                                        >
                                          {option}
                                        </ReactMarkdown>
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              </div>

                              {quizAnswers[`${activeNode.id}-${qIndex}`] && (
                                <div
                                  className={`mt-4 p-2 rounded-md ${
                                    quizAnswers[
                                      `${activeNode.id}-${qIndex}`
                                    ] === question.correct
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                      : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                  }`}
                                >
                                  {quizAnswers[`${activeNode.id}-${qIndex}`] ===
                                  question.correct
                                    ? "Correct!"
                                    : `Incorrect. The correct answer is ${question.correct}.`}
                                </div>
                              )}
                            </div>
                          ))}

                          <div className="flex justify-end mt-4">
                            <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition">
                              Submit Quiz
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm text-center">
                      <div className="p-6">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No content selected
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Click on a topic, flashcard, or quiz item from the
                          roadmap to view its content.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
