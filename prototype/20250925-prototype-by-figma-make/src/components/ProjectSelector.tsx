import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Plus, Folder, Edit2, Trash2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color: string;
  dailyBudget: number; // minutes per day
  createdAt: Date;
}

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string;
  onProjectChange: (projectId: string) => void;
  onProjectsUpdate: (projects: Project[]) => void;
}

const PROJECT_COLORS = [
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
  { name: 'Indigo', value: 'indigo', class: 'bg-indigo-500' },
  { name: 'Red', value: 'red', class: 'bg-red-500' },
  { name: 'Yellow', value: 'yellow', class: 'bg-yellow-500' },
];

export function ProjectSelector({ projects, currentProjectId, onProjectChange, onProjectsUpdate }: ProjectSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('blue');
  const [newProjectBudget, setNewProjectBudget] = useState('8.0'); // hours
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const currentProject = projects.find(p => p.id === currentProjectId);

  const getColorClass = (color: string) => {
    const colorData = PROJECT_COLORS.find(c => c.value === color);
    return colorData?.class || 'bg-blue-500';
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;

    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      color: newProjectColor,
      dailyBudget: Math.round(parseFloat(newProjectBudget) * 60), // convert hours to minutes
      createdAt: new Date()
    };

    const updatedProjects = [...projects, newProject];
    onProjectsUpdate(updatedProjects);
    onProjectChange(newProject.id);
    
    setNewProjectName('');
    setNewProjectColor('blue');
    setNewProjectBudget('8.0');
    setIsDialogOpen(false);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectColor(project.color);
    setNewProjectBudget((project.dailyBudget / 60).toFixed(1)); // convert minutes to hours
    setIsDialogOpen(true);
  };

  const handleUpdateProject = () => {
    if (!editingProject || !newProjectName.trim()) return;

    const updatedProjects = projects.map(p => 
      p.id === editingProject.id 
        ? { 
            ...p, 
            name: newProjectName.trim(), 
            color: newProjectColor,
            dailyBudget: Math.round(parseFloat(newProjectBudget) * 60)
          }
        : p
    );

    onProjectsUpdate(updatedProjects);
    resetDialog();
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return; // Don't delete the last project
    
    const updatedProjects = projects.filter(p => p.id !== projectId);
    onProjectsUpdate(updatedProjects);
    
    // If deleting current project, switch to first remaining project
    if (projectId === currentProjectId) {
      onProjectChange(updatedProjects[0].id);
    }
  };

  const resetDialog = () => {
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectColor('blue');
    setNewProjectBudget('8.0');
    setIsDialogOpen(false);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getColorClass(currentProject?.color || 'blue')}`}></div>
              <Folder className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Project:</span>
            </div>
            
            <Select value={currentProjectId} onValueChange={onProjectChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getColorClass(project.color)}`}></div>
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={resetDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? 'Edit Project' : 'Create New Project'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Project Name</label>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        editingProject ? handleUpdateProject() : handleCreateProject();
                      }
                    }}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Color</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setNewProjectColor(color.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          newProjectColor === color.value 
                            ? 'border-primary shadow-md' 
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full ${color.class}`}></div>
                          <span className="text-sm">{color.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Daily Budget (hours)</label>
                  <Input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={newProjectBudget}
                    onChange={(e) => setNewProjectBudget(e.target.value)}
                    placeholder="8.0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Target hours per day for this project
                  </p>
                </div>

                {editingProject && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm text-muted-foreground mb-3">Manage Project</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpdateProject}
                        className="flex-1"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Save Changes
                      </Button>
                      {projects.length > 1 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            handleDeleteProject(editingProject.id);
                            resetDialog();
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={editingProject ? handleUpdateProject : handleCreateProject}
                    disabled={!newProjectName.trim()}
                    className="flex-1"
                  >
                    {editingProject ? 'Update Project' : 'Create Project'}
                  </Button>
                  <Button variant="outline" onClick={resetDialog}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick project actions */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-muted-foreground">Quick actions:</span>
          {projects.slice(0, 4).map((project) => (
            <Badge
              key={project.id}
              variant={project.id === currentProjectId ? "default" : "secondary"}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onProjectChange(project.id)}
            >
              <div className={`w-2 h-2 rounded-full mr-1 ${getColorClass(project.color)}`}></div>
              {project.name}
            </Badge>
          ))}
          {projects.length > 4 && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setIsDialogOpen(true)}>
              +{projects.length - 4} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}