import React, { useEffect } from "react";
import { Clock } from "lucide-react";

export default function ExamTimer({ timeRemaining, onTimeUp, setTimeRemaining }) {
  useEffect(() => {
    if (timeRemaining === null || timeRemaining === undefined) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev === undefined) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, onTimeUp, setTimeRemaining]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeRemaining < 300) return "text-red-400"; // Last 5 minutes
    if (timeRemaining < 600) return "text-amber-400"; // Last 10 minutes
    return "text-white";
  };

  return (
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4" />
      <span className={`font-mono text-lg font-bold ${getTimeColor()}`}>
        {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
      </span>
    </div>
  );
}