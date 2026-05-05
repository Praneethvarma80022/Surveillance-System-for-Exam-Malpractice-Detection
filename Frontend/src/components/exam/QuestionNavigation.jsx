import React from "react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { CheckCircle } from "lucide-react";

export default function QuestionNavigation({ currentQuestion, totalQuestions, answers, onQuestionChange }) {
  const isAnswered = (index) => {
    const entry = answers[index];
    if (!entry) return false;
    const value = entry.answer;
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
          Question Overview
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-800 border-slate-600 text-white">
        <div className="space-y-4">
          <h3 className="font-semibold">Question Progress</h3>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: totalQuestions }, (_, index) => {
              const answered = isAnswered(index);
              const isCurrent = index === currentQuestion;
              return (
                <Button
                  key={index}
                  size="sm"
                  variant={isCurrent ? "default" : "outline"}
                  className={`w-10 h-10 p-0 ${
                    isCurrent 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : answered 
                      ? "border-green-500 bg-green-500/20 hover:bg-green-500/30" 
                      : "border-slate-500 hover:bg-slate-700"
                  }`}
                  onClick={() => onQuestionChange(index)}
                >
                  {answered && !isCurrent ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </Button>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>
              Answered: {Object.keys(answers).filter((index) => isAnswered(Number(index))).length}/{totalQuestions}
            </span>
            <span>
              Remaining: {totalQuestions - Object.keys(answers).filter((index) => isAnswered(Number(index))).length}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}