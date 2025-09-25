import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Folder, Clock, Calendar, Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

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

interface ProjectStatsProps {
  projects: Project[];
  taskHistory: TaskEntry[];
}

export function ProjectStats({ projects, taskHistory }: ProjectStatsProps) {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getColorClass = (color: string) => {
    const colorClasses = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
      pink: 'bg-pink-500',
      indigo: 'bg-indigo-500',
      red: 'bg-red-500',
      yellow: 'bg-yellow-500',
    };
    return colorClasses[color as keyof typeof colorClasses] || 'bg-blue-500';
  };

  const projectStats = projects.map(project => {
    const projectTasks = taskHistory.filter(task => task.projectId === project.id);
    const totalDuration = projectTasks.reduce((sum, task) => sum + task.duration, 0);
    const taskCount = projectTasks.length;
    
    // Get tasks from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentTasks = projectTasks.filter(task => task.startTime >= sevenDaysAgo);
    const recentDuration = recentTasks.reduce((sum, task) => sum + task.duration, 0);

    return {
      ...project,
      totalDuration,
      taskCount,
      recentDuration,
      recentTaskCount: recentTasks.length,
      averageTaskDuration: taskCount > 0 ? Math.round(totalDuration / taskCount) : 0
    };
  }).sort((a, b) => b.totalDuration - a.totalDuration);

  const totalTime = projectStats.reduce((sum, stat) => sum + stat.totalDuration, 0);
  const maxTime = Math.max(...projectStats.map(stat => stat.totalDuration));

  // Chart data for last 7 days with budget comparison
  const chartData = [];
  const budgetVsActualData = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    const dayData: any = { 
      day: dateStr,
      date: date.toISOString().split('T')[0]
    };
    
    let totalActual = 0;
    let totalBudget = 0;
    
    projects.forEach(project => {
      const dayTasks = taskHistory.filter(task => 
        task.projectId === project.id && 
        task.startTime.toDateString() === date.toDateString()
      );
      const dayDuration = dayTasks.reduce((sum, task) => sum + task.duration, 0);
      const dayMinutes = Math.round(dayDuration / 60);
      
      dayData[`${project.name}_actual`] = dayMinutes;
      dayData[`${project.name}_budget`] = project.dailyBudget;
      
      totalActual += dayMinutes;
      totalBudget += project.dailyBudget;
    });
    
    dayData.totalActual = totalActual;
    dayData.totalBudget = totalBudget;
    dayData.variance = totalActual - totalBudget;
    
    chartData.push(dayData);
    budgetVsActualData.push({
      date: dateStr,
      actual: totalActual,
      budget: totalBudget,
      variance: totalActual - totalBudget,
      variancePercent: totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget * 100) : 0
    });
  }

  if (taskHistory.length === 0) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="py-12 text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="mb-2">No Data Yet</h3>
          <p className="text-muted-foreground">Start tracking time to see project statistics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Time</p>
                <p className="text-2xl">{formatDuration(totalTime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl">{taskHistory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Folder className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Weekly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'totalBudget') return [`${value} min`, 'Budget'];
                    if (name === 'totalActual') return [`${value} min`, 'Actual'];
                    return [`${value} min`, name];
                  }}
                  labelStyle={{ color: 'var(--foreground)' }}
                  contentStyle={{ 
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="totalActual" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={3}
                  name="Actual Time"
                  dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="totalBudget" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Budget"
                  dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Budget vs Actual Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Daily Budget vs Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetVsActualData.map((day, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{day.date}</TableCell>
                  <TableCell className="text-right">{formatDuration(day.budget * 60)}</TableCell>
                  <TableCell className="text-right">{formatDuration(day.actual * 60)}</TableCell>
                  <TableCell className={`text-right ${day.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {day.variance >= 0 ? '+' : ''}{formatDuration(Math.abs(day.variance) * 60)}
                  </TableCell>
                  <TableCell className={`text-right ${day.variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {day.variancePercent >= 0 ? '+' : ''}{day.variancePercent.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    {day.variance >= 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Project Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Project Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectStats.map((project) => {
              const weeklyBudget = project.dailyBudget * 7;
              const weeklyActual = project.recentDuration / 60; // convert seconds to minutes
              const budgetProgress = weeklyBudget > 0 ? (weeklyActual / weeklyBudget) * 100 : 0;
              
              return (
                <div key={project.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getColorClass(project.color)}`}></div>
                      <span>{project.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {project.taskCount} tasks
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p>{formatDuration(project.totalDuration)}</p>
                      <p className="text-xs text-muted-foreground">
                        {((project.totalDuration / totalTime) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={(project.totalDuration / maxTime) * 100} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Daily budget: {formatDuration(project.dailyBudget * 60)}</span>
                    <span>Weekly: {formatDuration(project.recentDuration)} / {formatDuration(weeklyBudget * 60)} ({budgetProgress.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}