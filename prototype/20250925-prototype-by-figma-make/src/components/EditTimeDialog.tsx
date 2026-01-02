import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Clock, Calendar } from 'lucide-react';

interface TaskEntry {
  id: string;
  task: string;
  tags: string[];
  projectId: string;
  duration: number;
  startTime: Date;
  endTime: Date;
}

interface EditTimeDialogProps {
  task: TaskEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: TaskEntry) => void;
}

export function EditTimeDialog({ task, isOpen, onClose, onSave }: EditTimeDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  React.useEffect(() => {
    if (task && isOpen) {
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);

      setStartDate(start.toISOString().split('T')[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split('T')[0]);
      setEndTime(end.toTimeString().slice(0, 5));
    }
  }, [task, isOpen]);

  const handleSave = () => {
    if (!task) return;

    const newStartTime = new Date(`${startDate}T${startTime}`);
    const newEndTime = new Date(`${endDate}T${endTime}`);

    if (newStartTime >= newEndTime) {
      alert('End time must be after start time');
      return;
    }

    const newDuration = Math.floor((newEndTime.getTime() - newStartTime.getTime()) / 1000);

    const updatedTask: TaskEntry = {
      ...task,
      startTime: newStartTime,
      endTime: newEndTime,
      duration: newDuration,
    };

    onSave(updatedTask);
    onClose();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getCurrentDuration = (): number => {
    if (!startDate || !startTime || !endDate || !endTime) return 0;

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (start >= end) return 0;

    return Math.floor((end.getTime() - start.getTime()) / 1000);
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Edit Time Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Task</p>
            <p className="truncate">{task.task}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Start Date
              </Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                End Date
              </Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {startDate && startTime && endDate && endTime && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">New Duration:</span>
                <span className="font-medium">{formatDuration(getCurrentDuration())}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-muted-foreground">Original Duration:</span>
                <span className="text-sm">{formatDuration(task.duration)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
