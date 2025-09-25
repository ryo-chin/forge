import React, { useState, useEffect } from 'react';
import { TimerDisplay } from './components/TimerDisplay';
import { TaskHistory } from './components/TaskHistory';
import { TagPreview } from './components/TagPreview';
import { ProjectSelector } from './components/ProjectSelector';
import { ProjectStats } from './components/ProjectStats';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Play, Pause, Square } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color: string;
  dailyBudget: number; // minutes per day
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

export default function App() {
  const [currentTask, setCurrentTask] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [taskHistory, setTaskHistory] = useState<TaskEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  useEffect(() => {
    // Load task history
    const savedTasks = localStorage.getItem('taskHistory');
    if (savedTasks) {
      const parsed = JSON.parse(savedTasks);
      setTaskHistory(parsed.map((entry: any) => ({
        ...entry,
        startTime: new Date(entry.startTime),
        endTime: new Date(entry.endTime),
        projectId: entry.projectId || 'default' // Migration for old entries
      })));
    }

    // Load projects
    const savedProjects = localStorage.getItem('projects');
    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      const projectsWithDates = parsed.map((project: any) => ({
        ...project,
        dailyBudget: project.dailyBudget || 480, // Migration for old projects
        createdAt: new Date(project.createdAt)
      }));
      setProjects(projectsWithDates);
      
      // Set current project to first project or create default
      if (projectsWithDates.length > 0) {
        setCurrentProjectId(projectsWithDates[0].id);
      } else {
        createDefaultProject();
      }
    } else {
      createDefaultProject();
    }
  }, []);

  const createDefaultProject = () => {
    const defaultProject: Project = {
      id: 'default',
      name: 'General',
      color: 'blue',
      dailyBudget: 480, // 8 hours default
      createdAt: new Date()
    };
    setProjects([defaultProject]);
    setCurrentProjectId('default');
    localStorage.setItem('projects', JSON.stringify([defaultProject]));
  };

  const startTimer = () => {
    if (!currentTask.trim() || !currentProjectId) return;
    
    const now = new Date();
    setStartTime(now);
    setElapsedTime(0);
    setIsRunning(true);
  };

  const parseTaskAndTags = (input: string) => {
    const tagRegex = /#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
    const tags = (input.match(tagRegex) || []).map(tag => tag.slice(1)); // Remove # prefix
    const task = input.replace(tagRegex, '').trim();
    return { task, tags };
  };

  const stopTimer = () => {
    if (!startTime || !currentTask.trim() || !currentProjectId) return;
    
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const { task, tags } = parseTaskAndTags(currentTask);
    
    const newEntry: TaskEntry = {
      id: Date.now().toString(),
      task: task || currentTask, // Fallback to original if no task after tag removal
      tags,
      projectId: currentProjectId,
      duration,
      startTime,
      endTime
    };
    
    const updatedHistory = [newEntry, ...taskHistory];
    setTaskHistory(updatedHistory);
    localStorage.setItem('taskHistory', JSON.stringify(updatedHistory));
    
    setIsRunning(false);
    setStartTime(null);
    setElapsedTime(0);
    setCurrentTask('');
  };

  const resetTimer = () => {
    setIsRunning(false);
    setStartTime(null);
    setElapsedTime(0);
    setCurrentTask('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isRunning) {
      startTimer();
    }
  };

  const handleProjectChange = (projectId: string) => {
    setCurrentProjectId(projectId);
  };

  const handleProjectsUpdate = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    localStorage.setItem('projects', JSON.stringify(updatedProjects));
  };

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentProjectTasks = taskHistory.filter(task => task.projectId === currentProjectId);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-16">
          <h1 className="mb-2">Simple Time Tracker</h1>
          <p className="text-muted-foreground">Track your time with ease</p>
        </div>

        {/* Project Selector */}
        <div className="mb-8">
          <ProjectSelector
            projects={projects}
            currentProjectId={currentProjectId}
            onProjectChange={handleProjectChange}
            onProjectsUpdate={handleProjectsUpdate}
          />
        </div>

        {/* Main Timer Section */}
        <div className="text-center mb-12">
          <div className="mb-8">
            <TimerDisplay elapsedTime={elapsedTime} isRunning={isRunning} />
          </div>

          {/* Google-style search input */}
          <div className="max-w-lg mx-auto mb-6">
            <div className="relative">
              <Input
                type="text"
                placeholder="What are you working on? (Use #tags for categorization)"
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isRunning || !currentProjectId}
                className="w-full h-14 px-6 text-center border-2 rounded-full shadow-lg hover:shadow-xl transition-shadow focus:shadow-xl"
              />
            </div>
            <TagPreview input={currentTask} />
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center gap-4">
            {!isRunning ? (
              <Button
                onClick={startTimer}
                disabled={!currentTask.trim() || !currentProjectId}
                size="lg"
                className="rounded-full px-8 h-12"
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            ) : (
              <>
                <Button
                  onClick={stopTimer}
                  size="lg"
                  className="rounded-full px-8 h-12"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                <Button
                  onClick={resetTimer}
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 h-12"
                >
                  Reset
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs for History and Stats */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
            <TabsTrigger value="history">Task History</TabsTrigger>
            <TabsTrigger value="stats">Project Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <TaskHistory 
              taskHistory={currentProjectTasks}
              projects={projects}
              onClearHistory={() => {
                const updatedHistory = taskHistory.filter(task => task.projectId !== currentProjectId);
                setTaskHistory(updatedHistory);
                localStorage.setItem('taskHistory', JSON.stringify(updatedHistory));
              }}
              onTaskUpdate={(updatedTask) => {
                const updatedHistory = taskHistory.map(task => 
                  task.id === updatedTask.id ? updatedTask : task
                );
                setTaskHistory(updatedHistory);
                localStorage.setItem('taskHistory', JSON.stringify(updatedHistory));
              }}
            />
          </TabsContent>

          <TabsContent value="stats">
            <ProjectStats
              projects={projects}
              taskHistory={taskHistory}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}