import React from 'react';

interface TimerDisplayProps {
  elapsedTime: number;
  isRunning: boolean;
}

export function TimerDisplay({ elapsedTime, isRunning }: TimerDisplayProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      <div
        className={`text-6xl font-mono transition-colors duration-300 ${
          isRunning ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        {formatTime(elapsedTime)}
      </div>
      {isRunning && (
        <div className="absolute -top-2 -right-2">
          <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
}
