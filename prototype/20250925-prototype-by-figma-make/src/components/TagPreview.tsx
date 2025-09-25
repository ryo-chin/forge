import React from 'react';
import { Badge } from './ui/badge';
import { Tag } from 'lucide-react';

interface TagPreviewProps {
  input: string;
}

export function TagPreview({ input }: TagPreviewProps) {
  const parseTaskAndTags = (input: string) => {
    const tagRegex = /#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
    const tags = (input.match(tagRegex) || []).map(tag => tag.slice(1)); // Remove # prefix
    const task = input.replace(tagRegex, '').trim();
    return { task, tags };
  };

  const getTagColor = (tag: string): string => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-yellow-100 text-yellow-800',
      'bg-red-100 text-red-800',
    ];
    
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const { task, tags } = parseTaskAndTags(input);

  if (!input.trim() || tags.length === 0) {
    return null;
  }

  return (
    <div className="max-w-lg mx-auto mt-2 p-3 bg-card border rounded-lg shadow-sm">
      <div className="text-sm text-muted-foreground mb-2">Preview:</div>
      <div className="space-y-2">
        {task && (
          <div>
            <span className="text-sm text-foreground">Task: </span>
            <span className="text-sm">{task}</span>
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">Tags: </span>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, index) => (
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
          </div>
        )}
      </div>
    </div>
  );
}