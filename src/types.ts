export enum ExamType {
  CFA = "CFA",
  FRM = "FRM"
}

export type CFALevel = "Level_1" | "Level_2" | "Level_3";
export type FRMPart = "Part_1" | "Part_2";

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  stepByStepSolution: string;
  knowledgeAnalysis: string;
  examLogicInsight: string;
  pointsTested: string;
  difficulty: "Easy" | "Medium" | "Hard";
  dimension?: string; // e.g., "Level_A", "Level_B" etc.
}

export interface PracticeSet {
  id: string;
  examType: ExamType;
  subLevel: string; // "Level 1" or "Part 1" etc
  conceptInput: string;
  generatedAt: string;
  questions: Question[];
  targetDimension?: string;
}

export interface SavedPractice {
  id: string;
  practiceSet: PracticeSet;
  userAnswers: { [qId: string]: number }; // questionId -> selectedOptionIndex
  score: number; // percentage or correct count
  isCompleted: boolean;
  notes?: string;
  savedAt: string;
}

export interface GenerateRequest {
  examType: ExamType;
  level: string; // e.g. "Level 1", "Part 2"
  concept: string;
  count?: number; // default e.g. 3 questions
  dimension?: string; // selected target testing dimension
}
