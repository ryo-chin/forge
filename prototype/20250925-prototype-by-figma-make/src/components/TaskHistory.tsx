import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { EditTimeDialog } from './EditTimeDialog';
import { Trash2, Calendar, Clock, Tag, Edit } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

interface TaskEntry {
  id: string;
  task: string;
  tags: string[];
  projectId: string;
  duration: number;
  startTime: Date;
  endTime: Date;
}

interface TaskHistoryProps {
  taskHistory: TaskEntry[];
  projects: Project[];
  onClearHistory: () => void;
  onTaskUpdate: (updatedTask: TaskEntry) => void;
}

export function TaskHistory({ taskHistory, projects, onClearHistory, onTaskUpdate }: TaskHistoryProps) {
  const [editingTask, setEditingTask] = useState<TaskEntry | null>(null);
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const getTotalDuration = (): string => {
    const total = taskHistory.reduce((sum, entry) => sum + entry.duration, 0);
    return formatDuration(total);
  };

  const getTagColor = (tag: string): string => {
    // Generate consistent colors based on tag name
    const colors = [
      'bg-blue-100 text-blue-800 hover:bg-blue-200',
      'bg-green-100 text-green-800 hover:bg-green-200',
      'bg-purple-100 text-purple-800 hover:bg-purple-200',
      'bg-orange-100 text-orange-800 hover:bg-orange-200',
      'bg-pink-100 text-pink-800 hover:bg-pink-200',
      'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
      'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      'bg-red-100 text-red-800 hover:bg-red-200',
    ];
    
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (taskHistory.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No time entries yet. Start tracking your first task!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Time Entries
          {projects.length > 0 && taskHistory.length > 0 && (
            <Badge variant="outline" className="ml-2">
              {projects.find(p => p.id === taskHistory[0]?.projectId)?.name || 'Current Project'}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="px-3 py-1">
            Total: {getTotalDuration()}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {taskHistory.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate pr-4">{entry.task}</p>
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className={`text-xs px-2 py-0.5 ${getTagColor(tag)}`}
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-muted-foreground">
                  {formatDate(entry.startTime)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {formatDuration(entry.duration)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setEditingTask(entry)}
              >
                <Edit className="w-4 h-4 text-muted-foreground hover:text-primary" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
      
      <EditTimeDialog
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={onTaskUpdate}
      />
    </Card>
  );
}